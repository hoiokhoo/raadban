/**
 * کارت تصویری گزارش بازار — خواستهٔ کاربر (۱۵ نوامبر ۲۰۲۶):
 * «کارت‌سازی بستهٔ خبری و گزارش بازار — همان زیرساخت امروزِ هواشناسی قابل استفادهٔ مجدد است».
 *
 * همان معماری کارت هواشناسی: SVG راست‌به‌چپ با فونت وزیرمتن → PNG با sharp.
 * دادهٔ ورودی همان Quote های bot/market.ts است (با درصد تغییر اعمال‌شده)؛ هیچ عددی اینجا
 * ساخته نمی‌شود. فلش صعود/نزول به‌صورت برداری رسم می‌شود (بدون فونت ایموجی).
 * شکست رندر → null و فراخواننده پیام متنی کامل می‌فرستد — هیچ کارت نیمه‌ساختگی.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faDigits } from './daily';
import { type TripleDate } from './calendar';
import { formatMoney, carFactoryDelta, type Quote } from './market';

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

// ---------- هندسهٔ کارت ----------

const W = 1080;
const HEADER_H = 230;
const CHIPS_H = 110;
const SECTION_H = 58;
const ROW_H = 84;
const PAD = 36;
const FOOTER_H = 88;
const TITLE_MAX_CHARS = 30;
const MAX_CARS = 10;
/** ارتفاع ردیف کارخانه‌دار (VIP) — دو خط: بازار + خط کارخانه/اختلاف */
const VIP_ROW_H = 120;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

// ---------- بخش‌بندی اقلام — خالص و تست‌پذیر ----------

export interface MarketRow {
  title: string;
  value: string;
  /** درصد تغییر — null یعنی «—» (بدون تغییر/بی‌داده) */
  pct: number | null;
  /** ستون کارخانه + ما به‌التفاوت — فقط خودروهای VIP (خواستهٔ کاربر ۱۹ نوامبر:
   *  «جلوش تو یه ستون مجزا قیمت کارخونه رو بزاری، جلوش تو ستون مجزا هم ما به التفاوت و هم درصد تفاوت») */
  factory?: { value: string; diff: string; pct: number | null };
}

export interface MarketSection {
  title: string;
  rows: MarketRow[];
}

