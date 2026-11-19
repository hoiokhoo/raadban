/**
 * پیش‌نمایش کارت گزارش بازار با دادهٔ واقعی — دقیقاً همان مسیر اسلات ظهر/شب ربات:
 * fetchMarketData (نوبیتکس/tgju/بورس/کانال خودرو) → applyDeltas → کارت PNG.
 * شکست هر مرحله → exit(2) (هیچ عدد ساختگی).
 * اجرا: bun scripts/preview-market-card.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fetchMarketData, applyDeltas } from '../bot/market';
import { renderMarketCardPng } from '../bot/market-card';
import { tripleDateOf } from '../bot/calendar';

const tz = 'Asia/Tehran';

const md = await fetchMarketData({});
console.log(`اقلام: ${md.quotes.length} — دریافت‌نشده (صادقانه): ${md.failures.length ? md.failures.join('؛ ') : '—'}`);
if (md.quotes.length < 3) {
  console.error('❌ قلم قابل‌اعتماد کافی نیست — پیش‌نمایش صادقانه انجام نمی‌شود (هیچ عدد ساختگی)');
  process.exit(2);
}

const withDelta = applyDeltas(md.quotes, undefined);
const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const date = tripleDateOf(todayKey, tz, 'umalqura');
const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()));
const slotLabel = hour < 15 ? 'میان‌روز' : 'شب';

const card = await renderMarketCardPng({ date, slotLabel, quotes: withDelta });
if (!card) {
  console.error('❌ رندر کارت ناموفق بود');
  process.exit(2);
}
mkdirSync('download/preview', { recursive: true });
writeFileSync('download/preview/market-card.png', card.png);
console.log(`✅ کارت: ${card.width}×${card.height} — ${Math.round(card.png.length / 1024)} کیلوبایت → download/preview/market-card.png`);
// کپشن حذف شد — خواستهٔ کاربر ۲۰ نوامبر: عکس بدون هیچ متن زیرش ارسال می‌شود
