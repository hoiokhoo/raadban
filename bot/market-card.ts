/**
 * کارت تصویری گزارش بازار — خواستهٔ کاربر (۱۵ نوامبر ۲۰۲۶):
 * «کارت‌سازی بستهٔ خبری و گزارش بازار — همان زیرساخت امروزِ هواشناسی قابل استفادهٔ مجدد است».
 *
 * بازطراحی یکدست ۲۰ نوامبر ۲۰۲۶ (خواستهٔ کاربر):
 * «کل آیتمها به یه شکل — ستون اول اسم ماشین/سکه/دلار، ستون دوم قیمت بازار،
 *  ستون سوم قیمت کارخانه یا دولتی اگر هست، ستون چهارم درصد تغییر نسبت به روز قبل.
 *  الآن سه تا ماشین اول لیست یه کلن بقیه لیست یه شکل دیگه!» —
 * همهٔ ردیف‌ها (خودرو/طلا/سکه/ارز/بورس) اکنون یک جدول یکدست ۴ستونی‌اند؛
 * ستون «کارخانه/دولتی» برای اقلام بی‌قیمت رسمی «—» می‌آید (هیچ عدد ساختگی).
 * سربرگ‌های آماریِ دیباگ (صعودی/نزولی/بدون تغییر، «N قلم قیمت‌گذاری‌شده») حذف شدند.
 *
 * همان معماری کارت هواشناسی: SVG راست‌به‌چپ با فونت وزیرمتن → PNG با sharp.
 * شکست رندر → null و فراخواننده پیام متنی کامل می‌فرستد — هیچ کارت نیمه‌ساختگی.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faDigits } from './daily';
import { type TripleDate } from './calendar';
import { formatMoney, type Quote } from './market';

// ---------- فونت‌پیکربندی پروژه‌ای — پیش از نخستین رندر sharp ----------
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.FONTCONFIG_FILE) {
  try { mkdirSync(join(PROJECT_ROOT, '.fc-cache'), { recursive: true }); } catch { /* بی‌اهمیت */ }
  process.env.FONTCONFIG_FILE = join(PROJECT_ROOT, '.fontconfig.conf');
}

export interface MarketCardInput {
  date: TripleDate;
  /** برچسب اسلات — «میان‌روز» | «شب» | «گزارش فوری» */
  slotLabel: string;
  /** اقلام با درصد تغییر اعمال‌شده (applyDeltas) */
  quotes: Quote[];
}

export interface CardPng {
  png: Buffer;
  width: number;
  height: number;
}

// ---------- هندسهٔ کارت — جدول یکدست ۴ستونی (۲۰ نوامبر) ----------

const W = 1080;
const HEADER_H = 170;
/** سطر عنوان ستون‌ها — «نام | قیمت بازار | کارخانه/دولتی | تغییر روز» */
const COLHDR_H = 62;
const SECTION_H = 58;
/** همهٔ ردیف‌ها هم‌قد و هم‌شکل (خودرو VIP هم مثل بقیه تک‌خطی) */
const ROW_H = 80;
const PAD = 36;
const FOOTER_H = 84;
const TITLE_MAX_CHARS = 26;
const MAX_CARS = 10;

/** لنگرهای افقی ستون‌ها (راست→چپ): نام | بازار | کارخانه/دولتی | تغییر
 *  هندسهٔ بدون‌هم‌پوشانی: نام ≤۳۰۰px (۷۲۰–۱۰۲۰) • بازار ≤۲۱۰px (۴۴۵–۶۵۵) •
 *  رسمی ≤۲۰۵px (۱۵۵–۳۶۰) • تغییر ۳۶–۱۲۰ (چپ‌چین) — حاشیهٔ امن ≥۴۰px میان ستون‌ها */
const X_NAME_R = W - PAD - 24; // لبهٔ راست ستون نام
const X_MKT_R = 655; // لبهٔ راست ستون قیمت بازار
const X_OFF_R = 360; // لبهٔ راست ستون کارخانه/دولتی
/** ستون تغییر روز — چپ‌چین از لبهٔ کارت: فلش ۳۶–۵۷، درصد از ۶۶ */
const X_PCT_L = PAD + 30;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

// ---------- بخش‌بندی اقلام — خالص و تست‌پذیر ----------

