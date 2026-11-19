/**
 * گیف متحرک وضعیت غالب هواشناسی — خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «گیف هم به اون بخش اضافه کن» — پس از کارت‌های PNG شهرها، یک گیف کوچک متحرک از
 * وضعیت غالب فردا (خورشید گردان، ابر روان، قطره‌های باران، برف، رعد و برق، ماه و ستاره)
 * به بخش هواشناسی ساعت ۲۱:۰۰ اضافه می‌شود.
 *
 * معماری: ۱۲ فریم SVG برداری → رندر خام RGBA با sharp → کدگذاری GIF متحرک با gifenc
 * (خالص JS، بدون وابستگی native). هیچ متن در گیف نیست → هیچ وابستگی فونتی.
 *
 * صادقانه: شکست هر مرحله → null؛ گیف تزئینی است و شکستش فقط از دست دادن تزئین است —
 * کارت‌های اصلی هواشناسی مستقل از گیف ارسال می‌شوند.
 */
import { iconKindOf } from './weather-card';
import type { HourlyEntry } from './weather';

// ---------- وضعیت غالب روز — خالص و تست‌پذیر ----------

export interface DominantKind {
  kind: string;
  label: string;
}

/** برچسب فارسی هر شکل — برای کپشن گیف */
export const KIND_LABELS: Record<string, string> = {
  sun: 'آفتابی',
  'sun-cloud': 'نیمه‌ابری',
  cloud: 'ابری',
  rain: 'بارانی',
  snow: 'برفی',
  storm: 'رعد و برق',
  moon: 'شب صاف',
};

/** وضعیت غالب روز — بیشترین تکرار شکل آیکن در ساعات معتبر؛ تساوی → نخستین. تابع خالص. */
export function dominantKindOf(hours: HourlyEntry[]): DominantKind | null {
  if (!hours || hours.length === 0) return null;
  const counts = new Map<string, number>();
  for (const h of hours) {
    const k = iconKindOf(h.code);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) { best = k; bestN = n; }
  }
  if (!best) return null;
  return { kind: best, label: KIND_LABELS[best] || 'متغیر' };
}

// ---------- ساخت فریم‌های SVG — خالص و تست‌پذیر ----------

export const GIF_SIZE = 480;
export const GIF_FRAMES = 12;
export const GIF_DELAY_MS = 90;

function cloud(cx: number, cy: number, s: number, fill: string): string {
  return `<ellipse cx="${cx - 5 * s}" cy="${cy}" rx="${13 * s}" ry="${9 * s}" fill="${fill}"/>`
    + `<ellipse cx="${cx + 7 * s}" cy="${cy - 2 * s}" rx="${10 * s}" ry="${8 * s}" fill="${fill}"/>`;
}

function sunRays(cx: number, cy: number, r: number, rotDeg: number): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i + (rotDeg * Math.PI) / 180;
    const x1 = cx + Math.cos(a) * r * 0.72;
    const y1 = cy + Math.sin(a) * r * 0.72;
    const x2 = cx + Math.cos(a) * r;
    const y2 = cy + Math.sin(a) * r;
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#f59e0b" stroke-width="${(r * 0.17).toFixed(1)}" stroke-linecap="round"/>`;
  }
  return out;
}

