/**
 * گیف متحرک پیش‌بینی ۲۴ساعتهٔ بارش ایران — خواستهٔ کاربر ۲۴ نوامبر ۲۰۲۶:
 * «از یه سایت هواشناسی که مدل پیشبینی ۲۴ ساعته رو داده … گیف متحرکش رو بزاری که بهتره».
 *
 * دادهٔ «مدل عددی» واقعی است: Open-Meteo (همان سرویسی که کارت‌های هواشناسی شهرها را
 * می‌سازد — تجمیع مدل‌های ملی DWD ICON/GFS) روی گرید ~۰٫۷° داخل مرز ایران؛ ۲۵ فریم ساعتی
 * (اکنون تا +۲۴ ساعت، گام ساعتی) از بارش/برف/ابری، رندر نرمِ هم‌الگوی نقشه‌های حرفه‌ای
 * (لکه‌های هم‌پوشان تارشده) روی همان نقشهٔ استان‌ها/مراکز استان (iran-map-base).
 * زبان رنگ همان رادار: آبی=برف، نارنجی→قرمز=باران سبک→شدید، خاکستری=ابری.
 *
 * صادقانه: شکست واکشی/رندر → null؛ فریمِ کمتر از ۳ → null. هیچ عدد ساختگی.
 *
 * کیفیت (خواستهٔ ۲۵ نوامبر: «عکسها کیفیتشون کمه») — انکود تطبیقی ۲×→۱٫۵×→۱×: فریم‌ها
 * یک بار ساخته می‌شوند و بزرگ‌ترین تراکمی که حجم گیف را در سقف نگه دارد برنده است؛
 * نقشه/متن برداری است و تراکم بالاتر واقعاً شارپ‌تر رندر می‌شود.
 */
import { faDigits } from './daily';
import { type TripleDate } from './calendar';
import {
  MAP_W, MAP_H,
  provinceFillsSvg, provinceBordersSvg, iranOutlineSvg, iranMapClipPath, graticuleSvg, capitalsSvg, capitalsSvgMeasured, mercProject,
} from './iran-map-base';
import { buildIranGrid, classifyRadarSample, radarColor, num, type RadarCell, type RadarSample } from './iran-radar';
import { renderGifDensityFor, DENSITY_15X, DENSITY_1X } from './render-scale';

export interface ForecastGif {
  gif: Buffer;
  width: number;
  height: number;
}

// ---------- هندسه ----------

const HEADER_H = 200;
const FOOTER_H = 52;
const TOTAL_H = HEADER_H + MAP_H + FOOTER_H;

/** فریم‌ها: اکنون + هر «۱ ساعت» تا ۲۴ ساعت — ۲۵ فریم ساعتی.
 *  خواستهٔ کاربر ۲۵ نوامبر ۲۰۲۶: «پیشبینی مدل ۲۴ ساعت آینده رو گیف متحرک کن نه فقط سه ساعته» —
 *  گام ساعتی، حرکت روان سامانهٔ بارش در کل شبانه‌روز.
 *  دادهٔ واکشی هم‌چنان ساعتی است (forecast_hours=25) — فقط گام نمایش ساعتی شد. */
export const FORECAST_STEPS: readonly number[] = Array.from({ length: 25 }, (_, i) => i);

/** ضلع لکهٔ «فعلی» بر پایهٔ شدت — بزرگ‌تر از رادار ایستا برای پوشش پیوستهٔ نرم */
export function blobRadius(level: 0 | 1 | 2): number {
  return [46, 54, 62][level]!;
}

// ---------- واکشی ساعتی چندنقطه‌ای — خالصِ ساختِ نشانی ----------