export interface MarketRow {
  title: string;
  /** قیمت بازار — قالب‌بندی‌شده */
  value: string;
  /** درصد تغییر نسبت به روز قبل — null یعنی «—» (بی‌داده) */
  pct: number | null;
  /** قیمت کارخانه/دولتی قالب‌بندی‌شده — null یعنی «—» (این قلم قیمت رسمی ندارد) */
  official: string | null;
}

export interface MarketSection {
  title: string;
  rows: MarketRow[];
}

/** قیمت رسمی یک قلم — کارخانه (خودرو، باما) یا دولتی (دلار: مرکز مبادله؛ سکه: بهار آزادی بانکی) */
export function officialOf(q: Quote): string | null {
  const v = q.officialToman ?? q.factoryToman;
  if (v !== undefined && Number.isFinite(v) && v > 0) return formatMoney(v, 'toman');
  return null;
}

/** گروه‌بندی همان قالب پیام متنی گزارش بازار — خودرو (سقف ۱۰) / طلا و سکه / ارز و شاخص‌ها */
export function marketSectionsOf(quotes: Quote[]): { sections: MarketSection[]; moreCars: number } {
  const of = (q: Quote): MarketRow => ({
    title: q.title,
    value: formatMoney(q.value, q.unit),
    pct: typeof q.changePct === 'number' && Number.isFinite(q.changePct) ? q.changePct : null,
    official: officialOf(q),
  });
  const cars = quotes.filter((q) => q.key.startsWith('car:'));
  const gold = quotes.filter((q) => ['geram18', 'geram24', 'sekee', 'nim'].includes(q.key));
  const rest = ['usd', 'tedpix', 'btc', 'oil_brent']
    .map((k) => quotes.find((q) => q.key === k))
    .filter((q): q is Quote => Boolean(q))
    .map(of);
  const sections: MarketSection[] = [];
  if (cars.length > 0) sections.push({ title: 'خودرو — بازار آزاد', rows: cars.slice(0, MAX_CARS).map(of) });
  if (gold.length > 0) sections.push({ title: 'طلا و سکه', rows: gold.map(of) });
  if (rest.length > 0) sections.push({ title: 'ارز، بورس و کریپتو', rows: rest });
  return { sections, moreCars: Math.max(0, cars.length - MAX_CARS) };
}

/** فلش برداری صعود/نزول — بدون فونت */
function arrowSvg(x: number, y: number, up: boolean, color: string): string {
  const d = up
    ? `M ${x + 11} ${y + 8} L ${x + 21} ${y + 8} L ${x + 16} ${y - 3} Z`
    : `M ${x + 11} ${y - 3} L ${x + 21} ${y - 3} L ${x + 16} ${y + 8} Z`;
  return `<path d="${d}" fill="${color}"/>`;
}

// ---------- ساخت SVG — خالص و تست‌پذیر (بدون sharp) ----------

