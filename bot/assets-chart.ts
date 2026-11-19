/**
 * نمودار روند دارایی‌ها — خواستهٔ کاربر (۲۰ نوامبر ۲۰۲۶، دومی):
 * «قرار بود چارت نمودار دارایی ها رو هم بزاری،اما الآن نیست» — کارت تصویری روندِ
 * ۳۰روزهٔ دارایی‌های شاخص: دلار، طلای ۱۸ عیار، سکهٔ بانکی، شاخص کل بورس، بیت‌کوین، نفت برنت.
 *
 * منبع: tgju «summary-table-data» — همان tgju گزارش بازار (بدون کلید، عمومی):
 *   https://api.tgju.org/v1/market/indicator/summary-table-data/{symbol}?lang=fa
 * ردیف‌ها جدید→قدیم‌اند: [open, high, low, close, Δ, Δ٪, تاریخ میلادی, تاریخ جلالی].
 *
 * معماری:
 *   تاریخچهٔ روزانه یک‌بار در روز واکشی و در state (chartHist) کش می‌شود؛
 *   نقطهٔ «امروزِ» هر سری از tgjuCurrent زندهٔ همان گزارش بازار به انتهای سری
 *   ملحق/جایگزین می‌شود (تاریخچهٔ tgju گاهی یک روز عقب است — نمودار همیشه تازه).
 *   شکست هر نماد → پنل همان نماد حذف؛ کمتر از ۳ پنل → کل کارت حذف (صادقانه،
 *   هیچ نیم‌نموداری ارسال نمی‌شود). کارت بازار خودش مستقل ارسال شده است.
 *
 * همان معماری کارت‌های پروژه: SVG راست‌به‌چپ با فونت وزیرمتن → PNG با sharp؛
 * همهٔ توابع خالص و تست‌پذیرند — فقط fetchAssetHistory زنده است.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faDigits } from './daily';
import { type TripleDate, tripleDateOf } from './calendar';
import { formatMoney } from './market';

// ---------- فونت‌پیکربندی پروژه‌ای — پیش از نخستین رندر sharp ----------
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.FONTCONFIG_FILE) {
  try { mkdirSync(join(PROJECT_ROOT, '.fc-cache'), { recursive: true }); } catch { /* بی‌اهمیت */ }
  process.env.FONTCONFIG_FILE = join(PROJECT_ROOT, '.fontconfig.conf');
}

// ---------- پیکربندی دارایی‌ها ----------

export interface ChartAsset {
  /** کلید پایدار در state.chartHist.assets */
  key: string;
  /** نماد tgju history API */
  symbol: string;
  /** کلید همان نماد در tgjuCurrent (ajax.json) برای نقطهٔ زندهٔ امروز */
  liveKey: string;
  title: string;
  unit: 'toman' | 'usd' | 'index';
  /** قیمت ریالی → تقسیم بر ۱۰ (تومان) */
  rial: boolean;
}

/** شش دارایی شاخص — ترتیب = چیدمان کارت (راست→چپ، بالا→پایین) */
export const CHART_ASSETS: ChartAsset[] = [
  { key: 'usd', symbol: 'price_dollar_rl', liveKey: 'price_dollar_rl', title: 'دلار آزاد', unit: 'toman', rial: true },
  { key: 'gold', symbol: 'geram18', liveKey: 'geram18', title: 'طلای ۱۸ عیار', unit: 'toman', rial: true },
  { key: 'coin', symbol: 'sekeb', liveKey: 'sekeb', title: 'سکهٔ بانکی', unit: 'toman', rial: true },
  { key: 'tse', symbol: 'bourse', liveKey: 'bourse', title: 'شاخص کل بورس', unit: 'index', rial: false },
  { key: 'btc', symbol: 'crypto-bitcoin', liveKey: 'crypto-bitcoin', title: 'بیت‌کوین', unit: 'usd', rial: false },
  { key: 'brent', symbol: 'oil_brent', liveKey: 'oil_brent', title: 'نفت برنت', unit: 'usd', rial: false },
];

/** بازهٔ نمودار — ۳۰ نقطهٔ آخر + نقطهٔ زندهٔ امروز */
export const CHART_DAYS = 30;

export interface HistSeries {
  /** قیمت‌های روزانه قدیم→جدید (واحد نهایی: تومان/دلار/امتیاز) */
  closes: number[];
  /** تاریخ میلادی هر نقطه «YYYY-MM-DD» قدیم→جدید */
  dates: string[];
}

// ---------- پارس واکشی — خالص و تست‌پذیر ----------

