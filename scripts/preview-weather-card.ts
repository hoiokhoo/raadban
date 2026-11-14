/**
 * پیش‌نمایش کارت هواشناسی با دادهٔ واقعی — دقیقاً همان مسیر ۲۱:۰۰ ربات:
 * Open-Meteo → پارس → تاریخ سه‌گانه → رندر PNG. شکست هر مرحله → exit(2) (هیچ دادهٔ ساختگی).
 * اجرا: bun scripts/preview-weather-card.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fetchHourlyForecast } from '../bot/weather';
import { tripleDateOf } from '../bot/calendar';
import { buildWeatherCardCaption, renderWeatherCardPng } from '../bot/weather-card';

const tz = 'Asia/Tehran';
const city = 'تهران';
const lat = 35.6892;
const lon = 51.389;
const weatherHour = '21:00';

const tomorrowEpoch = Date.now() + 86_400_000;
const tomorrowKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrowEpoch);
console.log('روز هدف:', tomorrowKey);

const hours = await fetchHourlyForecast(lat, lon, tz, tomorrowKey);
if (!hours) {
  console.error('❌ دادهٔ معتبر Open-Meteo دریافت نشد — پیش‌نمایش صادقانه انجام نمی‌شود');
  process.exit(2);
}
console.log(`✅ ${hours.length} ساعت معتبر — دما ${Math.min(...hours.map((h) => h.temp))} تا ${Math.max(...hours.map((h) => h.temp))} درجه`);

const tomorrow = tripleDateOf(tomorrowKey, tz, 'umalqura');
const card = await renderWeatherCardPng({ city, tomorrow, weatherHour, hours });
if (!card) {
  console.error('❌ رندر کارت ناموفق بود');
  process.exit(2);
}
mkdirSync('download/preview', { recursive: true });
writeFileSync('download/preview/weather-card.png', card.png);
console.log(`✅ کارت: ${card.width}×${card.height} — ${Math.round(card.png.length / 1024)} کیلوبایت → download/preview/weather-card.png`);

const cap = buildWeatherCardCaption({ city, tomorrow, weatherHour, hours });
console.log('--- کپشن (بدون تگ) ---');
console.log(cap.replace(/<[^>]+>/g, ''));
console.log(`طول کپشن: ${cap.length} نویسه (سقف ۱۰۲۴)`);
