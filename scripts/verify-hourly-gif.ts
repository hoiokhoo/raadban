/** راستی‌آزمایی گیف ساعتی + پیش‌نمایش PNG فریم برای بازبینی برچسب استان‌ها */
import { writeFileSync } from 'node:fs';
import { makeForecastFrameSvg, stepLabelFa, FORECAST_STEPS } from '../bot/forecast-gif';
import { buildIranGrid } from '../bot/iran-radar';
import { tripleDateOf } from '../bot/calendar';
import type { RadarCell } from '../bot/iran-radar';

// ۱) شمارش فریم گیف تولیدشده
const sharp = (await import('sharp')).default;
const meta = await sharp('download/preview-forecast-24h.gif').metadata();
console.log('فریم‌های گیف پیش‌نمایش:', meta.pages, '| ابعاد:', meta.width, '×', meta.height);

// ۲) دادهٔ واقعی Open-Meteo — اگر شبکه بود
const date = tripleDateOf('2026-11-25', 'Asia/Tehran', 'umalqura');
try {
  const { fetchForecastGif } = await import('../bot/forecast-gif');
  const real = await fetchForecastGif(date, 20000);
  if (real) {
    writeFileSync('download/preview-forecast-real-hourly.gif', real.gif);
    const m2 = await sharp(real.gif).metadata();
    console.log('گیف واقعی:', real.gif.length, 'بایت |', m2.pages, 'فریم |', real.width, '×', real.height);
  } else {
    console.log('دادهٔ واقعی در دسترس نبود (شبکه/سهمیه) — null صادقانه');
  }
} catch (e) {
  console.log('دادهٔ واقعی ناموفق:', e instanceof Error ? e.message : e);
}

// ۳) فریم PNG برای بازبینی چشمی برچسب‌ها (دادهٔ ساختگی همان اسکریپت dev)
const grid = buildIranGrid(0.7);
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
for (const idx of [0, 4]) {
  const t = FORECAST_STEPS[idx]!;
  const svg = makeForecastFrameSvg(date, frames[idx]!, `${String((18 + t) % 24).padStart(2, '0')}:00`, stepLabelFa(t));
  await sharp(Buffer.from(svg)).png().toFile(`download/preview-forecast-frame${idx}.png`);
  console.log(`فریم ${idx} PNG ذخیره شد`);
}
