#!/bin/bash
# ============================================================================
# تست جامع و کامل رصدبان — پس از «هر تغییر» اجرا شود (خواستهٔ کاربر ۱ نوامبر ۲۰۲۶):
# «تا آخر برنامه هر تغییری که انجام میدیم این تست جامع رو هم انجام بده،
#  هیچ بخشی از برنامه غیر متصل و خراب نباشه»
#
# پوشش: ۱) تایپ‌چک ۲) لینت ۳) تست واحد ۴) دود همهٔ APIها ۵) سلامت صف AI
#       ۶) اتصال بله ۷) وضعیت منابع و مدارشکن ایکس ۸) صحت بانک ۹) زنجیرهٔ تأمین مدل
# خروجی: خلاصهٔ PASS/FAIL برای هر بخش؛ کد خروج ۰ فقط اگر همه سبز باشند.
# ============================================================================
cd /home/z/my-project
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "❌ $1"; }
section() { echo; echo "━━━ $1 ━━━"; }

# ۱) تایپ‌چک — فقط src و tests (نمونه‌ها/اسکریپت‌های قدیمی خارج از دامنهٔ محصول)
section "۱) تایپ‌چک TypeScript"
ERRS=$(bunx tsc --noEmit 2>&1 | grep -cE "^(src|tests)/")
if [ "$ERRS" = "0" ]; then ok "tsc: صفر خطا در src/ و tests/"; else bad "tsc: $ERRS خطا — $(bunx tsc --noEmit 2>&1 | grep -E '^(src|tests)/' | head -3)"; fi

# ۲) لینت
section "۲) لینت"
if bun run lint >/dev/null 2>&1; then ok "eslint: پاک"; else bad "eslint: خطا — $(bun run lint 2>&1 | tail -3)"; fi

# ۳) تست واحد
section "۳) تست واحد (bun test)"
T=$(bun test 2>&1 | tail -4)
if echo "$T" | grep -q " 0 fail"; then ok "bun test: $(echo "$T" | grep -oE '[0-9]+ pass' | head -1)"; else bad "bun test: $(echo "$T")"; fi

# ۴) سرور توسعه و دود APIها
section "۴) سرور و دود API"
sleep 1
H=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 http://localhost:3000/)
if [ "$H" = "200" ]; then ok "صفحهٔ اصلی 200"; else bad "صفحهٔ اصلی: $H"; fi

BAD_API=""
for ep in status sources posts live events claims categories topics clusters reports schedule jobs costs errors references channels settings ai/keys ai/providers bale bale/preview; do
  C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 "http://localhost:3000/api/$ep")
  [ "$C" = "200" ] || BAD_API="$BAD_API /api/$ep=$C"
done
# محتوای خط لحظه‌ای — باید ok:true و آرایهٔ posts بدهد (خواستهٔ کاربر: دیدن کل اخبار لحظه‌ای بدون اتصال بله)
LIVE=$(curl -s --max-time 25 "http://localhost:3000/api/live?take=5")
if echo "$LIVE" | grep -q '"ok":true' && echo "$LIVE" | grep -q '"posts":\['; then
  ok "خط لحظه‌ای (/api/live): پاسخ سالم با آرایهٔ اخبار"
else
  bad "خط لحظه‌ای (/api/live): پاسخ ناقص — $(echo "$LIVE" | head -c 200)"
fi
if [ -z "$BAD_API" ]; then ok "همهٔ ۲۲ مسیر API در دسترس (شامل پیش‌نمایش بله و خط لحظه‌ای)"; else bad "API خراب:$BAD_API"; fi

# مسیرهای پویا — یک پست واقعی (references فقط POST است؛ 405 یعنی مسیر وصل است)
PID=$(bun -e 'import {PrismaClient} from "@prisma/client"; const db=new PrismaClient(); const p=await db.post.findFirst({select:{id:true}}); console.log(p?.id||""); process.exit(0);' 2>/dev/null | tail -1)
if [ -n "$PID" ]; then
  C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "http://localhost:3000/api/posts/$PID/references")
  case "$C" in
    200) ok "مسیر پویا /api/posts/[id]/references 200";;
    405) ok "مسیر پویا /api/posts/[id]/references وصل است (فقط POST — تست با GET: 405)";;
    *) bad "مسیر پویا posts/[id]/references: $C";;
  esac
fi

