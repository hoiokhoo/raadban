/**
 * نقشهٔ بارشی کشور — خواستهٔ کاربر (۲۰ نوامبر ۲۰۲۶):
 * «میخوام آخرین نقشه بارشی کشور هم زیر پیام هواشناسی بیاد، اگر api لازم داری بگو».
 *
 * منبع: NASA GIBS WMS (عمومی و بدون هیچ کلید API — پاسخ به «اگر api لازم داری بگو»:
 * کلید لازم نیست؛ سهمیهٔ آزاد ناسا کفایت می‌کند):
 *   بارش: IMERG_Precipitation_Rate — رادار-ماهوارهٔ GPM (نیم‌ساعتی)
 *   مرزها: Coastlines_15m — خطوط ساحلی و مرزی
 * جعبهٔ جغرافیایی ایران: عرض ۲۴–۴۱، طول ۴۳–۶۴ (EPSG:4326 خطی درجه‌ای).
 *
 * خروجی: PNG با نوار عنوان (تاریخ شمسی/میلادی + بازهٔ داده) + راهنمای رنگ
 * (سبک→شدید) + مرزها + پیکسل‌های بارش. «آخرین» = تازه‌ترین روزِ دارای داده
 * (امروز → دیروز → … تا ۳ روز عقب؛ دادهٔ IMERG گاهی با تأخیر می‌آید) و روزِ
 * پیش از آن — ترکیب max پیکسلی دو روز (بارشِ «بازهٔ اخیر»، نه لحظهٔ واحد).
 * هیچ فریم معتبر نیامد → null (فراخواننده صادقانه چیزی نمی‌فرستد).
 * همهٔ توابع خالص (URL/برچسب/ترکیب/SVG) تست‌پذیرند؛ فقط fetch زنده است.
 */
import { faDigits } from './daily';
import { EN_MONTHS_FA } from './day-history';
import type { TripleDate } from './calendar';

// ---------- فونت‌پیکربندی پروژه‌ای — پیش از نخستین رندر sharp ----------
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.FONTCONFIG_FILE) {
  try { mkdirSync(join(PROJECT_ROOT, '.fc-cache'), { recursive: true }); } catch { /* بی‌اهمیت */ }
  process.env.FONTCONFIG_FILE = join(PROJECT_ROOT, '.fontconfig.conf');
}

// ---------- هندسهٔ نقشه ----------

export const RAIN_MAP_W = 1100;
/** نسبت خطی EPSG:4326 — ۱۷ درجهٔ عرض / ۲۱ درجهٔ طول */
export const RAIN_MAP_H = Math.round((RAIN_MAP_W * 17) / 21); // ۸۹۰
/** جعبهٔ ایران + حاشیهٔ کوچک همسایه‌ها: BBOX (WMS 1.3.0 / EPSG:4326 = lat,lon,lat,lon) */
export const RAIN_MAP_BBOX = '24,43,41,64';
/** نوار عنوان + راهنما */
export const RAIN_MAP_HEADER_H = 196;
/** پانوشت نازک */
export const RAIN_MAP_FOOTER_H = 48;
export const RAIN_MAP_TOTAL_H = RAIN_MAP_HEADER_H + RAIN_MAP_H + RAIN_MAP_FOOTER_H;

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const UA = 'Mozilla/5.0 (compatible; RaadbanBot/1.0; +https://github.com)';

/** ساعت‌های نمونهٔ هر روز (UTC) — ترکیب max چهار فریم، پوشش شبانه‌روزی بدون ۴۸ درخواست */
export const GIBS_DAY_TIMES_UTC = ['00:00', '06:00', '12:00', '18:00'] as const;

/** ساخت URL مستقیم WMS — خالص و تست‌پذیر */
export function buildGibsWmsUrl(layer: string, dateIso: string, timeUtc: string, w: number, h: number): string {
  const t = `${dateIso}T${timeUtc}:00Z`;
  const p = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    CRS: 'EPSG:4326',
    BBOX: RAIN_MAP_BBOX,
    LAYERS: layer,
    FORMAT: 'image/png',
    WIDTH: String(w),
    HEIGHT: String(h),
    TIME: t,
  });
  return `${GIBS_WMS}?${p.toString()}`;
}

/** تاریخ میلادی UTC با جابه‌جایی روز — «2026-11-20» + (-1) → «2026-11-19». خالص. */
export function utcDateOffset(dateIso: string, offsetDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso || '');
  if (!m) return new Date().toISOString().slice(0, 10);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** برچسب فارسی بازهٔ دادهٔ دو روزه — «۱۷–۱۸ نوامبر» یا ماه‌های متفاوت. خالص و تست‌پذیر. */
