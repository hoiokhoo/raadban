/**
 * کارت تصویری گزارش بازار خودرو — بازطراحی ۲۴ نوامبر ۲۰۲۶ (خواستهٔ کاربر):
 * «بخش قیمت ماشینها خیلی دراز شد، اولا ستون چهارم رو با ستون دوم ادغام کن، یعنی اول
 *  قیمت بازار کنارش داخل پرانتز در صد تغییر نسبت به قیمت ۲۴ ساعت گذشته. دوما تعداد
 *  ستونها رو بکن ۶ تا در بخش ماشین، نصف بقیه ماشینها رو در همون سه ستون بعدی قرار
 *  بده که در نتیجه ارتفاع عکس کمتر بشه».
 *
 *  → کارت خودرو: فقط خودرو (طلا/ارز/تورم به کارت مجزای دارایی‌ها رفت — bot/assets-card.ts)؛
 *  → شش ستون = دو بلوکِ سه‌ستونی کنار هم: ستون‌های ۱-۳ (راست) نیمهٔ ارزان‌ترِ فهرستِ
 *    مرتب‌شده، ستون‌های ۴-۶ (چپ) نیمهٔ گران‌تر — ارتفاع عکس تقریباً نصف می‌شود؛
 *  → ستون «بازار» = قیمت بازار + درصد تغییر ۲۴ساعته داخل پرانتز (ادغام ستون چهارم)؛
 *  → ستون «کارخانه» = قیمت کارخانه/نمایندگی باما + خط ریز اختلاف با بازار (مبلغ و درصد).
 *
 * همان معماری پیشین: SVG راست‌به‌چپ با فونت وزیرمتن → PNG با sharp (اکنون ۲× برای
 * شفافیت در زوم — خواستهٔ ۲۴ نوامبر). شکست رندر → null و فراخواننده پیام متنی کامل
 * می‌فرستد — هیچ کارت نیمه‌ساختگی.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faDigits } from './daily';
import { type TripleDate } from './calendar';
import { renderDensityFor } from './render-scale';
import { compactNum, faGroup, officialDeltaOf, type Quote } from './market';
import { FONT_FA } from './card-font';

// ---------- فونت‌پیکربندی پروژه‌ای — پیش از نخستین رندر sharp ----------
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.FONTCONFIG_FILE) {
  try { mkdirSync(join(PROJECT_ROOT, '.fc-cache'), { recursive: true }); } catch { /* بی‌اهمیت */ }
  process.env.FONTCONFIG_FILE = join(PROJECT_ROOT, '.fontconfig.conf');
}

export interface MarketCardInput {
  date: TripleDate;
  /** برچسب اسلات — «گزارش روزانه (ساعت ۱۵)» | «گزارش فوری» */
  slotLabel: string;
  /** اقلام با درصد تغییر اعمال‌شده (applyDeltas) — کارت فقط خودروها را می‌کشد */
  quotes: Quote[];
}

export interface CardPng {
  png: Buffer;
  width: number;
  height: number;
}

// ---------- هندسهٔ کارت — جدول شش‌ستونی (دو بلوک سه‌ستونی) ----------

const W = 1080;
const HEADER_H = 150;
/** سطر عنوان ستون‌ها — «خودرو | بازار (۲۴ ساعت) | کارخانه» × دو بلوک */
const COLHDR_H = 58;
const SECTION_H = 54;
/** سطر خودرو — تک‌خط در نام/بازار؛ کارخانه دو خط (قیمت + اختلاف ریز) */
const ROW_H = 78;
const PAD = 32;
/** فاصلهٔ میان دو بلوک سه‌ستونی */
const BLOCK_GAP = 26;
const FOOTER_H = 78;
/** بیشینهٔ نویسهٔ نام مدل در ستون باریک بلوک */
const TITLE_MAX_CHARS = 16;
/** سقف ردیف خودرو روی کارت — ۱۰→۴۰ (۲۳ نوامبر)؛ نصفش در هر بلوک می‌نشیند (۲۴ نوامبر) */
const MAX_CARS = 40;
/** عرض هر بلوک سه‌ستونی */
const BLOCK_W = Math.floor((W - PAD * 2 - BLOCK_GAP) / 2); // ۴۹۵

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

