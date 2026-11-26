/**
 * 🛡 موتور ورودی خبر — «فیلتر تبلیغ ← حقیقت‌سنجی ← اهمیت‌سنجی» — خواستهٔ کاربر ۲۶ نوامبر ۲۰۲۶
 *
 * پرامپت سوپر حرفه‌ای‌شدهٔ پیام کاربر (سند کامل: docs/nov26-news-intake-prompt.md):
 * «اولاً به هیچ عنوان پیام‌های تبلیغاتی کانال‌ها یا خبرگزاری‌ها وارد برنامه نشن؛
 *  دوماً [تا پیش از آبشار تصویری] تمامی اخبار … ؛
 *  سوماً اخبار کانال‌های تلگرام و ایتا و خبرگزاری‌های داخل ایران همه وارد یک موتور
 *  حقیقت‌سنجی بشن: اگر زده فلانی توییت زد اصلاً واردش نکن چون خودمون بخش توییت داریم؛
 *  اگر زده به نقل از بلومبرگ، برنامه سایت بلومبرگ رو چک کنه و اگر درست بود همون خبر از
 *  خبرگزاری اصلی بفرسته؛ اگر به واقعه تاریخی اشاره داره صحت انطباقش با اون واقعه چک بشه.
 *  بعد از موتور صحت‌سنجی، وارد موتور تجمیع و تحلیل بشن و دیگه خبر خام کانال‌ها اصلا نیاد …
 *  اخبار بی‌اهمیت رو دیگه منتشر نکنی.»
 *
 * چهار گیت قطعی و «کلمه‌به‌کلمه» (بدون مدل — سریع، مجانی، آزمون‌پذیر؛ مدل برای تحلیل است
 * نه داوری ورودی). هر تابع خالص است و در tests/nov26-features.test.ts پوشش دارد:
 *
 *  گیت ۱ — ضدتبلیغ (isAdOrPromo): شماره کارت ۱۶رقمی، شبا IR+۲۴رقم، «کارت به نام»،
 *    تلفن همراه، دستگیرهٔ @کانال، «واریز/نیت کنید/در حد توان/یاعلی بگید»، joinchat.
 *    سیگنال‌های سخت به‌تنهایی = تبلیغ؛ سیگنال‌های نرم ≥۲ = تبلیغ. نمونهٔ واقعی کاربر
 *    (درخواست کمک برای سیستم صوت هیئت با کارت ۵۸۹۲… و شبا IR40…) باید رد شود.
 *
 *  گیت ۲ — خبرِ «فلانی توییت زد» (isTweetRelayNews): روایت صرفِ توییتِ شخصیت‌ها در
 *    تیتر + متن کوتاه = تکرارِ بخش توییت خودمان؛ رد. گزارش بلندِ تحلیلی که در میانهٔ
 *    آن به توییتی ارجاع شده = خبر واقعی؛ ماند.
 *
 *  گیت ۳ — اهمیت‌سنجی (importanceScore/filterByImportance): امتیاز ۰..۱۰۰ قطعی؛
 *    جنگ/ایران همیشه ≥۹۵ و هرگز حذف نمی‌شود؛ سقف حجم (۱۶ مورد/اسلات) + گیت اهمیت =
 *    پاسخِ «حجم اخبار خیلی زیاده»؛ «آغاز ثبت‌نام اعتکاف» و «امام‌جمعه فلان شهر: …»
 *    می‌افتند؛ «انفجار پرتابه در نفتکش غرب دبی» می‌ماند. سهمیهٔ حداقل (minKeep) مانع
 *    گرسنگی بسته می‌شود — در روز بی‌خبر، بهترینِ موجود ارسال می‌شود.
 *
 *  گیت ۴ — حقیقت‌سنجی (attributionOf/historyConsistencyOf): استخراج ارجاع «به نقل از
 *    بلومبرگ/رویترز/…» برای تأیید وب (در bot.ts با searchWeb) و انطباق سالِ رویدادهای
 *    تاریخی شناخته‌شده (انقلاب اسلامی ۱۳۵۷/۱۹۷۹، جنگ تحمیلی، جنگ جهانی دوم، برجام، …) —
 *    سالِ ناسازگار با واقعه = خبر ناساز، رد.
 *
 * اصل آهنین: هیچ خروجی جعلی؛ رد شدن گیت فقط با «دلیل شفاف» و ثبت در لاگ/خلاصهٔ چرخه.
 */

