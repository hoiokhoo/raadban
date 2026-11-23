/** پیش‌نمایش زندهٔ محصولات جدید ۲۴ نوامبر: گیف رادار RainViewer، گیف پیش‌بینی ۲۴ساعته، کارت دارایی‌ها */
import { writeFileSync } from 'node:fs';
import { fetchRadarGif } from '../bot/radar-gif';
import { fetchForecastGif } from '../bot/forecast-gif';
import { renderAssetsCardPng } from '../bot/assets-card';
import { fetchMacroStats, type Quote } from '../bot/market';
import { tripleDateOf } from '../bot/calendar';

const date = tripleDateOf('2026-11-24', 'Asia/Tehran', 'umalqura');

console.log('۱) گیف رادار RainViewer...');
const t0 = Date.now();
const radar = await fetchRadarGif(date);
if (radar) {
  writeFileSync('download/preview-radar-rainviewer.gif', radar.gif);
  console.log(`   ✅ ${radar.width}×${radar.height} — ${(radar.gif.length / 1024).toFixed(0)}KB — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} else {
  console.log('   ⚠️ رادار ساخته نشد');
}

console.log('۲) گیف پیش‌بینی ۲۴ساعته (Open-Meteo)...');
const t1 = Date.now();
const fc = await fetchForecastGif(date);
if (fc) {
  writeFileSync('download/preview-forecast-24h.gif', fc.gif);
  console.log(`   ✅ ${fc.width}×${fc.height} — ${(fc.gif.length / 1024).toFixed(0)}KB — ${((Date.now() - t1) / 1000).toFixed(1)}s`);
} else {
  console.log('   ⚠️ پیش‌بینی ساخته نشد');
}

console.log('۳) کارت دارایی‌ها و تورم...');
const macro = await fetchMacroStats();
console.log('   آمار کلان:', JSON.stringify(macro));
const quotes: Quote[] = [
  { key: 'geram18', title: 'طلای ۱۸ عیار', value: 92_500_000, unit: 'toman', srcLabel: 'tgju', emoji: '🥇', changePct: 0.7, changeAbs: 640_000 },
  { key: 'geram24', title: 'طلای ۲۴ عیار', value: 123_300_000, unit: 'toman', srcLabel: 'tgju', emoji: '🥇', changePct: 0.6 },
  { key: 'sekee', title: 'سکه امامی', value: 249_590_000, unit: 'toman', srcLabel: 'tgju', emoji: '🪙', changePct: -1.1, officialToman: 239_840_000, officialSrc: 'بانکی (بهار آزادی)' },
  { key: 'nim', title: 'نیم‌سکه', value: 139_000_000, unit: 'toman', srcLabel: 'tgju', emoji: '🪙', changePct: -0.9 },
  { key: 'usd', title: 'دلار (تتر نوبیتکس)', value: 269_970, unit: 'toman', srcLabel: 'نوبیتکس', emoji: '💵', changePct: 0.3, officialToman: 193_633, officialSrc: 'مرکز مبادله' },
  { key: 'tedpix', title: 'شاخص کل بورس', value: 3_214_500, unit: 'index', srcLabel: 'بورس تهران', emoji: '📈', changePct: 1.4 },
  { key: 'btc', title: 'بیت‌کوین', value: 9_180_000_000, unit: 'toman', srcLabel: 'نوبیتکس', emoji: '₿', changePct: -2.2 },
  { key: 'oil_brent', title: 'نفت برنت', value: 74.2, unit: 'usd', srcLabel: 'tgju', emoji: '🛢', changePct: 0.8 },
];
const card = await renderAssetsCardPng({ date, slotLabel: 'گزارش روزانه (ساعت ۱۵)', quotes, macro });
if (card) {
  writeFileSync('download/preview-assets-card.png', card.png);
  console.log(`   ✅ ${card.width}×${card.height} — ${(card.png.length / 1024).toFixed(0)}KB`);
} else {
  console.log('   ⚠️ کارت دارایی‌ها رندر نشد');
}