// ---------- ردیف خودرو — خالص و تست‌پذیر ----------

export interface MarketRow {
  title: string;
  /** قیمت بازار فشرده — «۲٫۶۱۵ میلیارد» (قالب‌بندی‌شده) */
  value: string;
  /** درصد تغییر نسبت به روز قبل — null یعنی «—» (بی‌داده) */
  pct: number | null;
  /** قیمت کارخانه/نمایندگی فشرده — null یعنی «—» */
  official: string | null;
  /** اختلاف بازار از کارخانه — مبلغ فشرده؛ null یعنی بی‌معنا */
  gapAbs: string | null;
  /** درصد همان اختلاف — «۱۱۹٫۹٪» */
  gapPct: string | null;
  /** جهت اختلاف: true = بازار بالاتر از کارخانه؛ null = بی‌معنا */
  gapUp: boolean | null;
}

/** قیمت رسمی یک قلم — کارخانه (خودرو، باما) یا دولتی؛ قالب فشردهٔ کارت */
export function officialCompactOf(q: Quote): string | null {
  const v = q.officialToman ?? q.factoryToman;
  if (v !== undefined && Number.isFinite(v) && v > 0) return compactNum(v, 'toman');
  return null;
}

/** ردیف خودرو از یک Quote — قالب‌بندی فشردهٔ کارت شش‌ستونی. خالص. */
export function carRowOf(q: Quote): MarketRow {
  const pct = typeof q.changePct === 'number' && Number.isFinite(q.changePct) ? q.changePct : null;
  const gap = officialDeltaOf(q);
  const gapMeaningful = gap !== null && Math.abs(gap.diff) >= 1;
  return {
    title: q.title,
    value: compactNum(q.value, 'toman'),
    pct,
    official: officialCompactOf(q),
    gapAbs: gapMeaningful ? compactNum(gap.diff, 'toman') : null,
    gapPct: gapMeaningful ? `${faGroup(Math.abs(gap.pct), 0)}٪` : null,
    gapUp: gapMeaningful ? gap.diff > 0 : null,
  };
}

/** دو بلوک سه‌ستونی خودرو — نیمهٔ ارزان‌تر (راست) و نیمهٔ گران‌تر (چپ).
 *  ورودی از پیش صعودی مرتب است (mergeCarQuotes — خواستهٔ ۲۳ نوامبر)؛ دوباره صعودی
 *  مرتب می‌کنیم تا هیچ وابستگی ترتیبی به فراخواننده نماند. خالص و تست‌پذیر. */
export function carTableBlocks(quotes: Quote[]): { right: MarketRow[]; left: MarketRow[]; more: number } {
  const cars = quotes
    .filter((q) => q.key.startsWith('car:'))
    .slice()
    .sort((a, b) => a.value - b.value);
  const shown = cars.slice(0, MAX_CARS).map(carRowOf);
  const half = Math.ceil(shown.length / 2);
  return { right: shown.slice(0, half), left: shown.slice(half), more: Math.max(0, cars.length - MAX_CARS) };
}

/** فلش برداری صعود/نزول — بدون فونت */
function arrowSvg(x: number, y: number, up: boolean, color: string): string {
  const d = up
    ? `M ${x + 2} ${y + 4} L ${x + 12} ${y + 4} L ${x + 7} ${y - 7} Z`
    : `M ${x + 2} ${y - 7} L ${x + 12} ${y - 7} L ${x + 7} ${y + 4} Z`;
  return `<path d="${d}" fill="${color}"/>`;
}

// ---------- ساخت SVG — خالص و تست‌پذیر (بدون sharp) ----------

