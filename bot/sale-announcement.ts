/**
 * اطلاعیه‌های فروش/پیش‌فروش خودرو — بازطراحی بر پایهٔ خواستهٔ کاربر (۱۹ نوامبر ۲۰۲۶):
 * «میخوام در بخش اطلاعیه فروش خودرو آدرس و اسم آخرین خودرو حذف بشه و بجاش دوتا متن زیر خبر بزاری
 *  اول لینک اون خودروسازی مرتبط با بخشنامه فروش که کاربر بعد از مطالعه اطلاعیه با زدن روی لینک
 *  بره برای خرید دوم قیمت فروش کارخانه سوم قیمت بازار آزاد اون خودرو».
 *
 * ۱) «آدرس و اسم آخرین خودرو» = امضای انتهای اطلاعیهٔ کانال «آخرین خودرو»
 *    («@akharin_khodro | Akharinkhodro.ir») و خطوط تبلیغ کانال — کامل حذف می‌شود.
 * ۲) لینک خودروساز: سامانه‌های فروش رسمیِ تأییدشده (جست‌وجوی ۱۹ نوامبر ۲۰۲۶):
 *    ایران‌خودرو esale.ikco.ir • سایپا saipa.iranecar.com • کرمان‌موتور customer.bamco.ir •
 *    مدیران‌خودرو customer.mvmco.ir • گروه بهمن bahman.ir • کوشا‌خودرو (کیا) sale.kooshakhodro.com •
 *    نیلان‌خودرو (تویوتا) app.nilankhodro.com • ایلیا ilia-auto.com/sale
 * ۳) قیمت کارخانه: عدد اعلامی در خود اطلاعیه (ریال/تومان) — نبودش صادقانه «در اطلاعیه ذکر نشده».
 * ۴) قیمت بازار آزاد: قیمت «بازار» باما برای مدل شناسایی‌شده (فقط اسلاگ‌های تأییدشده) —
 *    نبود مدل/شکست واکشی → صادقانه غایب. هیچ عدد ساختگی.
 * همهٔ توابع خالص و تست‌پذیر — واکشی زنده در bot/bot.ts.
 */

/** سامانه‌های فروش رسمی خودروسازها — به ترتیب تطبیق (برند خاص‌تر قبل از شرکت مادر) */
export interface SalePortal {
  /** کلیدواژه‌های تطبیق — روی متن نرمال‌شده (نیم‌فاصله → فاصله) */
  keys: string[];
  url: string;
  /** برچسب نمایشی خط لینک */
  label: string;
}

export const SALE_PORTALS: SalePortal[] = [
  { keys: ['کوشا خودرو', 'کوشا خودرو', 'کیا', 'اسپورتیج', 'sportage', 'k5'], url: 'https://sale.kooshakhodro.com', label: 'سامانه فروش کوشا خودرو (کیا)' },
  { keys: ['نیلان خودرو', 'نیلان خودرو', 'تویوتا', 'کرولا', 'فرانتلندر', 'لندکروز', 'toyota'], url: 'https://app.nilankhodro.com', label: 'سامانه فروش نیلان خودرو (تویوتا)' },
  { keys: ['کرمان موتور', 'کرمان موتور', 'kmc', 'جک', 'جی ای سی', 'jac'], url: 'https://customer.bamco.ir', label: 'سامانه فروش کرمان موتور' },
  { keys: ['مدیران خودرو', 'مدیران خودرو', 'ام وی ام', 'ام‌وی‌ام', 'mvm', 'فونیکس', 'fownix', 'اکستریم', 'xtrim', 'چری'], url: 'https://customer.mvmco.ir', label: 'سامانه فروش مدیران خودرو' },
  { keys: ['بهمن موتور', 'گروه بهمن', 'فیدلیتی', 'پرستیژ', 'دی‌گو', 'دیگو'], url: 'https://bahman.ir', label: 'بخش فروش گروه بهمن (بهمن موتور)' },
  { keys: ['سایپا'], url: 'https://saipa.iranecar.com', label: 'سامانه فروش سایپا' },
  { keys: ['ایلیا', 'ilia'], url: 'https://ilia-auto.com/sale', label: 'سامانه فروش صنایع خودروسازی ایلیا' },
  { keys: ['ایران خودرو', 'ایرانخودرو', 'ایران خودرو', 'پژو', 'سمند', 'تارا', 'دنا', 'پیکان', 'هاوان', 'ريرا', 'ری‌را', 'ری را'], url: 'https://esale.ikco.ir', label: 'سامانه فروش ایران‌خودرو' },
];

/** نرمال‌سازی برای تطبیق — ی/ک فارسی، حذف اعراب، نیم‌فاصله → فاصله */
export function normSaleText(s: string): string {
  return (s || '')
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .toLowerCase();
}

/** نخستین سامانهٔ فروش منطبق با شرکت/برند اطلاعیه — هیچ تطبیقی → null (لینک ساختگی ممنوع) */
export function matchSalePortal(text: string): SalePortal | null {
  const t = normSaleText(text);
  for (const p of SALE_PORTALS) {
    if (p.keys.some((k) => t.includes(normSaleText(k)))) return p;
  }
  return null;
}

