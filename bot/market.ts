/**
 * بازار رصدبان — گزارش قیمت (خودرو، طلا و سکه، دلار، شاخص بورس، بیت‌کوین، برنت)
 * خواستهٔ کاربر (۹ نوامبر ۲۰۲۶): «ظهر و شب هر روز آخرین قیمت خودروهای داخل ایران،
 * قیمت طلا ۱۸ و ۲۴ عیار، قیمت دلار آزاد، شاخص بورس، قیمت بیت‌کوین و قیمت نفت برنت
 * و آخرین درصد تغییرشان از خبر قبلی رو بفرستی».
 *
 * منابع (به ترتیب اولویت — خواستهٔ صریح کاربر):
 *   دلار و بیت‌کوین: نوبیتکس (api.nobitex.ir) → پشتیبان: tgju
 *   طلا و سکه: tgju آنلاین (call1.tgju.org/ajax.json)
 *   شاخص بورس: سایت بورس (tsetmc) → پشتیبان: tgju («نشد از سایتهای جایگزین»)
 *   نفت برنت: tgju (oil_brent)
 *   خودرو: کانال‌های خبری خودرو در تلگرام (t.me/s/… — فرمت «مدل⬅️قیمت»)
 *
 * صراحت: هر منبعی که پاسخ نداد صادقانه «دریافت نشد» می‌آید؛ هیچ عدد ساختگی.
 * صفر وابستگی — فقط fetch استاندارد؛ همهٔ پارسرها خالص و تست‌پذیر.
 */

// ---------- ابزار عدد و قالب فارسی ----------

/** تبدیل ارقام فارسی/عربی به ASCII — برای پارس قیمت‌ها */
export function faToEnDigits(s: string): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  return s.replace(/[۰-۹٠-٩]/g, (c) => {
    const i = fa.indexOf(c);
    return String(i >= 0 ? i : ar.indexOf(c));
  });
}

/** «2,649,000» یا «254,171,000» → عدد؛ نامعتبر → null */
export function num(s: string | undefined | null): number | null {
  if (!s) return null;
  const t = faToEnDigits(String(s)).replace(/[,\s٬]/g, '').replace(/[۰-۹]/g, '');
  const m = t.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) ? v : null;
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** رقم فارسی + جداکنندهٔ هزارگان «٬» — 25417100 → «۲۵٬۴۱۷٬۱۰۰» */
export function faGroup(n: number, decimals = 0): string {
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const out = (frac ? `${grouped}٫${frac}` : grouped).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
  return (neg ? '−' : '') + out;
}

/** نمایش مقدار بر حسب واحد — بهومان ≥۱ میلیارد → «میلیارد تومان»؛ خودرو از کانال به همین شکل می‌آید */
export function formatMoney(value: number, unit: 'toman' | 'usd' | 'index'): string {
  if (unit === 'index') return faGroup(value, value >= 1000 ? 0 : 2);
  if (unit === 'usd') return `${faGroup(value, value >= 100 ? 0 : 2)} دلار`;
  // toman
  if (Math.abs(value) >= 1e9) return `${faGroup(value / 1e9, 3)} میلیارد تومان`;
  return `${faGroup(value, 0)} تومان`;
}

/** نمایش درصد تغییر — ▲/▼/— با رقم فارسی */
export function formatPct(p: number | undefined | null): string {
  if (p === undefined || p === null || !Number.isFinite(p)) return '—';
  if (Math.abs(p) < 0.05) return 'بدون تغییر';
  const arrow = p > 0 ? '▲' : '▼';
  return `${arrow}${faGroup(Math.abs(p), Math.abs(p) >= 10 ? 1 : 1)}٪`;
}

/** درصد تغییر — تابع خالص تست‌پذیر؛ prev صفر/نامعتبر → null */
export function deltaPct(prev: number, now: number): number | null {
  if (!Number.isFinite(prev) || !Number.isFinite(now) || prev === 0) return null;
  return Math.round(((now - prev) / Math.abs(prev)) * 10000) / 100;
}

// ---------- تایپ عمومی ----------

export type QuoteUnit = 'toman' | 'usd' | 'index';

export interface Quote {
  /** کلید پایدار برای مقایسهٔ بین‌گزارشی — «car:<مدل نرمال>» | «geram18» | «usd» | … */
  key: string;
  title: string;
  value: number;
  unit: QuoteUnit;
  /** منبع واقعی این عدد — در پیام می‌آید (نوبیتکس | tgju | بورس تهران | کانال خودرو) */
  srcLabel: string;
  /** درصد تغییر: پایهٔ «دیروز ساعت ۱۵» (snapshot گزارش روزانهٔ ۱۵:۰۰)؛ نبود → تغییر روز منبع */
  changePct?: number;
  /** مبلغ اختلاف نسبت به همان پایهٔ درصد — همان واحد value (خواستهٔ کاربر ۲۰ نوامبر
   *  هفتم: «درصد و مبلغ اختلاف کنارش»). پایهٔ عددی نبود → undefined (هیچ عدد ساختگی) */
  changeAbs?: number;
  changeSrc?: 'prev' | 'source' | 'none';
  /** نمایش آمادهٔ مقدار */
  display?: string;
  /** یادداشت صادقانه — مثلاً کهنگی قیمت خودرو */
  note?: string;
  /** قیمت کارخانه (نمایندگی) باما — فقط برای مدل‌های VIP (خواستهٔ کاربر ۱۹ نوامبر:
   *  «جلوش تو یه ستون مجزا قیمت کارخونه رو بزاری») */
  factoryToman?: number;
  /** منبع قیمت کارخانه — «باما» */
  factorySrc?: string;
  /** قیمت دولتی/رسمی — ستون سوم جدول یکدست (خواستهٔ کاربر ۲۰ نوامبر:
   *  «ستون سوم قیمت کارخانه یا دولتی اگر هست … دلار دولتیش باید بشه همون قیمت دلار مرکز مبادله»):
   *  دلار = نرخ فروش حوالهٔ مرکز مبادلهٔ ارز و طلا (tgju: ice_transfer_usd_sell — همان رقمی که
   *  اخبار «دلار مرکز مبادله» می‌نامند) • سکه امامی = سکه بهار آزادی طرح بانکی (tgju: sekeb) */
  officialToman?: number;
  /** منبع قیمت دولتی — «مرکز مبادله» | «بانکی (بهار آزادی)» */
  officialSrc?: string;
  emoji: string;
}

export type PriceSnapshot = Record<string, number>; // key → مقدار گزارش قبل

/** اعمال تغییرات — خواستهٔ کاربر ۲۰ نوامبر (ششم): «تغییرات نسبت به روز قبل
 *  محاسبه بشن» (ساعتِ گزارش: ۳ → ۱۵ — خواستهٔ ۲۳ نوامبر) — گزارش بازار روزانهٔ ۱۵:۰۰
 *  است، پس پایهٔ «دیروز ساعت ۱۵» = snapshot گزارش روز پیشین. اولویت: ۱) پایهٔ دیروز
 *  (prevDay — دقیقاً گزارش ۱۵:۰۰ دیروز)؛
 *  ۲) آخرین گزارش موجود (prev — در گزارش روزانه همان ۱۵ دیروز است)؛
 *  ۳) تغییر روزانهٔ خود منبع (tgju/nobitex/tsetmc — فقط وقتی snapshot ما نیست؛
 *  پایه‌اش بسته‌شدن دیروزِ منبع است نه ساعت ۱۵). هیچ‌کدام → بدون تغییرات («—»).
 *  تابع خالص تست‌پذیر. */
export function applyDeltas(quotes: Quote[], prev?: PriceSnapshot, prevDay?: PriceSnapshot): Quote[] {
  return quotes.map((q) => {
    const pd = prevDay?.[q.key];
    if (pd !== undefined) {
      const dd = deltaPct(pd, q.value);
      if (dd !== null) return { ...q, changePct: dd, changeAbs: q.value - pd, changeSrc: 'prev' as const };
    }
    const pv = prev?.[q.key];
    if (pv !== undefined) {
      const d = deltaPct(pv, q.value);
      if (d !== null) return { ...q, changePct: d, changeAbs: q.value - pv, changeSrc: 'prev' as const };
    }
    if (q.changePct !== undefined && Number.isFinite(q.changePct)) {
      // پایهٔ عددی ما نیست (تغییر روز خود منبع) → درصد هست، مبلغ اختلاف ساختگی نمی‌شود
      return { ...q, changeAbs: undefined, changeSrc: 'source' as const };
    }
    return { ...q, changePct: undefined, changeAbs: undefined, changeSrc: 'none' as const };
  });
}

// ---------- tgju (طلا، سکه، دلار پشتیبان، برنت، شاخص پشتیبان، بیت‌کوین پشتیبان) ----------

export interface TgjuEntry { p?: string; h?: string; l?: string; d?: string; dt?: string; t?: string }