/** پارس پاسخ summary-table-data — ردیف‌ها جدید→قدیم‌اند؛ ۳۰ نقطهٔ آخر به‌ترتیب قدیم→جدید. */
export function parseHistorySeries(json: string, opts: { days?: number; rial?: boolean } = {}): HistSeries | null {
  try {
    const days = opts.days ?? CHART_DAYS;
    const div = opts.rial ? 10 : 1;
    const o = JSON.parse(json) as { data?: unknown[][] };
    const rows = Array.isArray(o?.data) ? o.data : [];
    const closes: number[] = [];
    const dates: string[] = [];
    for (const r of rows) {
      if (!Array.isArray(r) || r.length < 8) continue;
      const closeRaw = String(r[3] ?? '').replace(/[^0-9.]/g, '');
      const close = Number(closeRaw);
      const dm = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(String(r[6] ?? ''));
      if (!Number.isFinite(close) || close <= 0 || !dm) continue;
      closes.push(close / div);
      dates.push(`${dm[1]}-${dm[2]}-${dm[3]}`);
    }
    if (closes.length < 8) return null; // سری خیلی کوتاه → بی‌نمودار صادقانه
    return { closes: closes.slice(0, days).reverse(), dates: dates.slice(0, days).reverse() };
  } catch {
    return null;
  }
}

/** نقطهٔ زندهٔ امروز — آخرین نقطه امروز است → جایگزین؛ نیست → الحاق به انتها. خالص. */
export function mergeLivePoint(series: HistSeries, todayIso: string, live: number | null, rial: boolean): HistSeries {
  const raw = live !== null && Number.isFinite(live) && live > 0 ? live : null;
  if (raw === null) return series;
  const liveVal = rial ? raw / 10 : raw;
  const last = series.dates[series.dates.length - 1] ?? '';
  if (last === todayIso) {
    const closes = [...series.closes];
    closes[closes.length - 1] = liveVal;
    return { closes, dates: [...series.dates] };
  }
  return { closes: [...series.closes, liveVal], dates: [...series.dates, todayIso] };
}

export interface ChartPanel {
  key: string;
  title: string;
  unit: 'toman' | 'usd' | 'index';
  values: number[];
  /** درصد تغییر بازه (نخست → آخر) — گردیده به یک رقم اعشار */
  pct: number;
  /** تاریخ اولین/آخرین نقطه «YYYY-MM-DD» */
  firstDate: string;
  lastDate: string;
}

/** ساخت یک پنل از سری آماده — سری نال/کوتاه → null. خالص. */
export function buildChartPanel(asset: ChartAsset, series: HistSeries | null): ChartPanel | null {
  if (!series || series.closes.length < 8) return null;
  const first = series.closes[0]!;
  const last = series.closes[series.closes.length - 1]!;
  const pct = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0;
  return {
    key: asset.key,
    title: asset.title,
    unit: asset.unit,
    values: series.closes,
    pct,
    firstDate: series.dates[0]!,
    lastDate: series.dates[series.dates.length - 1]!,
  };
}

// ---------- هندسهٔ اسپارک‌لاین — خالص و تست‌پذیر ----------

