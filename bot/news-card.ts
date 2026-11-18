/**
 * کارت تصویری بستهٔ خبری — خواستهٔ کاربر (۱۵ نوامبر ۲۰۲۶):
 * «کارت‌سازی بستهٔ خبری و گزارش بازار — همان زیرساخت امروزِ هواشناسی قابل استفادهٔ مجدد است».
 *
 * همان معماری کارت هواشناسی (bot/weather-card.ts): ساخت SVG با چیدمان راست‌به‌چپ و فونت
 * وزیرمتن → تبدیل به PNG با sharp (libvips/librsvg) — هیچ وابستگی تازه‌ای.
 *
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
const HEADER_H = 240;
const CHIPS_H = 110;
const ROW_H = 158;
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
  const verified = items.filter((i) => i.tick).length;
  const dropped = input.dropped ?? 0;
  const more = Math.max(0, total - items.length);
  const rows = items.length;
  const moreH = more > 0 ? 64 : 0;
  const H = HEADER_H + CHIPS_H + rows * ROW_H + 26 + moreH + FOOTER_H;

  const chips: Array<{ label: string; value: string }> = [
    { label: 'رویدادهای بازه', value: faDigits(String(total)) },
    { label: 'تأییدشدهٔ دومانبعی', value: faDigits(String(verified)) },
  ];
  if (dropped > 0) chips.push({ label: 'حذفِ بی‌خاستگاه', value: faDigits(String(dropped)) });
  if (more > 0) chips.push({ label: 'در کارت‌های بعدی', value: `+${faDigits(String(more))}` });

  const partLabel = input.part && input.part.of > 1 ? ` — بخش ${faDigits(String(input.part.no))} از ${faDigits(String(input.part.of))}` : '';
  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="86" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('بستهٔ خبری رصدبان')}</text>
  <text x="${W - PAD}" y="140" font-size="26" fill="#9fc3e8" text-anchor="end">${rtl(`${date.weekdayFa} ${date.shamsi} • ${date.miladi}${partLabel}`)}</text>
  <text x="${W - PAD}" y="200" font-size="30" font-weight="500" fill="#ffd75e" text-anchor="end">${rtl(`${faDigits(String(total))} رویداد این بازه • ${faDigits(String(verified))} مورد تأییدشده`)}</text>`;

  const chipW = (W - PAD * 2 - (chips.length - 1) * 16) / chips.length;
  const chipsSvg = chips
    .map((c, i) => {
      const x = W - PAD - chipW - i * (chipW + 16); // راست به چپ
      return `
  <rect x="${x.toFixed(1)}" y="${HEADER_H + 22}" width="${chipW.toFixed(1)}" height="${CHIPS_H - 44}" rx="14" fill="#123a5e"/>
  <text x="${(x + chipW / 2).toFixed(1)}" y="${HEADER_H + 52}" font-size="20" fill="#8fb8d9" text-anchor="middle">${rtl(c.label)}</text>
  <text x="${(x + chipW / 2).toFixed(1)}" y="${HEADER_H + 86}" font-size="25" font-weight="700" fill="#e8f1fa" text-anchor="middle">${rtl(c.value)}</text>`;
    })
    .join('');

  const rowsSvg = items
    .map((it, i) => {
      const yTop = HEADER_H + CHIPS_H + 14 + i * ROW_H;
      const bg = i % 2 === 0 ? '#102941' : '#0d2135';
      const lines = wrapFa(it.text || '', MAX_CHARS_PER_LINE, 2);
      const cy = yTop + (ROW_H - 12) / 2;
      const numCx = W - PAD - 34;
      const textRight = W - PAD - 110;
      const line1 = esc(lines[0] || '');
      const line2 = esc(lines[1] || '');
      const src = it.source ? `<text x="${textRight}" y="${yTop + 128}" font-size="19" fill="#7fa8c9" text-anchor="end">${rtl(`منبع: ${esc(it.source)}`)}</text>` : '';
      const l2 = line2 ? `<text x="${textRight}" y="${yTop + 92}" font-size="27" fill="#e8f1fa" text-anchor="end">${rtl(line2)}</text>` : '';
      return `
  <rect x="${PAD}" y="${yTop}" width="${W - PAD * 2}" height="${ROW_H - 12}" rx="14" fill="${bg}"/>
  <circle cx="${numCx}" cy="${cy - 8}" r="24" fill="#16405f" stroke="#2c6ea5" stroke-width="1.5"/>
  <text x="${numCx}" y="${cy}" font-size="25" font-weight="700" fill="#ffffff" text-anchor="middle">${rtl(faDigits(String(i + 1)))}</text>
  ${it.tick ? tickBadgeSvg(numCx - 46, cy - 8) : ''}
  <text x="${textRight}" y="${yTop + 52}" font-size="27" fill="#e8f1fa" text-anchor="end">${rtl(line1)}</text>
  ${l2}
  ${src}`;
    })
    .join('');

  const moreSvg =
    more > 0
      ? `<text x="${W / 2}" y="${HEADER_H + CHIPS_H + 14 + rows * ROW_H + 40}" font-size="24" fill="#9fc3e8" text-anchor="middle">${rtl(`+ ${faDigits(String(more))} رویداد دیگر در کارت‌های بعدی`)}</text>`
      : '';

  const footerY = H - 34;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="end">${rtl('رصدبان • تیک اعتبارسنجی قفل‌شده به جمله‌های منبع')}</text>
  <text x="${PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="start">${rtl('تطبیق اجباری خروجی/منبع انجام شد')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1c30"/>
  ${header}
  ${chipsSvg}
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

/** کپشن کوتاه کارت (≤۱۰۲۴ نویسهٔ بله) — خالص و تست‌پذیر.
 *  ۱۶ نوامبر: بخش شماره‌دار + تحلیل پایانی در پیام متنی پیرو کارت‌ها. */
