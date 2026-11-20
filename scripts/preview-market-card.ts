/**
 * پیش‌نمایش کارت بازار با دادهٔ واقعی — برای دیدن همان چیزی که کاربر می‌بیند.
 * اجرا: bun scripts/preview-market-card.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchMarketData, applyDeltas, formatMarketMessage } from '../bot/market';
import { renderMarketCardPng } from '../bot/market-card';
import { tripleDateOf } from '../bot/calendar';
import { tehranParts } from '../bot/digest';

const state = JSON.parse(readFileSync('bot/state.json', 'utf8')) as {
  priceSnap?: Record<string, number>;
  priceSnapAt?: string | null;
  priceSnapPrevDay?: Record<string, number>;
  carStore?: unknown;
};

const md = await fetchMarketData({ carStore: state.carStore as never });
const withDelta = applyDeltas(md.quotes, state.priceSnapPrevDay, state.priceSnapPrevDay);
const now = tehranParts(Date.now());
const date = tripleDateOf(now.dateKey, 'Asia/Tehran', 'umalqura');
const card = await renderMarketCardPng({ date, slotLabel: 'بامداد (ساعت ۳)', quotes: withDelta });
if (card) writeFileSync('/tmp/market-card-current.png', card.png);
console.log('card:', card ? `${card.width}x${card.height} → /tmp/market-card-current.png` : 'render failed');
console.log('failures:', md.failures);
for (const q of withDelta) {
  console.log(
    `${q.emoji} ${q.key} | value=${q.value} | official=${q.officialToman ?? '-'} factory=${q.factoryToman ?? '-'} | pct=${q.changePct ?? '-'} src=${q.changeSrc ?? '-'}`,
  );
}
console.log('--- text message ---');
console.log(formatMarketMessage(md.quotes, state.priceSnapPrevDay, state.priceSnapPrevDay));