/** نشانی درخواست ساعتی گرید — خالص تست‌پذیر */
export function buildOpenMeteoHourlyUrl(lats: number[], lons: number[]): string {
  const p = new URLSearchParams({
    latitude: lats.map((v) => v.toFixed(2)).join(','),
    longitude: lons.map((v) => v.toFixed(2)).join(','),
    hourly: 'precipitation,rain,snowfall,cloud_cover',
    forecast_hours: '25',
    timezone: 'Asia/Tehran',
  });
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

/** نمونهٔ ساعتی یک نقطه در t ساعت آینده — خالص؛ نبود داده → null */
export function parseHourlyAt(p: unknown, t: number): RadarSample | null {
  if (!p || typeof p !== 'object') return null;
  const h = (p as { hourly?: { precipitation?: unknown[]; rain?: unknown[]; snowfall?: unknown[]; cloud_cover?: unknown[] } }).hourly;
  if (!h || !Array.isArray(h.precipitation) || h.precipitation.length <= t) return null;
  const at = (a: unknown[] | undefined) => (Array.isArray(a) && a.length > t ? num(a[t]) : 0);
  return {
    precipitation: at(h.precipitation),
    rain: at(h.rain),
    snowfall: at(h.snowfall),
    cloudCover: at(h.cloud_cover),
  };
}

/** همهٔ فریم‌ها از پاسخ چندنقطه‌ای — نقاط گرید × گام‌های زمانی. خالص. */
export function parseForecastFrames(json: unknown, grid: Array<{ lat: number; lon: number }>): RadarCell[][] {
  const arr = Array.isArray(json) ? json : [json];
  if (!arr || arr.length < grid.length * 0.5) return [];
  const out: RadarCell[][] = [];
  for (const t of FORECAST_STEPS) {
    const cells: RadarCell[] = [];
    grid.forEach((g, i) => {
      const s = parseHourlyAt(arr[i], t);
      if (s) cells.push({ lat: g.lat, lon: g.lon, cur: s, fc: null });
    });
    out.push(cells);
  }
  return out;
}

// ---------- لایهٔ دادهٔ SVG — خالص ----------

/** لکه‌های نرم بارش/برف/ابری یک فریم — هم‌پوشان و تار (فیلتر گاوسی در SVG فریم). خالص. */
export function makeForecastCellsSvg(cells: RadarCell[]): string {
  const L: string[] = [];
  for (const c of cells) {
    const [x, y] = mercProject(c.lon, c.lat);
    const cur = classifyRadarSample(c.cur);
    if (cur.kind === 'cloud') {
      L.push(`<rect x="${(x - 30).toFixed(1)}" y="${(y - 30).toFixed(1)}" width="60" height="60" rx="16" fill="#8ea6bd" opacity="0.22"/>`);
    } else if (cur.kind === 'rain' || cur.kind === 'snow') {
      const fill = radarColor(cur.kind, cur.level);
      const s = blobRadius(cur.level);
      L.push(`<rect x="${(x - s / 2).toFixed(1)}" y="${(y - s / 2).toFixed(1)}" width="${s}" height="${s}" rx="${Math.round(s * 0.32)}" fill="${fill}" opacity="0.88"/>`);
    }
  }
  return L.join('\n  ');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

const FONT_FA = "'B Nazanin', Vazirmatn, sans-serif";

/** برچسب فارسی گام زمانی — «همین حالا» | «+۳ ساعت» | «+۲۴ ساعت». خالص. */
export function stepLabelFa(t: number): string {
  if (t === 0) return 'همین حالا';
  return `+${faDigits(String(t))} ساعت`;
}

/** ساعت تهرانِ فریم از ستون زمانی ساعتی — «۱۸:۰۰». خالص. */
export function frameClockFromTimes(times: string[] | undefined, t: number): string {
  if (!Array.isArray(times) || times.length <= t) return '';
  const raw = String(times[t] || '');
  const m = raw.match(/T(\d{2}:\d{2})/);
  return m ? faDigits(m[1]!) : '';
}

/** SVG کامل یک فریم پیش‌بینی — خالص. capsBlock اختیاری: برچسب‌های اندازه‌گیری‌شده
 *  (capitalsSvgMeasured) — در نبودش همان چینش تخمینی. */
export function makeForecastFrameSvg(date: TripleDate, cells: RadarCell[], clockFa: string, label: string, capsBlock?: string): string {
  const legendY = HEADER_H - 38;
  const chip = (x: number, color: string) => `<rect x="${x}" y="${legendY - 13}" width="30" height="17" rx="8.5" fill="${color}"/>`;
  const txt = (x: number, s: string, anchor: 'start' | 'end' = 'end', fill = '#9fc3e8') =>
    `<text x="${x}" y="${legendY}" font-family="${FONT_FA}" font-size="20" fill="${fill}" text-anchor="${anchor}">${rtl(esc(s))}</text>`;
  const legend = `${txt(MAP_W - 24, 'برف')}${chip(MAP_W - 114, '#3b82f6')}
  ${txt(MAP_W - 154, 'باران')}${chip(MAP_W - 244, '#f97316')}
  ${txt(MAP_W - 284, 'شدید')}${chip(MAP_W - 354, '#dc2626')}
  ${txt(MAP_W - 394, 'ابری')}${chip(MAP_W - 466, '#8ea6bd')}
  <text x="24" y="${legendY}" font-family="${FONT_FA}" font-size="20" fill="#8fb8d9" text-anchor="start">${rtl(esc('پیش‌بینی ۲۴ ساعت آینده — گام ساعتی'))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${TOTAL_H}" viewBox="0 0 ${MAP_W} ${TOTAL_H}">
  <defs>
    ${iranMapClipPath()}
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
  </defs>
  <rect width="${MAP_W}" height="${TOTAL_H}" fill="#0a1c30"/>
  <rect width="${MAP_W}" height="${HEADER_H}" fill="#122f4f"/>
  <text x="${MAP_W - 24}" y="56" font-family="${FONT_FA}" font-size="40" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('پیش‌بینی ۲۴ ساعتهٔ بارش ایران')}</text>
  <text x="${MAP_W - 24}" y="104" font-family="${FONT_FA}" font-size="24" fill="#9fc3e8" text-anchor="end">${rtl(esc(`${date.weekdayFa} ${date.shamsi} • ${date.miladi}`))}</text>
  <text x="${MAP_W - 24}" y="${HEADER_H - 76}" font-family="${FONT_FA}" font-size="23" font-weight="700" fill="#8ef0c0" text-anchor="end">${rtl(esc(`${label}${clockFa ? ` — ساعت ${clockFa}` : ''}`))}</text>
  ${legend}
  <g transform="translate(0, ${HEADER_H})">
    ${graticuleSvg()}
    ${provinceFillsSvg()}
    <g clip-path="url(#iranClip)">
      <g filter="url(#soft)">${makeForecastCellsSvg(cells)}</g>
    </g>
    ${provinceBordersSvg()}
    ${iranOutlineSvg()}
    ${capsBlock ?? capitalsSvg()}
  </g>
  <text x="${MAP_W - 24}" y="${TOTAL_H - 18}" font-family="${FONT_FA}" font-size="19" fill="#6f93b4" text-anchor="end">${rtl('رصدبان • فقط ایران')}</text>
  <text x="24" y="${TOTAL_H - 18}" font-family="${FONT_FA}" font-size="19" fill="#6f93b4" text-anchor="start">${rtl('دادهٔ مدل عددی: Open-Meteo')}</text>
</svg>`;
}

// ---------- واکشی زنده + مونتاژ GIF ----------

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
export const FORECAST_GIF_MAX_BYTES = 8_000_000;
/** ۲۵ فریم × ۵۵۰ms ≈ ۱۳٫۸ ثانیه برای هر دور حلقه — روان و خوانا */
export const FORECAST_FRAME_DELAY_MS = 550;

/** گیف پیش‌بینی ۲۴ساعته — شکست هر مرحله → null صادقانه. */
export async function fetchForecastGif(date: TripleDate, timeoutMs = 25_000): Promise<ForecastGif | null> {
  try {
    const grid = buildIranGrid(0.7);
    if (grid.length < 20) return null;
    const perChunk = 350;
    const points: Array<{ lat: number; lon: number }> = grid;
    const arr: unknown[] = [];
    const timesRef: { v?: string[] } = {};
    for (let off = 0; off < points.length; off += perChunk) {
      const part = points.slice(off, off + perChunk);
      const url = buildOpenMeteoHourlyUrl(part.map((g) => g.lat), part.map((g) => g.lon));
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) return null;
      const json = await res.json();
      const list = Array.isArray(json) ? json : [json];
      arr.push(...list);
      if (!timesRef.v) {
        const t0 = (list[0] as { hourly?: { time?: string[] } })?.hourly?.time;
        if (Array.isArray(t0)) timesRef.v = t0;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    const frames = parseForecastFrames(arr, points);
    if (frames.length < 3) return null;
    const sharp = (await import('sharp')).default;
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
    // برچسب‌ها با عرض واقعی اندازه‌گیری‌شده (یک بار برای همهٔ فریم‌ها)
    const capsBlock = await capitalsSvgMeasured().catch(() => capitalsSvg());
    // ── کیفیت (خواستهٔ ۲۵ نوامبر: «عکسها کیفیتشون کمه») — فریم‌ها یک بار ساخته می‌شوند و
    //    انکود در بزرگ‌ترین تراکمِ ممکن (۲× → ۱٫۵× → ۱×) تکرار می‌شود تا حجم گیف در سقف
    //    ۸MB بماند: نقشهٔ استان‌ها/متن برداری است؛ ۲× واقعاً شارپ‌تر است؛ ۲۵فریمِ ۲× اگر
    //    سنگین بود ۱٫۵× می‌نشیند (گیف پیشین ۲.۳MB در ۱× → ~۵.۲MB در ۱٫۵×). ──
    const frameSvgs: string[] = [];
    for (let i = 0; i < FORECAST_STEPS.length; i++) {
      const cells = frames[i];
      if (!cells || cells.length < 10) continue;
      const t = FORECAST_STEPS[i]!;
      frameSvgs.push(makeForecastFrameSvg(date, cells, frameClockFromTimes(timesRef.v, t), stepLabelFa(t), capsBlock));
    }
    if (frameSvgs.length < 3) return null;
    const encodeAt = async (density: number): Promise<ForecastGif | null> => {
      try {
        const encoder = GIFEncoder();
        for (let i = 0; i < frameSvgs.length; i++) {
          const { data, info } = await sharp(Buffer.from(frameSvgs[i]!), { density }).raw().toBuffer({ resolveWithObject: true });
          const u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          const palette = quantize(u8, 256);
          const index = applyPalette(u8, palette);
          encoder.writeFrame(index, info.width, info.height, { palette, delay: FORECAST_FRAME_DELAY_MS });
        }
        encoder.finish();
        const gif = Buffer.from(encoder.bytes());
        if (gif.length < 10_000 || gif.length > FORECAST_GIF_MAX_BYTES) return null;
        if (gif.slice(0, 3).toString('latin1') !== 'GIF') return null;
        return { gif, width: Math.round(MAP_W * (density / 72)), height: Math.round(TOTAL_H * (density / 72)) };
      } catch {
        return null;
      }
    };
    // پلهٔ آغازین بر پایهٔ شمار فریم: ≤۱۰ فریم از ۲×؛ ۲۵فریمیِ ۲× همیشه از سقف ۸MB
    // می‌گذرد (~۹MB) — مستقیم از ۱٫۵× شروع می‌کند (۵.۲MB ✓) و انکودِ محکوم‌به‌شکست
    // و ~۴۵ ثانیه CPU بیهوده صرف نمی‌شود.
    const startDensity = frameSvgs.length >= 15 ? DENSITY_15X : renderGifDensityFor(MAP_W, TOTAL_H);
    const densities = [...new Set([startDensity, DENSITY_15X, DENSITY_1X])];
    for (const density of densities) {
      const out = await encodeAt(density);
      if (out) return out;
    }
    return null;
  } catch {
    return null;
  }
}