/** نقاط اسپارک‌لاین راست‌به‌چپ (قدیم→راست، جدید→چپ) — خروجی: polyline + مسیر ناحیه + آخرین نقطه */
export function sparklinePoints(values: number[], x: number, y: number, w: number, h: number): { pts: string; area: string; lastX: number; lastY: number } {
  const n = values.length;
  if (n < 2 || w <= 0 || h <= 0) return { pts: '', area: '', lastX: x + w, lastY: y + h / 2 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const px = (i: number) => x + w - (i / (n - 1)) * w;
  const py = (v: number) => (span === 0 ? y + h / 2 : y + (1 - (v - min) / span) * h);
  const coords = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  return {
    pts: coords.join(' '),
    area: `${(x + w).toFixed(1)},${(y + h).toFixed(1)} ${coords.join(' ')} ${x.toFixed(1)},${(y + h).toFixed(1)}`,
    lastX: px(n - 1),
    lastY: py(values[n - 1]!),
  };
}

// ---------- ساخت SVG — خالص و تست‌پذیر ----------

const W = 1080;
const HEADER_H = 170;
const FOOTER_H = 84;
const PAD = 36;
const GAP = 24;
/** شبکهٔ ۲×۳ — هر پنل ۴۹۲×۲۶۰ */
const PANEL_W = Math.floor((W - PAD * 2 - GAP) / 2);
const PANEL_H = 260;
const PANEL_ROWS = 3;

export interface AssetsChartInput {
  date: TripleDate;
  panels: ChartPanel[];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

/** برچسب تاریخ جلالی «YYYY-MM-DD» → «۲۷ آبان» (بدون سال — فشرده برای پنل) */
function jalaliShort(dateIso: string): string {
  const t = tripleDateOf(dateIso, 'Asia/Tehran', 'umalqura');
  // shamsi = «۲۷ آبان ۱۴۰۵» → «۲۷ آبان»
  const parts = t.shamsi.split(' ');
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : t.shamsi;
}

/** کارت نمودار دارایی‌ها — سربرگ + شبکهٔ ۲×۳ پنل اسپارک‌لاین + پانوشت مینیمال */
export function makeAssetsChartSvg(input: AssetsChartInput): string {
  const { date, panels } = input;
  if (!panels || panels.length < 3) return '';
  const rows = Math.min(PANEL_ROWS, Math.ceil(panels.length / 2));
  const bodyH = rows * PANEL_H + (rows - 1) * GAP;
  const H = HEADER_H + 20 + bodyH + FOOTER_H;

  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="76" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('نمودار روند دارایی‌ها')}</text>
  <text x="${W - PAD}" y="128" font-size="26" fill="#9fc3e8" text-anchor="end">${rtl(`روند ${faDigits(String(CHART_DAYS))} روز اخیر • ${date.weekdayFa} ${date.shamsi}`)}</text>`;

  const pieces: string[] = [];
  panels.slice(0, PANEL_ROWS * 2).forEach((p, i) => {
    const col = i % 2; // ۰ = ستون راست، ۱ = ستون چپ (RTL)
    const row = Math.floor(i / 2);
    const x = col === 0 ? W - PAD - PANEL_W : PAD;
    const y = HEADER_H + 20 + row * (PANEL_H + GAP);
    const bg = row % 2 === 0 ? '#102941' : '#0d2135';
    const up = p.pct >= 0;
    const color = up ? '#4ade80' : '#f87171';
    const arrow = Math.abs(p.pct) < 0.05 ? '—' : up ? '▲' : '▼';
    const pctTxt = `${arrow}${faDigits(String(Math.abs(p.pct)).replace('.', '٫'))}٪`;
    const cur = p.values[p.values.length - 1]!;
    const spark = sparklinePoints(p.values, x + 24, y + 104, PANEL_W - 48, 116);
    pieces.push(`
  <rect x="${x}" y="${y}" width="${PANEL_W}" height="${PANEL_H}" rx="14" fill="${bg}"/>
  <text x="${x + PANEL_W - 24}" y="${y + 44}" font-size="27" font-weight="700" fill="#e8f1fa" text-anchor="end">${rtl(esc(p.title))}</text>
  <text x="${x + PANEL_W - 24}" y="${y + 78}" font-size="22" fill="#9fc3e8" text-anchor="end">${rtl(formatMoney(cur, p.unit))}</text>
  <text x="${x + 24}" y="${y + 44}" font-size="26" font-weight="700" fill="${color}" text-anchor="start">${rtl(pctTxt)}</text>
  <text x="${x + 24}" y="${y + 74}" font-size="17" fill="#6f93b4" text-anchor="start">${rtl(`${faDigits(String(CHART_DAYS))} روز`)}</text>
  <polyline points="${spark.pts}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
  <polygon points="${spark.area}" fill="${color}" fill-opacity="0.13" stroke="none"/>
  <circle cx="${spark.lastX.toFixed(1)}" cy="${spark.lastY.toFixed(1)}" r="6" fill="${color}" stroke="#0a1c30" stroke-width="2"/>
  <text x="${x + 24}" y="${y + PANEL_H - 16}" font-size="17" fill="#6f93b4" text-anchor="start">${rtl(`${jalaliShort(p.firstDate)} تا ${jalaliShort(p.lastDate)}`)}</text>`);
  });

  const footerY = H - 34;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="end">${rtl('رصدبان')}</text>
  <text x="${PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="start">${rtl('روند دورهٔ ۳۰روزه — آخرین نقطه: به‌روزترین قیمت')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1c30"/>
  ${header}
  ${pieces.join('\n')}
  ${footer}
</svg>`;
}

// ---------- رندر PNG ----------

export interface CardPng {
  png: Buffer;
  width: number;
  height: number;
}

/** رندر کارت به PNG — شکست هر مرحله → null (هیچ کارت نیمه‌ساختگی ارسال نمی‌شود) */
export async function renderAssetsChartPng(input: AssetsChartInput): Promise<CardPng | null> {
  try {
    if (!input.panels || input.panels.length < 3) return null;
    const svg = makeAssetsChartSvg(input);
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

// ---------- واکشی زندهٔ تاریخچه ----------

const UA = 'Mozilla/5.0 (compatible; RaadbanBot/1.0; +https://github.com)';

/** URL عمومی و بی‌کلید تاریخچهٔ tgju — خالص و تست‌پذیر */
export function historyUrl(symbol: string): string {
  return `https://api.tgju.org/v1/market/indicator/summary-table-data/${encodeURIComponent(symbol)}?lang=fa`;
}

/** واکشی تاریخچهٔ یک نماد — شکست/تایم‌اوت → null صادقانه (بقیهٔ نمادها مستقل‌اند) */
export async function fetchAssetHistory(symbol: string, rial: boolean, timeoutMs = 15_000): Promise<HistSeries | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(historyUrl(symbol), { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    return parseHistorySeries(text, { rial });
  } catch {
    return null;
  }
}
