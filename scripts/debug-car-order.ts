/** دیباگ چیدمان خودرو — خواستهٔ ۲۳ نوامبر: کامل + به ترتیب قیمت + کارخانهٔ باما */
import { fetchMarketData, CAR_BAMA_MODELS, normalizeCarModel } from '../bot/market';

const md = await fetchMarketData({});
const cars = md.quotes.filter((q) => q.key.startsWith('car:'));
console.log('total car rows:', cars.length, '| bama families:', CAR_BAMA_MODELS.length);
const keys = cars.map((c) => c.key);
console.log('dup keys:', keys.filter((k, i) => keys.indexOf(k) !== i));
console.log('sorted ascending:', cars.every((c, i) => i === 0 || cars[i - 1].value <= c.value));
for (const c of cars) {
  console.log(
    `${String(c.value / 1e9).padStart(7)}B | ${(c.factoryToman ? (c.factoryToman / 1e9).toFixed(2) + 'B' : '—').padStart(7)} | ${c.title} (${c.srcLabel})`,
  );
}
console.log('failures:', md.failures);
console.log('sources:', md.sources);
console.log('sr3 key present:', keys.includes(`car:${normalizeCarModel('sr3')}`));
