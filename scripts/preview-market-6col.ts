/** پیش‌نمایش کارت خودروی شش‌ستونی — بازبینی چشمی ۲۴ نوامبر */
import { renderMarketCardPng } from '../bot/market-card';
import { tripleDateOf } from '../bot/calendar';
import type { Quote } from '../bot/market';
import { writeFileSync } from 'node:fs';

const mk = (key: string, title: string, value: number, pct: number | undefined, factory?: number): Quote => ({
  key, title, value, unit: 'toman', srcLabel: 'باما', emoji: '🚗',
  changePct: pct, factoryToman: factory,
});

const cars: Quote[] = [
  mk('car:پراید', 'پراید ۱۵۱', 0.32e9, -0.4, 0.119e9),
  mk('car:کوییک', 'کوییک', 0.55e9, 1.2, 0.25e9),
  mk('car:تیبا', 'تیبا ۲', 0.49e9, 0),
  mk('car:ساینا', 'ساینا', 0.68e9, 0.8, 0.33e9),
  mk('car:شاهین', 'شاهین', 0.95e9, -1.5, 0.52e9),
  mk('car:اطلس', 'اطلس', 1.02e9, 2.1, 0.61e9),
  mk('car:پژو 207', 'پژو ۲۰۷', 1.25e9, 0.3, 0.72e9),
  mk('car:رانا', 'رانا', 0.78e9, undefined),
  mk('car:تارا', 'تارا', 1.58e9, 1.9, 0.95e9),
  mk('car:دنا', 'دنا پلاس', 1.87e9, -0.7, 1.13e9),
  mk('car:سورن', 'سورن پلاس', 1.41e9, 0.5, 0.88e9),
  mk('car:ری را', 'ری‌را', 2.05e9, 3.4),
  mk('car:هایما s5', 'هایما S5', 1.72e9, -2.2, 1.29e9),
  mk('car:هایما s7', 'هایما S7', 2.3e9, 0.9),
  mk('car:هایما 8s', 'هایما 8S', 2.65e9, 4.1),
  mk('car:جک j4', 'جک J4', 1.95e9, 1.1, 1.61e9),
  mk('car:sr3', 'کی ام سی SR3', 1.68e9, -0.9),
  mk('car:j7', 'کی ام سی J7', 3.1e9, 2.8),
  mk('car:t9', 'کی ام سی T9', 3.45e9, 5.2),
  mk('car:اریزو6', 'آریزو ۶ پرو', 2.15e9, 0.2, 1.55e9),
  mk('car:تیگو7', 'تیگو ۷ پرو', 2.8e9, 1.5, 2.1e9),
  mk('car:تیگو8', 'تیگو ۸ پرو مکس', 3.25e9, 3.9, 2.42e9),
  mk('car:الیت', 'فیدلیتی الیت ۷نفره', 4.7e9, 6.3, 3.35e9),
  mk('car:لاماری اکو', 'لاماری اکو', 2.9e9, -1.8),
  mk('car:اینوی', 'اینوی هیبرید', 3.6e9, undefined),
];

const date = tripleDateOf('2026-11-24', 'Asia/Tehran', 'umalqura');
const card = await renderMarketCardPng({
  date,
  slotLabel: 'گزارش روزانه (ساعت ۱۵)',
  quotes: [...cars, { key: 'geram18', title: 'طلای ۱۸ عیار', value: 92_500_000, unit: 'toman', srcLabel: 'tgju', emoji: '🥇' }],
});
if (!card) { console.error('رندر نشد!'); process.exit(1); }
writeFileSync('/home/z/my-project/download/preview-market-6col.png', card.png);
console.log('کارت:', card.width, '×', card.height, '-', (card.png.length / 1024).toFixed(0), 'KB');
