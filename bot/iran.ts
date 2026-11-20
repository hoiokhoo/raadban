/**
 * شناسایی و برجسته‌سازی اخبار مرتبط با ایران — خواستهٔ کاربر (۲۰ نوامبر ۲۰۲۶، دوم):
 * «میخوام اخبار مرتبط با ایران به رنگ متفاوت و کمی بولدتر داخل خبرنامه ها و ... نمایش داده بشن».
 *
 * دو لایه:
 *  ۱) کارت‌های تصویری (bot/news-card.ts): متن موردِ ایران‌مرتبط با رنگ کهربایی + وزن بولد +
 *     نوار لبهٔ کهربایی ردیف — «رنگ متفاوت و کمی بولدتر».
 *  ۲) پیام‌های متنی بله (دیجست ژئوپلیتیک و بست‌های خام): HTML بله رنگ ندارد؛ موردِ
 *     ایران‌مرتبط با <b>…</b> بولد می‌شود — highlightIranItemsHtml.
 *
 * همهٔ توابع خالص و تست‌پذیرند. «ایرانسل» برند است نه ایران — استثنا شده.
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
