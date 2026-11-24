/**
 * شناسایی و برجسته‌سازی اخبار مرتبط با ایران و جنگ — خواستهٔ کاربر (۲۰ نوامبر ۲۰۲۶، دوم):
 * «میخوام اخبار مرتبط با ایران به رنگ متفاوت و کمی بولدتر داخل خبرنامه ها و ... نمایش داده بشن».
 *
 * خواستهٔ کاربر (۲۵ نوامبر ۲۰۲۶): «داخل هر عکس با همون استانداردی که داشتیم کلمه جنگ و
 * ایران اگر بود اون خبر رو متمایزکن» — همان هایلایت کهربایی/بولد، حالا با کلیدواژهٔ «جنگ»
 * هم فعال می‌شود (isWarRelated + isPriorityRelated).
 *
 * دو لایه:
 *  ۱) کارت‌های تصویری (bot/news-card.ts): متن موردِ ایران/جنگ‌مرتبط با رنگ کهربایی + وزن بولد +
 *     نوار لبهٔ کهربایی ردیف — «رنگ متفاوت و کمی بولدتر».
 *  ۲) پیام‌های متنی بله (دیجست ژئوپلیتیک و بست‌های خام): HTML بله رنگ ندارد؛ موردِ
 *     ایران/جنگ‌مرتبط با <b>…</b> بولد می‌شود — highlightIranItemsHtml/highlightPriorityItemsHtml.
 *
 * همهٔ توابع خالص و تست‌پذیرند. «ایرانسل» برند است نه ایران — استثنا شده.
 * «جنگل» جنگ نیست — استثنا شده (جنگ + ل).
 */

/** واژه‌های نشانهٔ ایران‌مرتبط — فارسی و لاتین (توییت/تروث‌سوشال انگلیسی هم) */
export const IRAN_KEYWORDS: readonly string[] = [
  'ایران',
  'ایرانی',
  'تهران',
  'سپاه',
  'IRGC',
];

/** متن به ایران مرتبط است؟ — تطبیق واژه‌ای محتاطانه. خالص و تست‌پذیر.
 *  «ایرانسل» (برند مخابراتی) عمداً ایران‌مرتبط شمرده نمی‌شود. */
export function isIranRelated(text: string): boolean {
  const t = (text || '');
  if (!t.trim()) return false;
  if (/ایران(?!سل)/.test(t)) return true; // ایران، ایران‌ها، ایرانی — نه ایرانسل
  if (/ایرانی/.test(t)) return true;
  if (/تهران/.test(t)) return true;
  if (/سپاه/.test(t)) return true;
  if (/\bIran\b|\bIranian\b|\bTehran\b/.test(t)) return true;
  if (/\bIRGC\b/.test(t)) return true;
  return false;
}

/** واژه‌های نشانهٔ جنگ — خواستهٔ کاربر ۲۵ نوامبر: «کلمه جنگ و ایران اگر بود اون خبر رو متمایزکن» */
export const WAR_KEYWORDS: readonly string[] = [
  'جنگ',
  'جنگی',
  'War',
];

/** متن به جنگ مرتبط است؟ — خالص و تست‌پذیر.
 *  «جنگل» (واژهٔ طبیعت) عمداً جنگ شمرده نمی‌شود؛ «جنگ‌ها/جنگی/ضدجنگ» همه جنگ‌اند.
 *  توییت‌های ترجمه‌شده فارسی‌اند؛ لاتین هم برای مسیرهای خام پوشش داده شد. */
export function isWarRelated(text: string): boolean {
  const t = (text || '');
  if (!t.trim()) return false;
  if (/جنگ(?!ل)/.test(t)) return true; // جنگ، جنگی، جنگ‌ها، ضدجنگ — نه جنگل
  if (/\bwar\b|\bwars\b|\bwarfare\b/i.test(t)) return true;
  return false;
}

/** موردِ «اولویت‌دار» — ایران یا جنگ (خواستهٔ ۲۵ نوامبر): همان تمایز کهربایی/بولد
 *  در همهٔ کارت‌های تصویری (خبر، توییت، متن کامل). خالص و تست‌پذیر. */
export function isPriorityRelated(text: string): boolean {
  return isIranRelated(text) || isWarRelated(text);
}

/** سطر موردِ شماره‌دار/گلوله‌دار دیجست — پیشوند شماره را جدا می‌کند تا بولد فقط متن را بگیرد */
const ITEM_PREFIX_RE = /^(\s*(?:[۰-۹0-9]{1,2}\s*[.):٫]\s*|[-–—•▪]\s*))([\s\S]*)$/;

/** بولد‌کردن موارد ایران‌مرتبط یک متن دیجست — HTML بله (رنگ ندارد؛ بولد مجاز است).
 *  فقط سطرهای «مورد» (شماره‌دار/گلوله‌دار) و فقط وقتی خودشان تگ بولد ندارند.
 *  سطرهای بدون تغییر دست‌نخورده می‌مانند. تابع خالص تست‌پذیر. */
export function highlightIranItemsHtml(text: string): string {
  if (!text) return text;
  const lines = text.split('\n');
  const out = lines.map((line) => {
    if (line.includes('<b>')) return line; // از قبل بولد/سربرگ — دست نمی‌زنیم
    const m = ITEM_PREFIX_RE.exec(line);
    if (!m) return line;
    const body = m[2] || '';
    if (!body.trim() || !isIranRelated(body)) return line;
    return `${m[1]}<b>${body}</b>`;
  });
  return out.join('\n');
}

/** بولد‌کردن موارد ایران یا جنگ — همان الگوی highlightIranItemsHtml با گسترش ۲۵ نوامبر:
 *  «کلمه جنگ و ایران اگر بود اون خبر رو متمایزکن». خالص و تست‌پذیر. */
export function highlightPriorityItemsHtml(text: string): string {
  if (!text) return text;
  const lines = text.split('\n');
  const out = lines.map((line) => {
    if (line.includes('<b>')) return line; // از قبل بولد/سربرگ — دست نمی‌زنیم
    const m = ITEM_PREFIX_RE.exec(line);
    if (!m) return line;
    const body = m[2] || '';
    if (!body.trim() || !isPriorityRelated(body)) return line;
    return `${m[1]}<b>${body}</b>`;
  });
  return out.join('\n');
}
