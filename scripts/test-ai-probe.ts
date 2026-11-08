/** تست زندهٔ زنجیرهٔ AI اپ: یک فراخوانی کوچک تحلیل/خلاصه‌سازی فارسی */
import { aiCall } from '../src/lib/ai/client';

const t0 = Date.now();
const res = await aiCall({
  systemPrompt: 'تو دستیار تحلیل خبری فارسی هستی. فقط پاسخ کوتاه فارسی بده.',
  userContent: 'این خبر را در یک جمله فارسی روان خلاصه کن:\n"OPEC+ announced a new output cut of 500,000 barrels per day for Q1, citing seasonal demand weakness."',
  purpose: 'تست_تحلیل',
  maxTokens: 300,
});
console.log('elapsed:', Date.now() - t0, 'ms');
console.log('ok:', res.ok);
console.log('model:', res.model);
console.log('content:', (res.content || '').slice(0, 300));
if (!res.ok) console.log('error:', res.error);
process.exit(0);
