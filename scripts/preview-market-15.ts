/** پیش‌نمایش کارت بازار زنده — خواستهٔ ۲۳ نوامبر (اسلات ۱۵ + فهرست کامل خودرو مرتب بر اساس قیمت) */
import { fetchMarketData, applyDeltas } from '../bot/market';
import { renderMarketCardPng } from '../bot/market-card';
import { tripleDateOf } from '../bot/calendar';
import { writeFileSync } from 'node:fs';

const md = await fetchMarketData({});
const withDelta = applyDeltas(md.quotes, undefined, undefined);
// کلید روز تهران — قالب tripleDateOf «YYYY-MM-DD» است
const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const date = tripleDateOf(dateKey, 'Asia/Tehran', 'umalqura');
const card = await renderMarketCardPng({ date, slotLabel: 'گزارش روزانه (ساعت ۱۵)', quotes: withDelta });
if (card) {
  writeFileSync('download/preview-market-15.png', card.png);
  console.log(`کارت بازار: ${card.width}×${card.height}px → download/preview-market-15.png`);
} else {
  console.log('رندر کارت ناموفق');
}
const cars = withDelta.filter((q) => q.key.startsWith('car:'));
console.log(`ردیف‌های خودرو: ${cars.length} | کارخانه‌دار: ${cars.filter((c) => c.factoryToman).length}`);
