/**
 * کارت تصویری «متن کامل» — پالت بنفش — خواستهٔ کاربر (۲۵ نوامبر ۲۰۲۶):
 * «بعضی از اخبار الآن خام ارسال میشن ،متناشون خوبه اما میخوام اونا هم با یه رنگ پس
 *  زمینه متفاوت از بخشهای دیگه داخل یه عکس جا بشن».
 *
 * این کارت جای «پیام‌های متنی خام» سرریزها را می‌گیرد — همان‌هایی که از سپرهای
 * «بی‌بریدگی» (نقد ۲۱ نوامبر) به پیام متنی جداگانه می‌رفتند:
 *  ۱) سرریز «…» خبر — مورد بلندتر از سه خط کارت خبر (finalizeNewsCardText → null)؛
 *  ۲) سرریز ظرفیت کارت خبر — فراتر از سقف ردیف کارت‌ها؛
 *  ۳) سرریز توییت — ترجمهٔ بلندتر از سقف خط یا مازاد صفحات کارت توییت.
 * متن «کامل» روی کارت می‌آید (wrapFaFull — هیچ «…»، هیچ خلاصه‌سازی)، هرچند بلند؛
 * ارتفاع ردیف متغیر و صفحه‌بندی ارتفاعی همان کارت توییت.
 *
 * پالت بنفش متمایز از همهٔ بخش‌های دیگر است: خبر=سرمه‌ای، توییت=سبز کم‌رنگ،
 * فوری=قرمز کم‌رنگ، متن کامل=بنفش کم‌رنگ — «رنگ پس‌زمینهٔ متفاوت از بخشهای دیگه».
 * موردِ جنگ/ایران‌مرتبط همان تمایز کهربایی + بولد استاندارد را دارد (خواستهٔ ۲۵ نوامبر:
 * «داخل هر عکس با همون استانداردی که داشتیم کلمه جنگ و ایران اگر بود اون خبر رو متمایزکن»).
 *
 * همان معماری کارت خبر (bot/news-card.ts): SVG راست‌به‌چپ → PNG با sharp؛
 * صفحه‌ها کوتاه‌اند (سقف ۲۱۰۰px) → تراکم رندر ۳× (۳۲۴۰px عرض) — شارپ با زوم
 * (خواستهٔ ۲۵ نوامبر: «عکسها کیفیتشون کمه»). شکست رندر → null صادقانه؛ فراخواننده
 * به همان پیام متنی پیشین برمی‌گردد — هیچ متنی گم نمی‌شود.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faDigits } from './daily';
import { isPriorityRelated } from './iran';
import { type TripleDate } from './calendar';
import { wrapFaFull, stripCardEmoji } from './news-card';
import { renderDensityFor, BALE_DIM_SUM_MAX } from './render-scale';
import { FONT_FA } from './card-font';
import type { CardPng } from './news-card';

// ---------- فونت‌پیکربندی پروژه‌ای — پیش از نخستین رندر sharp ----------
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.FONTCONFIG_FILE) {
  try { mkdirSync(join(PROJECT_ROOT, '.fc-cache'), { recursive: true }); } catch { /* بی‌اهمیت */ }
  process.env.FONTCONFIG_FILE = join(PROJECT_ROOT, '.fontconfig.conf');
}

export interface FullTextCardItem {
  /** منبع — «خبرگزاری تسنیم» یا «𝕏 Donald Trump»؛ نبود → بدون خط منبع */
  source?: string;
  /** متن کامل — بدون هیچ بریدگی/خلاصه‌سازی (wrapFaFull) */
  text: string;
  /** نام فارسی نویسنده (توییت‌ها) — خط عنوان ردیف */
  name?: string;
}

export interface FullTextCardInput {
  /** تاریخ سه‌گانه — خط دوم سربرگ؛ اختیاری (سرریز می‌تواند بی‌تاریخ باشد) */
  date?: TripleDate;
  /** عنوان سربرگ — «متن کامل خبرها» (پیش‌فرض) یا «متن کامل توییت‌ها» */
  title?: string;
  items: FullTextCardItem[];
  part?: { no: number; of: number };
}

// ---------- هندسه — همان مقیاس کارت خبر/توییت ----------

const W = 1080;
const HEADER_H = 190;
const FOOTER_H = 88;
const PAD = 36;
const FT_SOURCE_H = 46;
const FT_NAME_H = 42;
const FT_LINE_H = 40;
const FT_PAD_BOTTOM = 50;
const FT_CHARS_PER_LINE = 62;

/** سقف ارتفاع هر صفحه — ۲۱۰۰px → تراکم رندر ۳× (۳×(۱۰۸۰+۲۱۰۰)=۹۵۴۰ ≤ سقف بله) —
 *  خواستهٔ ۲۵ نوامبر: کارت کوتاه‌تر = شارپ‌تر + «تعداد اخبار هر عکس کمتر، تعداد عکس بیشتر» */
