/**
 * گیف متحرک رادار بارشی ایران — خواستهٔ کاربر ۲۴ نوامبر ۲۰۲۶:
 * «میخوام خیلی خفن‌ای از یه سایت هواشناسی که مدل پیشبینی ۲۴ ساعته رو داده کپیش کنی
 *  یا گیف متحرکش رو بزاری که بهتره نه اینکه نقشه رو خودت بسازی».
 *
 * تصویر رادار «عیناً از سرویس حرفه‌ای RainViewer» کپی می‌شود (API عمومی بدون کلید —
 * https://api.rainviewer.com/public/weather-maps.json): کاشی‌های ۵۱۲px وب‌مرکاتور در
 * z=6 روی جعبهٔ ایران → برش دقیق مرز → زیر نقشهٔ استان‌ها/مراکز استان (iran-map-base)
 * → گیف متحرک ~۷ فریم (۲ ساعت گذشته، گام ۱۰-دقیقه‌ای) + فریم‌های پیش‌بینی ۳۰دقیقه‌ای
 * هنگام وجود. مهر زمان هر فریم به وقت تهران. ارجاع منبع در پانوشت (الزام API عمومی).
 *
 * صادقانه: شکست API/کاشی/رندر → null (فراخواننده به گیف پیش‌بینی ۲۴ساعته و کارت‌های
 * شهرها تکیه می‌کند — هیچ جایگزین ساختگی ساخته نمی‌شود). آسمان صاف = کاشی‌های خالی؛
 * گیف همچنان ساخته می‌شود (حقیقتِ «بارشی نیست»).
 */
import { faDigits } from './daily';
import { type TripleDate } from './calendar';
import {
  MAP_W, MAP_H, MERC_BBOX,
  provinceFillsSvg, provinceBordersSvg, iranOutlineSvg, iranMapClipPath, graticuleSvg, capitalsSvg,
} from './iran-map-base';

export interface RadarGif {
  gif: Buffer;
  width: number;
  height: number;
}

// ---------- هندسهٔ سربرگ/پانوشت ----------

const HEADER_H = 200;
const FOOTER_H = 52;
const TOTAL_H = HEADER_H + MAP_H + FOOTER_H;
/** رنگ‌بندی ۴ = The Weather Channel (سبز→زرد→قرمز؛ snow=۱ برف جدا) */
const RV_COLOR = 4;
const RV_OPTS = '1_1'; // هموار + برف
const TILE = 512;
const ZOOM = 6;

// ---------- ریاضیات کاشی وب‌مرکاتور — خالص و تست‌پذیر ----------

/** شمارهٔ کاشی x از طول جغرافیایی — خالص */
export function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

/** شمارهٔ کاشی y از عرض جغرافیایی (مرکاتور) — خالص */
export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

/** بازهٔ کاشی‌های پوشش‌دهندهٔ جعبهٔ ایران — خالص */
export function iranTileRange(z: number): { x0: number; x1: number; y0: number; y1: number } {
  return {
    x0: lonToTileX(MERC_BBOX.minLon, z),
    x1: lonToTileX(MERC_BBOX.maxLon, z),
    y0: latToTileY(MERC_BBOX.maxLat, z),
    y1: latToTileY(MERC_BBOX.minLat, z),
  };
}

/** نشانی یک کاشی رادار — خالص */
export function radarTileUrl(host: string, path: string, z: number, x: number, y: number, size = TILE): string {
  return `${host}${path}/${size}/${z}/${x}/${y}/${RV_COLOR}/${RV_OPTS}.png`;
}

/** پیکسلِ طول جغرافیایی داخلِ ترکیب کاشی‌ها — خالص */
export function lonToCompositePx(lon: number, z: number, x0: number, size = TILE): number {
  return ((lon + 180) / 360) * 2 ** z * size - x0 * size;
}

/** پیکسلِ عرض جغرافیایی داخلِ ترکیب کاشی‌ها — خالص */
export function latToCompositePx(lat: number, z: number, y0: number, size = TILE): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z * size - y0 * size;
}

// ---------- گزینش فریم‌ها — خالص ----------

export interface RvFrame { time: number; path: string }

/** گزینش فریم‌های رادار — گذشته با گام ~۲ (۲۰ دقیقه) + همهٔ nowcast (پیش‌بینی کوتاه).
 *  سقف maxFrames فریم. خالص تست‌پذیر. */
