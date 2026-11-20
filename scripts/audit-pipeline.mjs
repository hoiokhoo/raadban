// شبیه‌سازی دقیق خط لوله چارت با داده زنده + کش تولید
import { readFileSync } from 'node:fs';

const SYM = { usd:'price_dollar_rl', gold:'geram18', coin:'sekeb', tse:'bourse', btc:'crypto-bitcoin', brent:'oil_brent' };
const LIVE = { usd:'price_dollar_rl', gold:'geram18', coin:'sekeb', tse:'bourse', btc:'crypto-bitcoin', brent:'oil_brent' };
const RIAL = { usd:true, gold:true, coin:true, tse:false, btc:false, brent:false };
const UA = 'Mozilla/5.0 (compatible; RaadbanBot/1.0)';

function parseHistory(json, rial, days=30) {
  const div = rial ? 10 : 1;
  const o = JSON.parse(json);
  const rows = Array.isArray(o?.data) ? o.data : [];
  const closes = [], dates = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 8) continue;
    const close = Number(String(r[3] ?? '').replace(/[^0-9.]/g, ''));
    const dm = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(String(r[6] ?? ''));
    if (!Number.isFinite(close) || close <= 0 || !dm) continue;
    closes.push(close / div); dates.push(`${dm[1]}-${dm[2]}-${dm[3]}`);
  }
  return { closes: closes.slice(0, days).reverse(), dates: dates.slice(0, days).reverse() };
}

// کش تولید
let cache = null;
try {
  const st = JSON.parse(readFileSync('bot/state.json', 'utf8'));
  cache = st.chartHist;
  console.log('state.chartHist.day =', cache?.day, '| assets:', Object.keys(cache?.assets ?? {}));
} catch (e) { console.log('state read fail:', e.message); }

// زنده
const live = {};
for (const h of ['https://call1.tgju.org/ajax.json', 'https://call2.tgju.org/ajax.json']) {
  try { const r = await fetch(h, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) }); const j = await r.json(); if (j?.current) { Object.assign(live, j.current); break; } } catch {}
}
console.log('\nlive entries:', Object.keys(live).length);

// تاریخ امروز تهران
const now = new Date();
const tehran = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now);
console.log('today (Tehran) =', tehran, '| now UTC =', now.toISOString());

for (const [k, s] of Object.entries(SYM)) {
  const sLive = live[LIVE[k]];
  const liveP = sLive ? Number(String(sLive.p).replace(/[^0-9.]/g, '')) : null;
  let hist = null;
  try {
    const r = await fetch(`https://api.tgju.org/v1/market/indicator/summary-table-data/${s}?lang=fa`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    hist = parseHistory(await r.text(), RIAL[k]);
  } catch (e) { console.log(`${k}: fetch fail ${e.message}`); continue; }
  const src = cache?.assets?.[k] ? { closes: cache.assets[k].closes, dates: cache.assets[k].dates } : hist;
  const tag = cache?.assets?.[k] ? 'CACHE' : 'FRESH';
  // mergeLivePoint همان bot
  let merged = src;
  if (liveP !== null && Number.isFinite(liveP) && liveP > 0) {
    const lv = RIAL[k] ? liveP / 10 : liveP;
    const last = src.dates[src.dates.length - 1] ?? '';
    if (last === tehran) { const c = [...src.closes]; c[c.length - 1] = lv; merged = { closes: c, dates: [...src.dates] }; }
    else merged = { closes: [...src.closes, lv], dates: [...src.dates, tehran] };
  }
  const f = merged.closes[0], l = merged.closes[merged.closes.length - 1];
  const pct = f > 0 ? Math.round(((l - f) / f) * 1000) / 10 : 0;
  console.log(`\n${k} [${tag}] n=${merged.closes.length}`);
  console.log(`   hist range: ${hist.dates[0]} → ${hist.dates[hist.dates.length-1]} | merged: ${merged.dates[0]} → ${merged.dates[merged.dates.length-1]}`);
  console.log(`   first=${f} last=${l} pct=${pct}% | liveP=${liveP} (raw ${sLive?.p}) | histLastClose=${src.closes[src.closes.length-1]}`);
  console.log(`   closes[0..4]=${merged.closes.slice(0,5).map(x=>Math.round(x)).join(',')} … closes[-3..]=${merged.closes.slice(-3).map(x=>Math.round(x)).join(',')}`);
  if (cache?.assets?.[k]) console.log(`   CACHE n=${cache.assets[k].closes.length} range=${cache.assets[k].dates?.[0]}→${cache.assets[k].dates?.[cache.assets[k].dates.length-1]} first=${cache.assets[k].closes[0]} last=${cache.assets[k].closes[cache.assets[k].closes.length-1]}`);
}
