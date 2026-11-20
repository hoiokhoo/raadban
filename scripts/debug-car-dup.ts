/** دیباگ تکرار ردیف خودرو در fetchMarketData */
import { fetchMarketData } from '../bot/market';

const md = await fetchMarketData({ carStore: undefined });
const cars = md.quotes.filter((q) => q.key.startsWith('car:'));
console.log('car rows:', cars.length);
for (const c of cars) console.log(' ', c.key, '|', c.title, '|', c.value, '| factory=', c.factoryToman ?? '-');