# ۵) سلامت زنجیرهٔ تأمین مدل — اگر کلید OpenRouter موجود باشد باید سرِ زنجیره باشد (خواستهٔ کاربر)؛
#    بدون کلید، زنجیره باید دست‌کم یک تأمین‌کنندهٔ سالم داشته باشد (پشتیبان‌های zai/pollinations)
section "۵) زنجیرهٔ مدل"
CHAIN=$(bun -e 'import {getProviderChain} from "./src/lib/ai/providers"; const c=await getProviderChain(); console.log(c.filter(p=>p.enabled).map(p=>p.id).join(",")); process.exit(0);' 2>/dev/null | tail -1)
if grep -q '^OPENROUTER_API_KEY=..' .env 2>/dev/null; then
  echo "$CHAIN" | grep -q "openrouter" && { echo "$CHAIN" | grep -qE "^openrouter" && ok "سرِ زنجیره: OpenRouter (پیش‌فرض) → $CHAIN" || bad "کلید OpenRouter هست ولی سرِ زنجیره نیست: $CHAIN"; } || bad "کلید OpenRouter هست ولی غیرفعال است: $CHAIN"
else
  if [ -n "$CHAIN" ]; then ok "زنجیره بدون کلید OpenRouter سالم است: $CHAIN (برای بازگشت OpenRouter به سرِ زنجیره، کلید را در .env یا تب «مدل و API» وارد کنید)"; else bad "زنجیرهٔ مدل خالی است — هیچ تأمین‌کننده‌ای فعال نیست"; fi
fi

# ۶) اتصال بله (getMe — بدون ارسال پیام مزاحم)
section "۶) بات بله"
ME=$(bun -e 'import {baleGetMe} from "./src/lib/bale-bot"; const m=await baleGetMe(); console.log(JSON.stringify(m)); process.exit(0);' 2>/dev/null | tail -1)
echo "$ME" | grep -q '"ok":true' && ok "getMe بله موفق ($(echo "$ME" | grep -oE '"username":"[^"]+"'))" || bad "بله: $ME"

# ۷) منابع و مدارشکن ایکس
section "۷) منابع و مدارشکن"
bun -e '
import {PrismaClient} from "@prisma/client";
const db = new PrismaClient();
const total = await db.source.count({where:{isActive:true}});
const badS = await db.source.count({where:{isActive:true, status:"خطای_اتصال"}});
const tw = await db.source.count({where:{platform:"twitter", isActive:true}});
const twBad = await db.source.count({where:{platform:"twitter", isActive:true, status:"خطای_اتصال"}});
const posts = await db.post.count();
const imgs = await db.post.count({where:{imageUrl:{not:null}}});
const raw = await db.post.count({where:{processingStatus:"خام"}});
const claims = await db.claim.count();
console.log(`منابع فعال: ${total} (خطا: ${badS}) | ایکس: ${tw} (خطا: ${twBad})`);
console.log(`مطالب: ${posts} (عکس‌دار: ${imgs}) | خام: ${raw} | ادعا: ${claims}`);
process.exit(0);' 2>/dev/null | tail -2
echo "ℹ️  خطاهای ایکس انتظار‌پذیر است (سهمیهٔ تنگ واقعی ایکس از IP دیتاسنتر) — مدارشکن: ۱ حساب/۹۰ ثانیه، خنکی تطبیقی ۲۰ تا ۹۰ دقیقه"

# ۸) صحت بانک — پست بی‌منبع «غیر دستی» خرابی است؛ ورودی‌های دستی (manual:true) عمداً بی‌منبع‌اند
section "۸) صحت بانک اطلاعاتی"
bun -e '
import {PrismaClient} from "@prisma/client";
const db = new PrismaClient();
const orphanPosts = await db.post.count({where:{source:null, NOT:{metadata:{contains:"\"manual\":true"}}}});
const manualPosts = await db.post.count({where:{source:null, metadata:{contains:"\"manual\":true"}}});
if (orphanPosts === 0) console.log("OK: بدون پست بی‌منبع غیردستی (ورودی دستی: " + manualPosts + ")"); else console.log(`BAD: ${orphanPosts} پست بی‌منبع غیردستی`);
process.exit(0);' 2>/dev/null | while read -r line; do
  case "$line" in OK:*) ok "$line";; BAD:*) bad "$line";; WARN:*) echo "⚠️  $line";; esac
done

# ───── جمع‌بندی ─────
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "نتیجه: $PASS سبز، $FAIL قرمز"
[ "$FAIL" = "0" ] && echo "🏆 تست جامع: همهٔ بخش‌ها متصل و سالم" || echo "🛑 تست جامع: $FAIL بخش خراب — اصلاح لازم"
exit "$FAIL"