/** گروه‌بندی همان قالب پیام متنی گزارش بازار — خودرو (سقف ۱۰) / طلا و سکه / ارز و شاخص‌ها */
export function marketSectionsOf(quotes: Quote[]): { sections: MarketSection[]; moreCars: number } {
  const of = (q: Quote): MarketRow => ({
    title: q.title,
    value: formatMoney(q.value, q.unit),
    pct: typeof q.changePct === 'number' && Number.isFinite(q.changePct) ? q.changePct : null,
  });
  const ofCar = (q: Quote): MarketRow => {
    const row = of(q);
    if (q.factoryToman) {
      const fd = carFactoryDelta(q.value, q.factoryToman);
      if (fd) {
        row.factory = {
          value: formatMoney(q.factoryToman, 'toman'),
          diff: formatMoney(fd.diff, 'toman'),
          pct: fd.pct,
        };
      }
    }
    return row;
  };
  const cars = quotes.filter((q) => q.key.startsWith('car:'));
  const gold = quotes.filter((q) => ['geram18', 'geram24', 'sekee', 'nim'].includes(q.key));
  const rest = ['usd', 'tedpix', 'btc', 'oil_brent']
    .map((k) => quotes.find((q) => q.key === k))
    .filter((q): q is Quote => Boolean(q))
    .map(of);
  const sections: MarketSection[] = [];
  if (cars.length > 0) sections.push({ title: 'خودرو — بازار آزاد', rows: cars.slice(0, MAX_CARS).map(ofCar) });
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

  const up = quotes.filter((q) => typeof q.changePct === 'number' && q.changePct > 0.05).length;
  const down = quotes.filter((q) => typeof q.changePct === 'number' && q.changePct < -0.05).length;
  const flat = quotes.length - up - down;
  // ارتفاع ردیف متغیر — ردیف کارخانه‌دار (VIP) دو خط دارد
  const rowH = (r: MarketRow): number => (r.factory ? VIP_ROW_H : ROW_H);
  const rowsTotalH = sections.reduce((a, s) => a + s.rows.reduce((a2, r) => a2 + rowH(r), 0), 0);
  const rowsTotal = sections.reduce((a, s) => a + s.rows.length, 0);
  const moreH = moreCars > 0 ? 52 : 0;
  const H = HEADER_H + CHIPS_H + sections.length * SECTION_H + rowsTotalH + 24 + moreH + FOOTER_H;

  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="84" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('گزارش بازار رصدبان')}</text>
  <text x="${W - PAD}" y="136" font-size="26" fill="#9fc3e8" text-anchor="end">${rtl(`${date.weekdayFa} ${date.shamsi} • ${date.miladi}`)}</text>
  <text x="${W - PAD}" y="192" font-size="30" font-weight="500" fill="#ffd75e" text-anchor="end">${rtl(`${esc(slotLabel)} • ${faDigits(String(quotes.length))} قلم قیمت‌گذاری‌شده`)}</text>`;

  const chips: Array<{ label: string; value: string }> = [
    { label: 'صعودی', value: faDigits(String(up)) },
    { label: 'نزولی', value: faDigits(String(down)) },
    { label: 'بدون تغییر / بی‌داده', value: faDigits(String(flat)) },
  ];
  const chipW = (W - PAD * 2 - (chips.length - 1) * 16) / chips.length;
  const chipsSvg = chips
    .map((c, i) => {
      const x = W - PAD - chipW - i * (chipW + 16);
      return `
  <rect x="${x.toFixed(1)}" y="${HEADER_H + 22}" width="${chipW.toFixed(1)}" height="${CHIPS_H - 44}" rx="14" fill="#123a5e"/>
  <text x="${(x + chipW / 2).toFixed(1)}" y="${HEADER_H + 52}" font-size="20" fill="#8fb8d9" text-anchor="middle">${rtl(c.label)}</text>
  <text x="${(x + chipW / 2).toFixed(1)}" y="${HEADER_H + 86}" font-size="25" font-weight="700" fill="#e8f1fa" text-anchor="middle">${rtl(c.value)}</text>`;
    })
    .join('');

  let y = HEADER_H + CHIPS_H + 14;
  const bodySvg = sections
    .map((sec) => {
      const head = `
  <rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${SECTION_H - 14}" rx="12" fill="#164a75"/>
  <text x="${W - PAD - 20}" y="${y + 34}" font-size="26" font-weight="700" fill="#ffffff" text-anchor="end">${rtl(esc(sec.title))}</text>`;
      y += SECTION_H;
      const rows = sec.rows
        .map((r, i) => {
          const rh = rowH(r);
          const ry = y + sec.rows.slice(0, i).reduce((a2, r2) => a2 + rowH(r2), 0);
          const bg = i % 2 === 0 ? '#102941' : '#0d2135';
          const title = r.title.length > TITLE_MAX_CHARS ? `${r.title.slice(0, TITLE_MAX_CHARS - 1)}…` : r.title;
          const pctColor = r.pct === null || Math.abs(r.pct) < 0.05 ? '#94a3b8' : r.pct > 0 ? '#4ade80' : '#f87171';
          const pctText =
            r.pct === null || Math.abs(r.pct) < 0.05
              ? '—'
              : `${faDigits(Math.abs(r.pct).toFixed(1))}٪`;
          const hasArrow = r.pct !== null && Math.abs(r.pct) >= 0.05;
          const cyText = ry + (rh - 12) / 2 + (r.factory ? -6 : 9);
          const factoryLine = r.factory
            ? `
  <text x="${W - PAD - 24}" y="${ry + 74}" font-size="21" fill="#9fc3e8" text-anchor="end">${rtl(`کارخانه: ${esc(r.factory.value)}`)}</text>
  <text x="${PAD + 190}" y="${ry + 74}" font-size="21" font-weight="700" fill="${r.factory.pct !== null && r.factory.pct > 0.05 ? '#fbbf24' : '#e8f1fa'}" text-anchor="start">${rtl(`اختلاف: ${esc(r.factory.diff)}${r.factory.pct !== null && Math.abs(r.factory.pct) >= 0.05 ? ` (${r.factory.pct > 0 ? '▲' : '▼'}${faDigits(Math.abs(r.factory.pct).toFixed(1))}٪)` : ''}`)}</text>`
            : '';
          return `
  <rect x="${PAD}" y="${ry}" width="${W - PAD * 2}" height="${rh - 12}" rx="12" fill="${bg}"/>
  <text x="${W - PAD - 24}" y="${cyText}" font-size="26" fill="#e8f1fa" text-anchor="end">${rtl(esc(title))}</text>
  <text x="${PAD + 190}" y="${cyText}" font-size="26" font-weight="700" fill="#ffffff" text-anchor="start">${rtl(esc(r.value))}</text>
  ${hasArrow ? arrowSvg(PAD + 118, cyText - 9, r.pct! > 0, pctColor) : ''}
  <text x="${PAD + 108}" y="${cyText}" font-size="24" font-weight="700" fill="${pctColor}" text-anchor="end">${rtl(pctText)}</text>${factoryLine}`;
        })
        .join('');
      y += sec.rows.reduce((a2, r) => a2 + rowH(r), 0);
      return head + rows;
    })
    .join('');

  const moreSvg =
    moreCars > 0
      ? `<text x="${W / 2}" y="${y + 30}" font-size="22" fill="#9fc3e8" text-anchor="middle">${rtl(`+ ${faDigits(String(moreCars))} مدل دیگر در گزارش متنی`)}</text>`
      : '';

  const footerY = H - 34;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="end">${rtl('منابع: نوبیتکس • tgju • بورس تهران • کانال‌های خودرو')}</text>
  <text x="${PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="start">${rtl('رصدبان • هیچ عدد ساختگی')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1c30"/>
  ${header}
  ${chipsSvg}
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

/** کپشن کوتاه کارت (≤۱۰۲۴ نویسهٔ بله) — خالص و تست‌پذیر */
export function buildMarketCardCaption(input: MarketCardInput): string {
  const { date, slotLabel, quotes } = input;
  const up = quotes.filter((q) => typeof q.changePct === 'number' && q.changePct > 0.05);
  const down = quotes.filter((q) => typeof q.changePct === 'number' && q.changePct < -0.05);
  const usd = quotes.find((q) => q.key === 'usd');
  const L: string[] = [
    '📊 <b>گزارش بازار رصدبان</b>',
    `📅 ${date.weekdayFa} — ${date.shamsi} • ${date.miladi} • ${slotLabel}`,
    `🧾 ${faDigits(String(quotes.length))} قلم — ${faDigits(String(up.length))} صعودی / ${faDigits(String(down.length))} نزولی`,
  ];
  if (usd) L.push(`💵 دلار آزاد: ${formatMoney(usd.value, usd.unit)}`);
  L.push('📈 جزئیات همهٔ اقلام در تصویر');
  L.push('📡 رصدبان — درصد تغییر نسبت به گزارش قبلی');
  return L.join('\n').slice(0, 1024);
}