export function rainDataRangeLabel(anchorIso: string, prevIso: string): string {
  const parts = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? { d: Number(m[3]), mo: Number(m[2]) } : null;
  };
  const a = parts(anchorIso);
  const p = parts(prevIso);
  if (!a || !p) return '';
  const mA = EN_MONTHS_FA[a.mo - 1] || '';
  const mP = EN_MONTHS_FA[p.mo - 1] || '';
  if (a.mo === p.mo) return `${faDigits(String(p.d))}–${faDigits(String(a.d))} ${mA}`;
  return `${faDigits(String(p.d))} ${mP} – ${faDigits(String(a.d))} ${mA}`;
}

// ---------- ترکیب max پیکسلی چند فریم — خالص و تست‌پذیر ----------

/** ترکیب بیشینهٔ چند فریم RGBA هم‌اندازه — هر پیکسل، پربارش‌ترین فریم می‌ماند.
 *  قاعده: آلفای بزرگ‌تر برنده؛ آلفای برابر → بیشینهٔ کانال‌ها. خالص. */
export function compositeMaxRgba(frames: Buffer[], w: number, h: number): Buffer {
  const out = Buffer.alloc(w * h * 4);
  for (const f of frames) {
    if (!f || f.length < out.length) continue;
    for (let i = 0; i < out.length; i += 4) {
      const aF = f[i + 3]!;
      const aO = out[i + 3]!;
      if (aF > aO) {
        out[i] = f[i]!; out[i + 1] = f[i + 1]!; out[i + 2] = f[i + 2]!; out[i + 3] = aF;
      } else if (aF === aO && aO > 0) {
        out[i] = Math.max(out[i]!, f[i]!);
        out[i + 1] = Math.max(out[i + 1]!, f[i + 1]!);
        out[i + 2] = Math.max(out[i + 2]!, f[i + 2]!);
      }
    }
  }
  return out;
}

/** نسبت پیکسل‌های غیرشفاف فریم (خالی‌بودن داده را تشخیص می‌دهد) — نمونه‌برداری هر ۷ پیکسل */
export function nonTransparentRatio(raw: Buffer): number {
  if (!raw || raw.length < 4) return 0;
  let total = 0;
  let count = 0;
  for (let i = 3; i < raw.length; i += 28) {
    total++;
    if (raw[i]! > 10) count++;
  }
  return total === 0 ? 0 : count / total;
}

// ---------- SVG نوار عنوان/راهنما — خالص و تست‌پذیر ----------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

const FONT_FA = "'B Nazanin', Vazirmatn, sans-serif";

/** طیف راهنما — هم‌خانوادهٔ پالت IMERG ناسا: سبز→زرد→نارنجی→قرمز */
const LEGEND_STOPS = ['#00784b', '#3f9e1e', '#9ccb19', '#f4e512', '#f2a007', '#e03c31'];

export interface RainMapOverlayInput {
  date: TripleDate;
  /** برچسب بازهٔ دادهٔ میلادی — «۱۷–۱۸ نوامبر» */
  dataLabel: string;
  /** هیچ بارشی در داده نبود → به‌جای طیف، یادداشت صادقانه */
  noRain?: boolean;
}

