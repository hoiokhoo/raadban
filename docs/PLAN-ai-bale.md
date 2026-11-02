# پرامپت اجرایی حرفه‌ای — جمینی پیش‌فرض، زنجیره انتقال خطا، گزارش نیم‌ساعته به بله

> سند طرح (Pseudocode Plan) برای سامانه «رصدبان» — پیش از اجرا نوشته شده تا اجرا و تست طبق همین قرارداد انجام شود.
> اصل صراحت در تمام طراحی رعایت می‌شود: هیچ داده‌ای ساختگی نیست؛ هر شکست، شفاف گزارش می‌شود.

---

## ۰) وضعیت سنجیده‌شده (پیش از اجرا — تست واقعی)

| آزمون زنده | نتیجه واقعی | استنتاج |
|---|---|---|
| `POST generativelanguage.googleapis.com/v1beta/openai/chat/completions` با کلید کاربر | احراز هویت موفق؛ سپس `400 FAILED_PRECONDITION — User location is not supported` | کلید **معتبر** است اما گوگل درخواست از IP این سرور را تحریم جغرافیایی می‌کند |
| `getMe` بات بله | `{"ok":true,"result":{"id":1168268645,"username":"ainewsallbot"}}` | توکن بات بله کاملاً فعال است |
| `sendMessage` به `@ainewsallbot` | `404 — no such group or user` | بات بله فقط به **شناسه عددی چت** ارسال می‌کند؛ کشف خودکار شناسه الزامی است |

**تصمیم طراحی:** جمینی به‌عنوان تأمین‌کنندهٔ **اول زنجیره** می‌نشیند (پیش‌فرض). هر خطای جمینی — از جمله تحریم جغرافیایی، ۴۲۹، تایم‌اوت — در کمتر از یک ثانیه زنجیره را به مدل بعدی یعنی **GLM-4** می‌رساند. روی سروری که تحریم جغرافیایی گوگل نداشته باشد، جمینی بدون هیچ تغییری عملاً پاسخ‌گو می‌شود.

---

## ۱) زنجیرهٔ هوش مصنوعی با انتقال خودکار خطا

```
زنجیرهٔ نهایی:
  ۱. gemini  (پیش‌فرض)  → OpenAI-compatible: generativelanguage.googleapis.com/v1beta/openai
  ۲. zai     (GLM-4)    → سرویس داخلی
  ۳. pollinations       → رایگان بدون کلید (پشتیبان)
  ۴. سایر تأمین‌کنندگان کلیددار (groq / openrouter / nvidia / github / together)
```

```
PSEUDOCODE — buildDefaultChain(env, keysFromSettings):
  chain = []
  chain += Provider(gemini, base=GEMINI_BASE, model=GEMINI_MODEL|'gemini-3.8-flash',
                    key=env.GEMINI_API_KEY || keys.gemini,
                    enabled = key موجود است)
  chain += Provider(zai, enabled=true)          # GLM — پشتیبان اول
  chain += Provider(pollinations, enabled=true) # پشتیبان رایگان
  for spec in FREE_PROVIDERS:
      chain += Provider(spec, enabled = key(spec) موجود است)
  return chain

PSEUDOCODE — getProviderKeys():            # کلیدهای افزوده‌شده از رابط کاربری
  row = Setting['ai_provider_keys']        # JSON: { providerId: کلید رمزنگاری‌شده }
  return { providerId: decrypt(v) for each }

PSEUDOCODE — تزریق کلید:
  هر Provider با key خالی ← اگر keys[provider.id] هست، جایگزین و فعال می‌شود
```

قواعد رفتار خطا (بدون تغییر از معماری موجود):
- ۴۲۹ → انتظار و تلاش مجدد روی همان مدل، سپس مدل بعدی؛
- خطای دیگر (۴۰۰ تحریم جغرافیایی، ۵xx، تایم‌اوت) → بی‌درنگ مدل بعدی؛
- شکست همه → خطای تجمیعی صادقانه با دلیل تک‌تک تلاش‌ها؛ **هرگز پاسخ ساختگی نه.**

## ۲) مدیریت کلید API از رابط کاربری + نمایش مانده/مصرف توکن

```
PSEUDOCODE — POST /api/ai/keys  {providerId, apiKey}
  اعتبارسنجی طول ۸..۳۰۰ → encrypt → Setting['ai_provider_keys'][providerId] = encrypted
PSEUDOCODE — DELETE /api/ai/keys {providerId}   → حذف کلید
PSEUDOCODE — GET  /api/ai/keys
  برای هر تأمین‌کنندهٔ زنجیره:
    { id, label, enabled, hasKey(masked), model,
      usedTodayTokens  = Σ estTokens(AiUsage امروز، موفق)
      successCount / failCount امروز
      lastError / lastSuccessAt }
  برای openrouter با کلید: GET api.openrouter.ai/key → ماندهٔ واقعی (در شکست: «نامشخص» صادقانه)
```

قاعدهٔ امنیتی: کلید هرگز به مرورگر برنمی‌گردد — فقط ماسک (`AQ.…kuXA`).

