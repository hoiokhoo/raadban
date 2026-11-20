/**
 * پیش‌نمایش کارت فوریِ متن‌بلند — اثبات خواستهٔ ۲۰ نوامبر (هشتم):
 * «توییتهای فوری … اصلا خلاصه نکن … کامل باشه فقط فارسی روان و کامل»
 * یک تروث‌سوشال بلند واقعی‌نما + ترجمهٔ کامل فارسی → کارت باید تمام متن را بی‌«…» نشان دهد.
 * اجرا: bun scripts/preview-breaking-long.ts
 */
import { renderBreakingCardPng, renderBreakingCardGif, breakingCardHeight } from '../bot/news-card';
import { tripleDateOf } from '../bot/calendar';
import { writeFileSync } from 'node:fs';

const text = `من با روسیه و اوکراین گفتگو می‌کنم. بسیار نزدیک به یک توافق هستیم، اما این دو کشور هر بار به میانهٔ راه می‌رسند و «بازی بزرگ» را ادامه می‌دهند. من هفتهٔ آینده به صورت شخصی دربارهٔ ایران و برنامهٔ هسته‌ای مذاکره می‌کنم؛ پیام من روشن است: هرگونه حملات به آمریکا و متحدانش پاسخ قاطع خواهد بود. نباید اجازه دهیم جنگ در خاورمیانه گسترش یابد — قیمت نفت و امنیت جهان به همین منطقه گره خورده است. این بزرگ‌ترین معاملهٔ قرن خواهد بود و همهٔ طرف‌ها برنده خواهند بود. جزئیات کامل را به‌زودی اعلام می‌کنم و همهٔ مستندات و آمار واقعی را منتشر خواهم کرد تا دنیا ببیند چه اتفاقی واقعاً افتاده است و چه کسی دروغ گفت و چه کسی صادق بود.`;

const faName = 'دونالد ترامپ (رئیس‌جمهور آمریکا)';
const source = '🅣 Donald Trump (تروث‌سوشال)';
const date = tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura');

console.log(`متن: ${text.length} نویسه | ارتفاع کارت: ${breakingCardHeight(text, true)}px`);

const png = await renderBreakingCardPng({ source, text, faName, date });
if (!png) { console.error('رندر PNG ناموفق'); process.exit(1); }
writeFileSync('/home/z/my-project/download/preview-breaking-long.png', png.png);
console.log(`PNG: download/preview-breaking-long.png (${png.width}×${png.height})`);

const gif = await renderBreakingCardGif({ source, text, faName, date });
console.log(gif ? `GIF متحرک هم آماده است (${(gif.png.length / 1024).toFixed(0)}KB — ارسال تک‌پیام)` : 'گیف رد شد (کارت بلند) → PNG تک‌پیام — رفتار درست');