/** لنگرهای افقی یک بلوک (راست→چپ): خودرو | بازار (۲۴ساعت) | کارخانه — خالص */
export function blockAnchors(blockRight: number): { nameR: number; mktR: number; offR: number; blockL: number } {
  const nameR = blockRight - 8; // لبهٔ راست ستون نام
  const mktR = nameR - 152; // لبهٔ راست ستون بازار (قیمت + پرانتز درصد)
  const offR = mktR - 196; // لبهٔ راست ستون کارخانه
  return { nameR, mktR, offR, blockL: blockRight - BLOCK_W };
}

function blockRowsSvg(rows: MarketRow[], blockRight: number, yStart: number): string {
  const a = blockAnchors(blockRight);
  const out: string[] = [];
  rows.forEach((r, i) => {
    const ry = yStart + i * ROW_H;
    const bg = i % 2 === 0 ? '#102941' : '#0d2135';
    const cy = ry + 47; // خط تک‌متن نام/بازار
    const title = r.title.length > TITLE_MAX_CHARS ? `${r.title.slice(0, TITLE_MAX_CHARS - 1)}…` : r.title;
    // درصد ۲۴ساعته — داخل پرانتز کنار قیمت بازار (ادغام ستون چهارم — خواستهٔ ۲۴ نوامبر)؛
    // علامت +/− داخل پرانتز + رنگ سبز/قرمز جهت را می‌رساند (فلش برداری در این تنگا جا ندارد)
    const hasPct = r.pct !== null && Math.abs(r.pct as number) >= 0.05;
    const pctColor = !hasPct ? '#7fa8c6' : (r.pct as number) > 0 ? '#4ade80' : '#f87171';
    const pctInner = hasPct ? `${(r.pct as number) > 0 ? '+' : '−'}${faGroup(Math.abs(r.pct as number), 1)}٪` : '—';
    // اختلاف بازار از کارخانه — کهربایی (بازار گران‌تر) / سبز (ارزان‌تر)
    const gapColor = r.gapUp === null || r.gapUp ? '#fbbf24' : '#4ade80';
    out.push(`
  <rect x="${a.blockL}" y="${ry}" width="${BLOCK_W}" height="${ROW_H - 12}" rx="12" fill="${bg}"/>
  <text x="${a.nameR}" y="${cy}" font-size="21" fill="#e8f1fa" text-anchor="end">${rtl(esc(title))}</text>
  <text x="${a.mktR}" y="${cy}" font-size="21" font-weight="700" fill="#ffffff" text-anchor="end">${'\u202B'}${esc(r.value)} <tspan font-size="16" font-weight="400" fill="${pctColor}">(${pctInner})</tspan>${'\u202C'}</text>
  ${r.official
    ? `<text x="${a.offR}" y="${ry + 33}" font-size="18" fill="#9fc3e8" text-anchor="end">${rtl(esc(r.official))}</text>${r.gapAbs && r.gapPct && r.gapUp !== null ? `<text x="${a.offR}" y="${ry + 58}" font-size="14" fill="${gapColor}" text-anchor="end">${rtl(`اختلاف ${esc(r.gapAbs)} (${esc(r.gapPct)})`)}</text>` : ''}`
    : `<text x="${a.offR}" y="${cy}" font-size="21" fill="#7fa8c6" text-anchor="end">${rtl('—')}</text>`}`);
  });
  return out.join('\n');
}