// ---------- نرمال‌سازی ارقام فارسی/عربی → لاتین (خالص) ----------

/** ارقام فارسی (۰-۹) و عربی (٠-٩) به لاتین — پایهٔ همهٔ الگوهای عددی این ماژول. خالص. */
export function digitsToLatin(s: string): string {
  return (s || '').replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (d) => {
    const fa = '\u06F0'.charCodeAt(0);
    const ar = '\u0660'.charCodeAt(0);
    const c = d.charCodeAt(0);
    return String(c >= fa ? c - fa : c - ar);
  });
}

/** چسباندن رقم‌های جداافاصل‌دار («۵۸۹۲ ۱۰۷۰ …» / «1234-5678-…») — فقط جداسازِ بین رقم را
 *  برمی‌دارد تا شماره کارتِ گروه‌بندی‌شده هم گرفته شود. خالص (بدون lookbehind). */
export function joinDigitRuns(s: string): string {
  return digitsToLatin(s || '').replace(/(\d)[\s\u200c\-\u2013.]+(?=\d)/g, '$1');
}

// ---------- گیت ۱ — ضدتبلیغ ----------

export interface AdVerdict {
  ad: boolean;
  /** نام قاعدهٔ ردشده — برای لاگ شفاف */
  rule?: string;
}

/** سیگنال‌های سخت — هرکدام به‌تنهایی یعنی پیام تبلیغ/طلب کمک است (خبر واقعی هرگز
 *  شماره کارت ۱۶رقمی یا شبا یا «کارت به نام» ندارد). قواعد عددی روی متنِ نرمال‌شده
 *  (ارقام فارسی→لاتین + گروه‌بندی چسبیده) سنجیده می‌شوند — «norm» واژه‌ها را دست
 *  نمی‌زند؛ «joined» برای کارت/شبای گروه‌بندی‌شده است. */
const AD_HARD_RULES: Array<[string, (norm: string, joined: string) => boolean]> = [
  ['شماره کارت ۱۶رقمی', (_n, j) => /\d{16}/.test(j)],
  ['شماره شبا (IR+۲۴رقم)', (_n, j) => /IR\d{24}/i.test(j)],
  ['کارت به نام', (n) => /کارت\s*(?:به نام|بنام)/.test(n)],
  ['شماره کارت/حساب', (n) => /شماره[\s\u200c]*(?:ی[\s\u200c]*)?(?:کارت|حساب)/.test(n)],
  ['شبا + شماره', (n) => /شبا[^\d]{0,14}\d/.test(n)],
  ['لینک عضویت کانال', (n) => /t\.me\/\+|joinchat/i.test(n)],
];

