const SYM = {
  usd: 'price_dollar_rl', gold: 'geram18', coin: 'sekeb', tse: 'bourse',
  btc: 'crypto-bitcoin', brent: 'oil_brent',
};
const UA = 'Mozilla/5.0 (compatible; RaadbanBot/1.0; +https://github.com)';
for (const [k, s] of Object.entries(SYM)) {
  try {
    const r = await fetch(`https://api.tgju.org/v1/market/indicator/summary-table-data/${s}?lang=fa`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    const j = await r.json();
    const rows = j.data ?? [];
    console.log(`\n===== ${k} (${s}) — ${rows.length} rows, HTTP ${r.status}`);
    for (const idx of [0, 1, 2, rows.length - 3, rows.length - 2, rows.length - 1]) {
      if (rows[idx]) console.log(`  [${idx}]`, JSON.stringify(rows[idx]).slice(0, 160));
    }
  } catch (e) { console.log(`\n===== ${k} (${s}) FETCH FAIL: ${e.message}`); }
}
