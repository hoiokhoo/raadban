/**
 * کارت تصویری بستهٔ خبری — خواستهٔ کاربر (۱۵ نوامبر ۲۰۲۶):
 * «کارت‌سازی بستهٔ خبری و گزارش بازار — همان زیرساخت امروزِ هواشناسی قابل استفادهٔ مجدد است».
 *
 * خواستهٔ کاربر (۱۹ نوامبر ۲۰۲۶):
 *  ۱) «فقط عکس حاوی اخبار باشه» — کپشن زیر عکس کامل حذف شد (کارت همهٔ اطلاعات را خودش دارد).
 *  ۲) «خبرها ترکیبی اند … میخوام هر دسته از اخبار از جنگ گرفته تا سیاست و علمی و ورزشی ،
 *     تو اون بازه دسته بندی بشن ، اولویت بندی بشن» — بنر دسته (bot/categories.ts) پیش از
 *     نخستین مورد هر دسته در کارت رندر می‌شود؛ ترتیب دسته‌ها اولویت سردبیری.
 *  ۳) توییت‌ها «فقط فارسی روان» — متن اصلی حذف؛ نام فارسی توییت‌کننده + ترجمهٔ کامل و
 *     روان (بدون خلاصه‌سازی، بدون سقف دومخطی) با ارتفاع ردیف متغیر.
 *
 * خواستهٔ کاربر (۲۰ نوامبر ۲۰۲۶ — دومی):
 *  «هنوز بعضی اخبار به شکل ناقص بعد از دوخط با سه نقطه پایان پیدا میکنند … میخوام کل
 *  کامل اون خبر در ۲ـ۳ خط خلاصه بشه با معنی کامل نه ناقص» — ردیف‌های خبر اکنون
 *  هم‌چون کارت توییت ارتفاع متغیر دارند: تا سه خط کامل رندر می‌شود و دیگر خبرِ
 *  سه‌خطی در خط دوم با «…» بریده نمی‌شود؛ «…» فقط سپر آخرِ متن‌های فراتر از سه خط است.
 *
 * خواستهٔ کاربر (۲۰ نوامبر ۲۰۲۶ — سوم): «پس زمینهٔ بستهٔ توییت‌های عادی سبز کم‌رنگ باشه،
 *  تویی‌ها و اخبار فوری قرمز کم‌رنگ» — کارت توییت‌ها به پالت سبز کم‌رنگ روشن رفت و
 *  کارت خبر فوری (renderBreakingCardPng) با پالت قرمز کم‌رنگ ساخته شد (گیف چراغ گردان
 *  هم‌زمان در bot/breaking.ts قرمز کم‌رنگ شد).
 *
 * همان معماری کارت هواشناسی (bot/weather-card.ts): ساخت SVG با چیدمان راست‌به‌چپ و فونت
 * وزیرمتن → تبدیل به PNG با sharp (libvips/librsvg) — هیچ وابستگی تازه‌ای.
 * صراحت: تیک ✅ این کارت فقط از نتیجهٔ تطبیق اجباری با منبع می‌آید (bot/grounding.ts) —
 * هر مورد تیک‌دار یعنی خاستگاه در خوشهٔ «≥۲ منبع مستقل». شکست رندر → null و فراخواننده
 * فقط پیام متنی می‌فرستد — هیچ کارت نیمه‌ساختگی.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faDigits } from './daily';
import { isIranRelated } from './iran';
import { type TripleDate } from './calendar';

// ---------- فونت‌پیکربندی پروژه‌ای — پیش از نخستین رندر sharp ----------
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.FONTCONFIG_FILE) {
  try { mkdirSync(join(PROJECT_ROOT, '.fc-cache'), { recursive: true }); } catch { /* بی‌اهمیت */ }
  process.env.FONTCONFIG_FILE = join(PROJECT_ROOT, '.fontconfig.conf');
}

export interface NewsCardItem {
  /** متن مورد (بدون شماره/تیک) — خروجی grounding یا خوشهٔ خام */
  text: string;
  /** تیک قطعی از دادهٔ خوشهٔ منبع (≥۲ منبع مستقل) — نه از مدل */
  tick: boolean;
  /** منبع نمایندهٔ خوشه */
  source: string;
  /** برچسب دستهٔ خبری («⚔️ جنگ و امنیت») — بنر پیش از نخستین موردِ هر دسته (۱۹ نوامبر) */
  section?: string;
}

export interface NewsCardInput {
  date: TripleDate;
  items: NewsCardItem[];
  /** کل رویدادهای بازه پس از تجمیع — برای تراشهٔ «+N رویداد در کارت‌های بعدی» */
  total?: number;
  /** موارد حذف‌شدهٔ بی‌خاستگاه در تطبیق اجباری — شفافیت در کارت */
  dropped?: number;
  /** شمارهٔ صفحه (کارت چندتکه — خواستهٔ ۱۶ نوامبر: همهٔ اخبار در قالب تصویر) */
  part?: { no: number; of: number };
}

export interface CardPng {
  png: Buffer;
  width: number;
  height: number;
}

// ---------- هندسهٔ کارت ----------

const W = 1080;
/** دو خط سربرگ: عنوان + تاریخ (خط سوم آماری و تراشه‌ها حذف شدند — خواستهٔ ۲۰ نوامبر) */
const HEADER_H = 190;
const BANNER_H = 62;
const PAD = 36;
const FOOTER_H = 88;
const MAX_CHARS_PER_LINE = 56;