export function pickRadarFrames(past: RvFrame[], nowcast: RvFrame[], maxFrames = 9): RvFrame[] {
  const ok = (a: RvFrame[]) => (a || []).filter((f) => f && typeof f.time === 'number' && typeof f.path === 'string' && f.path.startsWith('/'));
  const p = ok(past);
  const nc = ok(nowcast).slice(0, 3);
  const step = 2;
  const picked: RvFrame[] = [];
  for (let i = p.length > 1 ? 1 : 0; i < p.length && picked.length < maxFrames - nc.length; i += step) picked.push(p[i]!);
  if (p.length > 0) picked.push(p[p.length - 1]!); // آخرین وضعیت فعلی همیشه هست
  const seen = new Set<number>();
  const out = [...picked, ...nc].filter((f) => (seen.has(f.time) ? false : (seen.add(f.time), true)));
  return out.slice(0, maxFrames);
}

/** برچسب فارسی زمان فریم — «۱۴:۱۰» به وقت تهران. خالص. */
export function frameClockFa(timeSec: number): string {
  try {
    const hhmm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date(timeSec * 1000));
    return faDigits(hhmm);
  } catch {
    return '';
  }
}

// ---------- SVG فریم — خالص ----------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

const FONT_FA = "'B Nazanin', Vazirmatn, sans-serif";

/** SVG کامل یک فریم رادار — تصویر ترکیب کاشی‌ها (data URL) زیر مرزها/مراکز استان.
 *  خالص. */
export function makeRadarFrameSvg(date: TripleDate, radarDataUrl: string, clockFa: string, fcTag: string): string {
  const legendY = HEADER_H - 38;
  const chip = (x: number, color: string) => `<rect x="${x}" y="${legendY - 13}" width="30" height="17" rx="8.5" fill="${color}"/>`;
  const txt = (x: number, s: string, anchor: 'start' | 'end' = 'end', fill = '#9fc3e8') =>
    `<text x="${x}" y="${legendY}" font-family="${FONT_FA}" font-size="20" fill="${fill}" text-anchor="${anchor}">${rtl(esc(s))}</text>`;
  const legend = `${txt(MAP_W - 24, 'بارش سبک')}${chip(MAP_W - 130, '#4ade80')}
  ${txt(MAP_W - 170, 'شدید')}${chip(MAP_W - 240, '#dc2626')}
  ${txt(MAP_W - 280, 'برف')}${chip(MAP_W - 340, '#7db9f5')}
  <text x="24" y="${legendY}" font-family="${FONT_FA}" font-size="20" fill="#8fb8d9" text-anchor="start">${rtl(esc('پویش ۲ ساعت گذشته + پیش‌بینی ۳۰ دقیقه'))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${TOTAL_H}" viewBox="0 0 ${MAP_W} ${TOTAL_H}">
  <defs>${iranMapClipPath()}</defs>
  <rect width="${MAP_W}" height="${TOTAL_H}" fill="#0a1c30"/>
  <rect width="${MAP_W}" height="${HEADER_H}" fill="#122f4f"/>
  <text x="${MAP_W - 24}" y="56" font-family="${FONT_FA}" font-size="40" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('رادار بارشی ایران')}</text>
  <text x="${MAP_W - 24}" y="104" font-family="${FONT_FA}" font-size="24" fill="#9fc3e8" text-anchor="end">${rtl(esc(`${date.weekdayFa} ${date.shamsi} • ${date.miladi}`))}</text>
  <text x="${MAP_W - 24}" y="${HEADER_H - 76}" font-family="${FONT_FA}" font-size="23" font-weight="700" fill="#ffdf8e" text-anchor="end">${rtl(esc(`ساعت ${clockFa}${fcTag ? ` — ${fcTag}` : ''}`))}</text>
  ${legend}
  <g transform="translate(0, ${HEADER_H})">
    ${graticuleSvg()}
    ${provinceFillsSvg()}
    <g clip-path="url(#iranClip)">
      <image x="0" y="0" width="${MAP_W}" height="${MAP_H}" preserveAspectRatio="none" href="${radarDataUrl}"/>
    </g>
    ${provinceBordersSvg()}
    ${iranOutlineSvg()}
    ${capitalsSvg()}
  </g>
  <text x="${MAP_W - 24}" y="${TOTAL_H - 18}" font-family="${FONT_FA}" font-size="19" fill="#6f93b4" text-anchor="end">${rtl('رصدبان • فقط ایران')}</text>
  <text x="24" y="${TOTAL_H - 18}" font-family="${FONT_FA}" font-size="19" fill="#6f93b4" text-anchor="start">${rtl('تصویر رادار: RainViewer')}</text>
</svg>`;
}

// ---------- واکشی + مونتاژ GIF ----------

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** حجم سقف گیف رادار — بزرگ‌تر → null (فراخواننده گیف پیش‌بینی را دارد) */
export const RADAR_GIF_MAX_BYTES = 8_000_000;
export const RADAR_FRAME_DELAY_MS = 480;
export const RADAR_LAST_DELAY_MS = 1300;