export function buildNewsCardCaption(input: NewsCardInput): string {
  const { date, items } = input;
  const total = input.total ?? items.length;
  const verified = items.filter((i) => i.tick).length;
  const dropped = input.dropped ?? 0;
  const partLabel = input.part && input.part.of > 1 ? ` — بخش ${faDigits(String(input.part.no))} از ${faDigits(String(input.part.of))}` : '';
  const L: string[] = [
    `📰 <b>بستهٔ خبری رصدبان</b>${partLabel}`,
    `📅 ${date.weekdayFa} — ${date.shamsi} • ${date.miladi}`,
    `📋 ${faDigits(String(total))} رویداد این بازه — ${faDigits(String(verified))} مورد تأییدشدهٔ دومانبعی`,
  ];
  if (dropped > 0) L.push(`🛡 ${faDigits(String(dropped))} مورد بی‌خاستگاه در تطبیق با منبع حذف شد`);
  L.push('📡 رصدبان — تیک اعتبارسنجی قفل‌شده به جمله‌های منبع');
  return L.join('\n').slice(0, 1024);
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

// ---------- کارت توییت‌ها — همان قالب، برای بستهٔ توییت/تروث‌سوشال (خواستهٔ ۱۶ نوامبر) ----------

export interface TweetCardItem {
  /** برچسب منبع با نشانگر پلتفرم — «𝕏 Donald Trump» یا «🅣 Donald Trump (تروث‌سوشال)» */
  source: string;
  /** متن اصلی (انگلیسی/هر زبان) — یک خط در کارت */
  orig: string;
  /** ترجمهٔ فارسی روان */
  fa: string;
  /** نام فارسی توییت‌کننده + مسئولیت — خط «نام: ترجمه» */
  faName?: string;
  /** توییت دومانبعی/تأییدشده (بازتاب هم‌موضوع) */
  verified?: boolean;
}

export interface TweetCardInput {
  date: TripleDate;
  items: TweetCardItem[];
  part?: { no: number; of: number };
}

/** هندسهٔ ردیف توییت: برچسب + اصلی + حداکثر دو خط ترجمه */
const TW_ROW_H = 208;
export const TWEET_CARD_ROWS_PER_PAGE = 8;
export const TWEET_CARD_MAX_PAGES = 3;

/** ساخت SVG کارت توییت — خالص و تست‌پذیر */
export function makeTweetCardSvg(input: TweetCardInput): string {
  const { date, items } = input;
  if (!items || items.length === 0) return '';
  const rows = items.length;
  const H = HEADER_H + CHIPS_H + rows * TW_ROW_H + 26 + FOOTER_H;
  const partLabel = input.part && input.part.of > 1 ? ` — بخش ${faDigits(String(input.part.no))} از ${faDigits(String(input.part.of))}` : '';
  const verified = items.filter((i) => i.verified).length;

  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="86" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('توییت‌های مقامات تأثیرگذار')}</text>
  <text x="${W - PAD}" y="140" font-size="26" fill="#9fc3e8" text-anchor="end">${rtl(`${date.weekdayFa} ${date.shamsi} • ${date.miladi}${partLabel}`)}</text>
  <text x="${W - PAD}" y="200" font-size="30" font-weight="500" fill="#ffd75e" text-anchor="end">${rtl(`${faDigits(String(items.length))} پست این بازه • ${faDigits(String(verified))} بازتاب چندمنبعی`)}</text>`;

  const chips: Array<{ label: string; value: string }> = [
    { label: 'پلتفرم', value: '𝕏 ایکس + 🅣 تروث‌سوشال' },
  ];
  const chipW = (W - PAD * 2 - (chips.length - 1) * 16) / chips.length;
  const chipsSvg = chips
    .map((c, i) => {
      const x = W - PAD - chipW - i * (chipW + 16);
      return `
  <rect x="${x.toFixed(1)}" y="${HEADER_H + 22}" width="${chipW.toFixed(1)}" height="${CHIPS_H - 44}" rx="14" fill="#123a5e"/>
  <text x="${(x + chipW / 2).toFixed(1)}" y="${HEADER_H + 52}" font-size="20" fill="#8fb8d9" text-anchor="middle">${rtl(c.label)}</text>
  <text x="${(x + chipW / 2).toFixed(1)}" y="${HEADER_H + 86}" font-size="23" font-weight="700" fill="#e8f1fa" text-anchor="middle">${rtl(c.value)}</text>`;
    })
    .join('');

  const rowsSvg = items
    .map((it, i) => {
      const yTop = HEADER_H + CHIPS_H + 14 + i * TW_ROW_H;
      const bg = i % 2 === 0 ? '#102941' : '#0d2135';
      const textRight = W - PAD - 28;
      const orig1 = esc(wrapFa(it.orig || '', 62, 1)[0] || '');
      const faLine1 = it.faName ? `${it.faName}: ` : '';
      const faLines = wrapFa(`${faLine1}${it.fa || ''}`, MAX_CHARS_PER_LINE, 2);
      const fa1 = esc(faLines[0] || '');
      const fa2 = esc(faLines[1] || '');
      const l2 = fa2 ? `<text x="${textRight}" y="${yTop + 178}" font-size="26" fill="#e8f1fa" text-anchor="end">${rtl(fa2)}</text>` : '';
      return `
  <rect x="${PAD}" y="${yTop}" width="${W - PAD * 2}" height="${TW_ROW_H - 12}" rx="14" fill="${bg}"/>
  <text x="${textRight}" y="${yTop + 46}" font-size="26" font-weight="700" fill="#9fc3e8" text-anchor="end">${rtl(esc(it.source))}${it.verified ? ' ✅' : ''}</text>
  <text x="${textRight}" y="${yTop + 88}" font-size="24" fill="#c7d9ec" text-anchor="end">${rtl(orig1)}</text>
  <text x="${textRight}" y="${yTop + 136}" font-size="26" fill="#e8f1fa" text-anchor="end">${rtl(fa1)}</text>
  ${l2}`;
    })
    .join('');

  const footerY = H - 34;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="end">${rtl('رصدبان • توییت/تروث‌سوشال مقامات تأثیرگذار')}</text>
  <text x="${PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="start">${rtl('ترجمهٔ وفادار کامل — بدون خلاصه‌سازی')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1c30"/>
  ${header}
  ${chipsSvg}
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
export async function renderTweetCardPages(input: TweetCardInput, opts: { rowsPerPage?: number; maxPages?: number } = {}): Promise<CardPng[]> {
  const per = opts.rowsPerPage ?? TWEET_CARD_ROWS_PER_PAGE;
  const maxPages = opts.maxPages ?? TWEET_CARD_MAX_PAGES;
  const pages = paginateItems(input.items || [], per, maxPages);
  const out: CardPng[] = [];
  for (let p = 0; p < pages.length; p++) {
    const card = await renderTweetCardPng({ ...input, items: pages[p]!, part: { no: p + 1, of: pages.length } });
    if (card) out.push(card);
  }
  return out;
}

/** کپشن کارت توییت — خالص و تست‌پذیر */
export function buildTweetCardCaption(input: TweetCardInput): string {
  const { date, items } = input;
  const partLabel = input.part && input.part.of > 1 ? ` — بخش ${faDigits(String(input.part.no))} از ${faDigits(String(input.part.of))}` : '';
  const L: string[] = [
    `🐦 <b>توییت‌های مقامات تأثیرگذار</b>${partLabel}`,
    `📅 ${date.weekdayFa} — ${date.shamsi} • ${date.miladi}`,
    `📋 ${faDigits(String(items.length))} پست — ترجمهٔ وفادار زیر هر متن اصلی`,
    '📡 رصدبان — ایکس و تروث‌سوشال',
  ];
  return L.join('\n').slice(0, 1024);
}