export function makeMarketCardSvg(input: MarketCardInput): string {
  const { date, slotLabel, quotes } = input;
  if (!quotes || quotes.length === 0) return '';
  const { sections, moreCars } = marketSectionsOf(quotes);
  if (sections.length === 0) return '';

  const rowsTotal = sections.reduce((a, s) => a + s.rows.length, 0);
  const moreH = moreCars > 0 ? 52 : 0;
  const H = HEADER_H + COLHDR_H + sections.length * SECTION_H + rowsTotal * ROW_H + 24 + moreH + FOOTER_H;

  // سربرگ — عنوان + تاریخ + اسلات؛ بدون خطوط آماری دیباگ (۲۰ نوامبر)
  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="82" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('گزارش بازار رصدبان')}</text>
  <text x="${W - PAD}" y="134" font-size="26" fill="#9fc3e8" text-anchor="end">${rtl(`${date.weekdayFa} ${date.shamsi} • ${date.miladi} • ${esc(slotLabel)}`)}</text>`;

  // سطر عنوان ستون‌ها — همان لنگرهای ردیف‌ها
  const colHdr = `
  <rect x="${PAD}" y="${HEADER_H + 8}" width="${W - PAD * 2}" height="${COLHDR_H - 16}" rx="12" fill="#123a5e"/>
  <text x="${X_NAME_R}" y="${HEADER_H + 42}" font-size="24" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl('نام')}</text>
  <text x="${X_MKT_R}" y="${HEADER_H + 42}" font-size="24" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl('قیمت بازار')}</text>
  <text x="${X_OFF_R}" y="${HEADER_H + 42}" font-size="24" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl('کارخانه / دولتی')}</text>
  <text x="${PAD}" y="${HEADER_H + 42}" font-size="24" font-weight="700" fill="#ffd75e" text-anchor="start">${rtl('تغییر روز')}</text>`;

  let y = HEADER_H + COLHDR_H;
  const bodySvg = sections
    .map((sec) => {
      const head = `
  <rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${SECTION_H - 14}" rx="12" fill="#164a75"/>
  <text x="${W - PAD - 20}" y="${y + 34}" font-size="26" font-weight="700" fill="#ffffff" text-anchor="end">${rtl(esc(sec.title))}</text>`;
      y += SECTION_H;
      const rows = sec.rows
        .map((r, i) => {
          const ry = y + i * ROW_H;
          const bg = i % 2 === 0 ? '#102941' : '#0d2135';
          const title = r.title.length > TITLE_MAX_CHARS ? `${r.title.slice(0, TITLE_MAX_CHARS - 1)}…` : r.title;
          const pctColor = r.pct === null || Math.abs(r.pct) < 0.05 ? '#94a3b8' : r.pct > 0 ? '#4ade80' : '#f87171';
          const pctText =
            r.pct === null || Math.abs(r.pct) < 0.05
              ? '—'
              : `${faDigits(Math.abs(r.pct).toFixed(1))}٪`;
          const hasArrow = r.pct !== null && Math.abs(r.pct) >= 0.05;
          const cyText = ry + 50;
          return `
  <rect x="${PAD}" y="${ry}" width="${W - PAD * 2}" height="${ROW_H - 12}" rx="12" fill="${bg}"/>
  <text x="${X_NAME_R}" y="${cyText}" font-size="26" fill="#e8f1fa" text-anchor="end">${rtl(esc(title))}</text>
  <text x="${X_MKT_R}" y="${cyText}" font-size="25" font-weight="700" fill="#ffffff" text-anchor="end">${rtl(esc(r.value))}</text>
  <text x="${X_OFF_R}" y="${cyText}" font-size="24" fill="${r.official ? '#9fc3e8' : '#5b7f9e'}" text-anchor="end">${rtl(r.official ? esc(r.official) : '—')}</text>
  ${hasArrow ? arrowSvg(PAD, cyText - 9, r.pct! > 0, pctColor) : ''}
  <text x="${X_PCT_L}" y="${cyText}" font-size="24" font-weight="700" fill="${pctColor}" text-anchor="start">${rtl(pctText)}</text>`;
        })
        .join('');
      y += sec.rows.length * ROW_H;
      return head + rows;
    })
    .join('');

  const moreSvg =
    moreCars > 0
      ? `<text x="${W / 2}" y="${y + 30}" font-size="22" fill="#9fc3e8" text-anchor="middle">${rtl(`+ ${faDigits(String(moreCars))} مدل دیگر در گزارش متنی`)}</text>`
      : '';

  const footerY = H - 32;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="end">${rtl('رصدبان • درصد تغییر نسبت به روز قبل')}</text>
  <text x="${PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="start">${rtl('دولتی: مرکز مبادله/بانکی — کارخانه: باما')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1c30"/>
  ${header}
  ${colHdr}
  ${bodySvg}
  ${moreSvg}
  ${footer}
</svg>`;
}

// ---------- رندر PNG ----------

/** رندر کارت به PNG — شکست هر مرحله → null */
export async function renderMarketCardPng(input: MarketCardInput): Promise<CardPng | null> {
  try {
    if (!input.quotes || input.quotes.length === 0) return null;
    const svg = makeMarketCardSvg(input);
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

// کپشن زیر عکس بازار حذف شد — خواستهٔ کاربر ۲۰ نوامبر ۲۰۲۶ («زیر عکس به شکل
// متنی میاد حذف کن») — کارت جدول کامل قیمت‌ها را دارد؛ عکس بدون کپشن ارسال می‌شود.
