/** پیش‌نمایش «رندر» گیف پیش‌بینی ۲۴ساعته با دادهٔ ساختگیِ توسعه — فقط بازبینی چشمی؛
 *  هیچ‌وقت به کانال نمی‌رود (در تولید دادهٔ واقعی Open-Meteo می‌آید). سهمیهٔ IP سندباکس
 *  امروز تمام شده؛ رندر/مانتاژ همین مسیر تست می‌شود. */
import { writeFileSync } from 'node:fs';
import { makeForecastFrameSvg, stepLabelFa, FORECAST_STEPS } from '../bot/forecast-gif';
import { capitalsSvgMeasured, capitalsSvg } from '../bot/iran-map-base';
import { buildIranGrid } from '../bot/iran-radar';
import { tripleDateOf } from '../bot/calendar';
import type { RadarCell } from '../bot/iran-radar';

const date = tripleDateOf('2026-11-24', 'Asia/Tehran', 'umalqura');
const grid = buildIranGrid(0.7);
console.log('گرید:', grid.length, 'نقطه');

// میدان ساختگی: نوار بارانی شمال‌غرب که با گذر زمان به سمت شرق می‌رود + برف ارتفاعات
const frames: RadarCell[][] = FORECAST_STEPS.map((t) =>
  grid.map((g) => {
    const drift = t * 0.35;
    const d = Math.abs(g.lon - (49 + drift)) + Math.abs(g.lat - 36.5) * 1.6;
    if (d < 2.6) {
      const heavy = d < 1.1;
      return { lat: g.lat, lon: g.lon, cur: { precipitation: heavy ? 6.5 : 2.2, rain: heavy ? 6.5 : 2.2, snowfall: g.lat > 36.4 ? (heavy ? 1.6 : 0.5) : 0 }, fc: null };
    }
    if (d < 4.6) return { lat: g.lat, lon: g.lon, cur: { precipitation: 0, rain: 0, snowfall: 0, cloudCover: 85 }, fc: null };
    return { lat: g.lat, lon: g.lon, cur: { precipitation: 0, rain: 0, snowfall: 0, cloudCover: 15 }, fc: null };
  }),
);

const sharp = (await import('sharp')).default;
const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
const capsBlock = await capitalsSvgMeasured().catch(() => capitalsSvg());
const encoder = GIFEncoder();
let first = true;
for (let i = 0; i < FORECAST_STEPS.length; i++) {
  const t = FORECAST_STEPS[i]!;
  const clock = `${String((18 + t) % 24).padStart(2, '0')}:00`;
  const svg = makeForecastFrameSvg(date, frames[i]!, clock, stepLabelFa(t), capsBlock);
  if (first) {
    writeFileSync('download/preview-forecast-frame0.svg', Buffer.from(svg)); // بازبینی SVG خام
    first = false;
  }
  const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  const u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const palette = quantize(u8, 256);
  const index = applyPalette(u8, palette);
  encoder.writeFrame(index, info.width, info.height, { palette, delay: 550 });
}
encoder.finish();
const gif = Buffer.from(encoder.bytes());
writeFileSync('download/preview-forecast-24h.gif', gif);
console.log('گیف ساختگی توسعه:', gif.length, 'بایت —', (gif.length / 1024).toFixed(0), 'KB');
