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
const ROW_H = 158;
const BANNER_H = 62;
const PAD = 36;
const FOOTER_H = 88;
const MAX_CHARS_PER_LINE = 56;

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
  const H = HEADER_H + items.length * ROW_H + bannersH + 26 + moreH + FOOTER_H;

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
    rowY += ROW_H;
    const bg = i % 2 === 0 ? '#102941' : '#0d2135';
    const lines = wrapFa(it.text || '', MAX_CHARS_PER_LINE, 2);
    const cy = yTop + (ROW_H - 12) / 2;
    const numCx = W - PAD - 34;
    const textRight = W - PAD - 110;
    const line1 = esc(lines[0] || '');
    const line2 = esc(lines[1] || '');
    const src = it.source ? `<text x="${textRight}" y="${yTop + 128}" font-size="19" fill="#7fa8c9" text-anchor="end">${rtl(`منبع: ${esc(it.source)}`)}</text>` : '';
    const l2 = line2 ? `<text x="${textRight}" y="${yTop + 92}" font-size="27" fill="#e8f1fa" text-anchor="end">${rtl(line2)}</text>` : '';
    pieces.push(`${banner}
  <rect x="${PAD}" y="${yTop}" width="${W - PAD * 2}" height="${ROW_H - 12}" rx="14" fill="${bg}"/>
  <circle cx="${numCx}" cy="${cy - 8}" r="24" fill="#16405f" stroke="#2c6ea5" stroke-width="1.5"/>
  <text x="${numCx}" y="${cy}" font-size="25" font-weight="700" fill="#ffffff" text-anchor="middle">${rtl(faDigits(String(i + 1)))}</text>
  ${it.tick ? tickBadgeSvg(numCx - 46, cy - 8) : ''}
  <text x="${textRight}" y="${yTop + 52}" font-size="27" fill="#e8f1fa" text-anchor="end">${rtl(line1)}</text>
  ${l2}
  ${src}`);
  });
  const rowsSvg = pieces.join('\n');

  const moreSvg =
    more > 0
      ? `<text x="${W / 2}" y="${HEADER_H + 14 + bannersH + items.length * ROW_H + 40}" font-size="24" fill="#9fc3e8" text-anchor="middle">${rtl(`+ ${faDigits(String(more))} رویداد دیگر در کارت‌های بعدی`)}</text>`
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
/** سقف خطوط ترجمه هر توییت — توییت‌های عادی (≤۲۸۰ نویسه) ~۴-۶ خط؛ فراتر صادقانه با «…» */
export const TW_MAX_LINES = 14;
/** سقف ارتفاع هر کارت توییت (px) — صفحه‌بندی بر پایهٔ ارتفاع واقعی ردیف‌ها */
export const TW_PAGE_MAX_HEIGHT = 6400;

/** ارتفاع ردیف یک توییت — خالص و تست‌پذیر (صفحه‌بندی بر پایهٔ آن) */
export function tweetRowHeight(fa: string): number {
  const lines = wrapFa(fa || '', TW_CHARS_PER_LINE, TW_MAX_LINES).length;
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
  <text x="${W - PAD}" y="140" font-size="26" fill="#9fc3e8" text-anchor="end">${rtl(`${date.weekdayFa} ${date.shamsi} • ${date.miladi}${partLabel}`)}</text>`;

  const textRight = W - PAD - 28;
  let y = HEADER_H + 14;
  const rowsSvg = items
    .map((it, i) => {
      const yTop = y;
      y += heights[i]!;
      const bg = i % 2 === 0 ? '#102941' : '#0d2135';
      // نام فارسی توییت‌کننده — خط عنوان؛ نبود آن → «ترجمه فارسی» (سازگاری با دادهٔ قدیمی)
      const nameLine = (it.faName || 'ترجمه فارسی').replace(/\s+/g, ' ').trim();
      const nameLines = wrapFa(nameLine, 60, 1);
      const nameY = yTop + TW_SOURCE_H + 30;
      const faLines = wrapFa(it.fa || '', TW_CHARS_PER_LINE, TW_MAX_LINES);
      const faSvg = faLines
        .map((ln, j) => `<text x="${textRight}" y="${nameY + 34 + (j + 1) * TW_LINE_H}" font-size="26" fill="#e8f1fa" text-anchor="end">${rtl(esc(ln))}</text>`)
        .join('\n');
      return `
  <rect x="${PAD}" y="${yTop}" width="${W - PAD * 2}" height="${heights[i]! - 12}" rx="14" fill="${bg}"/>
  <text x="${textRight}" y="${yTop + 38}" font-size="24" font-weight="700" fill="#9fc3e8" text-anchor="end">${rtl(esc(it.source))}${it.verified ? ' ✅' : ''}</text>
  <text x="${textRight}" y="${nameY}" font-size="27" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl(esc(nameLines[0] || nameLine))}</text>
  ${faSvg}`;
    })
    .join('');

  const footerY = H - 34;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="end">${rtl('رصدبان • توییت/تروث‌سوشال مقامات تأثیرگذار')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1c30"/>
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