/** سیگنال‌های نرم — دو یا بیشتر یعنی تبلیغ (تک‌سیگنالِ نرم خبر واقعی را نمی‌اندازد). */
const AD_SOFT_RULES: Array<[string, RegExp]> = [
  ['درخواست واریز', /واریز/],
  ['کمک مالی', /کمک[\s\u200c]*مالی|جمع[\s\u200c]*آوری\s*کمک/],
  ['نیت/سهم‌گیری', /نیت کنید|نیت کنید|یاعلی بگید|یا علی بگید|سهم(?:ی)? (?:بگیرید|بگید|بشید)/],
  ['در حد توان', /در حد توان|به اندازهٔ? توان/],
  ['حمایت مالی', /حامی(?:ی)? (?:باشید|مالی)|حمایت مالی|همکاری مالی|مشارکت مالی/],
  ['خیریه/صدقه', /خیریه|صدقه|وقف|نیکوکاری/],
  ['کارت بانکی درخواستی', /کارت\s*بانکی|کارت\s*به\s*کارت/],
  ['دستگیرهٔ کانال', /(^|[\s（(「【])@[A-Za-z][A-Za-z0-9_]{3,}/],
  ['تلفن تماس', /(?:تماس|ارتباط|تلگرام|واتساپ)[^\d]{0,10}0?9\d{9}|0?9\d{9}[^\d]{0,10}(?:تماس|بگیرید)|📞|☎/],
  ['دعوت به کلیک', /کلیک کنید|روی کارت|کپی می[\s\u200c]*شود|زیر پست/],
  ['خادم/ادمین', /ارتباط با (?:خادم|ادمین|مسئول)|تماس با خادم/],
  ['انگلیسی: donate', /\bdonat(?:e|ion)\b/i],
];

/** پیام تبلیغاتی/طلب کمک است؟ — گیت ۱. تابع خالص و آزمون‌پذیر.
 *  سیگنال سخت ≥۱ یا سیگنال نرم ≥۲ → تبلیغ؛ با نام قاعده برای شفافیت لاگ.
 *  ارقام فارسی/عربی پیش از همهٔ قواعد عددی (کارت/شبا/تلفن) لاتین می‌شوند. */
export function isAdOrPromo(text: string): AdVerdict {
  const raw = (text || '').replace(/[\u200f\u200e]/g, '');
  if (!raw.trim()) return { ad: false };
  const norm = digitsToLatin(raw); // ارقام فارسی→لاتین؛ واژه‌ها دست‌نخورده
  const joined = joinDigitRuns(raw).replace(/\s+/g, ''); // کارت/شبای گروه‌بندی‌شده
  for (const [rule, fn] of AD_HARD_RULES) if (fn(norm, joined)) return { ad: true, rule };
  let soft = 0;
  let firstSoft = '';
  for (const [rule, re] of AD_SOFT_RULES) {
    if (re.test(norm)) {
      soft++;
      if (!firstSoft) firstSoft = rule;
      if (soft >= 2) return { ad: true, rule: `${firstSoft} + …` };
    }
  }
  return { ad: false };
}

// ---------- گیت ۲ — خبرِ «فلانی توییت زد» (تکرار بخش توییت خودمان) ----------

/** نشان‌های روایتِ صرفِ توییت — «X توییت کرد / در توییتر نوشت / در ایکس اعلام کرد». */
const TWEET_RELAY_RE = /(?:توییت|توئیت)(?:[\s\u200c]*(?:اش|ش))?[\s\u200c]*(?:کرد|کردند|کردم|می[\s\u200c]*کند)|در[\s\u200c]*(?:توییتر|توئیتر|شبکه[\s\u200c]*(?:اجتماعی[\s\u200c]*)?(?:ایکس|اکس)|ایکس|اکس|تروث[\s\u200c]*سوشال)(?:[\s\u200c]*خود)?[\s\u200c]*(?:نوشت|نوشتند|منتشر[\s\u200c]*کرد|اعلام[\s\u200c]*کرد|اظهار[\s\u200c]*کرد)|به نقل از توییت/i;

/** آستانهٔ طول «روایت صرف» — گزارش بلندتر از این، پوشش خبری واقعی است نه تکرار توییت. */
export const TWEET_RELAY_MAX_LEN = 600;
/** روایت توییت در ناحیهٔ تیتر (نویسه‌های آغازین) جست‌وجو می‌شود نه هر جای متن. */
const TWEET_RELAY_HEAD_CHARS = 220;

/** خبر، صرفاً بازنشر توییتِ شخصیت است؟ — گیت ۲. خواستهٔ کاربر ۲۶ نوامبر: «اگر زده
 *  فلانی توییت زد اصلاً واردش نکن چون خودمون بخش توییت داریم». فقط وقتی رد می‌شود که
 *  روایتِ توییت خودِ تیترِ خبر باشد و متن هم کوتاه (صرفاً همان توییت) — گزارش تحلیلیِ
 *  بلند دربارهٔ همان توییت خبر است و می‌ماند. تابع خالص. */
export function isTweetRelayNews(text: string): boolean {
  const t = (text || '').replace(/[\u200f\u200e]/g, ' ').trim();
  if (!t) return false;
  if (t.length > TWEET_RELAY_MAX_LEN) return false; // پوشش خبری واقعی
  return TWEET_RELAY_RE.test(t.slice(0, TWEET_RELAY_HEAD_CHARS));
}

// ---------- گیت ۳ — اهمیت‌سنجی (پاسخ «حجم اخبار خیلی زیاده») ----------

/** واژه‌های جنگ/ایران → همیشه مهم (هم‌ارز isPriorityRelated در bot/iran.ts). */
const SCORE_WAR_RE = /حمله|موشک|پهپاد|جنگ(?!ل)|نبرد|کشته|زخمی|ترور|انفجار|تهاجم|تجاوز|محاصره|بمب|جنگنده|تهدید نظامی|حمله سایبری|آتش‌بس|عملیات نظامی/;
const SCORE_IRAN_RE = /ایران(?![\s\u200c]?(?:خودرو|مال|تور|خاک|سل))|تهران|جمهوری اسلامی|تحریم|اورانیوم|هسته‌ای|برجام|سپاه|آراک/;
const SCORE_MACRO_RE = /دلار|طلا|بورس|تورم|نفت|گاز|اوپک|صرافی|شاخص بورس|بازار سرمایه|قیمت/;
const SCORE_DIPLO_RE = /مذاکره|گفت[\s\u200c]*و[\s\u200c]*گو|دیپلماسی|قطعنامه|توافق|قرارداد|وزیر خارجه|نشست خبری|بیانیه/;
const SCORE_DISASTER_RE = /زلزله|زمین[\s\u200c]*لرزه|سیل|آتش[\s\u200c]*سوزی|سانحه|تصادف|فوران|خشکسالی/;

/** نشان‌های کُم‌اهمیت — خبرهای پرکرِ استانی/فرهنگی/آموزشی که حجم کانال را می‌سازند. */
const SCORE_LOW_RE = /آغاز ثبت[\s\u200c]*نام|ثبت[\s\u200c]*نام (?:از|تا|در|آغاز)|مهلت ثبت[\s\u200c]*نام|امام[\s\u200c]*جمعه|نماینده ولی[\s\u200c]*فقیه|جشن تولد|سالگرد|یادبود|جشنواره|همایش|نشست فرهنگی|اعتکاف|زیارت|راهنمای خرید|چگونه|برای پیشگیری|توصیه می[\s\u200c]*شود|علائم و درمان|کنسرت|فیلم سینمایی|سریال|مسابقه|هفته مد/;

/** اهمیت — وارونهٔ گیت ۳: جنگ «یا» ایران (نه فقط هر دو) ممتاز ≥۹۵؛ هرگز حذف نمی‌شوند
 *  (خواستهٔ ۲۶ نوامبر: «تحریم‌های آمریکا علیه ایران» هم ایران‌دار است). تابع خالص. */
export function importanceScore(text: string): number {
  const t = (text || '').replace(/[\u200f\u200e]/g, ' ');
  if (!t.trim()) return 0;
  const war = SCORE_WAR_RE.test(t);
  const iran = SCORE_IRAN_RE.test(t);
  if (war && iran) return 100; // جنگ + ایران — مهم‌ترین
  let score = war || iran ? 95 : 40; // پایه: خبر متوسط؛ جنگ/ایران ممتاز
  if (SCORE_MACRO_RE.test(t)) score += 20;
  if (SCORE_DIPLO_RE.test(t)) score += 14;
  if (SCORE_DISASTER_RE.test(t)) score += 16;
  if (SCORE_LOW_RE.test(t)) score -= 27;
  if (/(?:نماینده مجلس|استاندار|فرماندار|شورای شهر).{0,60}(?:گفت|اظهار داشت|تصریح)/.test(t)) score -= 10;
  if (/\d{2,}\s*(?:مگاوات|میلیارد تومان|میلیون دلار|میلیارد دلار|هزار نفری)/.test(joinDigitRuns(t))) score += 8; // عدد سنگین = واقعیت مهم
  return Math.max(0, Math.min(100, Math.round(score)));
}

export interface ImportanceFilterOpts {
  /** آستانهٔ حذف — امتیاز کمتر از این = کم‌اهمیت (پیش‌فرض ۵۵) */
  threshold?: number;
  /** سهمیهٔ حداقل — اگر همه‌چیز زیر آستانه بود، همین تعداد از بهترین‌ها می‌مانند (گرسنگی ممنوع) */
  minKeep?: number;
}

/** پالایهٔ اهمیت — گیت ۳. اولویت جنگ/ایران (≥۹۵) هرگز حذف نمی‌شود؛ در نبود خبر مهم،
 *  بهترینِ موجود تا سقف minKeep نگه داشته می‌شود تا بسته هرگز لال نشود. خالص. */
export function filterByImportance<T extends { text: string }>(
  items: T[],
  opts: ImportanceFilterOpts = {},
): { kept: T[]; dropped: T[] } {
  const threshold = Math.max(0, Math.min(100, opts.threshold ?? 55));
  const minKeep = Math.max(0, Math.min(50, opts.minKeep ?? 3));
  const scored = items.map((it) => ({ it, s: importanceScore(it.text) }));
  const kept = scored.filter((x) => x.s >= threshold || x.s >= 95).map((x) => x.it);
  if (kept.length >= Math.min(minKeep, items.length)) return { kept, dropped: items.filter((it) => !kept.includes(it)) };
  // سهمیهٔ حداقل — بهترین‌های باقی تا حداقلِ خواسته‌شده (ترتیب ورود حفظ می‌شود)
  const rest = scored.filter((x) => x.s < threshold && x.s < 95).sort((a, b) => b.s - a.s).slice(0, Math.max(0, minKeep - kept.length));
  const keepSet = new Set([...kept, ...rest.map((r) => r.it)]);
  return { kept: items.filter((it) => keepSet.has(it)), dropped: items.filter((it) => !keepSet.has(it)) };
}

// ---------- گیت ۴-الف — ارجاع‌یابی «به نقل از …» ----------

export interface Attribution {
  /** نام رسمی فارسی رسانهٔ اصلی — «بلومبرگ» */
  outlet: string;
  /** معادل لاتین برای جست‌وجوی وب — «Bloomberg» */
  outletEn: string;
}

/** رسانه‌های بین‌المللی مرجع — جفت نام فارسی/لاتین برای نشان و جست‌وجوی وب. */
const OUTLETS: Array<[RegExp, string, string]> = [
  [/بلومبرگ/, 'بلومبرگ', 'Bloomberg'],
  [/رویترز|روترز/, 'رویترز', 'Reuters'],
  [/آسوشیتد[\s\u200c]*پرس|آسوسیتد[\s\u200c]*پرس|خبرگزاری AP/, 'آسوشیتدپرس', 'AP News'],
  [/الجزیره/, 'الجزیره', 'Al Jazeera'],
  [/سی[\s\u200c]*ان[\s\u200c]*ان|CNN/, 'سی‌ان‌ان', 'CNN'],
  [/بی[\s\u200c]*بی[\s\u200c]*سی|BBC/, 'بی‌بی‌سی', 'BBC'],
  [/واشنگتن[\s\u200c]*پست/, 'واشنگتن‌پست', 'Washington Post'],
  [/نیویورک[\s\u200c]*تایمز/, 'نیویورک‌تایمز', 'New York Times'],
  [/وال[\s\u200c]*استریت/, 'وال‌استریت‌ژورنال', 'Wall Street Journal'],
  [/فایننشال[\s\u200c]*تایمز/, 'فایننشال‌تایمز', 'Financial Times'],
  [/اسکای[\s\u200c]*نیوز/, 'اسکای‌نیوز', 'Sky News'],
  [/راشا[\s\u200c]*تودی/, 'راشاتودی', 'RT'],
  [/فرانسه[\s\u200c]*۲۴|فرانس[\s\u200c]*۲۴/, 'فرانس۲۴', 'France 24'],
  [/دویچه[\s\u200c]*وله/, 'دویچه‌وله', 'DW'],
  [/اینترفکس/, 'اینترفکس', 'Interfax'],
];

/** نشان‌های ارجاع — «به نقل از X»، «به گزارش X»، «به گفتهٔ X»، «به استناد X». */
const ATTRIB_RE = /به[\s\u200c]*(?:نقل|گزارش|گفته|استناد|استنادِ)/;

/** ارجاعِ خبر به رسانهٔ بین‌المللی مرجع را استخراج می‌کند — گیت ۴-الف. تابع خالص.
 *  کاربرد در bot.ts: موردِ تک‌منبعیِ دارای ارجاع با searchWeb تأیید می‌شود؛ تأیید →
 *  برچسب منبع = رسانهٔ اصلی («همون خبر از خبرگزاری اصلی»)، عدم تأیید → حذف صادقانه. */
export function attributionOf(text: string): Attribution | null {
  const t = (text || '').replace(/[\u200f\u200e]/g, ' ');
  if (!ATTRIB_RE.test(t)) return null;
  for (const [re, outlet, outletEn] of OUTLETS) {
    if (re.test(t)) return { outlet, outletEn };
  }
  return null;
}

/** شباهت ژاکارد دو متن (توکن‌های کلمه‌ای) — برای تطبیق عنوان نتیجهٔ وب با متن خبر. خالص. */
export function jaccardSimilarity(a: string, b: string): number {
  const toks = (s: string) => new Set((s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((w) => w.length > 2));
  const A = toks(a);
  const B = toks(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** تطبیق چندسیگنالی نتیجهٔ وب با متن خبر — سه سیگنال مستقل، هرکدام کافی است:
 *  (۱) عدد مشترک ≥۲رقمی (سنگین‌ترین سیگنال — «۱.۷ میلیون بشکه» در هر دو زبان);
 *  (۲) ≥۲ توکن لاتین مشترک (Bessent، Bloomberg، OPEC — نام‌ها زبان‌برنده‌اند);
 *  (۳) ژاکارد ≥۰٫۱۸ (پیکرهٔ هم‌زبان — عنوان فارسی برای جست‌وجوی فارسی).
 *  خالص — واحد تأیید وب ارجاع‌ها در bot.ts (خواستهٔ ۲۶ نوامبر). */
export function attributionMatch(title: string, text: string): boolean {
  const t = digitsToLatin(title || '');
  const x = digitsToLatin(text || '');
  const numsOf = (s: string) => new Set((s.match(/\d{2,}/g) || []));
  const NT = numsOf(t);
  const NX = numsOf(x);
  for (const n of NT) if (NX.has(n)) return true;
  const latOf = (s: string) => new Set((s.match(/[A-Za-z][A-Za-z0-9'’]{3,}/g) || []).map((w) => w.toLowerCase()));
  const LT = latOf(t);
  const LX = latOf(x);
  let sharedLatin = 0;
  for (const w of LT) if (LX.has(w)) sharedLatin++;
  if (sharedLatin >= 2) return true;
  return jaccardSimilarity(title || '', text || '') >= 0.18;
}

// ---------- گیت ۴-ب — انطباق رویدادهای تاریخی ----------

export interface HistoryVerdict {
  ok: boolean;
  /** ناسازگاری یافت‌شده — برای لاگ شفاف */
  issue?: string;
}

/** واقعه‌های تاریخی شناخته‌شده + سال‌های صحیح (شمسی و میلادی). سال بیرون از این مجموعه
 *  در همان جملهٔ نام واقعه = ناسازگاری قطعی (مثال: «جنگ جهانی دوم در سال ۲۰۰۳»).
 *  ارقامِ الگو لاتین‌اند چون سنجش روی متنِ لاتین‌شده انجام می‌شود. بدون پرچم g —
 *  test بدون حالت. */
const HISTORIC_EVENTS: Array<{ name: RegExp; label: string; years: Set<number> }> = [
  { name: /انقلاب اسلامی|انقلاب 57/, label: 'انقلاب اسلامی', years: new Set([1357, 1358, 1978, 1979]) },
  { name: /جنگ تحمیلی|جنگ هشت[\s\u200c]*ساله|جنگ عراق با ایران|تهاجم عراق/, label: 'جنگ تحمیلی', years: setOf(1359, 1367, 1980, 1988) },
  { name: /جنگ جهانی دوم|جنگ دوم/, label: 'جنگ جهانی دوم', years: setOf(1318, 1324, 1939, 1945) },
  { name: /جنگ جهانی اول/, label: 'جنگ جهانی اول', years: setOf(1292, 1297, 1914, 1918) },
  { name: /11 سپتامبر|یازده سپتامبر/, label: 'یازده سپتامبر', years: new Set([1380, 2001]) },
  { name: /28 مرداد|کودتای 28/, label: 'کودتای 28 مرداد', years: new Set([1332, 1953]) },
  { name: /انقلاب مشروطه|مشروطه/, label: 'انقلاب مشروطه', years: setOf(1285, 1286, 1905, 1907) },
  { name: /فروپاشی (?:اتحاد جماهیر )?شوروی|سقوط شوروی/, label: 'فروپاشی شوروی', years: new Set([1370, 1991]) },
  { name: /حمله (?:آمریکا|ناتو) به افغانستان/, label: 'حمله به افغانستان', years: new Set([1380, 2001]) },
  { name: /حمله (?:آمریکا|آمریکایی‌ها) به عراق/, label: 'حمله آمریکا به عراق', years: new Set([1381, 1382, 2003]) },
  { name: /برجام/, label: 'برجام', years: new Set([1394, 1395, 2015]) },
  { name: /جنگ (?:شش|6) روزه/, label: 'جنگ شش‌روزه', years: new Set([1346, 1967]) },
  { name: /جنگ یوم کیپور|جنگ رمضان|جنگ اکتبر/, label: 'جنگ یوم کیپور', years: new Set([1352, 1973]) },
  { name: /قیام 15 خرداد|15 خرداد/, label: 'قیام 15 خرداد', years: new Set([1342, 1963]) },
  { name: /انفجار سفارت (?:ایران )?در بیروت/, label: 'انفجار سفارت بیروت', years: new Set([1362, 1983]) },
  { name: /جنگ قره[\s\u200c]*باغ/, label: 'جنگ قره‌باغ', years: new Set([1399, 2020, ...setOf(1367, 1373, 1988, 1994)]) },
  { name: /حمله (?:رژیم صهیونیستی|اسرائیل) به ایران|جنگ دوازده[\s\u200c]*روزه/, label: 'حمله اسرائیل به ایران', years: setOf(1403, 1404, 2024, 2025) },
];

/** سازندهٔ بازهٔ سال (شمسی/میلادی فرورفته در مجموعه). */
function setOf(fromSh: number, toSh: number, fromM: number, toM: number): Set<number> {
  const s = new Set<number>();
  for (let y = fromSh; y <= toSh; y++) s.add(y);
  for (let y = fromM; y <= toM; y++) s.add(y);
  return s;
}

/** سال‌های متن — ۴رقمی پس از نرمال‌سازی ارقام (شمسی ~۱۲۰۰-۱۶۰۰، میلادی ~۱۸۰۰-۲۲۰۰).
 *  بازهٔ ۱۵۰۱-۱۷۹۹ هم برمی‌گردد تا بررسی «سال غیرممکن» بگیردشان. خالص. */
export function yearsOfText(text: string): number[] {
  const t = digitsToLatin(text || '');
  const out: number[] = [];
  for (const m of t.matchAll(/\b(\d{4})\b/g)) {
    const y = Number(m[1]);
    if (y >= 1200 && y <= 2200) out.push(y);
  }
  return out;
}

/** سال‌های «سال‌دار» جمله — فقط عددی که واژهٔ «سال» پیش از آن آمده («در سال ۱۳۵۷»،
 *  «سال ۲۰۰۳»)؛ عددِ بی‌«سال» (مانند «۱۵۰۰ کشته») در بررسی واقعه‌ها نمی‌آید تا
 *  مثبت کاذب نشود. خالص. */
export function yearMentionsWithSal(sentence: string): number[] {
  const s = digitsToLatin(sentence || '');
  const out: number[] = [];
  for (const m of s.matchAll(/سال[^\d]{0,8}(\d{4})/g)) out.push(Number(m[1]));
  return out;
}

/** انطباق سالِ رویدادهای تاریخی — گیت ۴-ب. «جملهٔ» حاوی نام واقعه سنجیده می‌شود (نه
 *  پنجرهٔ وسیع — سالِ جملهٔ دیگر ماجرایی ندارد)؛ سالِ ناسازگار در همان جمله = خبر ناساز
 *  (مثال: «جنگ جهانی دوم در سال ۲۰۰۳ آغاز شد» رد می‌شود؛ «انقلاب اسلامی در ۱۳۵۷»
 *  می‌ماند). سال غیرممکن (بازهٔ ۱۵۰۱-۱۷۹۹ که نه شمسی است نه میلادی، یا >۲۱۰۰) هم
 *  ناساز است. تابع خالص. */
export function historyConsistencyOf(text: string): HistoryVerdict {
  const t = (text || '').replace(/[\u200f\u200e]/g, ' ');
  if (!t.trim()) return { ok: true };
  const latin = digitsToLatin(t);
  const impossible = yearsOfText(latin).find((y) => (y > 1500 && y < 1800) || y > 2100);
  if (impossible !== undefined) return { ok: false, issue: `سال غیرممکن ${impossible}` };
  const sentences = latin.split(/[.!؟?؛\n]+/);
  for (const ev of HISTORIC_EVENTS) {
    for (const s of sentences) {
      if (!ev.name.test(s)) continue;
      const bad = yearMentionsWithSal(s).find((y) => !ev.years.has(y));
      if (bad !== undefined) return { ok: false, issue: `${ev.label}: سال ${bad} با واقعه نمی‌خواند` };
    }
  }
  return { ok: true };
}

// ---------- حکم یکپارچهٔ ورودی + پالایهٔ دسته‌ای ----------

export interface IntakeVerdict {
  ok: boolean;
  /** دلیل رد — برای لاگ شفاف و شمارش خلاصهٔ چرخه */
  reason?: string;
  /** امتیاز اهمیت (ح навته در رد هم پر می‌شود تا آمار بدهد) */
  score: number;
}

export interface IntakeOpts {
  /** گیت اهمیت — برای پیکرهٔ تحلیل خاموش می‌شود (تحلیل کل رویدادها را می‌بیند) */
  importance?: boolean;
  threshold?: number;
}

/** حکم یکپارچهٔ یک متن خبر — ترتیب گیت‌ها: تبلیغ → توییت‌نما → ناساز تاریخی → کم‌اهمیت.
 *  هر رد با دلیل شفاف؛ خبر سالم ok=true با امتیاز. تابع خالص. */
export function intakeVerdict(text: string, opts: IntakeOpts = {}): IntakeVerdict {
  const score = importanceScore(text);
  const ad = isAdOrPromo(text);
  if (ad.ad) return { ok: false, reason: `تبلیغ/طلب کمک (${ad.rule})`, score };
  if (isTweetRelayNews(text)) return { ok: false, reason: 'بازنشر توییت (بخش توییت خودمان)', score };
  const hist = historyConsistencyOf(text);
  if (!hist.ok) return { ok: false, reason: `ناسازگاری تاریخی: ${hist.issue}`, score };
  if (opts.importance !== false && score < (opts.threshold ?? 55)) {
    return { ok: false, reason: `کم‌اهمیت (امتیاز ${score})`, score };
  }
  return { ok: true, score };
}

export interface IntakeFilterResult<T> {
  kept: T[];
  droppedAds: T[];
  droppedTweetRelay: T[];
  droppedHistory: T[];
  droppedLowImportance: T[];
}

/** پالایهٔ یکپارچهٔ دسته‌ای — گیت‌های ۱و۲و۴ روی همه؛ گیت ۳ (اهمیت) با سهمیهٔ حداقل.
 *  «خبر خام کانال‌ها» فقط بعد از این پالایه به صف/پیکرهٔ تحلیل می‌رود. خالص. */
export function filterNewsIntake<T extends { text: string }>(
  items: T[],
  opts: IntakeOpts & { minKeep?: number } = {},
): IntakeFilterResult<T> {
  const out: IntakeFilterResult<T> = { kept: [], droppedAds: [], droppedTweetRelay: [], droppedHistory: [], droppedLowImportance: [] };
  const survivors: T[] = [];
  for (const it of items || []) {
    const v = intakeVerdict(it.text, { importance: false });
    if (!v.ok) {
      if (v.reason?.startsWith('تبلیغ')) out.droppedAds.push(it);
      else if (v.reason?.startsWith('بازنشر توییت')) out.droppedTweetRelay.push(it);
      else out.droppedHistory.push(it);
      continue;
    }
    survivors.push(it);
  }
  if (opts.importance === false) {
    out.kept = survivors;
    return out;
  }
  const imp = filterByImportance(survivors, { threshold: opts.threshold ?? 55, minKeep: opts.minKeep ?? 3 });
  out.kept = imp.kept;
  out.droppedLowImportance = imp.dropped;
  return out;
}