export const FT_PAGE_MAX_HEIGHT = 2100;
/** سقف صفحات هر بستهٔ سرریز — مازاد → پیام متنی (سپر پیشین، هرگز حذف بی‌صدا) */
export const FT_MAX_PAGES = 12;

/** ارتفاع ردیف متن کامل — منبع + نام + همهٔ خطوط متن + بالشتک. خالص و تست‌پذیر. */
export function fullTextRowHeight(item: FullTextCardItem): number {
  const lines = wrapFaFull(stripCardEmoji(item.text || ''), FT_CHARS_PER_LINE).length;
  const hasSource = Boolean((item.source || '').trim());
  const hasName = Boolean((item.name || '').trim());
  return FT_SOURCE_H * (hasSource ? 1 : 0) + FT_NAME_H * (hasName ? 1 : 0) + Math.max(1, lines) * FT_LINE_H + FT_PAD_BOTTOM;
}

/** صفحه‌بندی ارتفاعی — هم‌الگوی splitTweetItemsForCards؛ مازاد در overflow برمی‌گردد
 *  (سپر «خبری از قلم نمی‌افتد») تا فراخواننده متن کاملش را بفرستد. خالص و تست‌پذیر.
 *  ممیزی ۲۷ نوامبر — سقف تک‌آیتم: موردِ تنها که بلندتر از خودِ صفحه است پیش‌تر شرط
 *  `cur.length > 0` را دور می‌زد و صفحه‌ای بلندتر از سقف (تا >۹٬۰۰۰px — بی‌فرست‌نی) می‌ساخت؛
 *  حالا چنین آیتمی مستقیم به overflow (پیام متنی — بدون سقف ارتفاع) می‌رود. */
