/**
 * پیش‌نمایش کارت هواشناسی با دادهٔ واقعی — دقیقاً همان مسیر ۲۱:۰۰ ربات:
 * Open-Meteo → پارس → تاریخ سه‌گانه → رندر PNG برای هر شهر (تهران، خوانسار، افجه لواسان —
 * خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶) + گیف متحرک وضعیت غالب. شکست هر مرحله → exit(2) (هیچ دادهٔ ساختگی).
 *
 * اجرا: FONTCONFIG_FILE=$PWD/.fontconfig.conf bun scripts/preview-weather-card.ts
 * (متغیر FONTCONFIG_FILE باید پیش از آغاز فرایند تنظیم شود — fontconfig فقط محیط آغازین را می‌خواند)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fetchHourlyForecast, type HourlyEntry } from '../bot/weather';
import { tripleDateOf } from '../bot/calendar';
import { buildWeatherCardCaption, renderWeatherCardPng } from '../bot/weather-card';
import { dominantKindOf, renderWeatherGif, buildWeatherGifCaption } from '../bot/weather-gif';

const tz = 'Asia/Tehran';
const weatherHour = '21:00';
/** همان پیش‌فرض ربات — bot/bot.ts DAILY_SETTINGS_DEFAULTS */
const cities: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'تهران', lat: 35.6892, lon: 51.389 },
  { name: 'خوانسار', lat: 33.2205, lon: 50.315 },
  { name: 'افجه لواسان', lat: 35.85, lon: 51.6833 },
];

const tomorrowEpoch = Date.now() + 86_400_000;
const tomorrowKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrowEpoch);
console.log('روز هدف:', tomorrowKey);

mkdirSync('download/preview', { recursive: true });
const tomorrow = tripleDateOf(tomorrowKey, tz, 'umalqura');
let mainHours: HourlyEntry[] | null = null;
const slug = (name: string) => name.replace(/\s+/g, '-');

for (const c of cities) {
  const hours = await fetchHourlyForecast(c.lat, c.lon, tz, tomorrowKey);
  if (!hours) {
    console.error(`❌ دادهٔ معتبر Open-Meteo برای ${c.name} دریافت نشد — پیش‌نمایش صادقانه انجام نمی‌شود`);
    process.exit(2);
  }
  if (c === cities[0]) mainHours = hours;
  console.log(`✅ ${c.name}: ${hours.length} ساعت معتبر — دما ${Math.min(...hours.map((h) => h.temp))} تا ${Math.max(...hours.map((h) => h.temp))} درجه`);
  const card = await renderWeatherCardPng({ city: c.name, tomorrow, weatherHour, hours });
  if (!card) {
    console.error(`❌ رندر کارت ${c.name} ناموفق بود`);
    process.exit(2);
  }
  const out = `download/preview/weather-card-${slug(c.name)}.png`;
  writeFileSync(out, card.png);
  console.log(`✅ کارت ${c.name}: ${card.width}×${card.height} — ${Math.round(card.png.length / 1024)} کیلوبایت → ${out}`);
  const cap = buildWeatherCardCaption({ city: c.name, tomorrow, weatherHour, hours });
  if (c === cities[0]) {
    console.log('--- کپشن تهران (بدون تگ) ---');
    console.log(cap.replace(/<[^>]+>/g, ''));
    console.log(`طول کپشن: ${cap.length} نویسه (سقف ۱۰۲۴)`);
  }
}

// گیف وضعیت غالب — از دادهٔ شهر اصلی
if (mainHours) {
  const dom = dominantKindOf(mainHours);
  const gif = dom ? await renderWeatherGif(dom.kind) : null;
  if (!dom || !gif) {
    console.error('❌ رندر گیف وضعیت غالب ناموفق بود');
    process.exit(2);
  }
  writeFileSync('download/preview/weather-dominant.gif', gif.gif);
  console.log(`✅ گیف وضعیت غالب: ${dom.label} — ${gif.gif.length} بایت (${gif.gif.slice(0, 3).toString('latin1')}) → download/preview/weather-dominant.gif`);
  console.log('--- کپشن گیف (بدون تگ) ---');
  console.log(buildWeatherGifCaption('تهران', dom, { minT: Math.min(...mainHours.map((h) => h.temp)), maxT: Math.max(...mainHours.map((h) => h.temp)) }).replace(/<[^>]+>/g, ''));
}
