/** راستی‌آزمایی متنی SVG کارت بازار — بدون وابستگی به بینایی مدل */
import { fetchMarketData, applyDeltas, formatMoney } from '../bot/market';
import { makeMarketCardSvg, marketSectionsOf } from '../bot/market-card';
import { tripleDateOf } from '../bot/calendar';

const md = await fetchMarketData({});
const withDelta = applyDeltas(md.quotes, undefined, undefined);
const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const date = tripleDateOf(dateKey, 'Asia/Tehran', 'umalqura');
const svg = makeMarketCardSvg({ date, slotLabel: 'گزارش روزانه (ساعت ۱۵)', quotes: withDelta });

const { sections, moreCars } = marketSectionsOf(withDelta);
const cars = sections.find((s) => s.title.includes('خودرو'))!;
console.log('ردیف‌های خودرو روی کارت:', cars.rows.length, '| مازاد:', moreCars);
console.log('--- پنج ردیف اول (باید صعودی باشد) ---');
for (const r of cars.rows.slice(0, 5)) console.log(`${r.title} | بازار ${r.value} | کارخانه ${r.official ?? '—'} | اختلاف ${r.gapAbs ?? '—'} (${r.gapPct ?? '—'})`);
console.log('--- سه ردیف آخر ---');
for (const r of cars.rows.slice(-3)) console.log(`${r.title} | بازار ${r.value} | کارخانه ${r.official ?? '—'}`);
// صعودی بودن مقادیر عددی از خود SVG؟ ردیف‌ها به ترتیب sections آمده‌اند
console.log('--- ادعاهای متنی SVG ---');
const checks: Array<[string, string]> = [
  ['برچسب اسلات ۱۵', 'گزارش روزانه (ساعت ۱۵)'],
  ['پانوشت دیروز ۱۵', 'دیروز ساعت ۱۵'],
  ['قیمت کارخانهٔ پراید (۱٫۱۹۰ میلیارد)', '۱٫۱۹۰ میلیارد تومان'],
  ['متن اختلاف', 'اختلاف'],
];
for (const [name, needle] of checks) console.log(`${name}: ${svg.includes(needle) ? '✓' : '✗ ' + needle}`);
console.log('شمار «میلیارد تومان» در SVG (بازار+کارخانه):', (svg.match(/میلیارد تومان/g) || []).length);
console.log('شمار «—» (ستون سوم خالی):', (svg.match(/—/g) || []).length);