async function fetchBuf(url: string, timeoutMs: number): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** واکشی همهٔ کاشی‌های یک فریم و ترکیب+برش به تصویر جعبهٔ ایران — null روی شکست */
async function fetchFrameComposite(host: string, frame: RvFrame, range: { x0: number; x1: number; y0: number; y1: number }, timeoutMs: number): Promise<Buffer | null> {
  const cols = range.x1 - range.x0 + 1;
  const rows = range.y1 - range.y0 + 1;
  const compW = cols * TILE;
  const compH = rows * TILE;
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  let fetched = 0;
  // هم‌زمانی محدود (۸) — مهربانی با سرویس عمومی
  const jobs: Array<Promise<void>> = [];
  for (let dx = 0; dx < cols; dx++) {
    for (let dy = 0; dy < rows; dy++) {
      const x = range.x0 + dx;
      const y = range.y0 + dy;
      jobs.push((async () => {
        const b = await fetchBuf(radarTileUrl(host, frame.path, ZOOM, x, y), timeoutMs);
        if (b && b.length > 8 && b.slice(0, 4).toString('latin1') === '\u0089PNG') {
          composites.push({ input: b, left: dx * TILE, top: dy * TILE });
          fetched++;
        }
      })());
      if (jobs.length >= 8) {
        await Promise.all(jobs.splice(0, jobs.length));
      }
    }
  }
  await Promise.all(jobs);
  if (fetched < Math.ceil(cols * rows * 0.5)) return null; // بیش از نیمی از کاشی‌ها نیامد
  try {
    const sharp = (await import('sharp')).default;
    const base = sharp({ create: { width: compW, height: compH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
    const comp = await base.composite(composites).png().toBuffer();
    // برش دقیق جعبهٔ ایران (وب‌مرکاتور — همان تصویرسازی نقشه)
    const left = Math.max(0, Math.round(lonToCompositePx(MERC_BBOX.minLon, ZOOM, range.x0)));
    const top = Math.max(0, Math.round(latToCompositePx(MERC_BBOX.maxLat, ZOOM, range.y0)));
    const width = Math.min(compW - left, Math.round(lonToCompositePx(MERC_BBOX.maxLon, ZOOM, range.x0)) - left);
    const height = Math.min(compH - top, Math.round(latToCompositePx(MERC_BBOX.minLat, ZOOM, range.y0)) - top);
    if (width < 100 || height < 100) return null;
    return await sharp(comp).extract({ left, top, width, height }).png().toBuffer();
  } catch {
    return null;
  }
}

/** گیف متحرک رادار ایران — شکست هر مرحله → null صادقانه. */
export async function fetchRadarGif(date: TripleDate, timeoutMs = 15_000): Promise<RadarGif | null> {
  try {
    const mapsRes = await fetch('https://api.rainviewer.com/public/weather-maps.json', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
    if (!mapsRes.ok) return null;
    const maps = (await mapsRes.json()) as { host?: string; radar?: { past?: RvFrame[]; nowcast?: RvFrame[] } };
    const host = maps.host || 'https://tilecache.rainviewer.com';
    const frames = pickRadarFrames(maps.radar?.past || [], maps.radar?.nowcast || []);
    if (frames.length < 3) return null;
    const range = iranTileRange(ZOOM);
    const nowcastTimes = new Set((maps.radar?.nowcast || []).map((f) => f.time));
    const sharp = (await import('sharp')).default;
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
    const encoder = GIFEncoder();
    let wrote = 0;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]!;
      const comp = await fetchFrameComposite(host, f, range, timeoutMs);
      if (!comp) continue;
      const dataUrl = `data:image/png;base64,${comp.toString('base64')}`;
      const fcTag = nowcastTimes.has(f.time) ? 'پیش‌بینی ۳۰ دقیقه' : '';
      const svg = makeRadarFrameSvg(date, dataUrl, frameClockFa(f.time), fcTag);
      const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
      const u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const palette = quantize(u8, 256);
      const index = applyPalette(u8, palette);
      const isLast = i === frames.length - 1 || wrote === frames.length - 1;
      encoder.writeFrame(index, info.width, info.height, { palette, delay: isLast ? RADAR_LAST_DELAY_MS : RADAR_FRAME_DELAY_MS });
      wrote++;
    }
    if (wrote < 3) return null;
    encoder.finish();
    const gif = Buffer.from(encoder.bytes());
    if (gif.length < 10_000 || gif.length > RADAR_GIF_MAX_BYTES) return null;
    if (gif.slice(0, 3).toString('latin1') !== 'GIF') return null;
    return { gif, width: MAP_W, height: TOTAL_H };
  } catch {
    return null;
  }
}