/** SVG کامل کارت خودرو — خالص و تست‌پذیر */
export function makeMarketCardSvg(input: MarketCardInput): string {
  const { date, slotLabel, quotes } = input;
  if (!quotes || quotes.length === 0) return '';
  const { right, left, more } = carTableBlocks(quotes);
  if (right.length === 0) return '';

  const rowsMax = Math.max(right.length, left.length);
  const moreH = more > 0 ? 48 : 0;
  const H = HEADER_H + COLHDR_H + SECTION_H + rowsMax * ROW_H + 18 + moreH + FOOTER_H;

  // سربرگ — عنوان + تاریخ + اسلات
  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="74" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('گزارش بازار خودرو — رصدبان')}</text>
  <text x="${W - PAD}" y="124" font-size="25" fill="#9fc3e8" text-anchor="end">${rtl(`${date.weekdayFa} ${date.shamsi} • ${date.miladi} • ${esc(slotLabel)}`)}</text>`;

  // سطر عنوان ستون‌های هر دو بلوک — «خودرو | بازار (۲۴ ساعت) | کارخانه»
  const rightA = blockAnchors(W - PAD);
  const leftA = blockAnchors(PAD + BLOCK_W);
  const colHdr = (a: { nameR: number; mktR: number; offR: number; blockL: number }) => `
  <rect x="${a.blockL}" y="${HEADER_H + 6}" width="${BLOCK_W}" height="${COLHDR_H - 12}" rx="12" fill="#123a5e"/>
  <text x="${a.nameR}" y="${HEADER_H + 40}" font-size="20" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl('خودرو')}</text>
  <text x="${a.mktR}" y="${HEADER_H + 40}" font-size="20" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl('بازار (۲۴ ساعت)')}</text>
  <text x="${a.offR}" y="${HEADER_H + 40}" font-size="20" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl('کارخانه')}</text>`;

  // سربرگ بخش — سهمگون روی هر دو بلوک
  const secY = HEADER_H + COLHDR_H;
  const section = `
  <rect x="${PAD}" y="${secY}" width="${W - PAD * 2}" height="${SECTION_H - 14}" rx="12" fill="#164a75"/>
  <text x="${W - PAD - 20}" y="${secY + 31}" font-size="25" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('خودرو — بازار آزاد • مرتب از ارزان به گران')}</text>
  <text x="${PAD + 20}" y="${secY + 31}" font-size="20" fill="#9fc3e8" text-anchor="start">${rtl('ستون‌های راست: ارزان‌تر • چپ: گران‌تر')}</text>`;

  const rowsStart = secY + SECTION_H;
  const bodySvg = blockRowsSvg(right, W - PAD, rowsStart) + '\n' + blockRowsSvg(left, PAD + BLOCK_W, rowsStart);

  const rowsEnd = rowsStart + rowsMax * ROW_H;
  const moreSvg =
    more > 0
      ? `<text x="${W / 2}" y="${rowsEnd + 32}" font-size="22" fill="#9fc3e8" text-anchor="middle">${rtl(`+ ${faDigits(String(more))} مدل دیگر در گزارش متنی`)}</text>`
      : '';

  const footerY = H - 30;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="19" fill="#6f93b4" text-anchor="end">${rtl('رصدبان • کارخانه/نمایندگی: باما')}</text>
  <text x="${PAD}" y="${footerY}" font-size="19" fill="#6f93b4" text-anchor="start">${rtl('درصد داخل پرانتز = تغییر نسبت به دیروز ساعت ۱۵')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT_FA}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1c30"/>
  ${header}
  ${colHdr(rightA)}
  ${colHdr(leftA)}
  ${section}
  ${bodySvg}
  ${moreSvg}
  ${footer}
</svg>`;
}

// ---------- رندر PNG ----------

/** رندر کارت به PNG (۲× در حد سقف ابعاد بله) — شکست هر مرحله → null */
export async function renderMarketCardPng(input: MarketCardInput): Promise<CardPng | null> {
  try {
    if (!input.quotes || input.quotes.length === 0) return null;
    const svg = makeMarketCardSvg(input);
    if (!svg) return null;
    const dims = svg.match(/width="(\d+)" height="(\d+)"/);
    const density = dims ? renderDensityFor(Number(dims[1]), Number(dims[2])) : 72;
    const sharp = (await import('sharp')).default;
    const png = await sharp(Buffer.from(svg), { density }).png().toBuffer();
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height || png.length < 5000) return null;
    return { png, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

// کپشن زیر عکس بازار حذف شد — خواستهٔ کاربر ۲۰ نوامبر ۲۰۲۶ («زیر عکس به شکل
// متنی میاد حذف کن») — کارت جدول کامل قیمت‌ها را دارد؛ عکس بدون کپشن ارسال می‌شود.