/** SVG لایهٔ عنوان/راهنما/پانوشت روی کل بوم شفاف — خالص و تست‌پذیر */
export function makeRainMapOverlaySvg(input: RainMapOverlayInput): string {
  const { date, dataLabel } = input;
  const W = RAIN_MAP_W;
  const H = RAIN_MAP_TOTAL_H;
  const PAD = 36;
  const legendY = RAIN_MAP_HEADER_H - 44;
  const stops = LEGEND_STOPS.map((c, i) => `<stop offset="${(i / (LEGEND_STOPS.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('');
  const legend = input.noRain
    ? `<text x="${W - PAD}" y="${legendY + 16}" font-family="${FONT_FA}" font-size="24" fill="#9fc3e8" text-anchor="end">${rtl('بارش معناداری در بازهٔ دادهٔ اخیر ثبت نشده است')}</text>`
    : `
  <text x="${W - PAD}" y="${legendY - 10}" font-family="${FONT_FA}" font-size="21" fill="#8fb8d9" text-anchor="end">${rtl('بارش سبک')}</text>
  <text x="${PAD}" y="${legendY - 10}" font-family="${FONT_FA}" font-size="21" fill="#8fb8d9" text-anchor="start">${rtl('بارش شدید')}</text>
  <rect x="${PAD}" y="${legendY}" width="${W - PAD * 2}" height="18" rx="9" fill="url(#legend)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
    <linearGradient id="legend" x1="1" y1="0" x2="0" y2="0">
      ${stops}
    </linearGradient>
  </defs>
  <rect width="${W}" height="${RAIN_MAP_HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="66" font-family="${FONT_FA}" font-size="46" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('آخرین نقشهٔ بارشی کشور')}</text>
  <text x="${W - PAD}" y="116" font-family="${FONT_FA}" font-size="27" fill="#9fc3e8" text-anchor="end">${rtl(`${date.weekdayFa} ${date.shamsi} • ${date.miladi}`)}</text>
  <text x="${PAD}" y="116" font-family="${FONT_FA}" font-size="22" fill="#8fb8d9" text-anchor="start">${rtl(`دادهٔ ماهواره‌ای GPM/IMERG${dataLabel ? ` — ${esc(dataLabel)}` : ''}`)}</text>
  ${legend}
  <text x="${W - PAD}" y="${H - 16}" font-family="${FONT_FA}" font-size="20" fill="#6f93b4" text-anchor="end">${rtl('رصدبان • بارش تجمعی دو روز اخیرِ دارای داده')}</text>
  <text x="${PAD}" y="${H - 16}" font-family="${FONT_FA}" font-size="20" fill="#6f93b4" text-anchor="start">${rtl('مرزها و داده: NASA GIBS')}</text>
</svg>`;
}

// ---------- واکشی زنده + مونتاژ ----------

export interface RainMapPng {
  png: Buffer;
  width: number;
  height: number;
}

async function fetchPng(url: string, timeoutMs = 15_000): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 3000) return null;
    if (buf.slice(1, 4).toString('latin1') !== 'PNG') return null; // امضای PNG
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** فریم raw RGBA یک روز/ساعت — شکست هر مرحله → null */
async function fetchRainRaw(dateIso: string, timeUtc: string, w: number, h: number): Promise<Buffer | null> {
  const png = await fetchPng(buildGibsWmsUrl('IMERG_Precipitation_Rate', dateIso, timeUtc, w, h));
  if (!png) return null;
  try {
    const sharp = (await import('sharp')).default;
    const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return Buffer.from(data);
  } catch {
    return null;
  }
}

/** آخرین نقشهٔ بارشی کشور — واکشی GIBS (بدون کلید) + مونتاژ با sharp. شکست → null. */
export async function fetchIranRainMapPng(date: TripleDate): Promise<RainMapPng | null> {
  try {
    const sharp = (await import('sharp')).default;
    const W = RAIN_MAP_W;
    const H = RAIN_MAP_H;
    const todayUtc = new Date().toISOString().slice(0, 10);

    // ۱) روز لنگر: تازه‌ترین روزِ دارای بارش (دادهٔ IMERG گاهی ۱-۲ روز تأخیر دارد)
    let anchor: string | null = null;
    let fallbackRaw: Buffer | null = null;
    for (let d = 0; d <= 3 && anchor === null; d++) {
      const day = utcDateOffset(todayUtc, -d);
      const raw = await fetchRainRaw(day, '12:00', W, H);
      if (!raw) continue;
      if (fallbackRaw === null) fallbackRaw = raw; // نخستین فریم معتبر (حتی خالی) — پشتیبانِ «بدون بارش»
      if (nonTransparentRatio(raw) >= 0.001) anchor = day;
    }

    // ۲) فریم‌های بارش — دو روز × چهار ساعت (UTC)؛ ترکیب max پیکسلی
    let rainRaws: Buffer[] = [];
    let dataLabel = '';
    if (anchor !== null) {
      const prev = utcDateOffset(anchor, -1);
      for (const day of [anchor, prev]) {
        for (const t of GIBS_DAY_TIMES_UTC) {
          const raw = await fetchRainRaw(day, t, W, H);
          if (raw) rainRaws.push(raw);
          await new Promise((r) => setTimeout(r, 200)); // مهربانی با سرویس عمومی ناسا
        }
      }
      dataLabel = rainDataRangeLabel(anchor, prev);
    } else if (fallbackRaw) {
      rainRaws = [fallbackRaw];
    }
    if (rainRaws.length === 0) return null;

    const noRain = anchor === null;
    const compositeRaw = compositeMaxRgba(rainRaws, W, H);
    const rainPng = await sharp(compositeRaw, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();

    // ۳) مرزها + زمینهٔ تیره + لایهٔ بارش + عنوان/راهنما
    const coastPng = await fetchPng(buildGibsWmsUrl('Coastlines_15m', todayUtc, '12:00', W, H));
    const mapArea = await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 10, g: 28, b: 48, alpha: 1 } },
    })
      .composite(coastPng ? [{ input: coastPng }, { input: rainPng }] : [{ input: rainPng }])
      .png()
      .toBuffer();

    const overlaySvg = makeRainMapOverlaySvg({ date, dataLabel, noRain });
    const overlayPng = await sharp(Buffer.from(overlaySvg), { density: 72 }).png().toBuffer();

    const out = await sharp({
      create: { width: RAIN_MAP_W, height: RAIN_MAP_TOTAL_H, channels: 4, background: { r: 10, g: 28, b: 48, alpha: 1 } },
    })
      .composite([{ input: mapArea, top: RAIN_MAP_HEADER_H, left: 0 }, { input: overlayPng, top: 0, left: 0 }])
      .png()
      .toBuffer();

    if (out.length < 20_000) return null;
    return { png: out, width: RAIN_MAP_W, height: RAIN_MAP_TOTAL_H };
  } catch {
    return null;
  }
}