/** مدل خودروی شناسایی‌شدهٔ اطلاعیه — فقط اسلاگ‌های بامای تأییدشده (۲۰ نوامبر ۲۰۲۶):
 *  J4 باما.ir/price/jac_j4 • SR3 باما.ir/price/kmc_sr3_1.6liter • فیدلیتی الیت ۷نفره
 *  باما.ir/price/fidelity_elite_7seater. «کرولا الیت» تویوتا است و نباید به فیدلیتی بخورد —
 *  تویوتا پیش از «الیت» چک می‌شود. مدل ناشناس → null (قیمت بازار صادقانه غایب می‌ماند). */
export interface SaleCarModel { label: string; bamaUrl: string }

export function matchSaleCarModel(text: string): SaleCarModel | null {
  const t = normSaleText(text);
  if (t.includes(normSaleText('تویوتا')) || t.includes(normSaleText('کرولا')) || t.includes(normSaleText('فرانتلندر'))) return null;
  if (t.includes(normSaleText('فیدلیتی')) || t.includes(normSaleText('الیت'))) return { label: 'فیدلیتی الیت ۷نفره', bamaUrl: 'https://bama.ir/price/fidelity_elite_7seater' };
  if (t.includes(normSaleText('sr3')) || t.includes(normSaleText('اس‌آر۳'))) return { label: 'کی ام سی SR3', bamaUrl: 'https://bama.ir/price/kmc_sr3_1.6liter' };
  if (/\bj4\b|جی ۴|جی4/.test(t)) return { label: 'جک J4', bamaUrl: 'https://bama.ir/price/jac_j4' };
  return null;
}

/** تبدیل ارقام فارسی/عربی و جداکنندهٔ فارسی به ASCII */
function priceDigits(s: string): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  return s.replace(/[۰-۹٠-٩٬،]/g, (c) => {
    const i = fa.indexOf(c);
    if (i >= 0) return String(i);
    const j = ar.indexOf(c);
    if (j >= 0) return String(j);
    return c === '٬' || c === '،' ? ',' : c;
  });
}

/** عدد تاومنی معقول یک خودرو — ≥۱۰۰ میلیون و ≤۵۰ میلیارد */
function plausibleCarToman(v: number): boolean {
  return Number.isFinite(v) && v >= 1e8 && v <= 5e10;
}

/** قیمت فروش کارخانهٔ اعلامی در متن اطلاعیه — بزرگ‌ترین قیمت معقول «عدد + ریال/تومان».
 *  ریال → تومان ÷۱۰. نبود قیمت → null (صادقانه «در اطلاعیه ذکر نشده»). تابع خالص تست‌پذیر. */
export function extractSaleFactoryPrice(text: string): number | null {
  const t = priceDigits((text || ''));
  const re = /(\d{1,3}(?:[,]\d{3})+|\d{7,})(\s*)\s(ریال|تومان)/g;
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const raw = Number(m[1]!.replace(/,/g, ''));
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const toman = m[3] === 'ریال' ? Math.round(raw / 10) : raw;
    if (!plausibleCarToman(toman)) continue;
    if (best === null || toman > best) best = toman;
  }
  return best;
}

/** پاکسازی متن اطلاعیه — حذف کامل «آدرس و اسم آخرین خودرو» (خواستهٔ ۱۹ نوامبر):
 *  امضای کانال («@akharin_khodro | Akharinkhodro.ir»)، خطوط تگ/کانال/لینک t.me و
 *  خطوط «آدرس: …» تبلیغاتی. متن اصلی اطلاعیه دست‌نخورده می‌ماند. تابع خالص تست‌پذیر. */
export function cleanSaleAnnouncementText(text: string): string {
  const lines = (text || '').split('\n');
  const kept = lines.filter((raw) => {
    const l = raw.trim();
    if (!l) return true; // خط خالی — بعداً فشرده می‌شود
    if (/^@[a-z0-9_]+/i.test(l)) return false; // امضای کانال (@akharin_khodro …)
    if (/akharinkhodro\.ir|akharin[-_ ]?khodro/i.test(l)) return false; // آدرس سایت کانال
    if (/t\.me\//i.test(l)) return false; // لینک تلگرام/کانال
    if (/^\W*(آدرس|نشانی)\s*[:：]/.test(l)) return false; // خط آدرس تبلیغاتی کانال
    if (/کانال تلگرام|کانال ما|آخرین خودرو\s*[|｜]?\s*$/i.test(l) && l.length < 80) return false; // تبلیغ کانال
    return true;
  });
  // فشردن خطوط خالی پیاپی
  const out: string[] = [];
  for (const l of kept) {
    if (!l.trim() && out.length > 0 && !out[out.length - 1]!.trim()) continue;
    out.push(l);
  }
  return out.join('\n').trim();
}
