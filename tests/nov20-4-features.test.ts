/**
 * ویژگی‌های خواستهٔ کاربر — ۲۰ نوامبر ۲۰۲۶ (چهارم — بستهٔ ارتقای نسل چهارم):
 *  ۱) «@khabarnamehir رو به منابع کانالها اضافه کن» — منبع تلگرامی تازه در bot/sources.json؛
 *     «اخبار کانال‌ها همگی پس از ادغام و حذف تکراری و چک تاریخچه یکبار با هوش مصنوعی
 *     راستی آزمایی بشن و بعد دسته بندی و صف بندی و ارسال بشن» — سوپرپرامپت تحلیل جامع
 *     یکپارچه اکنون «راستی‌آزمایی» صریح دارد و پیکره‌اش کانال + آرشیو خبر/توییت است.
 *  ۲) «پس زمینه بسته توییتهای عادی سبز کم رنگ باشن، توییها و اخبار فوری قرمز کم رنگ» —
 *     پالت سبز کم‌رنگ کارت توییت + پالت قرمز کم‌رنگ گیف فوری و کارت فوریِ تازه
 *     (renderBreakingCardPng) + تشخیص خبر فوری با آستانهٔ سخت (isBreakingNewsText).
 *  ۳) «تحلیل‌های جامع دوبار زمان‌بندی شدن ادغامشون کن — کلا در طی روز یه بستهٔ سه‌تایی
 *     هشت ساعتهٔ تحلیل جامع با وزن ۶۰/۳۰/۱۰» — parseSlots('none') خاموشی صریح؛
 *     buildGeoWeightedMemory پنجرهٔ ۲۴ساعت/۷روز.
 *  ۴) «بعضی اخبار بسته‌های خبری ناقص و با … ادامش اومدن» — finalizeNewsCardText:
 *     جملهٔ کامل در ≤۳ خط یا null (سرریز به پیام متنی) — هرگز «…».
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSlots, dueSlotKey } from '../bot/digest';
import {
  buildGeoWeightedMemory,
  type GeoAnalysis,
} from '../bot/geo';
import {
  isBreakingNewsText,
  isBreakingTweetText,
  makeBreakingGifFrameSvg,
} from '../bot/breaking';
import {
  finalizeNewsCardText,
  fitsNewsLines,
  makeBreakingCardSvg,
  makeTweetCardSvg,
  TW_MAX_LINES,
} from '../bot/news-card';
import { DEFAULT_SYSTEM_GEO } from '../bot/geo';

// ---------- (۱) منبع تازه + راستی‌آزمایی صریح ----------

describe('منبع @khabarnamehir + خط لولهٔ راستی‌آزمایی (خواستهٔ ۲۰ نوامبر چهارم)', () => {
  test('sources.json — کانال تلگرامی khabarnamehir با دستهٔ iran ثبت شده است', () => {
    const sources = JSON.parse(readFileSync(resolve(import.meta.dir, '../bot/sources.json'), 'utf8')) as Array<{ platform: string; identifier: string; language?: string; region?: string; category?: string }>;
    const src = sources.find((s) => s.identifier === 'khabarnamehir');
    expect(src).toBeTruthy();
    expect(src!.platform).toBe('telegram');
    expect(src!.language).toBe('fa');
    expect(src!.region).toBe('ایران');
    expect(sources.length).toBeGreaterThanOrEqual(80);
  });

  test('سوپرپرامپت تحلیل جامع — «راستی‌آزمایی» و تطبیق اجباری صریح است (یکبار با هوش مصنوعی)', () => {
    expect(DEFAULT_SYSTEM_GEO).toContain('تطبیق');
    expect(DEFAULT_SYSTEM_GEO).toContain('به‌اجبار با منبع تطبیق');
    expect(DEFAULT_SYSTEM_GEO).toContain('موردِ بی‌خاستگاه');
    // پیکرهٔ یکپارچه: کانال‌های چپ و راست + خبرگزاری‌ها و توییت‌ها (وزن ~۶۰٪)
    expect(DEFAULT_SYSTEM_GEO).toContain('کانال‌های چپ و راست');
    expect(DEFAULT_SYSTEM_GEO).toContain('خبرگزاری‌ها/توییت‌ها');
    expect(DEFAULT_SYSTEM_GEO).toContain('وزن ~۶۰٪');
  });
});

// ---------- (۲) رنگ‌ها: سبز کم‌رنگ توییت، قرمز کم‌رنگ فوری ----------

describe('خبر کانال/خبرگزاری هرگز فوری نمی‌شود (خواستهٔ ۲۰ نوامبر ششم: «نه خبرهای کانالها یا خبرگزاریها»)', () => {
  test('isBreakingNewsText همیشه false — حتی حملهٔ موشکی/بمباران/ترور/جنگ', () => {
    expect(isBreakingNewsText('ارتش اسرائیل به تهران حمله موشکی کرد')).toBe(false);
    expect(isBreakingNewsText('بمباران گسترده غزه ادامه دارد')).toBe(false);
    expect(isBreakingNewsText('دو نفر در جنگ داخلی سودان کشته شدند')).toBe(false);
    expect(isBreakingNewsText('ترور فرمانده نیروی قدس تأیید شد')).toBe(false);
    expect(isBreakingNewsText('Israel launches missile strike on Iran')).toBe(false);
    expect(isBreakingNewsText('حملهٔ تیم فوتبال استقلال در نیمهٔ دوم بازی')).toBe(false);
    expect(isBreakingNewsText('')).toBe(false);
  });

  test('فوری فقط توییت/تروث‌سوشال — جنگ/ایرا(ن)/جمهوری اسلامی (isBreakingTweetText)', () => {
    expect(isBreakingTweetText('Trump posts about Iran nuclear talks')).toBe(true);
    expect(isBreakingTweetText('جنگ تازه‌ای در آستانهٔ آغاز است')).toBe(true);
    expect(isBreakingTweetText('سخنرانی رهبر جمهوری اسلامی')).toBe(true);
    expect(isBreakingTweetText('The economy grew 2% this quarter')).toBe(false);
  });

  test('گیف چراغ گردان — پس‌زمینهٔ «قرمز کم‌رنگ» روشن (نه تیرهٔ قدیم)', () => {
    const svg = makeBreakingGifFrameSvg(3);
    expect(svg).toContain('#fff4f3'); // گرادیان روشن قرمز کم‌رنگ
    expect(svg).toContain('#ffdfda');
    expect(svg).not.toContain('#12060b'); // پس‌زمینهٔ تیرهٔ قدیمی حذف شد
    expect(svg).toContain('فوری');
  });

  test('کارت فوری — پالت قرمز کم‌رنگ + متن کامل + منبع/نام (هرگز خلاصه نمی‌شود)', () => {
    const svg = makeBreakingCardSvg({
      source: '𝕏 Donald Trump',
      text: 'ترامپ: اگر جنگ ادامه یابد پاسخ ما قاطع خواهد بود و هیچ گزینه‌ای از میز برداشته نمی‌شود.',
      faName: 'دونالد ترامپ (رئیس‌جمهور آمریکا)',
    });
    expect(svg).toContain('#fdf1f0'); // زمینهٔ قرمز کم‌رنگ کارت
    expect(svg).toContain('#8f1420'); // سربرگ سرخ اشباع
    expect(svg).toContain('فوری');
    expect(svg).toContain('دونالد ترامپ (رئیس‌جمهور آمریکا)');
    expect(svg).toContain('𝕏 Donald Trump');
    expect(svg).toContain('قاطع خواهد بود');
    expect(makeBreakingCardSvg({ source: 'x', text: '' })).toBe(''); // متن خالی → کارت نیست
  });

  test('کارت توییت عادی — پالت سبز کم‌رنگ روشن (سربرگ سبز، ردیف سبزفام)', () => {
    const svg = makeTweetCardSvg({ date: { weekdayFa: 'جمعه', shamsi: '۲۹ آبان ۱۴۰۵', miladi: '2026-11-20' } as never, items: [{ source: '𝕏 a', fa: 'سلام دنیا', faName: 'نام' }] });
    expect(svg).toContain('#eef6ee'); // زمینهٔ صفحهٔ سبز کم‌رنگ
    expect(svg).toContain('#14532d'); // سربرگ سبز تیره
    expect(svg).toContain('#e7f3e9'); // ردیف سبزفام روشن
    expect(svg).not.toContain('#0a1c30'); // زمینهٔ سرمه‌ای قدیمی حذف شد
    expect(TW_MAX_LINES).toBe(32); // ۲۰ نوامبر هشتم: ۱۶→۳۲ — ترجمهٔ بلند تروث‌سوشال هم کامل جا می‌شود
  });
});

// ---------- (۳) ادغام تحلیل‌ها: بستهٔ سه‌تایی ۸ساعته با وزن ۶۰/۳۰/۱۰ ----------

describe('خاموشی صریح اسلات‌ها و حافظهٔ وزنی (خواستهٔ ۲۰ نوامبر چهارم)', () => {
  test('parseSlots — «none» اسلات را کاملاً خاموش می‌کند (fallback به کار نمی‌افتد)', () => {
    expect(parseSlots('none')).toEqual([]);
    expect(parseSlots('NONE')).toEqual([]);
    expect(parseSlots('-')).toEqual([]);
    expect(parseSlots(undefined)).toEqual(['08:00', '14:00', '20:00']); // نبود env = پیش‌فرض
    expect(parseSlots('12:30,21:00')).toEqual(['12:30', '21:00']);
  });

  test('dueSlotKey با اسلات خاموش هرگز سررسید نمی‌شود — digest/nightly مرده‌اند', () => {
    const now = new Date('2026-11-20T10:00:00Z').getTime(); // ۱۳:۳۰ تهران
    expect(dueSlotKey(now, [], undefined)).toBeNull();
  });

  test('buildGeoWeightedMemory — پنجرهٔ ۲۴ ساعت (بافت کامل) و ۷ روز (فشرده) جدا می‌شوند', () => {
    const now = new Date('2026-11-20T12:00:00Z').getTime();
    const mk = (hoursAgo: number, n: number): GeoAnalysis => ({
      slotKey: `slot-${n}`,
      at: new Date(now - hoursAgo * 3600_000).toISOString(),
      text: `متن تحلیل ${n}`,
      summary: `خلاصهٔ تحلیل ${n}`,
      items: 5,
      channels: 9,
    });
    const list: GeoAnalysis[] = [
      mk(3, 1),   // ۳ ساعت پیش → پنجرهٔ روز
      mk(20, 2),  // ۲۰ ساعت پیش → پنجرهٔ روز
      mk(30, 3),  // ۳۰ ساعت پیش → پنجرهٔ هفته
      mk(6 * 24, 4), // ۶ روز پیش → پنجرهٔ هفته
      mk(9 * 24, 5), // ۹ روز پیش → بیرون هفته
    ];
    const wm = buildGeoWeightedMemory(list, now);
    expect(wm.dayCount).toBe(2);
    expect(wm.weekCount).toBe(2);
    expect(wm.day).toContain('خلاصهٔ تحلیل 1');
    expect(wm.day).toContain('خلاصهٔ تحلیل 2');
    expect(wm.day).not.toContain('خلاصهٔ تحلیل 3');
    expect(wm.week).toContain('خلاصهٔ تحلیل 3');
    expect(wm.week).toContain('خلاصهٔ تحلیل 4');
    expect(wm.week).not.toContain('خلاصهٔ تحلیل 5');
    expect(wm.week).not.toContain('خلاصهٔ تحلیل 1');
  });

  test('حافظهٔ خالی — پیام صادقانهٔ هر دو پنجره', () => {
    const wm = buildGeoWeightedMemory([], Date.now());
    expect(wm.day).toContain('ثبت نشده');
    expect(wm.week).toContain('ثبت نشده');
    expect(wm.dayCount).toBe(0);
    expect(wm.weekCount).toBe(0);
  });

  test('workflow — DIGEST_HOURS و NIGHTLY_HOURS با none خاموش؛ GEO_HOURS سه‌تایی ۰۶/۱۴/۲۲', () => {
    const yml = readFileSync(resolve(import.meta.dir, '../.github/workflows/bale-bot.yml'), 'utf8');
    expect(yml).toContain("DIGEST_HOURS: 'none'");
    expect(yml).toContain("NIGHTLY_HOURS: 'none'");
    expect(yml).toContain("GEO_HOURS: '6,14,22'");
  });

  test('نقد زمان‌بندی — بازار و نمودار فقط یکبار در روز ساعت ۳؛ صبح ۰۵:۴۵؛ هواشناسی ۲۱:۳۰', () => {
    const yml = readFileSync(resolve(import.meta.dir, '../.github/workflows/bale-bot.yml'), 'utf8');
    expect(yml).toContain("PRICE_HOURS: '03:00'");
    expect(yml).toContain("BOT_DAILY_POOL_CAP: '260'"); // آرشیو سبک — نقد state.json
    const ds = JSON.parse(readFileSync(resolve(import.meta.dir, '../bot/daily-settings.json'), 'utf8')) as { weatherHour: string; morningHour: string; eveningHour: string };
    expect(ds.weatherHour).toBe('21:30');
    expect(ds.morningHour).toBe('05:45');
    expect(ds.eveningHour).toBe('21:00');
  });
});

// ---------- (۴) ریشه‌کن «…» — نهایی‌ساز جملهٔ کامل ----------

describe('finalizeNewsCardText — جملهٔ کامل در ≤۳ خط یا سرریز (هرگز «…»)', () => {
  test('متن کوتاه تک‌خطی عیناً برمی‌گردد', () => {
    expect(finalizeNewsCardText('شاخص بورس امروز رشد کرد.')).toBe('شاخص بورس امروز رشد کرد.');
  });

  test('متنِ سه‌خطیِ جا‌شونده کامل برمی‌گردد — بدون هیچ بریدگی', () => {
    const t = 'وزارت خارجه اعلام کرد مذاکرات هسته‌ای فردا در ژنو از سر گرفته می‌شود و هیئت‌ها موضوع تحریم‌ها را بررسی خواهند کرد.';
    expect(fitsNewsLines(t)).toBe(true);
    expect(finalizeNewsCardText(t)).toBe(t);
  });

  test('متنِ چهارخطی → بلندترین جملهٔ کاملِ جاشونده؛ پایان با نقطه، بدون «…»', () => {
    const t = 'رئیس‌جمهور امروز در جلسهٔ هیئت‌وزیران از افزایش ۱۵ درصدی بودجهٔ دفاعی خبر داد.وزارت دفاع جزئیات را فردا اعلام می‌کند.بخش سوم متن که بسیار طولانی است و در سه خط جا نمی‌شود اصلاً.';
    const out = finalizeNewsCardText(t);
    expect(out).toBeTruthy();
    expect(out!.endsWith('.')).toBe(true);
    expect(out).not.toContain('…');
    expect(fitsNewsLines(out!)).toBe(true);
    expect(out!.length).toBeGreaterThanOrEqual(40);
    expect(out!.length).toBeLessThan(t.length);
    // نقطهٔ بی‌فاصلهٔ فارسی («داد.وزارت») هم مرز جمله شناخته شد — جملهٔ اول کامل برگشت
    expect(out!).toContain('خبر داد.');
  });

  test('بدون هیچ مرز جملهٔ جاشونده → null (سرریز به پیام متنی — متن کامل هرگز بریده نمی‌شود)', () => {
    const t = Array.from({ length: 18 }, (_, i) => `واژهٔ بسیار طولانی شمارهٔ ${i} برای پر کردن خطوط کارت بدون نقطه‌گذاری`).join(' ');
    expect(fitsNewsLines(t)).toBe(false);
    expect(finalizeNewsCardText(t)).toBeNull();
  });

  test('عدد اعشاری پایان جمله نیست — «۱۲.۵» جمله را نمی‌بندد', () => {
    const t = 'قیمت طلا امروز با رشد ۱۲.۵ درصدی به رقم بی‌سابقه‌ای رسید و بازار مسکن نیز داغ شد و همه منتظرند که فردا چه اتفاقی خواهد افتاد در این شرایط بی‌سابقه.';
    const out = finalizeNewsCardText(t);
    if (out) {
      expect(out).not.toMatch(/۱۲\.$/); // هیچ‌وقت روی «۱۲.» نمی‌ایستد
      expect(fitsNewsLines(out)).toBe(true);
    }
  });

  test('متن خالی → null', () => {
    expect(finalizeNewsCardText('')).toBeNull();
    expect(finalizeNewsCardText('   ')).toBeNull();
  });
});
