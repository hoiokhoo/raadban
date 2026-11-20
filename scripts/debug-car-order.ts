/** دیباگ حلقهٔ ترتیب خودرو — pending مصرف‌نشده را نشان بده */
import { fetchMarketData, CAR_FEATURED, CAR_VIP, CAR_WEB_SOURCES, normalizeCarModel } from '../bot/market';

const md = await fetchMarketData({});
const cars = md.quotes.filter((q) => q.key.startsWith('car:'));
console.log('total car rows:', cars.length);
const keys = cars.map((c) => c.key);
console.log('dup keys:', keys.filter((k, i) => keys.indexOf(k) !== i));
// شبیه‌سازی حلقهٔ pending
const vipMatches = CAR_VIP.map((v) => normalizeCarModel(v.match));
const norm = normalizeCarModel('sr3');
console.log('vipMatches:', vipMatches, '| sr3 norm:', norm);
for (const f of CAR_FEATURED) {
  const fm = normalizeCarModel(f.match);
  const hit = keys.find((k) => k.slice(4).includes(fm));
  if (hit) console.log(`feature ${f.match} → ${hit}`);
}
console.log('CAR_WEB_SOURCES:', CAR_WEB_SOURCES.map((w) => `${w.match} → ${w.label}`));
