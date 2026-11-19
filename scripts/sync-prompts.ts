/**
 * همگام‌سازی پرامپت‌های bot/prompts.json با پیش‌فرض‌های تازهٔ کد — ۲۰ نوامبر ۲۰۲۶.
 * کلید «hourly» در prompts.json بر DEFAULT_SYSTEM_HOURLY سایه می‌اندازد؛ پس هر دو باید
 * هم‌متن باشند (ضدحلقهٔ تکرار + ممنوعیت نقل‌سازی «گزارش کرد که»).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_SYSTEM_HOURLY } from '../bot/hourly';
import { DEFAULT_SYSTEM_GEO } from '../bot/geo';
import { DEFAULT_SYSTEM_NIGHTLY } from '../bot/nightly';

const file = new URL('../bot/prompts.json', import.meta.url).pathname;
const o = JSON.parse(readFileSync(file, 'utf8'));
o.hourly = DEFAULT_SYSTEM_HOURLY;
// کلیدهای geo/nightly در prompts.json نیستند — پیش‌فرض کد اثر می‌کند؛ حذف هر نسخهٔ کهنه برای اطمینان
delete o.geo;
delete o.nightly;
o.updatedAt = new Date().toISOString().slice(0, 19) + 'Z';
o.note =
  'پرامپت‌های ربات — از اپلیکیشن رصدبان (بخش ربات ۲۴ ساعته) ویرایش و همگام‌سازی می‌شود. حذف هر فیلد = بازگشت به پیش‌فرض درونی ربات. ' +
  'نسخهٔ ۲۰ نوامبر ۲۰۲۶: ضدحلقهٔ تکرار («اینجوری دیگه نیاد») — هر رویداد فقط یک‌بار و هیچ نشان «(تکرار)»؛ ' +
  'خلاصهٔ بازنویسی‌شدهٔ دوخطی (تا سه خط در موارد پیچیده)؛ ممنوعیت عین‌نویسی و عبارت نقل‌سازی («گزارش کرد که» و نام کانال در مورد).';
writeFileSync(file, JSON.stringify(o, null, 1) + '\n', 'utf8');
console.log(`prompts.json synced — hourly: ${o.hourly.length} chars (geo/nightly از پیش‌فرض کد)`);