export function splitFullTextItemsForCards(items: FullTextCardItem[], maxHeight: number = FT_PAGE_MAX_HEIGHT, maxPages: number = FT_MAX_PAGES): { paged: FullTextCardItem[][]; overflow: FullTextCardItem[] } {
  if (!items || items.length === 0) return { paged: [], overflow: [] };
  const pages: FullTextCardItem[][] = [];
  const overflow: FullTextCardItem[] = [];
  let cur: FullTextCardItem[] = [];
  const pageBase = HEADER_H + FOOTER_H + 26;
  let h = pageBase;
  for (let k = 0; k < items.length; k++) {
    const it = items[k]!;
    const rh = fullTextRowHeight(it);
    // تک‌آیتمِ بلندتر از کل صفحه — هیچ صفحه‌ای جایش نیست؛ سرریز صادقانه (پیام متنی کامل)
    if (rh > maxHeight - pageBase) { overflow.push(it); continue; }
    if (cur.length > 0 && h + rh > maxHeight) {
      pages.push(cur);
      cur = [];
      h = pageBase;
      if (pages.length >= maxPages) return { paged: pages, overflow: [...overflow, ...items.slice(k)] };
    }
    cur.push(it);
    h += rh;
  }
  if (cur.length > 0) pages.push(cur);
  return { paged: pages, overflow };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

/** عنوان پیش‌فرض سربرگ — خالص. */
export const FULLTEXT_NEWS_TITLE = 'متن کامل خبرها';
/** عنوان سربرگ بستهٔ توییت — خالص. */
export const FULLTEXT_TWEETS_TITLE = 'متن کامل توییت‌ها';

// ---------- ساخت SVG — خالص و تست‌پذیر (بدون sharp) ----------

export function makeFullTextCardSvg(input: FullTextCardInput): string {
  const { items } = input;
  if (!items || items.length === 0) return '';
  const title = (input.title || FULLTEXT_NEWS_TITLE).trim() || FULLTEXT_NEWS_TITLE;
  const heights = items.map((it) => fullTextRowHeight(it));
  const H = HEADER_H + 14 + heights.reduce((a, b) => a + b, 0) + FOOTER_H;

  const partLabel = input.part && input.part.of > 1 ? ` — بخش ${faDigits(String(input.part.no))} از ${faDigits(String(input.part.of))}` : '';
  const dateLine = input.date ? `${input.date.weekdayFa} ${input.date.shamsi} • ${input.date.miladi}` : 'بدون بریدگی و خلاصه‌سازی';

  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="86" font-size="40" font-weight="700" fill="#ffffff" text-anchor="end">${rtl(esc(title))}</text>
  <text x="${W - PAD}" y="140" font-size="25" fill="#d9cdf2" text-anchor="end">${rtl(esc(`${dateLine}${partLabel}`))}</text>`;

  const textRight = W - PAD - 28;
  let y = HEADER_H + 14;
  const rowsSvg = items
    .map((it, i) => {
      const yTop = y;
      y += heights[i]!;
      // مورد جنگ/ایران‌مرتبط — همان تمایز کهربایی استاندارد (خواستهٔ ۲۵ نوامبر) روی پالت بنفش
      const hot = isPriorityRelated(`${it.name || ''} ${it.text || ''}`);
      const bg = hot
        ? (i % 2 === 0 ? '#faf2da' : '#f6ecd0')
        : i % 2 === 0 ? '#efe7f9' : '#e9def5';
      const srcLine = (it.source || '').replace(/\s+/g, ' ').trim();
      const nameLine = (it.name || '').replace(/\s+/g, ' ').trim();
      const hasSource = srcLine.length > 0;
      const hasName = nameLine.length > 0;
      // متن کامل — بدون سقف خط (wrapFaFull)؛ ارتفاع ردیف همین‌ها است، هیچ بریدگی نیست
      const faLines = wrapFaFull(stripCardEmoji(it.text || ''), FT_CHARS_PER_LINE);
      const firstY = yTop + (hasSource ? 40 : 18) + (hasName ? 44 : 0);
      const srcSvg = hasSource
        ? `<text x="${textRight}" y="${yTop + 36}" font-size="22" font-weight="700" fill="${hot ? '#a1762a' : '#6d5a8e'}" text-anchor="end">${rtl(esc(srcLine))}</text>`
        : '';
      const nameSvg = hasName
        ? `<text x="${textRight}" y="${yTop + (hasSource ? FT_SOURCE_H : 6) + 32}" font-size="26" font-weight="700" fill="${hot ? '#8a5a12' : '#4c3575'}" text-anchor="end">${rtl(esc(nameLine))}</text>`
        : '';
      const faSvg = faLines
        .map((ln, j) => `<text x="${textRight}" y="${firstY + (j + 1) * FT_LINE_H}" font-size="26"${hot ? ' font-weight="700"' : ''} fill="${hot ? '#8a5a12' : '#3b2a5e'}" text-anchor="end">${rtl(esc(ln))}</text>`)
        .join('\n');
      return `
  <rect x="${PAD}" y="${yTop}" width="${W - PAD * 2}" height="${heights[i]! - 12}" rx="14" fill="${bg}"/>
  ${hot ? `<rect x="${PAD + 8}" y="${yTop + 10}" width="5" height="${heights[i]! - 32}" rx="2.5" fill="#d9a441"/>` : ''}
  ${srcSvg}
  ${nameSvg}
  ${faSvg}`;
    })
    .join('');

  const footerY = H - 34;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#6a578f" text-anchor="end">${rtl('رصدبان • متن کامل — بدون خلاصه‌سازی')}</text>
  <text x="${PAD}" y="${footerY}" font-size="20" fill="#6a578f" text-anchor="start">${rtl('موارد جنگ/ایران کهربایی متمایز')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT_FA}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b1d6e"/><stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#f7f3fc"/>
  ${header}
  ${rowsSvg}
  ${footer}
</svg>`;
}

// ---------- رندر PNG — شکست هر مرحله → null (فراخواننده به پیام متنی برمی‌گردد) ----------

function svgDimsOf(svg: string): { w: number; h: number } | null {
  const m = svg.match(/width="(\d+)" height="(\d+)"/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

export async function renderFullTextCardPng(input: FullTextCardInput): Promise<CardPng | null> {
  try {
    if (!input.items || input.items.length === 0) return null;
    const svg = makeFullTextCardSvg(input);
    if (!svg) return null;
    const sharp = (await import('sharp')).default;
    const d = svgDimsOf(svg);
    // ممیزی ۲۷ نوامبر — گارد فرست‌پذیری بله: حتی ۱× نباید از سقف مجموع عرض+ارتفاع بگذرد؛
    // کارتِ نافرستنی صادقانه null می‌شود و فراخواننده به پیام متنی کامل برمی‌گردد (هیچ بریدگی).
    if (d && d.w + d.h > BALE_DIM_SUM_MAX) return null;
    const png = await sharp(Buffer.from(svg), { density: d ? renderDensityFor(d.w, d.h) : 72 }).png().toBuffer();
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height || png.length < 5000) return null;
    return { png, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/** صفحه‌بندی + رندر همهٔ موارد در چند کارت پیاپی — خروجی «pages» خالی یعنی شکست/بی‌مورد
 *  (فراخواننده به پیام متنی خام پیشین برمی‌گردد — هیچ متنی گم نمی‌شود).
 *  «overflow»: مازادِ صادقانهٔ فراتر از سقف صفحات — سپر «خبری از قلم نمی‌افتد» (نقد ۲۱ نوامبر). */
export async function renderFullTextCardPages(input: FullTextCardInput, opts: { maxHeight?: number; maxPages?: number } = {}): Promise<{ pages: CardPng[]; overflow: FullTextCardItem[] }> {
  const split = splitFullTextItemsForCards(input.items || [], opts.maxHeight, opts.maxPages);
  const out: CardPng[] = [];
  for (let p = 0; p < split.paged.length; p++) {
    const card = await renderFullTextCardPng({ ...input, items: split.paged[p]!, part: { no: p + 1, of: split.paged.length } });
    if (card) out.push(card);
  }
  return { pages: out, overflow: split.overflow };
}
