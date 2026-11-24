/**
 * خواسته‌های ۲۰ نوامبر ۲۰۲۶ — ضدحلقهٔ تکرار و خلاصهٔ بازنویسی‌شده:
 * «الآن یه پیام اومده اینطوری!!! اینجوری دیگه نیاد» — مدل ضعیف یک مورد را ده‌ها بار با «(تکرار)»
 * در تحلیل ۴ساعتهٔ بخش چپ و راست فرستاد؛ و «گفتم خبر رو بخون و در دو خط خلاصه کن به‌طوری‌که
 * مفهوم خبر کاملاً منتقل بشه؛ اگر نشد تا سه خط مشکلی نداره» — موارد عین‌نویسی با عبارت
 * «@کانال گزارش کرد که» خلاصه نبودند.
 * سد قطعی: sanitizeDigestRepetition (خالص) پیش از ارسال + پرامپت‌های بازنویسی‌محور + فیلوور.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  sanitizeDigestRepetition,
  stripAttributionPrefix,
  groundAiBundle,
  DUP_ITEM_SIM,
  DUP_LOOP_THRESHOLD,
} from '../bot/grounding';
import type { MergedItem } from '../bot/hourly';
import { validateGeoText, DEFAULT_SYSTEM_GEO } from '../bot/geo';
import { DEFAULT_SYSTEM_HOURLY } from '../bot/hourly';
import { DEFAULT_SYSTEM_NIGHTLY } from '../bot/nightly';

// ---------- نمونهٔ واقعی خرابی ۱۹ نوامبر (pollinations) — با نشان «(تکرار)» ----------
const LOOP_SAMPLE = `🧭 تحولات در حوزهٔ امنیتی و سیاسی ایران و منطقه

🗂 رویدادهای کلیدی بازه
۱. تهدید آمریکا به ازسرگیری بازرسی آژانس در ایران کمک نمی‌کند.
۲. چهار موشک بالستیک از یمن به سمت جنوب عربستان سعودی شلیک شد.
۳. رئیس قوه قضائیه: فرایند رسیدگی به درخواست‌های خلاف بیّن شرع، اشکال دارد.
۴. رئیس قوه قضائیه: فرایند رسیدگی به درخواست‌های خلاف بیّن شرع، اشکال دارد. (تکرار)
۵. رئیس قوه قضائیه: فرایند رسیدگی به درخواست‌های خلاف بیّن شرع، اشکال دارد. (تکرار)
۶. دیدار پوتین و ترامپ به خوبی پیش رفت.
۷. رئیس قوه قضائیه: فرایند رسیدگی به درخواست‌های خلاف بیّن شرع، اشکال دارد. (تکرار)

📊 روایت‌های دو طیف
• هیچ رویدادی در این بازه روایت دوگانه ندارد؛ همهٔ گزارش‌ها تک‌منبعی‌اند.`;

// ---------- نمونهٔ گزارش کاربر ۲۰ نوامبر — حلقهٔ بی‌نشان («اینجوری دیگه نیاد») ----------
const ECHO_LOOP_SAMPLE = [
  '🧭 جمع‌بندی بازه',
  '',
  '🗂 رویدادهای کلیدی بازه',
  '۱. تهدید تازه آمریکا علیه نفت ایران.',
  ...Array.from({ length: 15 }, (_, i) => `${['۱','۲','۳','۴','۵','۶','۷','۸','۹','۱۰','۱۱','۱۲','۱۳','۱۴','۱۵','۱۶','۱۷','۱۸','۱۹','۲۰','۲۱','۲۲','۲۳','۲۴','۲۵'][i]}. وزیر فرهنگ و ارشاد اسلامی اعلام کرد نمایشگاه کتاب در دهه اول دی برگزار می‌شود.`),
  '',
  '🔍 تحلیل',
  '• نمایشگاه کتاب در دهه اول دی برگزار می‌شود.',
].join('\n');

function merged(text: string, sources: string[], id = 'm'): MergedItem {
  return {
    id,
    source: sources[0] || '',
    text,
    at: new Date().toISOString(),
    ids: [id],
    sources,
    verified: sources.length >= 2,
  };
}

describe('sanitizeDigestRepetition — ضدحلقهٔ تکرار (خواستهٔ ۲۰ نوامبر: «اینجوری دیگه نیاد»)', () => {
  test('نمونهٔ واقعی خرابی ۱۹ نوامبر — نشان «(تکرار)» پاک و شماره‌ها پیاپی می‌شوند', () => {
    const r = sanitizeDigestRepetition(LOOP_SAMPLE);
    expect(r.total).toBe(7);
    expect(r.removed).toBe(3);
    expect(r.loop).toBe(true); // ۳ حذف = آستانهٔ حلقه
    // سه مورد تکراری حذف؛ چهار مورد یکتا با شمارهٔ پیاپی
    expect(r.text).toContain('۱. تهدید آمریکا به ازسرگیری بازرسی');
    expect(r.text).toContain('۲. چهار موشک بالستیک');
    expect(r.text).toContain('۳. رئیس قوه قضائیه: فرایند رسیدگی');
    expect(r.text).toContain('۴. دیدار پوتین و ترامپ');
    // هیچ «تکرار» دوم یا شمارهٔ پرشی نمانده باشد
    expect(r.text).not.toContain('(تکرار)');
    expect(r.text).not.toContain('۵. ');
    // سربرگ‌ها و بخش‌ها دست‌نخورده
    expect(r.text).toContain('🗂 رویدادهای کلیدی بازه');
    expect(r.text).toContain('📊 روایت‌های دو طیف');
    expect(r.text).toContain('هیچ رویدادی در این بازه روایت دوگانه ندارد');
  });

  test('حلقهٔ بی‌نشان گزارش کاربر — ۱۵ نسخهٔ یکسان به یک مورد می‌رسد و پرچم loop می‌خورد', () => {
    const r = sanitizeDigestRepetition(ECHO_LOOP_SAMPLE, { loopThreshold: 5 });
    expect(r.removed).toBe(14); // ۱۵ نسخه — نخستین رخداد می‌ماند، ۱۴ تای دیگر حذف
    expect(r.loop).toBe(true);
    // نخستین رخداد می‌ماند؛ ادامهٔ شماره‌ها پیاپی
    expect(r.text).toContain('۱. تهدید تازه آمریکا علیه نفت ایران.');
    expect(r.text).toContain('۲. وزیر فرهنگ و ارشاد اسلامی اعلام کرد نمایشگاه کتاب');
    expect(r.text).not.toContain('۳. وزیر فرهنگ');
    // تحلیل پایین پیام حفظ می‌شود
    expect(r.text).toContain('🔍 تحلیل');
    expect(r.text).toContain('• نمایشگاه کتاب در دهه اول دی برگزار می‌شود.');
  });

  test('پیشوند نقل‌سازی «@کانال گزارش کرد که» پاک می‌شود — خودِ خبر می‌ماند', () => {
    const r = sanitizeDigestRepetition(
      '۱. @Majalle_siasy گزارش کرد که وزیر فرهنگ و ارشاد اسلامی اعلام کرد نمایشگاه کتاب در دهه اول دی برگزار می‌شود.\n۲. تهدید تازه آمریکا علیه نفت ایران.',
      { sources: ['@Majalle_siasy'] }
    );
    expect(r.text).toContain('وزیر فرهنگ و ارشاد اسلامی اعلام کرد نمایشگاه کتاب');
    expect(r.text).not.toContain('@Majalle_siasy');
    expect(r.text).not.toContain('گزارش کرد که وزیر');
  });

  test('پیشوند نام منبع شناخته‌شده («نام: …») پاک می‌شود ولی ذکر درون جمله دست نمی‌خورد', () => {
    const out = stripAttributionPrefix('غرب آسیا: چهار موشک از یمن شلیک شد.', ['غرب آسیا']);
    expect(out).toBe('چهار موشک از یمن شلیک شد.');
    const out2 = stripAttributionPrefix('اوضاع غرب آسیا: تحولات تازه‌ای در جریان است.', ['غرب آسیا']);
    expect(out2).toBe('اوضاع غرب آسیا: تحولات تازه‌ای در جریان است.'); // آغاز سطر نیست — دست نمی‌خورد
  });

  test('متن سالم بدون تکرار — عیناً و بدون هیچ دست‌کاری برمی‌گردد', () => {
    const healthy = '🗂 رویدادهای کلیدی بازه\n۱. تهدید آمریکا به ازسرگیری بازرسی آژانس در ایران.\n۲. چهار موشک بالستیک از یمن شلیک شد.\n\n🔍 تحلیل\n• دو محور اصلی در این بازه.';
    const r = sanitizeDigestRepetition(healthy);
    expect(r.removed).toBe(0);
    expect(r.loop).toBe(false);
    expect(r.text).toBe(healthy); // بایت‌به‌بایت
  });

  test('دو رویداد واقعاً متفاوتِ هم‌حوله یکی نمی‌شوند', () => {
    const t = [
      '۱. رئیس قوه قضائیه گفت فرایند رسیدگی به درخواست‌های خلاف بیّن شرع اشکال دارد و باید اصلاح شود.',
      '۲. رئیس قوه قضائیه در دیدار با مقامات قضایی فرانسه بر گسترش همکاری حقوقی دو کشور تأکید کرد.',
      '۳. بازار ارز امروز با رشد خفیف دلار بسته شد؛ هر دلار ۱۱۲٬۵۰۰ تومان.',
    ].join('\n');
    const r = sanitizeDigestRepetition(t);
    expect(r.removed).toBe(0);
    expect(r.text).toBe(t);
  });

  test('حذف تکرار حتی وقتی عین‌نویسی با فاصله/نیم‌فاصله متفاوت است', () => {
    const t = [
      '۱. فرایند رسیدگی به درخواست‌های خلاف بیّن شرع اشکال دارد.',
      '۲. فرایند رسیدگی به درخواست های خلاف بین شرع اشکال دارد.',
    ].join('\n');
    const r = sanitizeDigestRepetition(t);
    expect(r.removed).toBe(1);
    expect(r.loop).toBe(false); // زیر آستانهٔ حلقه — پاک‌سازی بی‌صدا
  });

  test('ثابت‌های آستانه', () => {
    expect(DUP_ITEM_SIM).toBe(0.8);
    expect(DUP_LOOP_THRESHOLD).toBe(3);
  });

  test('متن خالی و بدون مورد — دست‌نخورده', () => {
    expect(sanitizeDigestRepetition('').text).toBe('');
    const noItems = '🔍 تحلیل\n• بدون فهرست شماره‌دار.';
    expect(sanitizeDigestRepetition(noItems).text).toBe(noItems);
  });
});

describe('یکپارچگی: پاک‌سازی → اعتبارسنجی → قفل تیک به منبع', () => {
  test('خروجی پاک‌شدهٔ حلقه‌دار از اعتبارسنجی و تطبیق اجباری می‌گذرد — بدون تکرار', () => {
    const clusters: MergedItem[] = [
      merged('تهدید آمریکا به ازسرگیری بازرسی آژانس در ایران کمک نمی‌کند.', ['@yapressagency', 'غرب آسیا'], 'c1'),
      merged('چهار موشک بالستیک از یمن به سمت جنوب عربستان سعودی شلیک شد.', ['@yapressagency'], 'c2'),
      merged('رئیس قوه قضائیه: فرایند رسیدگی به درخواست‌های خلاف بیّن شرع، اشکال دارد.', ['@aboghasem'], 'c3'),
      merged('دیدار پوتین و ترامپ به خوبی پیش رفت.', ['@syriankhabar'], 'c4'),
    ];
    const v = validateGeoText(LOOP_SAMPLE);
    expect(v).not.toBeNull();
    const s = sanitizeDigestRepetition(v!);
    expect(s.loop).toBe(true);
    // حتی بدون فیلوور، متن پاک‌شده باید قابل ارسال و تطبیق‌پذیر باشد
    const g = groundAiBundle(s.text, clusters);
    expect(g.kept).toBe(4);
    expect(g.total).toBe(4);
    // تیک فقط از خوشهٔ دومانبعی سامانه می‌آید
    expect(g.ticked).toBe(1); // فقط خوشهٔ c1 دو منبع دارد
    // شماره‌های نهایی پیاپی‌اند
    const nums = [...g.text!.matchAll(/^([۰-۹]+)\./gm)].map((m) => m[1]);
    expect(nums).toEqual(['۱', '۲', '۳', '۴']);
  });
});

describe('پرامپت‌ها — خلاصهٔ بازنویسی‌شده و ممنوعیت عین‌نویسی/تکرار (خواستهٔ ۲۰ نوامبر)', () => {
  test('پرامپت تحلیل جامع ۸ساعتهٔ یکپارچه: بخوان و در دو خط خلاصه کن (تا سه خط در موارد پیچیده — ۲۰ نوامبر سوم)', () => {
    expect(DEFAULT_SYSTEM_GEO).toContain('خلاصهٔ بازنویسی‌شده');
    expect(DEFAULT_SYSTEM_GEO).toContain('بخوانید، بفهمید و بازنویسی کنید');
    expect(DEFAULT_SYSTEM_GEO).toContain('حداکثر دو خط');
    expect(DEFAULT_SYSTEM_GEO).toContain('حداکثر سه خط مجاز');
    // ممنوعیت عین‌نویسی و عبارت نقل‌سازی (منبع = کانال + خبرگزاری — بستهٔ یکپارچه)
    expect(DEFAULT_SYSTEM_GEO).toContain('هرگز متن منبع را عیناً کپی نکنید');
    expect(DEFAULT_SYSTEM_GEO).toContain('«گزارش کرد که»');
    expect(DEFAULT_SYSTEM_GEO).toContain('نام منبع‌ها فقط در بخش');
  });

  test('پرامپت بازه‌ای: ممنوعیت عین‌نویسی و تکرار سطر', () => {
    expect(DEFAULT_SYSTEM_HOURLY).toContain('هرگز متن ورودی را عیناً کپی نکنید — همیشه بازنویسی کنید');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('هر رویداد فقط یک‌بار در کل پاسخ می‌آید');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('«(تکرار)»');
  });

  test('پرامپت شبانه: ممنوعیت عین‌نویسی و تکرار سطر', () => {
    expect(DEFAULT_SYSTEM_NIGHTLY).toContain('هر رویداد را بخوانید و بازنویسی کنید');
    expect(DEFAULT_SYSTEM_NIGHTLY).toContain('هر رویداد فقط یک‌بار در کل پاسخ می‌آید');
  });

  test('bot/prompts.json — کلید hourly هم‌متن پیش‌فرض تازه است (سایه‌اندازی کهنه نماند)', () => {
    const o = JSON.parse(readFileSync(new URL('../bot/prompts.json', import.meta.url).pathname, 'utf8'));
    expect(o.hourly).toBe(DEFAULT_SYSTEM_HOURLY);
    // geo/nightly اوورراید ندارند — پیش‌فرض کد اثر می‌کند
    expect(o.geo).toBeUndefined();
    expect(o.nightly).toBeUndefined();
  });
});