/** سقف خطوط هر خبر — دو خط معمول + سطر سوم برای کامل‌بودن معنا (خواستهٔ کاربر ۲۰ نوامبر:
 *  «کل کامل اون خبر در ۲ـ۳ خط خلاصه بشه با معنی کامل نه ناقص») */
export const NEWS_MAX_LINES = 3;
/** فاصلهٔ عمودی میان خطوط متن خبر */
const NEWS_LINE_H = 40;

/** ارتفاع ردیف خبر بر پایهٔ خطوط واقعی متن — ارتفاع متغیر مثل کارت توییت؛
 *  ۱ خط: ۱۱۸ • ۲ خط: ۱۵۸ • ۳ خط: ۱۹۸ — خالص و تست‌پذیر */
export function newsRowHeight(text: string): number {
  const lines = wrapFa(stripCardEmoji(text || ''), MAX_CHARS_PER_LINE, NEWS_MAX_LINES).length;
  if (lines <= 1) return 118;
  if (lines === 2) return 158;
  return 198;
}

/** سقف ردیف هر کارت خبری — کارت بلندتر از این در بله ناخوانا می‌شود (۱۶ نوامبر) */
export const NEWS_CARD_ROWS_PER_PAGE = 12;
/** سقف کارت‌های هر بسته — ۱۲×۷ = ۸۴ رویداد در هر بازه */
export const NEWS_CARD_MAX_PAGES = 7;

/** صفحه‌بندی خالص — اقلام به قطعه‌های ≤ per قطعه می‌شوند؛ سقف max قطعه (مازاد صادقانه بی‌کارت می‌ماند) */
export function paginateItems<T>(items: T[], per: number, maxPages: number): T[][] {
  if (!items || items.length === 0 || per <= 0) return [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length && pages.length < maxPages; i += per) {
    pages.push(items.slice(i, i + per));
  }
  return pages;
}

// ---------- پالایش ایموجی متنِ روی کارت — خواستهٔ کاربر ۲۰ نوامبر (نهم) ----------
// «یه تیکه پرچم آمریکا افتاده روی توییت!!! اینجور علامتها دیگه نیاد رو عکس» —
// فونت سرور گلیف رنگیِ ایموجی ندارد؛ پرچم 🇺🇸 به قطعهٔ بزرگِ سیاهِ روی‌متن تبدیل می‌شد
// و روی چند خط توییت می‌افتاد. همهٔ ایموجی‌ها و نمادهای تزئینی از «متنِ روی تصویر» حذف
// می‌شوند — پرچم‌ها (Regional Indicator)، صورتک‌ها، نمادها، انتخاب‌گر نمایش (FE0F)،
// ZWJ، کی‌کپ و رنگ پوست. حروف/اعداد/علائم نگارشی فارسی و لاتین دست‌نخورده می‌مانند.
// فقط لایهٔ تصویر — پیام متنی بله ایموجی را سالم نشان می‌دهد و دست نمی‌خورد. خالص و تست‌پذیر.
const CARD_EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{231A}\u{231B}\u{23CF}\u{23E9}-\u{23FA}]/gu;

