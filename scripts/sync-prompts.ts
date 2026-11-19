/**
 * همگام‌سازی پرامپت‌های bot/prompts.json با پیش‌فرض‌های تازهٔ کد — ۲۰ نوامبر ۲۰۲۶.
 * کلید «hourly» و «summary» در prompts.json بر پیش‌فرض کد سایه می‌اندازند؛ پس هر دو طرف باید
 * هم‌متن باشند (ضدحلقهٔ تکرار + ممنوعیت نقل‌سازی + خلاصهٔ کامل ۲-۳خطی «نه ناقص»).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_SYSTEM_HOURLY } from '../bot/hourly';
import { DEFAULT_SYSTEM_GEO } from '../bot/geo';
import { DEFAULT_SYSTEM_NIGHTLY } from '../bot/nightly';
import { DEFAULT_NEWS_SUMMARY_PROMPT } from '../bot/bot';

const file = new URL('../bot/prompts.json', import.meta.url).pathname;
const o = JSON.parse(readFileSync(file, 'utf8'));
o.hourly = DEFAULT_SYSTEM_HOURLY;
o.summary = DEFAULT_NEWS_SUMMARY_PROMPT;
// کلیدهای geo/nightly در prompts.json نیستند — پیش‌فرض کد اثر می‌کند؛ حذف هر نسخهٔ کهنه برای اطمینان
delete o.geo;
delete o.nightly;
o.updatedAt = new Date().toISOString().slice(0, 19) + 'Z';
o.note =
  'پرامپت‌های ربات — از اپلیکیشن رصدبان (بخش ربات ۲۴ ساعته) ویرایش و همگام‌سازی می‌شود. حذف هر فیلد = بازگشت به پیش‌فرض درونی ربات. ' +
  'نسخهٔ ۲۰ نوامبر (دومی): خلاصهٔ کامل ۲-۳خطی («کل کامل اون خبر در ۲ـ۳ خط خلاصه بشه با معنی کامل نه ناقص») — سطر سوم مجاز؛ ' +
  'معنای کامل مقدم بر کوتاهی؛ مورد هرگز وسط جمله ناقص تمام نمی‌شود؛ ضدحلقهٔ تکرار و ممنوعیت نقل‌سازی («گزارش کرد که») پابرجا.';
writeFileSync(file, JSON.stringify(o, null, 1) + '\n', 'utf8');
console.log(`prompts.json synced — hourly: ${o.hourly.length} chars، summary: ${o.summary.length} chars (geo/nightly از پیش‌فرض کد)`);