/** یک فریم SVG از وضعیت — i = شمارهٔ فریم (۰..frames-۱)؛ خالص و تست‌پذیر */
export function makeWeatherGifFrameSvg(kind: string, i: number, size = GIF_SIZE): string {
  const cx = size / 2;
  const cy = size / 2 - size * 0.04;
  const r = size * 0.16;
  const t = i / GIF_FRAMES; // ۰..۱ — فاز چرخه
  let art = '';

  if (kind === 'sun') {
    art = sunRays(cx, cy, r * 1.5, (i * 360) / GIF_FRAMES)
      + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fbbf24"/>`
      + `<circle cx="${cx - r * 0.25}" cy="${cy - r * 0.2}" r="${r * 0.16}" fill="#fde68a"/>`;
  } else if (kind === 'moon') {
    const tw = 0.75 + 0.25 * Math.sin(t * Math.PI * 2);
    art = `<path d="M ${cx + r * 0.55} ${cy - r} A ${r} ${r} 0 1 0 ${cx + r * 0.55} ${cy + r} A ${r * 0.78} ${r * 0.78} 0 1 1 ${cx + r * 0.55} ${cy - r} Z" fill="#e8dfae"/>`
      + [0, 1, 2].map((k) => {
        const sx = cx + (k - 1) * r * 1.7 + (k === 1 ? r * 0.9 : 0);
        const sy = cy - r * (k === 1 ? 1.4 : 0.8) + (k === 0 ? r * 0.3 : 0);
        const sr = r * 0.12 * (k === 1 ? tw : 1.4 - tw * 0.5);
        return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${Math.max(1.5, sr).toFixed(1)}" fill="#dbeafe"/>`;
      }).join('');
  } else if (kind === 'cloud') {
    const dx = Math.sin(t * Math.PI * 2) * size * 0.05;
    art = cloud(cx + dx, cy, r / 9, '#94a3b8') + cloud(cx + dx - size * 0.09, cy + size * 0.045, r / 12, '#b8c4d4');
  } else if (kind === 'sun-cloud') {
    const dx = Math.sin(t * Math.PI * 2) * size * 0.06;
    art = sunRays(cx - size * 0.07, cy - size * 0.07, r * 1.05, (i * 360) / GIF_FRAMES)
      + `<circle cx="${cx - size * 0.07}" cy="${cy - size * 0.07}" r="${r * 0.7}" fill="#fbbf24"/>`
      + cloud(cx + dx, cy + size * 0.05, r / 9, '#cbd5e1');
  } else if (kind === 'rain') {
    const dx = Math.sin(t * Math.PI * 2) * size * 0.02;
    art = cloud(cx + dx, cy - size * 0.06, r / 9, '#94a3b8')
      + [0, 1, 2].map((k) => {
        const phase = (t + k / 3) % 1;
        const ry = cy + size * 0.03 + phase * size * 0.16;
        const rx = cx + dx + (k - 1) * size * 0.075 - phase * size * 0.02;
        return `<line x1="${rx.toFixed(1)}" y1="${ry.toFixed(1)}" x2="${(rx - size * 0.012).toFixed(1)}" y2="${(ry + size * 0.05).toFixed(1)}" stroke="#60a5fa" stroke-width="${(size * 0.014).toFixed(1)}" stroke-linecap="round"/>`;
      }).join('');
  } else if (kind === 'snow') {
    const dx = Math.sin(t * Math.PI * 2) * size * 0.02;
    art = cloud(cx + dx, cy - size * 0.06, r / 9, '#b8c4d4')
      + [0, 1, 2].map((k) => {
        const phase = (t + k / 3) % 1;
        const ry = cy + size * 0.03 + phase * size * 0.16;
        const rx = cx + dx + (k - 1) * size * 0.075 + Math.sin(phase * Math.PI * 3) * size * 0.015;
        return `<circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="${(size * 0.014).toFixed(1)}" fill="#e0f2fe"/>`;
      }).join('');
  } else {
    // storm — رعد و برق چشمک‌زن
    const flash = i % 4 === 0 || i % 4 === 1;
    art = cloud(cx, cy - size * 0.07, r / 9, '#64748b') + cloud(cx - size * 0.02, cy - size * 0.085, r / 12, '#94a3b8')
      + (flash
        ? `<path d="M ${cx} ${cy + size * 0.01} L ${cx - size * 0.055} ${cy + size * 0.09} L ${cx - size * 0.01} ${cy + size * 0.09} L ${cx - size * 0.05} ${cy + size * 0.17}" fill="none" stroke="#facc15" stroke-width="${(size * 0.016).toFixed(1)}" stroke-linejoin="round"/>`
        : `<path d="M ${cx} ${cy + size * 0.01} L ${cx - size * 0.055} ${cy + size * 0.09} L ${cx - size * 0.01} ${cy + size * 0.09} L ${cx - size * 0.05} ${cy + size * 0.17}" fill="none" stroke="#a16207" stroke-width="${(size * 0.01).toFixed(1)}" stroke-linejoin="round" opacity="0.55"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.38" r="0.85">
      <stop offset="0" stop-color="#164a75"/><stop offset="1" stop-color="#0a1c30"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${(size * 0.34).toFixed(1)}" fill="#ffffff" opacity="0.04"/>
  ${art}
</svg>`;
}

// ---------- رندر GIF متحرک — شکست هر مرحله → null ----------

export interface WeatherGif {
  gif: Buffer;
  width: number;
  height: number;
}

/** کدگذاری ۱۲ فریم به GIF متحرک — خالص از نظر دادهٔ ورودی، فقط وابسته به sharp/gifenc. */
export async function renderWeatherGif(kind: string): Promise<WeatherGif | null> {
  try {
    const sharp = (await import('sharp')).default;
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
    const encoder = GIFEncoder();
    for (let i = 0; i < GIF_FRAMES; i++) {
      const svg = makeWeatherGifFrameSvg(kind, i);
      const { data } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
      const u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const palette = quantize(u8, 96);
      const index = applyPalette(u8, palette);
      encoder.writeFrame(index, GIF_SIZE, GIF_SIZE, { palette, delay: GIF_DELAY_MS });
    }
    encoder.finish();
    const gif = Buffer.from(encoder.bytes());
    if (gif.length < 3000 || gif.slice(0, 3).toString('latin1') !== 'GIF') return null;
    return { gif, width: GIF_SIZE, height: GIF_SIZE };
  } catch {
    return null;
  }
}

// کپشن گیف حذف شد — خواستهٔ کاربر ۲۰ نوامبر ۲۰۲۶ («زیر عکس به شکل متنی نیاد») —
// گیف تزئینی است و همهٔ اطلاعات وضعیت غالب در کارت ساعتی بالای آن هست؛
// همراهش «Open-Meteo» هم حذف شد (خواستهٔ همان روز).