/** حذف ایموجی و نمادهای تزئینی از متنِ روی کارت — هم‌یشه پیش از wrapFa/ارتفاع، در هر سه کارت */
export function stripCardEmoji(text: string): string {
  return (text || '')
    .replace(CARD_EMOJI_RE, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** شکستن متن فارسی به خطوط با سقف نویسه — واژه‌محور؛ سرریز → «…» در خط آخر. خالص و تست‌پذیر. */
export function wrapFa(text: string, maxChars: number, maxLines: number): string[] {
  const words = (text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (w.length > maxChars) {
      // واژهٔ فوق‌بلند (مثلاً لینک پاک‌نشده) — شکستن سخت
      if (cur) { lines.push(cur); cur = ''; }
      for (let i = 0; i < w.length; i += maxChars) lines.push(w.slice(i, i + maxChars));
      continue;
    }
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length <= maxChars) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1] || '';
  kept[maxLines - 1] = last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
  return kept;
}

/** شکستن کامل بدون هیچ بریدگی — برای کارت فوری (خواستهٔ کاربر ۲۰ نوامبر هشتم:
 *  «توییتهای فوری شامل ایران یا جنگ رو اصلا خلاصه نکن … کامل باشه فقط فارسی روان و کامل» —
 *  توییت ترامپ با «…» در خط آخر رسید چون wrapFa در سقف خط می‌برید). همان الگوریتم واژه‌محور،
 *  اما بی‌سقف خط: هر متن فارسی، هر چقدر بلند، «همه» خطوطش برمی‌گردد و ارتفاع کارت با همان
 *  شمارش رشد می‌کند. خروجی با متن ورودیِ نرمال‌شده رشته‌به‌رشته برابر است. خالص و تست‌پذیر. */
export function wrapFaFull(text: string, maxChars: number): string[] {
  const words = (text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (w.length > maxChars) {
      // واژهٔ فوق‌بلند (مثلاً لینک پاک‌نشده) — شکستن سخت
      if (cur) { lines.push(cur); cur = ''; }
      for (let i = 0; i < w.length; i += maxChars) lines.push(w.slice(i, i + maxChars));
      continue;
    }
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length <= maxChars) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- نهایی‌ساز متن کارت خبر — ریشه‌کن «…» (خواستهٔ کاربر ۲۰ نوامبر سوم) ----------
// «بعضی اخبار بسته‌های خبری ناقص و با … ادامش اومدن — کل هر متن خبر رو هوش مصنوعی بخونه
//  و خلاصه کنه و در حداکثر سه خط با پایان‌بندی و متن روان ارسال کنه» — دو نشتِ «…»:
//  ۱) متنِ حتی ≤۱۶۵ نویسه که به‌خاطر مرز واژه در شکستن خط به خط چهارم می‌رسد (wrapFa
//     سپرِ «…» می‌زد)؛ ۲) مسیر خام. نهایی‌ساز: متنِ جا‌شونده در ۳ خطِ ۵۶نویسه‌ای ← عیناً؛
//  وگرنه بلندترین پیشوندِ «جملهٔ کامل» (پایان با . ! ؟ …) که در ۳ خط جا شود؛ نبود ← null
//  (مورد به پیام متنی جداگانه می‌رود — متن کامل، هرگز بریده). تابع خالص و تست‌پذیر. */

const SENT_END_RE = /[.!؟…]/;

/** پایان‌جمله بودن نویسهٔ i — بعدش فاصله/پایان متن؛ یا حرفِ فارسی (نقطه‌چین بی‌فاصلهٔ
 *  فارسی «داد.جزئیات»)؛ رقم دو طرف («۱۲.۵») هرگز پایان جمله نیست. */
function isSentBoundary(flat: string, i: number): boolean {
  const next = flat[i + 1] || '';
  if (next === '' || /\s/.test(next)) return true;
  const digit = /[\d۰-۹٠-٩]/;
  if (digit.test(flat[i - 1] || '') || digit.test(next)) return false;
  return /\p{L}/u.test(next);
}

/** جا شدن متن در سقف خطوط کارت خبر — با همان منطق wrapFa (مرز واژه) */
export function fitsNewsLines(text: string, maxLines = NEWS_MAX_LINES): boolean {
  return wrapFa(text || '', MAX_CHARS_PER_LINE, maxLines + 1).length <= maxLines;
}

/** نهایی‌ساز متن ردیف کارت خبر — «جملهٔ کامل در ≤۳ خط» یا null (سرریز → پیام متنی).
 *  خروجی هیچ‌گاه با «…» تمام نمی‌شود. تابع خالص و تست‌پذیر. */
export function finalizeNewsCardText(text: string, maxLines = NEWS_MAX_LINES): string | null {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  if (fitsNewsLines(flat, maxLines)) return flat;
  // بلندترین پیشوند جملهٔ کامل که در maxLines خط بگنجد
  let best: string | null = null;
  let from = 0;
  while (from < flat.length) {
    const rel = flat.slice(from).search(SENT_END_RE);
    if (rel < 0) break;
    const idx = from + rel;
    if (isSentBoundary(flat, idx)) {
      const cand = flat.slice(0, idx + 1).trim();
      if (cand.length >= 40 && fitsNewsLines(cand, maxLines)) best = cand; // کامل‌ترین جاشونده
    }
    from = idx + 1;
  }
  return best;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** جهت‌نمای راست‌به‌چپ صریح — همان کارت هواشناسی */
function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

/** نشان تیک برداری — دایرهٔ سبز + خط تیک سفید (بدون فونت ایموجی) */
function tickBadgeSvg(cx: number, cy: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="14" fill="#16a34a"/><path d="M ${cx - 6} ${cy} L ${cx - 1.5} ${cy + 5} L ${cx + 6.5} ${cy - 5}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ---------- ساخت SVG — خالص و تست‌پذیر (بدون sharp) ----------

export function makeNewsCardSvg(input: NewsCardInput): string {
  const { date, items } = input;
  if (!items || items.length === 0) return '';
  const total = input.total ?? items.length;
  const more = Math.max(0, total - items.length);
  // بنر دسته — پیش از نخستین موردِ هر دسته در این صفحه (اولین مورد صفحه همیشه بنر دارد)
  const banners = new Map<number, string>();
  let lastSection = '';
  items.forEach((it, i) => {
    const sec = (it.section || '').trim();
    if (sec && sec !== lastSection) { banners.set(i, sec); lastSection = sec; }
  });
  const bannersH = banners.size * BANNER_H;
  const moreH = more > 0 ? 64 : 0;
  // ارتفاع متغیر ردیف‌ها — خبر سه‌خطی بلندتر از دخطی رندر می‌شود (خواستهٔ ۲۰ نوامبر)
  const heights = items.map((it) => newsRowHeight(it.text || ''));
  const rowsH = heights.reduce((a, b) => a + b, 0);
  const H = HEADER_H + rowsH + bannersH + 26 + moreH + FOOTER_H;

  // سربرگ — عنوان + تاریخ؛ سربرگ‌های آماریِ دیباگ حذف شدند (خواستهٔ کاربر ۲۰ نوامبر:
  // «عناوین خبرها که برای دیباگ برنامست … و مثه اینها رو حذف کن»)
  const partLabel = input.part && input.part.of > 1 ? ` — بخش ${faDigits(String(input.part.no))} از ${faDigits(String(input.part.of))}` : '';
  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="86" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('بستهٔ خبری رصدبان')}</text>
  <text x="${W - PAD}" y="140" font-size="26" fill="#9fc3e8" text-anchor="end">${rtl(`${date.weekdayFa} ${date.shamsi} • ${date.miladi}${partLabel}`)}</text>`;

  // چیدمان انباشته — هر بنر دقیقاً پیش از ردیف خودش می‌نشیند (بدون حفرهٔ بالای کارت)
  let rowY = HEADER_H + 14;
  const pieces: string[] = [];
  items.forEach((it, i) => {
    const banner = banners.get(i)
      ? `
  <rect x="${PAD}" y="${rowY}" width="${W - PAD * 2}" height="${BANNER_H - 10}" rx="12" fill="#16405f"/>
  <rect x="${W - PAD - 8}" y="${rowY + 6}" width="4" height="${BANNER_H - 22}" rx="2" fill="#ffd75e"/>
  <text x="${W - PAD - 26}" y="${rowY + 38}" font-size="26" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl(esc(banners.get(i)!))}</text>`
      : '';
    if (banners.get(i)) rowY += BANNER_H;
    const yTop = rowY;
    const rh = heights[i]!;
    rowY += rh;
    // مورد ایران‌مرتبط — خواستهٔ کاربر ۲۰ نوامبر (دوم): «اخبار مرتبط با ایران به رنگ متفاوت و
    // کمی بولدتر» — متن کهربایی + وزن بولد + نوار لبهٔ کهربایی و زمینهٔ کمی گرم‌تر ردیف
    const iran = isIranRelated(it.text || '');
    const bg = iran
      ? (i % 2 === 0 ? '#1b3350' : '#162b45')
      : i % 2 === 0 ? '#102941' : '#0d2135';
    // تا سه خط کامل — دیگر خبر سه‌خطی با «…» در خط دوم بریده نمی‌شود (۲۰ نوامبر)
    // متن روی کارت بدون ایموجی — پرچم/نماد هرگز روی خطوط نمی‌افتد (۲۰ نوامبر نهم)
    const lines = wrapFa(stripCardEmoji(it.text || ''), MAX_CHARS_PER_LINE, NEWS_MAX_LINES);
    const cy = yTop + (rh - 12) / 2;
    const numCx = W - PAD - 34;
    const textRight = W - PAD - 110;
    const src = it.source ? `<text x="${textRight}" y="${yTop + rh - 30}" font-size="19" fill="${iran ? '#d9b96a' : '#7fa8c9'}" text-anchor="end">${rtl(`منبع: ${esc(it.source)}`)}</text>` : '';
    const bodySvg = lines
      .map((ln, j) => `<text x="${textRight}" y="${yTop + 52 + j * NEWS_LINE_H}" font-size="27"${iran ? ' font-weight="700"' : ''} fill="${iran ? '#ffd75e' : '#e8f1fa'}" text-anchor="end">${rtl(esc(ln))}</text>`)
      .join('\n');
    pieces.push(`${banner}
  <rect x="${PAD}" y="${yTop}" width="${W - PAD * 2}" height="${rh - 12}" rx="14" fill="${bg}"/>
  ${iran ? `<rect x="${PAD + 8}" y="${yTop + 10}" width="5" height="${rh - 32}" rx="2.5" fill="#ffd75e"/>` : ''}
  <circle cx="${numCx}" cy="${cy - 8}" r="24" fill="${iran ? '#3d4a1e' : '#16405f'}" stroke="${iran ? '#ffd75e' : '#2c6ea5'}" stroke-width="1.5"/>
  <text x="${numCx}" y="${cy}" font-size="25" font-weight="700" fill="#ffffff" text-anchor="middle">${rtl(faDigits(String(i + 1)))}</text>
  ${it.tick ? tickBadgeSvg(numCx - 46, cy - 8) : ''}
  ${bodySvg}
  ${src}`);
  });
  const rowsSvg = pieces.join('\n');

  const moreSvg =
    more > 0
      ? `<text x="${W / 2}" y="${HEADER_H + 14 + bannersH + rowsH + 40}" font-size="24" fill="#9fc3e8" text-anchor="middle">${rtl(`+ ${faDigits(String(more))} رویداد دیگر در کارت‌های بعدی`)}</text>`
      : '';

  const footerY = H - 34;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="end">${rtl('رصدبان')}</text>
  <text x="${PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="start">${rtl('تیک ✅ = پوشش حداقل دو منبع مستقل')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1c30"/>
  ${header}
  ${rowsSvg}
  ${moreSvg}
  ${footer}
</svg>`;
}

// ---------- رندر PNG ----------

/** رندر کارت به PNG — شکست هر مرحله → null (هیچ کارت خراب ارسال نمی‌شود) */
export async function renderNewsCardPng(input: NewsCardInput): Promise<CardPng | null> {
  try {
    if (!input.items || input.items.length === 0) return null;
    const svg = makeNewsCardSvg(input);
    if (!svg) return null;
    const sharp = (await import('sharp')).default;
    const png = await sharp(Buffer.from(svg), { density: 72 }).png().toBuffer();
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height || png.length < 5000) return null;
    return { png, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

// ---------- کارت چندصفحه‌ای — همهٔ اخبار در قالب تصویر (خواستهٔ کاربر ۱۶ نوامبر) ----------

/** صفحه‌بندی + رندر همهٔ موارد در چند کارت پیاپی — خروجی خالی یعنی شکست/بی‌مورد (فراخواننده به متن برمی‌گردد). */
export async function renderNewsCardPages(input: NewsCardInput, opts: { rowsPerPage?: number; maxPages?: number } = {}): Promise<CardPng[]> {
  const per = opts.rowsPerPage ?? NEWS_CARD_ROWS_PER_PAGE;
  const maxPages = opts.maxPages ?? NEWS_CARD_MAX_PAGES;
  const pages = paginateItems(input.items || [], per, maxPages);
  const out: CardPng[] = [];
  for (let p = 0; p < pages.length; p++) {
    const part = { no: p + 1, of: pages.length };
    const card = await renderNewsCardPng({ ...input, items: pages[p]!, part });
    if (card) out.push(card);
  }
  return out;
}

// ---------- کارت توییت‌ها — فقط فارسی روان، کامل (خواستهٔ ۱۹ نوامبر) ----------

export interface TweetCardItem {
  /** برچسب منبع با نشانگر پلتفرم — «𝕏 Donald Trump» یا «🅣 Donald Trump (تروث‌سوشال)» */
  source: string;
  /** ترجمهٔ فارسی روان و کامل — تنها متن نمایشی (متن اصلی حذف — خواستهٔ ۱۹ نوامبر) */
  fa: string;
  /** نام فارسی توییت‌کننده + مسئولیت — خط عنوان ردیف */
  faName?: string;
  /** توییت دومانبعی/تأییدشده (بازتاب هم‌موضوع) */
  verified?: boolean;
}

export interface TweetCardInput {
  date: TripleDate;
  items: TweetCardItem[];
  part?: { no: number; of: number };
}

/** هندسهٔ ردیف توییت — ارتفاع متغیر: عنوان منبع + نام فارسی + همهٔ خطوط ترجمه (کامل، بدون خلاصه‌سازی)
 *  خواستهٔ ۱۹ نوامبر: «میخوام به شکل کامل ،بدون خلاصه نویسی ، اما به زبان فارسی روان و واضح» */
const TW_SOURCE_H = 52;
const TW_NAME_H = 42;
const TW_LINE_H = 40;
/** بالشتک پایین ردیف — خط آخر (baseline) با فاصلهٔ امن در پس‌زمینهٔ ردیف می‌ماند */
const TW_PAD_BOTTOM = 50;
const TW_CHARS_PER_LINE = 62;
/** سقف خطوط ترجمه هر توییت در بستهٔ عادی — توییت‌های عادی (≤۲۸۰ نویسه) ~۴-۶ خط؛
 *  پست‌های بلند تروث‌سوشال تا ~۱۹۸۰ نویسه ÷ ۶۲ → سقف ۳۲ خط (۲۰ نوامبر هشتم: بالاتر رفت از ۱۶ —
 *  هیچ ترجمهٔ کامل توییت دیگر با «…» بریده نمی‌شود؛ ردیف بلندتر، صفحه‌بندی ارتفاعی جای آن می‌دهد) */
export const TW_MAX_LINES = 32;
/** سقف ارتفاع هر کارت توییت (px) — صفحه‌بندی بر پایهٔ ارتفاع واقعی ردیف‌ها */
export const TW_PAGE_MAX_HEIGHT = 6400;

/** ارتفاع ردیف یک توییت — خالص و تست‌پذیر (صفحه‌بندی بر پایهٔ آن) — متن بدون ایموجی */
export function tweetRowHeight(fa: string): number {
  const lines = wrapFa(stripCardEmoji(fa || ''), TW_CHARS_PER_LINE, TW_MAX_LINES).length;
  return TW_SOURCE_H + TW_NAME_H + Math.max(1, lines) * TW_LINE_H + TW_PAD_BOTTOM;
}

/** صفحه‌بندی توییت‌ها بر پایهٔ ارتفاع واقعی — ردیف تا جایی که مجموع ارتفاع از سقف نگذرد؛
 *  مازاد فراتر از maxPages صادقانه بی‌کارت می‌ماند (فراخواننده به بست متنی می‌رسد) */
export function paginateTweetItems(items: TweetCardItem[], maxHeight: number = TW_PAGE_MAX_HEIGHT, maxPages = 5): TweetCardItem[][] {
  if (!items || items.length === 0) return [];
  const pages: TweetCardItem[][] = [];
  let cur: TweetCardItem[] = [];
  let h = HEADER_H + FOOTER_H + 26;
  for (const it of items) {
    const rh = tweetRowHeight(it.fa);
    if (cur.length > 0 && h + rh > maxHeight) {
      pages.push(cur);
      cur = [];
      h = HEADER_H + FOOTER_H + 26;
      if (pages.length >= maxPages) return pages;
    }
    cur.push(it);
    h += rh;
  }
  if (cur.length > 0) pages.push(cur);
  return pages;
}

/** ساخت SVG کارت توییت — خالص و تست‌پذیر؛ سربرگ فقط عنوان + تاریخ (خط آماری
 *  «N پست این بازه • N بازتاب چندمنبعی» و تراشه‌های پلتفرم/ترجمه حذف شدند —
 *  خواستهٔ کاربر ۲۰ نوامبر: «عناوین … که برای دیباگ برنامست … حذف کن») */
export function makeTweetCardSvg(input: TweetCardInput): string {
  const { date, items } = input;
  if (!items || items.length === 0) return '';
  const partLabel = input.part && input.part.of > 1 ? ` — بخش ${faDigits(String(input.part.no))} از ${faDigits(String(input.part.of))}` : '';
  const heights = items.map((it) => tweetRowHeight(it.fa));
  const H = HEADER_H + 14 + heights.reduce((a, b) => a + b, 0) + FOOTER_H;

  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="86" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('توییت‌های مقامات تأثیرگذار')}</text>
  <text x="${W - PAD}" y="140" font-size="26" fill="#d3ead9" text-anchor="end">${rtl(`${date.weekdayFa} ${date.shamsi} • ${date.miladi}${partLabel}`)}</text>`;

  const textRight = W - PAD - 28;
  let y = HEADER_H + 14;
  const rowsSvg = items
    .map((it, i) => {
      const yTop = y;
      y += heights[i]!;
      // پالت «سبز کم‌رنگ» — خواستهٔ کاربر ۲۰ نوامبر (سوم): پس‌زمینهٔ بستهٔ توییت‌های عادی؛
      // توییت ایران‌مرتبط همان تمایز کهربایی را روی زمینهٔ روشن حفظ می‌کند (ردیف کهرباییِ کم‌رنگ)
      const iran = isIranRelated(`${it.faName || ''} ${it.fa || ''}`);
      const bg = iran
        ? (i % 2 === 0 ? '#faf2da' : '#f6ecd0')
        : i % 2 === 0 ? '#e7f3e9' : '#def0e2';
      // نام فارسی توییت‌کننده — خط عنوان؛ نبود آن → «ترجمه فارسی» (سازگاری با دادهٔ قدیمی)
      const nameLine = (it.faName || 'ترجمه فارسی').replace(/\s+/g, ' ').trim();
      const nameLines = wrapFa(nameLine, 60, 1);
      const nameY = yTop + TW_SOURCE_H + 30;
      const faLines = wrapFa(stripCardEmoji(it.fa || ''), TW_CHARS_PER_LINE, TW_MAX_LINES);
      const faSvg = faLines
        .map((ln, j) => `<text x="${textRight}" y="${nameY + 34 + (j + 1) * TW_LINE_H}" font-size="26"${iran ? ' font-weight="700"' : ''} fill="${iran ? '#8a5a12' : '#22432f'}" text-anchor="end">${rtl(esc(ln))}</text>`)
        .join('\n');
      return `
  <rect x="${PAD}" y="${yTop}" width="${W - PAD * 2}" height="${heights[i]! - 12}" rx="14" fill="${bg}"/>
  ${iran ? `<rect x="${PAD + 8}" y="${yTop + 10}" width="5" height="${heights[i]! - 32}" rx="2.5" fill="#d9a441"/>` : ''}
  <text x="${textRight}" y="${yTop + 38}" font-size="24" font-weight="700" fill="${iran ? '#a1762a' : '#4e7d61'}" text-anchor="end">${rtl(esc(it.source))}${it.verified ? ' ✅' : ''}</text>
  <text x="${textRight}" y="${nameY}" font-size="27" font-weight="700" fill="#1c5f38" text-anchor="end">${rtl(esc(nameLines[0] || nameLine))}</text>
  ${faSvg}`;
    })
    .join('');

  const footerY = H - 34;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#5f8870" text-anchor="end">${rtl('رصدبان • توییت/تروث‌سوشال مقامات تأثیرگذار')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14532d"/><stop offset="1" stop-color="#227a44"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#eef6ee"/>
  ${header}
  ${rowsSvg}
  ${footer}
</svg>`;
}

/** رندر کارت توییت به PNG — شکست هر مرحله → null */
export async function renderTweetCardPng(input: TweetCardInput): Promise<CardPng | null> {
  try {
    if (!input.items || input.items.length === 0) return null;
    const svg = makeTweetCardSvg(input);
    if (!svg) return null;
    const sharp = (await import('sharp')).default;
    const png = await sharp(Buffer.from(svg), { density: 72 }).png().toBuffer();
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height || png.length < 5000) return null;
    return { png, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/** همهٔ توییت‌ها در چند کارت پیاپی — خروجی خالی → فراخواننده به بستهٔ متنی برمی‌گردد */
export async function renderTweetCardPages(input: TweetCardInput): Promise<CardPng[]> {
  const pages = paginateTweetItems(input.items || []);
  const out: CardPng[] = [];
  for (let p = 0; p < pages.length; p++) {
    const card = await renderTweetCardPng({ ...input, items: pages[p]!, part: { no: p + 1, of: pages.length } });
    if (card) out.push(card);
  }
  return out;
}

// ---------- کارت خبر/توییت «فوری» — پالت قرمز کم‌رنگ (خواستهٔ کاربر ۲۰ نوامبر سوم) ----------
// «تویی‌ها و اخبار فوری قرمز کم‌رنگ» — پس‌زمینهٔ قرمز کم‌رنگ روشن + سربرگ سرخِ اشباع با
// گنبد چراغ گردان برداری (نسخهٔ متحرک همان گنبد در bot/breaking.ts). تک‌موردی: منبع +
// (نام فارسی) + متن کامل — هیچ خلاصه‌سازی؛ متن در ≤۱۶ خطِ ۶۲نویسه‌ای کامل می‌آید.

export interface BreakingCardInput {
  /** منبع — «𝕏 Donald Trump» یا «خبرگزاری تسنیم» یا نام کانال */
  source: string;
  /** متن فارسی کامل مورد فوری */
  text: string;
  /** نام فارسی توییت‌کننده + مسئولیت (توییت‌ها) — خط عنوان */
  faName?: string;
  /** تاریخ سه‌گانه — خط دوم سربرگ؛ اختیاری (فوری می‌تواند بی‌تاریخ باشد) */
  date?: TripleDate;
}

const BR_HEADER_H = 170;
const BR_SOURCE_H = 56;
const BR_NAME_H = 46;
const BR_LINE_H = 42;
const BR_PAD_BOTTOM = 54;
const BR_CHARS_PER_LINE = 60;
/** (منسوخ — نگه‌داشته برای سازگاری) کارت فوری دیگر سقف خط ندارد — wrapFaFull همهٔ متن را کامل نمایش می‌دهد */
export const BR_MAX_LINES = 16;
/** فریم‌های گیف کارت فوری — چراغ گردان سربرگ یک دور کامل می‌چرخد (کارت متحرک) */
export const BREAKING_CARD_GIF_FRAMES = 12;
export const BREAKING_CARD_GIF_DELAY_MS = 110;

/** ارتفاع کارت فوری — با شمارش کامل wrapFaFull؛ هر متن بلند، کارت بلندتر می‌سازد و هیچ‌گاه
 *  با «…» بریده نمی‌شود (خواستهٔ کاربر ۲۰ نوامبر هشتم). خالص و تست‌پذیر. */
export function breakingCardHeight(text: string, hasName: boolean): number {
  const lines = wrapFaFull(stripCardEmoji(text || ''), BR_CHARS_PER_LINE).length;
  return BR_HEADER_H + 14 + BR_SOURCE_H + (hasName ? BR_NAME_H : 0) + Math.max(1, lines) * BR_LINE_H + BR_PAD_BOTTOM + FOOTER_H;
}

/** گنبد چراغ گردان برداری سربرگ — قرمز اشباع + پرتوهای نور چرخان.
 *  phase = ۰..۱ (اختیاری): زاویهٔ چرخش پرتو + تپش گنبد/هاله — برای کارت فوری «متحرک»
 *  (خواستهٔ کاربر ۲۰ نوامبر پنجم: «چراغ گردون رو داخل همون خبر بزار متحرک نه پیام جدا»). */
function sirenSvg(cx: number, cy: number, phase = 0): string {
  const r = 34;
  const domeCy = cy - 8;
  const rot = phase * 360; // چرخش پرتو — یک دور کامل در هر لوپ
  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2); // تپش گنبد
  // پرتو دو بازوی روبه‌رو — هم‌الگوی گیف مستقل (bot/breaking.ts) جمع‌شده برای سربرگ کارت
  const beam = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const spread = 0.22; // نیم‌زاویهٔ بازشدگی
    const r0 = r * 1.02;
    const len = 58;
    const pt = (ang: number, rad: number) => `${(cx + Math.cos(ang) * rad).toFixed(1)} ${(domeCy + Math.sin(ang) * rad).toFixed(1)}`;
    return `<path d="M ${pt(a - spread, r0)} L ${pt(a - spread, len)} L ${pt(a + spread, len)} L ${pt(a + spread, r0)} Z" fill="#ff4438" opacity="${(0.32 + 0.16 * pulse).toFixed(2)}"/>`;
  };
  const ringPhase = phase;
  const ringR = r * (1.12 + ringPhase * 0.72);
  const ringOp = 0.42 * (1 - ringPhase);
  return `
  ${beam(rot)}${beam(rot + 180)}
  <circle cx="${cx}" cy="${domeCy}" r="${(r * 1.55).toFixed(1)}" fill="#ff3b30" opacity="${(0.05 + 0.07 * pulse).toFixed(2)}"/>
  <circle cx="${cx}" cy="${domeCy}" r="${ringR.toFixed(1)}" fill="none" stroke="#ff6b6b" stroke-width="3" opacity="${ringOp.toFixed(2)}"/>
  <ellipse cx="${cx}" cy="${cy + 16}" rx="${r * 1.25}" ry="7" fill="#e3b0aa"/>
  <rect x="${cx - r * 0.9}" y="${cy + 8}" width="${r * 1.8}" height="16" rx="6" fill="#f3d2cc" stroke="#d0968d" stroke-width="2"/>
  <radialGradient id="dome2" cx="0.5" cy="0.35" r="0.9">
    <stop offset="0" stop-color="#ff8a80"/><stop offset="0.45" stop-color="#ff3b30"/><stop offset="1" stop-color="#a01015"/>
  </radialGradient>
  <circle cx="${cx}" cy="${domeCy}" r="${r}" fill="url(#dome2)" opacity="${(0.85 + 0.15 * pulse).toFixed(2)}"/>
  <ellipse cx="${cx - 10}" cy="${cy - 18}" rx="9" ry="5" fill="#ffe3e0" opacity="0.75"/>`;
}

/** ساخت SVG کارت فوری — خالص و تست‌پذیر.
 *  animFrame (اختیاری): شمارهٔ فریم ۰..BREAKING_CARD_GIF_FRAMES−۱ → چراغ گردان سربرگ
 *  می‌چرخد/می‌تپد (کارت متحرک). بدون آن → چراغ در حالت ساکن (فاز صفر). */
export function makeBreakingCardSvg(input: BreakingCardInput, animFrame?: number): string {
  // متن روی کارت بدون ایموجی — پرچم/نماد هرگز روی خطوط نمی‌افتد (خواستهٔ ۲۰ نوامبر نهم)
  const text = stripCardEmoji((input.text || '').replace(/\s+/g, ' ').trim());
  if (!text) return '';
  const hasName = Boolean((input.faName || '').trim());
  const H = breakingCardHeight(text, hasName);
  const dateLine = input.date ? `${input.date.weekdayFa} ${input.date.shamsi} • ${input.date.miladi}` : '';
  const sirenCx = W - PAD - 50; // حاشیهٔ راحت از لبهٔ کارت + بدون تصادم با عنوان «فوری»
  const sirenCy = 82;
  const phase = animFrame === undefined ? 0 : ((animFrame % BREAKING_CARD_GIF_FRAMES) + BREAKING_CARD_GIF_FRAMES) % BREAKING_CARD_GIF_FRAMES / BREAKING_CARD_GIF_FRAMES;

  const header = `
  <rect width="${W}" height="${BR_HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD - 110}" y="76" font-size="46" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('فوری')}</text>
  <text x="${W - PAD - 110}" y="124" font-size="24" fill="#ffd9d5" text-anchor="end">${rtl(dateLine || 'رصدبان — خبر فوری')}</text>
  ${sirenSvg(sirenCx, sirenCy, phase)}`;

  const textRight = W - PAD - 28;
  let y = BR_HEADER_H + 14;
  const bodyH = H - BR_HEADER_H - 14 - FOOTER_H;
  const nameLine = (input.faName || '').replace(/\s+/g, ' ').trim();
  const nameLines = hasName ? wrapFa(nameLine, 60, 1) : [];
  // متن کامل بدون هیچ بریدگی — wrapFaFull همهٔ خطوط را می‌دهد؛ ارتفاع کارت از همین شمارش است
  // (خواستهٔ کاربر ۲۰ نوامبر هشتم: توییت فوری «کامل باشه فقط فارسی روان و کامل»)
  const faLines = wrapFaFull(text, BR_CHARS_PER_LINE);
  const nameY = y + BR_SOURCE_H + 34;
  const faSvg = faLines
    .map((ln, j) => `<text x="${textRight}" y="${nameY + (hasName ? 38 : 6) + (j + 1) * BR_LINE_H}" font-size="27" fill="#571416" text-anchor="end">${rtl(esc(ln))}</text>`)
    .join('\n');
  const rowsSvg = `
  <rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${bodyH - 12}" rx="14" fill="#fbdedb"/>
  <rect x="${PAD + 8}" y="${y + 10}" width="5" height="${bodyH - 32}" rx="2.5" fill="#e5484d"/>
  <text x="${textRight}" y="${y + 40}" font-size="24" font-weight="700" fill="#a75d55" text-anchor="end">${rtl(esc(input.source || 'منبع ناشناس'))}</text>
  ${hasName ? `<text x="${textRight}" y="${nameY}" font-size="27" font-weight="700" fill="#8f1420" text-anchor="end">${rtl(esc(nameLines[0] || nameLine))}</text>` : ''}
  ${faSvg}`;

  const footerY = H - 34;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#a3736c" text-anchor="end">${rtl('رصدبان • ارسال فوری بدون وقفه')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8f1420"/><stop offset="1" stop-color="#c62b3a"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#fdf1f0"/>
  ${header}
  ${rowsSvg}
  ${footer}
</svg>`;
}

/** رندر کارت فوری به PNG — شکست هر مرحله → null (فراخواننده به گیف+کپشن برمی‌گردد) */
export async function renderBreakingCardPng(input: BreakingCardInput): Promise<CardPng | null> {
  try {
    const svg = makeBreakingCardSvg(input);
    if (!svg) return null;
    const sharp = (await import('sharp')).default;
    const png = await sharp(Buffer.from(svg), { density: 72 }).png().toBuffer();
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height || png.length < 5000) return null;
    return { png, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

// ---------- کارت فوری متحرک — چراغ گردان «داخل خودِ خبر» (تک‌پیام) ----------

/** سقف حجم گیف کارت — بزرگ‌تر از این → null (فراخواننده به PNG ثابت برمی‌گردد) */
export const BREAKING_CARD_GIF_MAX_BYTES = 8_000_000;

/** سقف ارتفاع کارت برای نسخهٔ گیف متحرک — کارت بلندتر از این به PNG ثابت می‌رود
 *  (انکود گیف ۱۲فریمی از کارت خیلی بلند، سنگین و پُرحجم است؛ PNG همان متن کامل را در یک پیام می‌دهد) */
export const BREAKING_GIF_MAX_HEIGHT = 6000;

/** رندر کارت فوری به GIF متحرک — خود کارت (متن + سربرگ قرمز کم‌رنگ + چراغ گردان چرخان)
 *  در «یک» پیام ارسال می‌شود؛ دیگر گیفِ جدا + کارتِ جدا نیست (خواستهٔ کاربر ۲۰ نوامبر پنجم).
 *  هم‌الگوی renderBreakingGif (sharp خام + gifenc). شکست هر مرحله → null صادقانه.
 *  کارت خیلی بلند (متن کامل تروث‌سوشال چندصفحه‌ای) → null سریع → فراخواننده به PNG ثابت می‌رود. */
export async function renderBreakingCardGif(input: BreakingCardInput): Promise<CardPng | null> {
  try {
    const svg0 = makeBreakingCardSvg(input);
    if (!svg0) return null;
    const hasName = Boolean((input.faName || '').trim());
    if (breakingCardHeight(input.text || '', hasName) > BREAKING_GIF_MAX_HEIGHT) return null;
    const sharp = (await import('sharp')).default;
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
    const meta = await sharp(Buffer.from(svg0), { density: 72 }).metadata();
    if (!meta.width || !meta.height) return null;
    const encoder = GIFEncoder();
    for (let i = 0; i < BREAKING_CARD_GIF_FRAMES; i++) {
      const svg = makeBreakingCardSvg(input, i);
      const { data } = await sharp(Buffer.from(svg), { density: 72 }).raw().toBuffer({ resolveWithObject: true });
      const u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const palette = quantize(u8, 128);
      const index = applyPalette(u8, palette);
      encoder.writeFrame(index, meta.width, meta.height, { palette, delay: BREAKING_CARD_GIF_DELAY_MS });
    }
    encoder.finish();
    const gif = Buffer.from(encoder.bytes());
    if (gif.length < 5000 || gif.length > BREAKING_CARD_GIF_MAX_BYTES) return null;
    if (gif.slice(0, 3).toString('latin1') !== 'GIF') return null;
    return { png: gif, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}