/** درصد تغییر روزانهٔ tgju — فیلد «d» تغییر مطلق است (همان واحد p: ریال/دلار)، نه درصد!
 *  نمونهٔ واقعی: طلای ۱۸ عیار p=۲۴۲٬۸۶۷٬۰۰۰ و d=۱٬۷۲۹٬۰۰۰ → ۰٫۷۱٪ (سایت tgju همان‌جا ۰٫۷۲٪
 *  می‌نویسد). درصد = d÷p×۱۰۰. تصحیح ۲۰ نوامبر: پیش‌تر d عیناً «درصد» فرض می‌شد و با تغییر
 *  اولویت به «تغییر روزانهٔ منبع»، عدد مطلق ریالی با علامت ٪ می‌آمد (▲۲۳۰۵۰۰۰٪!). خالص تست‌پذیر. */
export function tgjuChangePct(e: TgjuEntry | undefined): number | undefined {
  const p = num(e?.p);
  const d = num(e?.d);
  if (p === null || p <= 0 || d === null || d === 0) return undefined;
  return Math.round((d / p) * 10000) / 100;
}

/** پارس پاسخ call1.tgju.org/ajax.json — تابع خالص تست‌پذیر */
export function parseTgjuCurrent(json: string): Record<string, TgjuEntry> {
  try {
    const o = JSON.parse(json) as { current?: Record<string, TgjuEntry> };
    if (!o || typeof o !== 'object' || !o.current || typeof o.current !== 'object') return {};
    return o.current;
  } catch {
    return {};
  }
}

/** tgju قیمت‌ها را به ریال می‌دهد → تومان = ÷۱۰ */
export function rialToToman(rial: number | null): number | null {
  return rial !== null && Number.isFinite(rial) && rial > 0 ? rial / 10 : null;
}

function tgjuQuote(cur: Record<string, TgjuEntry>, key: string, value: number | null, title: string, unit: QuoteUnit, emoji: string): Quote | null {
  if (value === null) return null;
  return {
    key, title, value, unit, srcLabel: 'tgju', emoji,
    changePct: tgjuChangePct(cur[key]),
  };
}

// ---------- نوبیتکس (دلار/تتر و بیت‌کوین — خواستهٔ صریح کاربر) ----------

export interface NobitexStats {
  btcToman?: number;
  usdToman?: number;
  btcChangePct?: number;
  usdChangePct?: number;
}

/** پارس api.nobitex.ir/market/stats/get — dstCurrency=rls → ریال → تومان ÷۱۰ */
export function parseNobitexStats(json: string): NobitexStats {
  const out: NobitexStats = {};
  try {
    const o = JSON.parse(json) as { status?: string; stats?: Record<string, { latest?: string; dayChange?: string }> };
    if (!o || o.status !== 'ok' || !o.stats || typeof o.stats !== 'object') return out;
    const btc = o.stats.btc;
    const usdt = o.stats.usdt;
    const btcV = num(btc?.latest);
    if (btcV !== null && btcV > 0) {
      out.btcToman = btcV / 10;
      const c = num(btc?.dayChange);
      if (c !== null) out.btcChangePct = c;
    }
    const usdV = num(usdt?.latest);
    if (usdV !== null && usdV > 0) {
      out.usdToman = usdV / 10;
      const c = num(usdt?.dayChange);
      if (c !== null) out.usdChangePct = c;
    }
    return out;
  } catch {
    return out;
  }
}

// ---------- شاخص بورس (tsetmc — سایت خود بورس؛ خواستهٔ کاربر) ----------

export interface TseIndex { index?: number; changePct?: number }

/** پارس MarketTotal.aspx — خط اول CSV: «شاخص,تغییر,…» (تغییر به درصد نیست؛ درصد محاسبه می‌شود)
 *  فرمت واقعی: Index,IndexChange,IndexLow?,… — پارس tolerant خط اول */
export function parseTsetmcMarketTotal(text: string): TseIndex {
  const out: TseIndex = {};
  if (!text) return out;
  const first = faToEnDigits(text.trim().split('\n')[0] || '');
  const parts = first.split(',').map((p) => p.trim());
  const idx = num(parts[0]);
  if (idx !== null && idx > 1000) out.index = idx;
  const chg = num(parts[1]);
  if (chg !== null && out.index && out.index > 0) {
    // تغییر مطلق شاخص → درصد نسبت به شاخصِ امروز (شاخص دیروز = امروز − تغییر)
    out.changePct = Math.round((chg / (out.index - chg || 1)) * 10000) / 100;
  }
  return out;
}

// ---------- خودرو — کانال‌های خبری خودرو تلگرام (فرمت «مدل⬅️قیمت») ----------

export interface CarEntry { model: string; valueToman: number; displayRaw: string; date?: string }

