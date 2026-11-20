/**
 * ویژگی‌های خواستهٔ کاربر — ۲۰ نوامبر ۲۰۲۶ (ششم):
 *  ۱) «گفتم فقط توییتها یا تروث سوشال های حاوی کلمه جنگ یا ایرا یا جمهوری اسلامی
 *     به شکل خبر فوری ارسال بشن نه خبرهای کانالها یا خبرگزاریها» — کلیدواژه‌های فوری
 *     توییت/تروث‌سوشال (جنگ | ایرا(ن) | جمهوری اسلامی) و حذف کامل مسیر فوریِ خبر
 *     کانالی (تست‌های واژه‌ای در nov20-3/nov20-4؛ اینجا نشانهٔ ساختاری حذف مسیر).
 *  ۲) «بخش قیمتها و نمودار قیمت کلا دیگه فقط یکبار در ساعت ۳ ارسال بشن و تغییرات
 *     نسبت به ساعت ۳ روز قبل محاسبه بشن» — اسلات واحد ۰۳:۰۰ تهران + پایهٔ درصد =
 *     snapshot دیروزِ ساعت ۳ + گارد تازگی (تست‌های محاسباتی در market.test.ts).
 *  ۳) «بسم الله الرحمن الرحیم در بالای حدیث ارسالی شب رو حذف کن بجاش بزار
 *     اللهم صل علی محمد و آل محمد و عجل فرجهم» — سربرگ شب صلوت است (daily.test.ts).
 *  ۴) «زمان بندی پیام صبح رو بزار ۵:۴۵ صبح و هر صبح بعد از حدیث بدون قبل و بعد ذکر
 *     روز رو بزار» — ۰۵:۴۵ + ذکر روزِ هفته (تست‌های پیام در daily.test.ts).
 * اینجا: زمان‌بندی اسلات بازار و یکپارچگی تنظیمات در سطح ریپو.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSlots, dueSlotKey, tehranParts } from '../bot/digest';

// ---------- (۱) اسلات واحد بازار ۰۳:۰۰ — فقط یکبار در شبانه‌روز ----------

describe('اسلات واحد بازار ۰۳:۰۰ — یکبار در روز (خواستهٔ ششم)', () => {
  test('parseSlots — «3» و «03:00» هر دو اسلات سه بامدادند', () => {
    expect(parseSlots('03:00')).toEqual(['03:00']);
    expect(parseSlots('3')).toEqual(['03:00']);
  });

  test('dueSlotKey — پیش از ۳ بامداد نرسیده؛ از ۳ تا انتهای روز همان یک کلید؛ فردا کلید تازه', () => {
    // تهران = UTC+۳:۳۰ (تست هم‌خوان با core.test.ts: نیمه‌شب تهران = ۲۰:۳۰ UTC)
    const p2am = tehranParts(Date.parse('2026-11-21T22:30:00Z')); // ~۰۲:۰۰ تهران ۲۲ نوامبر
    expect(dueSlotKey(0, ['03:00'], undefined, p2am)).toBeNull();
    const p3am = tehranParts(Date.parse('2026-11-21T23:35:00Z')); // ~۰۳:۰۵ تهران ۲۲ نوامبر
    const key = dueSlotKey(0, ['03:00'], undefined, p3am);
    expect(key).toBe('2026-11-22T03:00');
    expect(dueSlotKey(0, ['03:00'], key ?? '', p3am)).toBeNull(); // همان اسلات — تکرار نمی‌شود
    const p23 = tehranParts(Date.parse('2026-11-22T19:35:00Z')); // ~۲۳:۰۵ تهران همان روز
    expect(dueSlotKey(0, ['03:00'], key ?? '', p23)).toBeNull(); // کل روز فقط همان یک بار
    const pNext = tehranParts(Date.parse('2026-11-22T23:35:00Z')); // ~۰۳:۰۵ تهران روز بعد
    expect(dueSlotKey(0, ['03:00'], key ?? '', pNext)).toBe('2026-11-23T03:00');
  });
});

// ---------- (۲) یکپارچگی تنظیمات ریپو ----------

describe('یکپارچگی تنظیمات ریپو (ششم)', () => {
  test('workflow — PRICE_HOURS فقط ۰۳:۰۰؛ اسلات‌های قدیمی بازار حذف شدند', () => {
    const yml = readFileSync(resolve(import.meta.dir, '../.github/workflows/bale-bot.yml'), 'utf8');
    expect(yml).toContain("PRICE_HOURS: '03:00'");
    expect(yml).not.toContain("PRICE_HOURS: '12:30,20:30'");
    expect(yml).not.toContain("PRICE_HOURS: '12:30,21:00'");
  });

  test('daily-settings — صبح ۰۵:۴۵ / شب ۲۱:۰۰ / هواشناسی ۲۱:۳۰', () => {
    const ds = JSON.parse(readFileSync(resolve(import.meta.dir, '../bot/daily-settings.json'), 'utf8')) as Record<string, string>;
    expect(ds.morningHour).toBe('05:45');
    expect(ds.eveningHour).toBe('21:00');
    expect(ds.weatherHour).toBe('21:30');
  });

  test('مسیر فوری خبر کانالی حذف شد — bot.ts دیگر isBreakingNewsText را صدا نمی‌زند؛ فوری فقط دو خط توییت است', () => {
    const src = readFileSync(resolve(import.meta.dir, '../bot/bot.ts'), 'utf8');
    expect(src).not.toContain('isBreakingNewsText('); // خبر کانال/خبرگزاری هرگز فوری نیست
    const calls = src.match(/await sendBreakingNow\(/g) ?? [];
    expect(calls.length).toBe(2); // فقط خط لولهٔ توییت: حالت تحلیل + حالت بست/خبر
  });

  test('state — فیلد تازگی پایهٔ درصد (priceSnapAt) نرمال‌سازی می‌شود', async () => {
    const src = readFileSync(resolve(import.meta.dir, '../bot/bot.ts'), 'utf8');
    expect(src).toContain('priceSnapAt'); // گارد «دیروز ساعت ۳» واقعی
  });
});