## ۳) بات بله — ارسال گزارش

```
PSEUDOCODE — bale-bot.ts
  token = env.BALE_BOT_TOKEN || decrypt(Setting['bale_bot_token'])
  api(method, payload) = POST https://tapi.bale.ai/bot{token}/{method}

  ensureChatId():
    اگر Setting['bale_chat_id'] هست → همان
    وگرنه getUpdates() → نخستین chat.id یافت‌شده → ذخیره → بازگشت
    اگر هیچ گفت‌وگویی نبود → {ok:false, error:'هنوز کسی به بات پیام نداده — دکمهٔ Start را بزنید'}

  sendMessage(text):
    تفکیک به قطعه‌های ≤۳۵۰۰ نویسه؛ parse_mode='HTML'
    ۴۲۹ → انتظار طبق retry_after و تلاش مجدد؛ سایر خطا → صادقانه بازگشت

PSEUDOCODE — POST /api/bale  {action:'test'|'save'|'clear', token?, chatId?}
  test → getMe + sendMessage(«تست اتصال رصدبان»)
  save → رمزنگاری توکن/شناسه چت در Setting
```

## ۴) خط تولید نیم‌ساعتهٔ خودکار (دریافت → خلاصه/ترجمه → راستی‌آزمایی → گزارش بی‌طرف → بله)

```
PSEUDOCODE — scheduler.tick() اضافهٔ جدید:
  اگر Setting['bale_digest'].enabled و (اکنون − lastRun ≥ intervalMin=۳۰ دقیقه):
     job 'bale:digest' با قفل ضدرنامزدی:
       ۱. ingestAll()                       # دریافت تازه‌ترین اخبار همهٔ منابع فعال
       ۲. processPendingPosts(4)            # استخراج ادعا، موضوع، خوشه
       ۳. posts = ۱۵ پست تازهٔ بازهٔ از آخرین ارسال
       ۴. برای حداکثر ۳ پست غیرفارسی بدون ترجمه → translatePost()   # ترجمهٔ روان
       ۵. verdicts = ادعاهای همین پست‌ها با وضعیت راستی‌آزمایی موجود
          (ادعای بدون حکم → «در انتظار بررسی» صادقانه)
       ۶. aiCall(purpose='گزارش', priority='background'):
            سیستم‌پرامپت: بی‌طرفی کامل، بدون جهت‌گیری،
            نقل‌قول‌ها عیناً و به فارسی روان و سلیس،
            ذکر منبع و زمان هر خبر، نتیجهٔ راستی‌آزمایی هر ادعا،
            اگر شواهد ناکافی: «تأییدنشده» — نه حکم شتاب‌زده
       ۷. sendMessage(گزارش) به بله → ثبت lastSentAt و آمار در JobRun
  شکست هر گام: خطا در JobRun ثبت و ارسال انجام نمی‌شود (بدون گزارش ساختگی)
```

نکته: ترجمهٔ نقل‌قول‌ها «عیناً» یعنی مدل مجاز به حذف/تلقین نیست؛ SYSTEM_TRANSLATE و پرامپت گزارش هر دو با بند «نقل‌قول عیناً» مقویت می‌شوند.

## ۵) معیار پذیرش (Acceptance Criteria) — وضعیت اجرا

| # | معیار | وضعیت واقعی |
|---|---|---|
| ۱ | `GET /api/ai/providers` → جمینی اولِ زنجیره | ✅ زنده تأیید شد — جمینی اول با ماسک کلید و آخرین خطا (تحریم جغرافیایی/سهمیه)، GLM دوم |
| ۲ | فیل‌اور خودکار جمینی→GLM-4 | ✅ زنده: ارزیابی ادعا `ok:true` با انتقال خودکار؛ خنک‌کنندهٔ ۵ دقیقه‌ای تحریم جغرافیایی و ۴ دقیقه‌ای سهمیه اضافه شد |
| ۳ | افزودن کلید از UI + مصرف توکن | ✅ `/api/ai/keys` — رمزنگاری‌شده، ماسک، منبع کلید، مصرف امروز؛ ماندهٔ واقعی OpenRouter |
| ۴ | تست بات بله | ✅ `getMe` زنده موفق؛ ارسال پس از کشف شناسه چت — **نیازمند Start یک‌بارهٔ کاربر در بله** (محدودیت واقعی Bot API) |
| ۵ | زمان‌بند نیم‌ساعته | ✅ اجرای زندهٔ کامل یک چرخه (۸٫۴ دقیقه در شرایط اشباع ۴۲۹) با ثبت JobRun؛ ارسال به‌دلیل Start نشدن بات صادقانه ناموفق ثبت شد |
| ۶ | `bun test` سبز + lint | ✅ ۱۵۶/۱۵۷ — تنها استثنا: تست گزارش شبانه وابسته به ظرفیت زندهٔ مدل‌ها (در لحظهٔ اجرا هر سه مدل رایگان ۴۲۹ بودند)؛ lint بدون خطا |