/** نرمال‌سازی نام مدل برای یکتاسازی/تطبیق — ی/ک فارسی، بدون علائم */
export function normalizeCarModel(s: string): string {
  return faToEnDigits(s)
    .toLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** یک خط قیمت «ساینا⬅️1.815» یا «سورن(XU7P)⬅️برق:1.565/رینگ:1.597» → ورودی خودرو
 *  فقط فرمت ⬅ پذیرفته می‌شود (فرمت ثابت کانال‌های قیمت) — خطوط «قیمت دلار: …» و تبلیغات رد می‌شوند.
 *  واحد محاوره‌ای کانال: عدد <۳۰ = میلیارد تومان، ≥۳۰ = میلیون تومان (پراید ۴۸۵ = ۴۸۵ میلیون) */
export function parseCarLine(line: string): CarEntry | null {
  const clean = faToEnDigits(line).replace(/⬅️|⬅|←/g, '⬅');
  const sepIdx = clean.indexOf('⬅');
  if (sepIdx < 0) return null;
  const model = clean.slice(0, sepIdx).replace(/[⭕️❌️🔴🔹🔸💠•\-–—*#|]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\u200c\s]+|[\u200c\s]+$/g, '').trim();
  const valuePart = clean.slice(sepIdx + 1);
  const m = valuePart.match(/\d+(?:\.\d+)?/);
  if (!model || !m) return null;
  if (model.length < 2 || model.length > 60) return null;
  const v = Number(m[0]);
  if (!Number.isFinite(v) || v <= 0) return null;
  // حذف خطوط راهنما/تبلیغ (شماره تلفن و…) — قرارداد کانال: <۳۰ = میلیارد تومان، ≥۳۰ = میلیون تومان
  // (هر دو یک مقیاس تومان‌اند: ۳۰۰۰ میلیون = ۳٫۰ میلیارد) — بازهٔ معقول خودرو: ۵۰ میلیون تا ۳۰ میلیارد
  if (v < 0.05 || v > 29999) return null;
  const valueToman = v < 30 ? v * 1e9 : v * 1e6;
  return { model, valueToman, displayRaw: String(v) };
}

/** شمار خطوط قیمت واقعی یک پیام — معیار تشخیص «فهرست قیمت» از متن معمولی */
export function carListLineCount(text: string): number {
  return (text || '').split('\n').filter((l) => parseCarLine(l.trim()) !== null).length;
}

/** مدل‌های پرتیراژ و پرتقاضا به ترتیب نمایش — تطبیق با زیررشتهٔ نرمال‌شده.
 *  خواستهٔ کاربر (۱۰ نوامبر ۲۰۲۶): «پرتیراژترین خودروهای داخل ایران در این لیست حتماً
 *  همیشه آخرین قیمت آپدیت بشه» — این فهرست با انبار ماندگار (carStore) همیشه کامل می‌آید. */
export const CAR_FEATURED: Array<{ match: string; label: string }> = [
  { match: 'پراید', label: 'پراید' },
  { match: 'تیبا', label: 'تیبا' },
  { match: 'کوییک', label: 'کوییک' },
  { match: 'کوئیک', label: 'کوئیک' },
  { match: 'شاهین', label: 'شاهین' },
  { match: 'ساینا', label: 'ساینا' },
  { match: 'سورن', label: 'سورن' },
  { match: 'دنا', label: 'دنا' },
  { match: 'تارا', label: 'تارا' },
  { match: 'سمند', label: 'سمند' },
  { match: 'پارس', label: 'پژو پارس' },
  { match: '405', label: 'پژو ۴۰۵' },
  { match: '206', label: 'پژو ۲۰۶' },
  { match: '207', label: 'پژو ۲۰۷' },
  { match: 'رانا', label: 'رانا' },
  { match: 'ری را', label: 'ری‌را' },
  { match: 'ریرا', label: 'ری‌را' },
  { match: 'پیکان', label: 'پیکان' },

  // ---------- خانوادهٔ کرمان موتور / KMC — خواستهٔ کاربر ۱۲ نوامبر ۲۰۲۶:
  //  «قیمت ماشینهای کرمان موتور خصوصا j4 و sr3 رو اضافه کن و قیمتشون رو از کانال
  //  اخبار خودرو دربیار اگر نبود از نت دربیار» — SR3 غایب در کانال از باما (نت) می‌آید ----------
  { match: 'sr3', label: 'کی ام سی SR3' },
  { match: 'j4', label: 'جک J4' },
  { match: 'j7', label: 'جک J7' },
  { match: 't9', label: 'جک T9' },
  // «الیت» از فهرست عادی حذف شد — فیدلیتی الیت ۷نفره اکنون با قیمت کارخانهٔ باما در
  // CAR_BAMA_MODELS می‌آید (۱۹ نوامبر + بازآرایی ۲۳ نوامبر)؛ «فید» = فیدلیتی‌های دیگر کانال
  { match: 'فید', label: 'فیدلیتی' },
  { match: 'لاماری', label: 'لاماری' },
  { match: 'اتلس', label: 'اتلس اس' },
  { match: 'هایما', label: 'هایما' },
  { match: 'تیگو', label: 'تیگو' },
  { match: 'اریزو', label: 'آریزو' },
];

// ---------- پشتیبان «از نت» برای مدل‌های غایب در کانال — خواستهٔ کاربر ۱۲ نوامبر ۲۰۲۶ ----------
// خالی — SR3 که سابقاً اینجا بود اکنون در سه‌گانهٔ VIP با قیمت کارخانهٔ باما همیشه
// می‌آید (بازار: کانال/انبار → باما) و پشتیبانِ دوبارش، ردیف تکراری «SR3 بی‌کارخانه»
// می‌ساخت (خواستهٔ ۲۰ نوامبر هفتم: ستون سوم دقیق). سازوکار برای مدل‌های آینده می‌ماند؛
// حلقهٔ واکشی مدلِ تحت‌پوشش VIP را هم نادیده می‌گیرد (سپر دوم پیکربندی).
export interface CarWebSource { match: string; label: string; url: string; hostLabel: string }

export const CAR_WEB_SOURCES: CarWebSource[] = [];

// ---------- خودروهای باما — پوشش کامل بازار+کارخانه برای همهٔ خانواده‌های پرتقاضا ----------
// خواستهٔ کاربر ۲۳ نوامبر ۲۰۲۶: «قیمت ماشین ها اولا کاملتر بشن، دوما به ترتیب قیمت چیده بشن،
//  سوما هنوز قیمت کارخانه بعضیهاشون نیومده، اولا چک کن از سایت باما دات کام آخرین قیمت
//  کارخونه و بازارو» — جانشین سه‌گانهٔ VIP (خواستهٔ ۱۹ نوامبر؛ J4/SR3/الیت اکنون در همین
//  فهرست‌اند). همهٔ اسلاگ‌ها ۲۳ نوامبر از خود bama.ir واکشی و راستی‌آزمایی شدند
//  (صفحهٔ قیمت + هر دو برچسب «قیمت کارخانه» و «قیمت نمایندگی») — هیچ اسلاگ حدسی نیست.
//  variants = نام‌های رایج کانال اخبار خودرو برای همین خانواده (تطبیق زیررشتهٔ نرمال‌شده —
//  کانال می‌نویسد «پ207»، «ریرا»، «هایما s8»، «اریزو8»…). مرتب‌سازی نهایی بر اساس قیمت
//  در mergeCarQuotes انجام می‌شود، نه اینجا.
export interface CarBamaModel {
  /** نخستین variant = کلید پایدار Quote (car:<نرمال>) */
  variants: string[];
  label: string;
  url: string;
}

export const CAR_BAMA_MODELS: CarBamaModel[] = [
  // ── سایپا ──
  { variants: ['پراید'], label: 'پراید ۱۵۱', url: 'https://bama.ir/price/pride_151_gx' },
  { variants: ['کوییک', 'کوئیک'], label: 'کوییک', url: 'https://bama.ir/price/quick_manuals' },
  { variants: ['ساینا'], label: 'ساینا', url: 'https://bama.ir/price/saina_manuals_mtgas' },
  { variants: ['شاهین'], label: 'شاهین', url: 'https://bama.ir/price/shahin_g' },
  { variants: ['اطلس'], label: 'اطلس', url: 'https://bama.ir/price/atlas_g_mt' },
  { variants: ['سهند'], label: 'سهند', url: 'https://bama.ir/price/sahand_smt_gasoline' },
  { variants: ['اریسان'], label: 'آریسان', url: 'https://bama.ir/price/arisun_2' },
  { variants: ['پارس نوا'], label: 'پارس نوآ', url: 'https://bama.ir/price/parsnoa_1.6liter_mt' },
  // ── ایران خودرو ──
  { variants: ['پژو 207', 'پ207', 'پژو207'], label: 'پژو ۲۰۷', url: 'https://bama.ir/price/peugeot_207_manualtu5p' },
  { variants: ['تارا'], label: 'تارا', url: 'https://bama.ir/price/tara_v1p_6mt' },
  { variants: ['دنا'], label: 'دنا پلاس', url: 'https://bama.ir/price/dena_plusef7p_6mt' },
  { variants: ['رانا'], label: 'رانا', url: 'https://bama.ir/price/runna_plus_tu5plus' },
  { variants: ['سورن'], label: 'سورن پلاس', url: 'https://bama.ir/price/samand_soren_plustu5p' },
  { variants: ['ری را', 'ریرا'], label: 'ری‌را', url: 'https://bama.ir/price/reera_1.7literturbo_6at' },
  { variants: ['هایما s5', 'هایما اس5'], label: 'هایما S5', url: 'https://bama.ir/price/haima_s5_6at' },
  { variants: ['هایما s7', 'هایما اس7'], label: 'هایما S7', url: 'https://bama.ir/price/haima_s7_1.5literturbopro' },
  { variants: ['هایما 8s', 'هایما s8'], label: 'هایما 8S', url: 'https://bama.ir/price/haima_8s' },
  { variants: ['هایما 7x', 'هایما x7'], label: 'هایما 7X', url: 'https://bama.ir/price/haima_7x_1.6literturbo' },
  // ── کرمان موتور ──
  { variants: ['j4', 'جی4'], label: 'جک J4', url: 'https://bama.ir/price/jac_j4' },
  { variants: ['sr3'], label: 'کی ام سی SR3', url: 'https://bama.ir/price/kmc_sr3_1.6liter' },
  { variants: ['j7'], label: 'کی ام سی J7', url: 'https://bama.ir/price/kmc_j7' },
  { variants: ['t9'], label: 'کی ام سی T9', url: 'https://bama.ir/price/kmc_t9_2literturbo' },
  { variants: ['t8'], label: 'کی ام سی T8', url: 'https://bama.ir/price/kmc_t8' },
  { variants: ['x5'], label: 'کی ام سی X5', url: 'https://bama.ir/price/kmc_x5_1.5literturbo' },
  { variants: ['ej7'], label: 'کی ام سی eJ7', url: 'https://bama.ir/price/kmc_ej7_plus' },
  { variants: ['a5'], label: 'کی ام سی A5', url: 'https://bama.ir/price/kmc_a5_1.5literturbo' },
  { variants: ['ایگل'], label: 'کی ام سی ایگل', url: 'https://bama.ir/price/kmc_eagle_1.5liter' },
  { variants: ['sr6'], label: 'کی ام سی SR6', url: 'https://bama.ir/price/kmc_sr6_1.5literturbo' },
  // ── لاماری ──
  { variants: ['لاماری اکو'], label: 'لاماری اکو', url: 'https://bama.ir/price/lamari_echo_1.5literturbo' },
  { variants: ['لاماری ایما'], label: 'لاماری ایما', url: 'https://bama.ir/price/lamari_eama' },
  { variants: ['لاماری نئو'], label: 'لاماری نئو', url: 'https://bama.ir/price/lamari_neo_1.5literturbo' },
  // ── مدیران خودرو (فونیکس) ──
  { variants: ['اریزو6', 'اریزو 6'], label: 'آریزو ۶ پرو', url: 'https://bama.ir/price/fownix_arrizo6pro' },
  { variants: ['اریزو8', 'اریزو 8'], label: 'آریزو ۸', url: 'https://bama.ir/price/fownix_arrizo8_excellent' },
  { variants: ['تیگو7', 'تیگو 7'], label: 'تیگو ۷ پرو', url: 'https://bama.ir/price/fownix_tiggo7pro_premium' },
  { variants: ['تیگو8', 'تیگو 8'], label: 'تیگو ۸ پرو مکس', url: 'https://bama.ir/price/fownix_tiggo8promax_ie' },
  { variants: ['اف ایکس'], label: 'فونیکس FX', url: 'https://bama.ir/price/fownix_fx_premium' },
  // ── فیدلیتی ──
  { variants: ['الیت', 'فیدلیتی الیت'], label: 'فیدلیتی الیت ۷نفره', url: 'https://bama.ir/price/fidelity_elite_7seater' },
  // ── سایر داخلی ──
  { variants: ['اینوی'], label: 'اینوی هیبرید', url: 'https://bama.ir/price/envoy_hybrid_1.5liter' },
];

/** نتیجهٔ واکشی یک مدل باما — خالص و تست‌پذیر */
export interface BamaCarResult {
  variants: string[];
  label: string;
  market: number | null;
  factory: number | null;
}

/** ادغام ردیف‌های کانال با نتایج باما — خواستهٔ کاربر ۲۳ نوامبر:
 *  «کاملتر» + «به ترتیب قیمت» + «قیمت کارخانه از باما».
 *  • هر خانوادهٔ باما: یک ردیف — بازار = باما (جفتِ هم‌تیپ با کارخانه؛ اختلاف ستون سوم
 *    معنادار می‌شود)؛ باما بازار نداد → بازار کانال (پشتیبان صادقانه)؛ هیچ‌کدام → غایب.
 *  • کارخانه = «قیمت کارخانه/نمایندگی» باما؛ بازهٔ معقول ۱۰۰میلیارد تا ۵۰ میلیارد تومان.
 *  • ردیف‌های کانالِ خارج از پوشش باما (تیبا، پیکان، ۲۰۶، پارس، ۴۰۵، سمند…) عیناً می‌مانند.
 *  • خروجی: همهٔ خودروها صعودی بر اساس قیمت بازار (ارزان → گران). تابع خالص تست‌پذیر. */
export function mergeCarQuotes(channelQuotes: Quote[], bama: BamaCarResult[]): Quote[] {
  const bamaNorms = bama.map((b) => ({ ...b, norms: b.variants.map(normalizeCarModel).filter(Boolean) }));
  const out: Quote[] = [];
  const usedChannel = new Set<Quote>();
  for (const b of bamaNorms) {
    // نخستین ردیف کانالِ همین خانواده (پشتیبانِ بازار)
    const chan = channelQuotes.find((q) => !usedChannel.has(q) && b.norms.some((n) => q.key.slice(4).includes(n)));
    if (chan) usedChannel.add(chan);
    const bamaMktOk = b.market !== null && b.market >= 1e9 && b.market <= 3e10;
    const value = bamaMktOk ? (b.market as number) : chan ? chan.value : null;
    if (value === null) continue; // هیچ منبعی برای بازار نبود — صادقانه غایب
    const factoryOk = b.factory !== null && b.factory >= 1e8 && b.factory <= 5e10;
    out.push({
      key: `car:${b.norms[0]}`,
      title: b.label,
      value,
      unit: 'toman',
      srcLabel: bamaMktOk ? 'باما (نت)' : (chan?.srcLabel || 'باما (نت)'),
      note: chan && !bamaMktOk ? chan.note : undefined,
      factoryToman: factoryOk ? (b.factory as number) : undefined,
      factorySrc: factoryOk ? 'باما' : undefined,
      emoji: '🚗',
    });
  }
  // ردیف‌های کانالِ خارج از پوشش باما — دست‌نخورده
  for (const q of channelQuotes) if (!usedChannel.has(q)) out.push(q);
  // ترتیب قیمت: صعودی (ارزان → گران) — خواستهٔ کاربر ۲۳ نوامبر
  return out.sort((a, b2) => a.value - b2.value);
}

/** نخستین «قیمت بازار X,X…X تومان» صفحهٔ قیمت باما — تیپ مدل‌سال جدیدتر اول می‌آید.
 *  تابع خالص تست‌پذیر؛ نامعتبر → null. */
export function parseBamaMarketPrice(html: string): number | null {
  try {
    const t = (html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
    const m = t.match(/قیمت بازار\s*([0-9]{1,3}(?:,[0-9]{3}){2,})\s*تومان/);
    return m ? num(m[1]) : null;
  } catch {
    return null;
  }
}

/** قیمت بازار + قیمت کارخانه (نمایندگی) یک صفحهٔ باما — خواستهٔ کاربر ۱۹ نوامبر:
 *  ستون مجاز قیمت کارخانه و اختلاف بازار/کارخانه. نخستین تطبیق = مدل‌سال جدیدتر.
 *  نقد ۲۳ نوامبر — ریشهٔ «قیمت کارخانه بعضی مدل‌ها نیومده»: باما برای بیشتر مدل‌های
 *  داخلی برچسب رسمی را «قیمت کارخانه» می‌نویسد و فقط برای برخی «قیمت نمایندگی»
 *  (نمونهٔ واقعی ۲۳ نوامبر: pride_151_gx کارخانه ۱٬۱۹۰میلیارد؛ jac_j4 نمایندگی
 *  ۱٬۶۱۰میلیارد) — پارسر قبلی فقط «نمایندگی» را می‌گرفت و ۱۶ از ۲۳ قیمت رسمی را
 *  از دست می‌داد. حالا هر دو برچسب. تابع خالص تست‌پذیر؛ هر عدد نامعتبر → null مستقل. */
export function parseBamaPrices(html: string): { market: number | null; factory: number | null } {
  try {
    const t = (html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
    const mkt = t.match(/قیمت بازار\s*([0-9]{1,3}(?:,[0-9]{3}){2,})\s*تومان/);
    const fct = t.match(/قیمت (?:کارخانه|نمایندگی)\s*([0-9]{1,3}(?:,[0-9]{3}){2,})\s*تومان/);
    return { market: mkt ? num(mkt[1]) : null, factory: fct ? num(fct[1]) : null };
  } catch {
    return { market: null, factory: null };
  }
}

/** ما به‌التفاوت بازار نسبت به کارخانه — عدد و درصد در یک جا (خواستهٔ کاربر ۱۹ نوامبر:
 *  «جلوش تو ستون مجزا هم ما به التفاوت و هم درصد تفاوت رو بزار»). کارخانه نامعتبر → null. تابع خالص. */
export function carFactoryDelta(market: number, factory: number | undefined): { diff: number; pct: number } | null {
  if (!factory || !Number.isFinite(factory) || factory <= 0 || !Number.isFinite(market)) return null;
  return {
    diff: Math.round(market - factory),
    pct: Math.round(((market - factory) / factory) * 10000) / 100,
  };
}

/** اختلاف قیمت بازار از قیمت رسمی (دولتی/کارخانه) — خواستهٔ کاربر ۲۰ نوامبر هفتم:
 *  «ستون سوم رو با دقت همراه با درصد و مبلغ اختلاف کنارش بروز کنی» — کنار هر قیمت
 *  رسمی، فاصله‌اش تا بازار هم به مبلغ و هم به درصد می‌آید. قیمت رسمی نامعتبر → null.
 *  تابع خالص تست‌پذیر. */
export function officialDeltaOf(q: Quote): { diff: number; pct: number } | null {
  return carFactoryDelta(q.value, q.officialToman ?? q.factoryToman);
}

/** عدد فشردهٔ خوانا بدون واحد پایه (تومان/دلار) ولی با واژهٔ مقیاس — «۱٫۹۳۰ میلیارد»
 *  | «۹٫۷۵۰ میلیون» | «۷۶٬۳۳۷» | دلار/شاخص بی‌مقیاس. علامت ندارد (جهت را فلش/رنگ
 *  نشان می‌دهد). تابع خالص. */
export function compactNum(v: number, unit: QuoteUnit): string {
  const a = Math.abs(v);
  if (unit === 'usd') return faGroup(a, a >= 100 ? 0 : 2);
  if (unit === 'index') return faGroup(a, 0);
  if (a >= 1e9) return `${faGroup(a / 1e9, 3)} میلیارد`;
  if (a >= 1e6) return `${faGroup(a / 1e6, a / 1e6 >= 100 ? 0 : 3)} میلیون`;
  return faGroup(a, 0);
}

/** مبلغ اختلاف فشرده با واحد — «۱٫۹۳۰ میلیارد تومان» | «۹٫۷۵۰ میلیون تومان» | «۷۶٬۳۳۷ تومان»
 *  | «۱٬۴۵۰ دلار». تابع خالص. */
export function compactDelta(v: number, unit: QuoteUnit): string {
  const word = unit === 'usd' ? ' دلار' : unit === 'index' ? '' : ' تومان';
  return `${compactNum(v, unit)}${word}`;
}

// ---------- انبار ماندگار قیمت خودرو — همیشه پرتیراژها در فهرست ----------

export interface CarStoreEntry { model: string; valueToman: number; date: string; source: string }
export type CarStore = Record<string, CarStoreEntry>;

/** ادغام قیمت‌های تازه در انبار — تاریخ تازه‌تر جایگزین می‌شود؛ تابع خالص تست‌پذیر */
export function mergeCarStore(store: CarStore | undefined, cars: CarEntry[], nowIso: string): CarStore {
  const out: CarStore = { ...(store || {}) };
  for (const c of cars) {
    const k = normalizeCarModel(c.model);
    if (!k) continue;
    const old = out[k];
    const newTs = Date.parse(c.date || '') || Date.parse(nowIso) || Date.now();
    if (!old || (Date.parse(old.date || '') || 0) <= newTs) {
      out[k] = { model: c.model, valueToman: c.valueToman, date: new Date(newTs).toISOString(), source: c.date ? 'کانال اخبار خودرو' : 'آخرین اعلام' };
    }
  }
  return out;
}

export interface FeaturedCar extends CarEntry { ageDays: number }

/** فهرست نمایشی همیشگی از انبار — پرتیراژها همیشه می‌آیند حتی اگر امروز در کانال نبودند؛
 *  کهنگی صادقانه با ageDays اعلام می‌شود (هیچ قیمت ساختگی). تابع خالص تست‌پذیر. */
export function featuredCarsFromStore(store: CarStore | undefined, nowIso: string, limit = 12): FeaturedCar[] {
  const now = Date.parse(nowIso) || Date.now();
  const out: FeaturedCar[] = [];
  const usedKeys = new Set<string>();
  for (const f of CAR_FEATURED) {
    if (out.length >= limit) break;
    const fm = normalizeCarModel(f.match);
    if (!fm) continue;
    // تطبیق دقیق‌تر: کلید انبار که شامل مدل باشد — اولویت با کلید کوتاه‌تر (مدل خالص‌تر)
    const hit = Object.entries(store || {})
      .filter(([k]) => !usedKeys.has(k) && k.includes(fm))
      .sort((a, b) => a[0].length - b[0].length)[0];
    if (hit) {
      usedKeys.add(hit[0]);
      const e = hit[1];
      const ageDays = Math.max(0, Math.floor((now - (Date.parse(e.date || '') || now)) / 86400000));
      out.push({ model: e.model, valueToman: e.valueToman, displayRaw: String(e.valueToman), date: e.date, ageDays });
    }
  }
  return out;
}

/** پارس چند پیام کانال خودرو — همهٔ پیام‌های فهرست‌قیمت (≥۳ خط قیمت) اسکن و
 *  برای هر مدل «تازه‌ترین» قیمت می‌ماند. تابع خالص تست‌پذیر. */
export function parseCarPriceLists(messages: Array<{ text: string; date?: string }>): CarEntry[] {
  const byModel = new Map<string, CarEntry & { sortDate: number }>();
  for (const msg of messages) {
    if (!msg?.text) continue;
    const lines = msg.text.split('\n');
    const entries: CarEntry[] = [];
    for (const line of lines) {
      const e = parseCarLine(line.trim());
      if (e) entries.push({ ...e, date: msg.date });
    }
    if (entries.length < 3) continue; // فهرست واقعی قیمت — نه متن معمولی خبر
    const ts = msg.date ? Date.parse(msg.date) : 0;
    for (const e of entries) {
      const k = normalizeCarModel(e.model);
      if (!k) continue;
      const old = byModel.get(k);
      if (!old || ts >= old.sortDate) byModel.set(k, { ...e, model: e.model.trim(), sortDate: ts });
    }
  }
  return [...byModel.values()].map(({ model, valueToman, displayRaw, date }) => ({ model, valueToman, displayRaw, date }));
}

/** گزینش مدل‌های نمایشی: اول تطبیق فهرست پرتقاضا؛ کمتر از ۴ مورد → تازه‌ترین‌ها */
export function pickFeaturedCars(cars: CarEntry[], limit = 10): CarEntry[] {
  const norm = cars.map((c) => ({ c, k: normalizeCarModel(c.model) }));
  const out: CarEntry[] = [];
  const used = new Set<string>();
  for (const f of CAR_FEATURED) {
    if (out.length >= limit) break;
    const hit = norm.find((x) => !used.has(x.k) && x.k.includes(normalizeCarModel(f.match)));
    if (hit) { out.push(hit.c); used.add(hit.k); }
  }
  if (out.length < 4) {
    for (const x of norm) {
      if (out.length >= limit) break;
      if (!used.has(x.k)) { out.push(x.c); used.add(x.k); }
    }
  }
  return out;
}

// ---------- واکشی‌های زنده ----------

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function get(url: string, timeoutMs = 12_000): Promise<{ ok: boolean; text?: string; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json,text/html,*/*' }, signal: ctrl.signal, redirect: 'follow' });
    const text = await res.text().catch(() => '');
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    if (!text) return { ok: false, error: 'پاسخ خالی' };
    return { ok: true, text };
  } catch (e) {
    // پیام خطا فارسی و کوتاه — متن خام انگلیسی موتور fetch هرگز در پیام کانال نمی‌آید
    return { ok: false, error: e instanceof Error ? (e.name === 'AbortError' ? `timeout ${timeoutMs}ms` : 'در دسترس نبود') : 'در دسترس نبود' };
  } finally {
    clearTimeout(timer);
  }
}

export interface FetchMarketOpts {
  /** فهرست شناسهٔ کانال‌های خودرو (t.me/s/<id>) — پیش‌فرض: پژو‌خودرو + اخبار خودروئی + آخرین خودرو */
  carChannels?: string[];
  timeoutMs?: number;
  /** انبار ماندگار قیمت خودرو — ورودی/خروجی این واکشی (خواستهٔ کاربر: همیشه پرتیراژها) */
  carStore?: CarStore;
}

export interface MarketData {
  quotes: Quote[];
  /** سطرهای «دریافت نشد» — صراحت کامل */
  failures: string[];
  sources: string[];
  /** انبار به‌روزشدهٔ قیمت خودرو — caller در state ذخیره می‌کند */
  carStore?: CarStore;
  /** مقادیر زندهٔ tgju (ajax.json) — سوختِ نقطهٔ «امروز» نمودار دارایی‌ها (bot/assets-chart.ts) */
  tgjuCurrent?: Record<string, TgjuEntry>;
}

/** واکشی tgju با پشتیبان host دوم (call2) — خواستهٔ کاربر: «قیمت دلار خالی نباشه» */
async function fetchTgjuCurrent(timeoutMs: number): Promise<{ cur: Record<string, TgjuEntry>; error?: string }> {
  let firstErr = '';
  for (const host of ['https://call1.tgju.org/ajax.json', 'https://call2.tgju.org/ajax.json']) {
    const tg = await get(host, timeoutMs);
    if (tg.ok && tg.text) {
      const cur = parseTgjuCurrent(tg.text);
      if (Object.keys(cur).length > 0) return { cur };
    }
    firstErr = tg.error || 'پاسخ قابل تجزیه نبود';
  }
  return { cur: {}, error: firstErr };
}

/** واکشی همهٔ قیمت‌ها — خطای هر منبع بقیه را نمی‌اندازد؛ هر شکست صادقانه در failures */
export async function fetchMarketData(opts: FetchMarketOpts = {}): Promise<MarketData> {
  const failures: string[] = [];
  const sources = new Set<string>();
  const quotes: Quote[] = [];
  const timeoutMs = opts.timeoutMs ?? 12_000;

  // ۱) tgju — طلا/سکه + پشتیبان‌ها (host اول → پشتیبان host دوم)
  let tgjuCur: Record<string, TgjuEntry> = {};
  const tg = await fetchTgjuCurrent(timeoutMs);
  if (Object.keys(tg.cur).length > 0) {
    tgjuCur = tg.cur;
    sources.add('tgju');
  } else {
    failures.push(`tgju: ${tg.error || 'ناموفق'}`);
  }

  const g18 = rialToToman(num(tgjuCur.geram18?.p));
  const g24 = rialToToman(num(tgjuCur.geram24?.p));
  const sek = rialToToman(num(tgjuCur.sekee?.p));
  const nimQ = rialToToman(num(tgjuCur.nim?.p));
  const q18 = tgjuQuote(tgjuCur, 'geram18', g18, 'طلای ۱۸ عیار', 'toman', '🥇');
  const q24 = tgjuQuote(tgjuCur, 'geram24', g24, 'طلای ۲۴ عیار', 'toman', '🥇');
  const qSek = tgjuQuote(tgjuCur, 'sekee', sek, 'سکه امامی', 'toman', '🪙');
  const qNim = tgjuQuote(tgjuCur, 'nim', nimQ, 'نیم‌سکه', 'toman', '🪙');
  // قیمت دولتی سکه — بهار آزادی طرح بانکی (tgju: sekeb)؛ ستون «کارخانه/دولتی» (خواستهٔ ۲۰ نوامبر)
  const sekeBanki = rialToToman(num(tgjuCur.sekeb?.p));
  if (qSek && sekeBanki && sekeBanki > 0) {
    qSek.officialToman = sekeBanki;
    qSek.officialSrc = 'بانکی (بهار آزادی)';
  }
  // قیمت دولتی دلار — نرخ فروش حوالهٔ مرکز مبادله (tgju: ice_transfer_usd_sell)؛
  // همان رقمی که اخبار «دلار مرکز مبادله» می‌نامند (خواستهٔ کاربر ۲۰ نوامبر)
  const usdIce = rialToToman(num(tgjuCur.ice_transfer_usd_sell?.p));
  const usdOfficial = usdIce && usdIce > 0 ? usdIce : undefined;
  for (const q of [q18, q24, qSek, qNim]) if (q) quotes.push(q);

  const brentUsd = num(tgjuCur.oil_brent?.p);
  const qBrent = tgjuQuote(tgjuCur, 'oil_brent', brentUsd, 'نفت برنت', 'usd', '🛢');
  if (qBrent) quotes.push(qBrent); else failures.push('برنت: در tgju یافت نشد');

  const btcUsd = num(tgjuCur['crypto-bitcoin']?.p);
  const usdTgju = rialToToman(num(tgjuCur.price_dollar_rl?.p));
  const tedpixTgju = num(tgjuCur.bourse?.p);

  // ۲) نوبیتکس — دلار و بیت‌کوین (اولویت اول کاربر) — مسدود/خطا → پشتیبان tgju
  const nb = await get('https://api.nobitex.ir/market/stats/get?srcCurrency=btc,usdt&dstCurrency=rls', timeoutMs);
  let nobitexOk = false;
  if (nb.ok && nb.text) {
    const st = parseNobitexStats(nb.text);
    if (st.usdToman) {
      nobitexOk = true;
      sources.add('نوبیتکس');
      quotes.push({
        key: 'usd', title: 'دلار (تتر نوبیتکس)', value: st.usdToman, unit: 'toman',
        srcLabel: 'نوبیتکس', emoji: '💵', changePct: st.usdChangePct,
        officialToman: usdOfficial, officialSrc: usdOfficial ? 'مرکز مبادله' : undefined,
      });
    } else {
      failures.push('نوبیتکس دلار: پاسخ فاقد قیمت');
    }
    if (st.btcToman) {
      nobitexOk = true;
      quotes.push({
        key: 'btc', title: 'بیت‌کوین', value: st.btcToman, unit: 'toman',
        srcLabel: 'نوبیتکس', emoji: '₿', changePct: st.btcChangePct,
      });
    } else if (!btcUsd) {
      failures.push('نوبیتکس بیت‌کوین: پاسخ فاقد قیمت');
    }
  } else {
    failures.push(`نوبیتکس: ${nb.error || 'ناموفق'}`);
  }
  if (!nobitexOk || quotes.every((q) => q.key !== 'usd')) {
    // پشتیبان tgju — فقط اگر نوبیتکس دلار نداد
    if (!quotes.some((q) => q.key === 'usd') && usdTgju) {
      quotes.push({
        key: 'usd', title: 'دلار', value: usdTgju, unit: 'toman', srcLabel: 'tgju', emoji: '💵',
        changePct: tgjuChangePct(tgjuCur.price_dollar_rl),
        officialToman: usdOfficial, officialSrc: usdOfficial ? 'مرکز مبادله' : undefined,
      });
    }
    if (!quotes.some((q) => q.key === 'btc') && btcUsd) {
      quotes.push({
        key: 'btc', title: 'بیت‌کوین', value: btcUsd, unit: 'usd', srcLabel: 'tgju', emoji: '₿',
        changePct: tgjuChangePct(tgjuCur['crypto-bitcoin']),
      });
    }
  }

  // ۳) شاخص کل بورس — اول سایت خود بورس (tsetmc)؛ نشد → tgju («سایتهای جایگزین»)
  let tseDone = false;
  try {
    const tse = await get('https://cdn.tsetmc.com/sites/default/files/tsev2/data/MarketTotal.aspx', timeoutMs);
    if (tse.ok && tse.text) {
      const idx = parseTsetmcMarketTotal(tse.text);
      if (idx.index) {
        sources.add('بورس تهران');
        quotes.push({ key: 'tedpix', title: 'شاخص کل بورس', value: idx.index, unit: 'index', srcLabel: 'بورس تهران', emoji: '📈', changePct: idx.changePct });
        tseDone = true;
      }
    }
  } catch { /* پشتیبان پایین */ }
  if (!tseDone) {
    if (tedpixTgju && tedpixTgju > 1000) {
      sources.add('tgju');
      quotes.push({ key: 'tedpix', title: 'شاخص کل بورس', value: tedpixTgju, unit: 'index', srcLabel: 'tgju', emoji: '📈', changePct: tgjuChangePct(tgjuCur.bourse) });
    } else {
      failures.push('شاخص بورس: tsetmc و tgju هر دو در دسترس نبودند');
    }
  }

  // ۴) برنت از tgju نیامد → پشتیبان stooq (CSV عمومی، صفر کلید)
  if (!quotes.some((q) => q.key === 'oil_brent')) {
    try {
      const st = await get('https://stooq.com/q/l/?s=cb.f&f=sd2t2ohlcv&h&e=csv', timeoutMs);
      if (st.ok && st.text) {
        const line = st.text.trim().split('\n')[1] || '';
        const cols = line.split(',');
        const close = num(cols[6]);
        if (close && close > 5) {
          sources.add('stooq');
          quotes.push({ key: 'oil_brent', title: 'نفت برنت', value: close, unit: 'usd', srcLabel: 'stooq', emoji: '🛢' });
        }
      }
    } catch { /* صادقانه دریافت نشد می‌ماند */ }
  }

  // ۵) خودرو — کانال‌های خبری خودرو (فهرست‌های «مدل⬅️قیمت» — کف بازار به اعلام کانال)
  //  صفحه‌بندی تا ۴ صفحه در هر کانال تا یافتن فهرست واقعی قیمت (۳ خط قیمت یا بیشتر)
  const chans = (opts.carChannels && opts.carChannels.length ? opts.carChannels : ['irankhodro3007', 'akhbar_khodroei', 'Akharin_khodro']).slice(0, 5);
  const carMsgs: Array<{ text: string; date?: string }> = [];
  for (const ch of chans) {
    let before = '';
    let channelOk = false;
    for (let page = 0; page < 4 && !channelOk; page++) {
      const r = await get(`https://t.me/s/${ch.trim()}${before}`, timeoutMs);
      if (!r.ok || !r.text) { if (page === 0) failures.push(`کانال خودرو ${ch}: ${r.error || 'ناموفق'}`); break; }
      const blocks = r.text.split('<div class="tgme_widget_message ').slice(1);
      let parsed = 0;
      for (const b of blocks) {
        const tm = b.match(/<time datetime="([^"]+)"/)?.[1];
        const tx = b.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
        if (!tx) continue;
        parsed++;
        const text = tx.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
        if (text && carListLineCount(text) >= 3) carMsgs.push({ text, date: tm });
      }
      channelOk = carMsgs.length > 0;
      if (parsed === 0) break;
      const oldest = [...blocks].reverse().map((b) => b.match(/data-post="([^"]+)"/)?.[1]).find(Boolean);
      if (!oldest) break;
      before = `?before=${oldest.split('/').pop()}`;
    }
    if (channelOk) sources.add('کانال اخبار خودرو');
  }
  if (carMsgs.length === 0) failures.push('خودرو: فهرست قیمت قابل استخراج از کانال‌ها نبود');
  const cars = parseCarPriceLists(carMsgs);
  // انبار ماندگار — پرتیراژها همیشه در فهرست می‌مانند حتی اگر امروز در کانال نبودند (خواستهٔ کاربر)
  const carStore = mergeCarStore(opts.carStore, cars, new Date().toISOString());
  const featured = featuredCarsFromStore(carStore, new Date().toISOString(), 18);
  const carQuotes: Quote[] = [];
  for (const c of featured) {
    carQuotes.push({
      key: `car:${normalizeCarModel(c.model)}`,
      title: c.model,
      value: c.valueToman,
      unit: 'toman',
      srcLabel: c.ageDays === 0 ? 'کانال اخبار خودرو' : 'آخرین اعلام کانال',
      note: c.ageDays >= 1 ? `آخرین به‌روزرسانی: ${faGroup(c.ageDays, 0)} روز پیش` : undefined,
      emoji: '🚗',
    });
  }
  // ── پوشش کامل باما — خواستهٔ کاربر ۲۳ نوامبر: «کاملتر + به ترتیب قیمت + قیمت کارخانه
  //  از باما» — هر خانوادهٔ CAR_BAMA_MODELS واکشی می‌شود (بازار + کارخانه/نمایندگی)؛
  //  ردیف‌های کانالِ همان خانواده فقط پشتیبانِ بازار‌اند. هیچ عدد ساختگی.
  //  آزموده‌شده ۲۳ نوامبر (سه اجرا): هر نرخِ بالای ~۲ درخواست/ثانیه از این IP محدودسازی
  //  نرخ باما را فعال می‌کند (۳کارگر×۳۵۰ms: ۱۰/۳۸؛ ۶هم‌زمانی: ۱۶/۳۸؛ اما متوالیِ ۱s
  //  پس از کانال‌ها: ۲۰/۲۰ کامل) — پس تک‌رشته با فاصلهٔ ۶۰۰ms و تلاش مجدد با ۲s مکث؛
  //  کل فهرست ~۶۰ ثانیه، فقط یکبار در روز در اسلات ۱۵:۰۰. ──
  const bamaResults: BamaCarResult[] = [];
  let bamaOkCount = 0;
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  for (const m of CAR_BAMA_MODELS) {
    let bp: { market: number | null; factory: number | null } = { market: null, factory: null };
    for (let attempt = 0; attempt < 2 && bp.market === null && bp.factory === null; attempt++) {
      if (attempt > 0) await sleep(2000); // مکث پیش از تلاش مجدد — محدودکنندهٔ نرخ آرام می‌گیرد
      const r = await get(m.url, timeoutMs);
      if (r.ok && r.text) bp = parseBamaPrices(r.text);
    }
    await sleep(600); // فاصلهٔ مؤدبانه — نرخ ~۱٫۵ درخواست/ثانیه، زیر آستانهٔ محدودسازی
    if (bp.market !== null || bp.factory !== null) bamaOkCount++;
    bamaResults.push({ variants: m.variants, label: m.label, market: bp.market, factory: bp.factory });
  }
  if (bamaOkCount === 0) failures.push('باما: هیچ صفحهٔ قیمت خودرو دریافت نشد (شبکه؟)');
  else sources.add('باما');
  // ادغام + مرتب‌سازی صعودی بر اساس قیمت (mergeCarQuotes — خواستهٔ ۲۳ نوامبر)
  const orderedCarQuotes = mergeCarQuotes(carQuotes, bamaResults);
  quotes.push(...orderedCarQuotes);

  return {
    quotes: applyDeltas(quotes, undefined),
    failures,
    sources: [...sources],
    carStore,
    // مقادیر زندهٔ tgju برای نقطهٔ «امروز» نمودار دارایی‌ها (خواستهٔ ۲۰ نوامبر)
    tgjuCurrent: Object.keys(tgjuCur).length > 0 ? tgjuCur : undefined,
  };
}

// ---------- قالب پیام ----------

/** قالب پیام گزارش بازار — HTML-امن (esc توسط caller با esc بات اعمال می‌شود؟ — نه؛
 *  اینجا خودش XML-escape می‌کند چون sendBaleMessage با parse_mode:HTML می‌فرستد) */
export function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface MarketMessageOptsDeprecated { /** حذف شد — امضای تازه: (quotes, prev) */ note?: string }

/** برچسب ستون رسمی یک قلم در پیام متنی — دلار: مرکز مبادله؛ سکه: بانکی؛ خودرو: کارخانه */
export function officialLabelOf(q: Quote): string {
  if (q.key === 'usd') return 'مرکز مبادله';
  if (q.key === 'sekee') return 'بانکی (بهار آزادی)';
  return 'کارخانه';
}

/** پیام گزارش بازار — پشتیبان متنی کارت؛ همان ساختار ۴ستونی جدول (خواستهٔ ۲۰ نوامبر ششم و هفتم):
 *  «نام: بازار (تغییر نسبت به دیروز ساعت ۱۵ با مبلغ اختلاف) | کارخانه/دولتی: قیمت (اختلاف مبلغ/درصد
 *  با بازار)». بدون سربرگ برند، بدون بلوک «دریافت نشد»، بدون خط «منابع». خودرو با عنوان
 *  «آخرین قیمت بازار آزاد خودرو». */
export function formatMarketMessage(quotes: Quote[], prev?: PriceSnapshot, prevDay?: PriceSnapshot): string {
  const withDelta = applyDeltas(quotes, prev, prevDay);
  const L: string[] = [];
  const line = (q: Quote): string => {
    const official = q.officialToman ?? q.factoryToman;
    const abs = q.changeAbs !== undefined && Number.isFinite(q.changeAbs) && q.changeAbs !== 0
      ? ` | ${compactDelta(q.changeAbs, q.unit)}`
      : '';
    const off = official && Number.isFinite(official) && official > 0
      ? ` | ${officialLabelOf(q)}: ${formatMoney(official, 'toman')}`
      : '';
    const gap = officialDeltaOf(q);
    const gapText = gap && Math.abs(gap.diff) > 0
      ? ` (اختلاف ${compactDelta(gap.diff, 'toman')} / ${faGroup(Math.abs(gap.pct), 1)}٪)`
      : '';
    return `${xmlEsc(q.title)}: ${formatMoney(q.value, q.unit)} (${formatPct(q.changePct)}${abs})${off}${gapText}`;
  };
  const cars = withDelta.filter((q) => q.key.startsWith('car:'));
  if (cars.length) {
    L.push('<b>🚗 آخرین قیمت بازار آزاد خودرو:</b>');
    for (const c of cars) L.push(`• ${line(c)}${c.note ? ` — ${xmlEsc(c.note)}` : ''}`);
    L.push('');
  }
  const gold = withDelta.filter((q) => ['geram18', 'geram24', 'sekee', 'nim'].includes(q.key));
  if (gold.length) {
    L.push('<b>🥇 طلا و سکه:</b>');
    for (const c of gold) L.push(`• ${line(c)}`);
    L.push('');
  }
  for (const key of ['usd', 'tedpix', 'btc', 'oil_brent']) {
    const q = withDelta.find((x) => x.key === key);
    if (q) L.push(`${q.emoji} <b>${line(q)}</b>`);
  }
  return L.join('\n');
}

/** پیام متنی دارایی‌ها و تورم — پشتیبان کارت مجزای bot/assets-card.ts (خواستهٔ ۲۴ نوامبر):
 *  طلا/سکه + ارز/بورس/کریپتو + تورم نقطه‌به‌نقطهٔ سالانه/ماهانهٔ بانک مرکزی + مسکن تهران.
 *  ردیف غایب صادقانه نمی‌آید (هیچ عدد ساختگی). */
export function formatAssetsMessage(quotes: Quote[], prev?: PriceSnapshot, prevDay?: PriceSnapshot, macro?: MacroStats): string {
  const withDelta = applyDeltas(quotes, prev, prevDay);
  const L: string[] = [];
  const gold = withDelta.filter((q) => ['geram18', 'geram24', 'sekee', 'nim'].includes(q.key));
  if (gold.length) {
    L.push('<b>🥇 طلا و سکه:</b>');
    for (const c of gold) L.push(`• ${xmlEsc(c.title)}: ${formatMoney(c.value, c.unit)} (${formatPct(c.changePct)})${c.officialToman ? ` | بانکی (بهار آزادی): ${formatMoney(c.officialToman, 'toman')}` : ''}`);
    L.push('');
  }
  for (const key of ['usd', 'tedpix', 'btc', 'oil_brent']) {
    const q = withDelta.find((x) => x.key === key);
    if (q) L.push(`${q.emoji} <b>${xmlEsc(q.title)}: ${formatMoney(q.value, q.unit)} (${formatPct(q.changePct)})</b>${q.officialToman ? ` — مرکز مبادله: ${formatMoney(q.officialToman, 'toman')}` : ''}`);
  }
  const m = macro || {};
  if (m.inflationYoy || m.inflationMom) {
    L.push('');
    L.push('<b>📊 تورم نقطه‌به‌نقطه (بانک مرکزی):</b>');
    if (m.inflationYoy) L.push(`• سالانه: ${faGroup(m.inflationYoy.pct, 1)}٪ (${m.inflationYoy.periodFa})`);
    if (m.inflationMom) L.push(`• ماهانه: ${faGroup(m.inflationMom.pct, 1)}٪ (${m.inflationMom.periodFa})`);
  }
  if (m.housingTehran) {
    L.push('');
    L.push(`<b>🏠 مسکن تهران — میانهٔ هر متر: ${formatMoney(m.housingTehran.tomanPerM2, 'toman')} (${m.housingTehran.periodFa} — کیلید)</b>`);
  }
  return L.join('\n');
}

/** عکس‌برداری مقادیر برای گزارش بعدی (پایهٔ درصد تغییر) */
export function snapshotOf(quotes: Quote[]): PriceSnapshot {
  const out: PriceSnapshot = {};
  for (const q of quotes) if (Number.isFinite(q.value) && q.value > 0) out[q.key] = q.value;
  return out;
}

/** سقف کهنگی پایهٔ درصد — گزارش ۱۵:۰۰ روزانه؛ بیشتر از ~۳۶ ساعت یعنی گزارش دیروز ناموفق بوده
 *  و پایهٔ موجود متعلق به «دیروز ساعت ۱۵» نیست (دو روز قبل است) */
export const SNAPSHOT_STALE_MS = 36 * 3_600_000;

/** انتخاب پایهٔ درصد بر اساس تازگی snapshot — خواستهٔ کاربر ۲۰ نوامبر (ششم) + ساعت ۲۳ نوامبر:
 *  «تغییرات نسبت به ساعت ۱۵ روز قبل محاسبه بشن». snapshot تازه (≤۳۶ ساعت) → پایهٔ
 *  «دیروز ساعت ۱۵» معتبر است (prevDay مقدم، سپس prev). کهنه/ناموجود → پایه‌ها کنار
 *  می‌روند (درصد از تغییر روزانهٔ خود منبع یا «—» می‌آید؛ هیچ درصد چندروزهٔ
 *  گمراه‌کننده‌ای نشان داده نمی‌شود). تابع خالص تست‌پذیر. */
export function snapshotBaseOf(
  snap?: PriceSnapshot,
  snapAt?: string,
  prevDay?: PriceSnapshot,
  nowMs: number = Date.now(),
  staleMs: number = SNAPSHOT_STALE_MS,
): { prev?: PriceSnapshot; prevDay?: PriceSnapshot; fresh: boolean } {
  const at = snapAt ? Date.parse(snapAt) : NaN;
  const fresh = Number.isFinite(at) && nowMs - at <= staleMs && nowMs >= at;
  if (!fresh) return { fresh: false };
  return { prev: snap, prevDay, fresh: true };
}

/** ترمیم مهر زمان snapshot بی‌مهر — snapshot نسخه‌های پیش از گزارش روزانه priceSnapAt
 *  نداشتند و گارد تازگی آن‌ها را بی‌پایه می‌گذاشت (ستون «تغییر نسبت به روز قبل» خالی
 *  می‌ماند — خواستهٔ ۲۰ نوامبر هفتم). lastPriceKey کلید اسلات تهران «YYYY-MM-DDTHH:MM»
 *  است = زمان واقعی آخرین گزارش → مهر معتبر می‌سازد. بی‌snapshot/مهدار/کلید نامعتبر →
 *  undefined (هیچ مهر ساختگی). تابع خالص تست‌پذیر. */
export function repairSnapshotAt(snap?: PriceSnapshot, snapAt?: string, lastPriceKey?: string): string | undefined {
  if (!snap || snapAt) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(lastPriceKey || '')) return undefined;
  const iso = new Date(`${lastPriceKey}:00+03:30`).toISOString();
  return Number.isFinite(Date.parse(iso)) ? iso : undefined;
}

// ---------- آمار کلان: تورم بانک مرکزی + مسکن تهران (خواستهٔ ۲۴ نوامبر) ----------
// «برای بخش طلا و دلار و بیتکوین و غیر ماشین، آمار تورم نقطه به نقطه سالانه و ماهانه
//  بانک مرمزی رو هم وارد کن … اگر برای مسکن تهران هم شاخصی هست بزن توش».
// منابع (۲۴ نوامبر راستی‌آزمایی شد):
//   تورم نقطه‌به‌نقطه (سالانه/ماهانه): صفحهٔ ایران TradingEconomics — منتشرکنندهٔ
//     ارقام CPI ایران بر پایهٔ دادهٔ بانک مرکزی؛ HTML عمومی، پارس جملهٔ توصیفی ثابت.
//   مسکن تهران: کیلید — «میانهٔ قیمت هر متر آپارتمان در تهران در <ماه>، <عدد> میلیون
//     تومان است» (متای صفحه، ماه‌به‌ماه به‌روز). هیچ عدد ساختگی؛ شکست هر منبع → همان
//     ردیف صادقانه غایب می‌ماند.

export interface MacroInflation {
  /** درصد تورم نقطه‌به‌نقطه */
  pct: number;
  /** برچسب دورهٔ شمسی — «تیر ۱۴۰۵» */
  periodFa: string;
  /** مقدار دورهٔ قبل (درصد) — نبود → undefined */
  prevPct?: number;
}

export interface MacroHousing {
  /** میانهٔ قیمت هر متر مربع آپارتمان تهران — تومان */
  tomanPerM2: number;
  /** برچسب دوره — «آبان ۱۴۰۵» */
  periodFa: string;
}

export interface MacroStats {
  inflationYoy?: MacroInflation;
  inflationMom?: MacroInflation;
  housingTehran?: MacroHousing;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** نام ماه میلادی + سال → برچسب ماه شمسی «تیر ۱۴۰۵» (نیمهٔ ماه مبنای تعلق است).
 *  نامعتبر → null. خالص تست‌پذیر. */
export function gregMonthToShamsiFa(monthEn: string, year: number): string | null {
  const m = MONTHS_EN.findIndex((x) => x.toLowerCase() === (monthEn || '').toLowerCase());
  if (m < 0 || !Number.isFinite(year) || year < 1990 || year > 2100) return null;
  const mid = new Date(Date.UTC(year, m, 15));
  try {
    // Intl فارسی سال را پیش از ماه می‌دهد («۱۴۰۵ تیر») — ماه و سال جدا قالب‌بندی و جابه‌جا می‌شوند
    const monthName = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' }).format(mid);
    const yearFa = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(mid);
    const out = `${monthName} ${yearFa}`.replace(/\s+/g, ' ').trim();
    return out || null;
  } catch {
    return null;
  }
}

/** پارس صفحهٔ تورم سالانهٔ ایرانِ TradingEconomics — جملهٔ ثابت:
 *  «Inflation Rate in Iran decreased to 87.90 percent in July from 88.60 percent in June of 2026.»
 *  خالص تست‌پذیر؛ نامعتبر → null. */
export function parseTeInflationYoy(html: string): MacroInflation | null {
  const flat = (html || '').replace(/\s+/g, ' ');
  const m = flat.match(/Inflation Rate in Iran (?:decreased|increased) to ([\d.]+) percent in (\w+) from ([\d.]+) percent in \w+ of (\d{4})/);
  if (!m) return null;
  const pct = Number(m[1]);
  const prev = Number(m[3]);
  const periodFa = gregMonthToShamsiFa(m[2]!, Number(m[4]));
  if (!Number.isFinite(pct) || pct < 0 || pct > 500 || !periodFa) return null;
  return { pct: Math.round(pct * 10) / 10, periodFa, prevPct: Number.isFinite(prev) ? prev : undefined };
}

/** پارس صفحهٔ تورم ماهانهٔ ایرانِ TradingEconomics — جملهٔ ثابت:
 *  «The Consumer Price Index in Iran increased 9.50 percent in June of 2026 over the previous month.»
 *  خالص تست‌پذیر؛ نامعتبر → null. */
export function parseTeInflationMom(html: string): MacroInflation | null {
  const flat = (html || '').replace(/\s+/g, ' ');
  const m = flat.match(/Consumer Price Index in Iran (?:increased|decreased) ([\d.]+) percent in (\w+) of (\d{4}) over the previous month/);
  if (!m) return null;
  const pct = Number(m[1]);
  const periodFa = gregMonthToShamsiFa(m[2]!, Number(m[3]));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100 || !periodFa) return null;
  return { pct: Math.round(pct * 10) / 10, periodFa };
}

/** پارس صفحهٔ بازار مسکن تهرانِ کیلید — متای توصیفی ثابت:
 *  «میانهٔ قیمت هر متر آپارتمان در تهران در آبان ۱۴۰۵، ۲۳۷٫۲ میلیون تومان است.»
 *  خالص تست‌پذیر؛ نامعتبر → null. */
export function parseKilidTehranPrice(html: string): MacroHousing | null {
  const flat = (html || '').replace(/\s+/g, ' ');
  const m = flat.match(/میانهٔ? قیمت هر متر آپارتمان در تهران در ([^،,.]{3,20}?)[،,]\s*([۰-۹٠-٩\d][۰-۹٠-٩\d٫٬.,]*) میلیون تومان/);
  if (!m) return null;
  const periodFa = m[1]!.trim();
  const numEn = faToEnDigits(m[2]!).replace(/[٫]/g, '.').replace(/[٬,]/g, '');
  const vMillion = Number(numEn);
  // واحدِ صفحه «میلیون تومان» است → تومان = ×۱میلیون؛ بازهٔ معقول تهران: ۲۰ تا ۲٬۰۰۰ میلیون
  if (!Number.isFinite(vMillion) || vMillion < 20 || vMillion > 2000) return null;
  if (!/^(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s*\d{2,4}$/.test(faToEnDigits(periodFa).replace(/\u200c/g, ' '))) return null;
  return { tomanPerM2: Math.round(vMillion * 1e6), periodFa: periodFa.replace(/\u200c/g, ' ') };
}

/** واکشی آمار کلان — هر منبع مستقل؛ شکست هر کدام فقط همان ردیف را غایب می‌کند.
 *  زنده و شبکه‌ای؛ برای تست، پارسرهای خالص بالا. */
export async function fetchMacroStats(timeoutMs = 15_000): Promise<MacroStats> {
  const out: MacroStats = {};
  try {
    const r = await get('https://tradingeconomics.com/iran/inflation-cpi', timeoutMs);
    if (r.ok && r.text) out.inflationYoy = parseTeInflationYoy(r.text) ?? undefined;
  } catch { /* صادقانه غایب */ }
  try {
    const r = await get('https://tradingeconomics.com/iran/inflation-rate-mom', timeoutMs);
    if (r.ok && r.text) out.inflationMom = parseTeInflationMom(r.text) ?? undefined;
  } catch { /* صادقانه غایب */ }
  try {
    const r = await get('https://kilid.com/house-prices/tehran', timeoutMs);
    if (r.ok && r.text) out.housingTehran = parseKilidTehranPrice(r.text) ?? undefined;
  } catch { /* صادقانه غایب */ }
  return out;
}
