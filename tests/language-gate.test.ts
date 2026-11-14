/**
 * تست‌های دروازهٔ زبان و پل انکری — خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «الان یه تویییت از نتانیاهو اومده ولی ترجمه نشده!» + «تجمیع اخبار تکراری و
 * عدم تکرار اخبار نقل‌شده» + «بهتر شدن تحلیل‌ها و دریافت اخبار».
 *
 * پوشش:
 *  ۱) ریشهٔ باگ نتانیاهو: needsTranslation/isLikelyForeign نسخهٔ جدید (فهرست سفید خط
 *     فارسی در bot/lang.ts) عبری/چینی/یونانی/سیریلیک را می‌گیرد و فارسیِ سالم می‌گذرد؛
 *  ۲) پل انکری: بازنویسی همان رویداد با عدد/نام لاتین مشترک یکی می‌شود (تجمیع) و
 *     «خبر نقل‌شدهٔ تکراری» بلاک می‌شود، ولی رویداد تازهٔ واقعی می‌ماند؛
 *  ۳) یکسان‌سازی توکنایزر (حذف ایست‌واژه‌ها + یکسان‌سازی اعداد هزارگانه)؛
 *  ۴) نسخهٔ اپ (src/lib/translate.ts) هم عبری را «خارجی» می‌بیند.
 * اجرا: bun test tests/language-gate.test.ts
 */
import { describe, test, expect } from 'bun:test';
import { needsTranslationLang, isPureArabic, isPersianEnough, scriptProfile } from '../bot/lang';
import { needsTranslation, isLikelyForeign, tokensOf, isSimilarToAny } from '../bot/bot';
import { isLikelyForeign as isLikelyForeignApp } from '../src/lib/translate';
import {
  mergeSimilarItems,
  dropAlreadySent,
  isDuplicateText,
  strongAnchors,
  tokensFa,
  buildHourlyCorpus,
  type HourlyItem,
} from '../bot/hourly';

// ---------- کمکی ----------

function item(id: string, source: string, text: string, cat?: string, at = '2026-11-15T09:30:00Z'): HourlyItem {
  return { id, source, text, cat, at };
}

const HE_TWEET = 'שר הביטחון אמר היום כי ישראל תמשיך במערכה בעזה עד להשגת כל היעדים';
const HE_SHORT = 'ניצחון מוחלט';
const FA_NEWS = 'وزیر دفاع اسرائیل گفت عملیات در غزه ادامه خواهد یافت تا تحقق همهٔ اهداف جنگ';
const FA_WITH_BRAND = 'شرکت اپل گوشی تازهٔ خود را با تراشهٔ A19 و نمایشگر روشن‌تر معرفی کرد';

// ---------- ۱) دروازهٔ خط — ریشهٔ باگ توییت عبری نتانیاهو ----------

describe('needsTranslation — فهرست سفید خط فارسی (رفع باگ نتانیاهو)', () => {
  test('توییت عبری نتانیاهو → ترجمه لازم (ریشهٔ باگ ۱۵ نوامبر)', () => {
    expect(needsTranslation(HE_TWEET)).toBe(true);
    expect(needsTranslation(HE_SHORT)).toBe(true);
    expect(needsTranslationLang(HE_TWEET)).toBe(true);
  });

  test('خبر فارسی سالم → بدون ترجمه', () => {
    expect(needsTranslation(FA_NEWS)).toBe(false);
    expect(needsTranslationLang(FA_NEWS)).toBe(false);
  });

  test('فارسی با برند/نام لاتین کوتاه → بدون ترجمه (زودهنگام علامت نمی‌خورد)', () => {
    expect(needsTranslation(FA_WITH_BRAND)).toBe(false);
  });

  test('انگلیسی و روسی → ترجمه لازم', () => {
    expect(needsTranslation('Defense minister says the operation will continue until all goals are achieved')).toBe(true);
    expect(needsTranslation('Министр обороны заявил, что операция продолжится до достижения всех целей')).toBe(true);
  });

  test('چینی و یونانی → ترجمه لازم (نامرئی در نسخهٔ قدیمی)', () => {
    expect(needsTranslation('中国人民银行今天宣布了新的利率政策')).toBe(true);
    expect(needsTranslation('Η Ελλάδα ανακοίνωσε νέα μέτρα για την οικονομία')).toBe(true);
  });

  test('عربی خالص بلند → ترجمه لازم؛ متن کوتاه عربی‌مانند → بی‌علامت (رفتار حفظ‌شده)', () => {
    expect(needsTranslation('قال الوزير إن الاجتماع الذى عقد اليوم فى العاصمة ناقش الملف كاملا وحضرته وفود من عدة دول')).toBe(true);
    expect(needsTranslation('کلمة الى')).toBe(false);
  });

  test('خالی/فقط نشانه → بدون ترجمه', () => {
    expect(needsTranslation('')).toBe(false);
    expect(needsTranslation('!!! ???')).toBe(false);
  });

  test('فارسی با نقل‌قول کوتاه عبری (یک واژه) → بدون ترجمه — آستانه ۱۰٪', () => {
    const faWithHebQuote = `نام این شهر در عبری «ירושלים» نوشته می‌شود و مقام‌ها امروز دربارهٔ وضعیت آن گفت‌وگو کردند و توافق نیازمند زمان است`;
    expect(needsTranslation(faWithHebQuote)).toBe(false);
  });
});

describe('isLikelyForeign — نسخهٔ ربات (هم‌ارز دروازهٔ خط)', () => {
  test('توییت عبری → خارجی (قبلاً «فارسی» تلقی می‌شد!)', () => {
    expect(isLikelyForeign(HE_TWEET)).toBe(true);
  });
  test('فارسی → خارجی نیست؛ انگلیسی → خارجی', () => {
    expect(isLikelyForeign(FA_NEWS)).toBe(false);
    expect(isLikelyForeign('The president said negotiations will continue next week')).toBe(true);
  });
});

describe('isLikelyForeign — نسخهٔ اپ (src/lib/translate.ts)', () => {
  test('عبری و چینی → خارجی (مخرج پیشین عبری را نمی‌دید)', () => {
    expect(isLikelyForeignApp(HE_TWEET)).toBe(true);
    expect(isLikelyForeignApp('中国人民银行今天宣布了新的利率政策')).toBe(true);
  });
  test('فارسی → خارجی نیست؛ انگلیسی → خارجی', () => {
    expect(isLikelyForeignApp(FA_NEWS)).toBe(false);
    expect(isLikelyForeignApp('The Federal Reserve announced new interest rates today')).toBe(true);
  });
});

describe('isPureArabic / isPersianEnough — گارد خروجی مدل', () => {
  test('متن عربیِ خالص بلند جدا می‌شود؛ فارسی جدا', () => {
    expect(isPureArabic('قال الوزير إن الاجتماع الذى عقد اليوم فى العاصمة ناقش الملف كاملا وحضرته وفود من عدة دول عربية')).toBe(true);
    expect(isPureArabic(FA_NEWS)).toBe(false);
    expect(isPersianEnough(FA_NEWS)).toBe(true);
    expect(isPersianEnough(HE_TWEET)).toBe(false);
  });
  test('scriptProfile — شمارش خط عبری', () => {
    const p = scriptProfile(HE_TWEET);
    expect(p.hebrew).toBeGreaterThan(10);
    expect(p.hebrew / p.letters).toBeGreaterThan(0.8);
  });
});

// ---------- ۲) یکسان‌سازی توکنایزر ----------

describe('tokensOf/tokensFa — توکنایزر یکپارچهٔ معنایی', () => {
  test('ایست‌واژه‌های پرتکرار حذف می‌شوند', () => {
    const t = tokensOf('وزیر خارجه امروز در نشست خبری گفت که مذاکرات ادامه می‌یابد');
    for (const stop of ['از', 'که', 'را', 'این', 'برای', 'شد']) expect(t.has(stop)).toBe(false);
    expect(t.has('وزیر')).toBe(true);
  });
  test('جداکنندهٔ هزارگان حذف می‌شود — «۱۲٬۵۰۰» و «12500» یک توکن', () => {
    expect(tokensFa('دلار به ۱۲٬۵۰۰ تومان رسید').has('۱۲۵۰۰')).toBe(true);
    expect(tokensFa('dollar reached 2,500 toman').has('2500')).toBe(true);
  });
  test('حروف لاتین کوچک می‌شوند — Trump/trump یکی', () => {
    expect(tokensFa('Trump said').has('trump')).toBe(true);
  });
});

// ---------- ۳) پل انکری — تجمیع اخبار تکراری ----------

describe('strongAnchors — لنگر قوی فقط عدد ≥۳رقمی یا نام لاتین ≥۳حرف', () => {
  test('عدد بلند و نام لاتین لنگرند؛ درصد دونقمی و واژهٔ فارسی نیستند', () => {
    const t = tokensFa('دلار ۱۲٬۵۰۰ تومان؛ تعرفه ۲۵ درصدی ترامپ؛ بیانیه Biden منتشر شد');
    const a = strongAnchors(t);
    expect(a.has('۱۲۵۰۰')).toBe(true);
    expect(a.has('biden')).toBe(true);
    expect(a.has('۲۵')).toBe(false);
    expect(a.has('ترامپ')).toBe(false);
  });
});

describe('mergeSimilarItems — پل انکری: بازنویسی همان رویداد یکی می‌شود', () => {
  test('دو روایت یک ماجرا با عدد مشترک و واژه‌های متفاوت → یک خوشه (تجمیع تکراری‌ها)', () => {
    const A = 'قیمت دلار در بازار آزاد تهران امروز به ۱۲٬۵۰۰ تومان رسید و سوداگران واکنش نشان دادند';
    const B = 'دلار در تهران با رشد چشمگیر به ۱۲٬۵۰۰ تومان رسید';
    const merged = mergeSimilarItems([item('a', 'ایسنا', A), item('b', 'مهر', B)]);
    expect(merged.length).toBe(1);
    expect(merged[0].sources).toEqual(['ایسنا', 'مهر']);
    expect(merged[0].verified).toBe(true); // ۲ منبع مستقل → تیک قطعی
  });

  test('دو خبر متفاوتِ هم‌حوزه با عدد متفاوت → دو خوشه جدا (خبر تازه می‌ماند)', () => {
    const A = 'قیمت دلار در بازار آزاد تهران امروز به ۱۲٬۵۰۰ تومان رسید';
    const B = 'دلار با جهش بی‌سابقه به ۱۳٬۲۰۰ تومان رسید و رکورد زد';
    const merged = mergeSimilarItems([item('a', 'ایسنا', A), item('b', 'مهر', B)]);
    expect(merged.length).toBe(2);
  });

  test('دو خبر متفاوت با نام مشترک ولی بدون لنگر مشترک → جدا می‌مانند', () => {
    const A = 'ترامپ تعرفهٔ ۲۵ درصدی فولاد را امضا کرد';
    const B = 'ترامپ دربارهٔ توافق هسته‌ای سخن گفت و مذاکره را محتمل دانست';
    const merged = mergeSimilarItems([item('a', 'ایسنا', A), item('b', 'مهر', B)]);
    expect(merged.length).toBe(2);
  });
});

describe('dropAlreadySent — عدم تکرار اخبار نقل‌شده', () => {
  test('بازپوشش همان ماجرا توسط منبع دیگر (همان عدد) → بلاک', () => {
    const sent = 'قیمت دلار در بازار آزاد تهران امروز به ۱۲٬۵۰۰ تومان رسید و سوداگران واکنش نشان دادند';
    const newCover = 'گزارش مهر: دلار در تهران با رشد چشمگیر به ۱۲٬۵۰۰ تومان رسید';
    const r = dropAlreadySent([item('n1', 'مهر', newCover)], [tokensFa(sent)]);
    expect(r.dropped).toBe(1);
    expect(r.kept.length).toBe(0);
  });

  test('رویداد تازهٔ واقعی (عدد تازه) → می‌ماند', () => {
    const sent = 'قیمت دلار در بازار آزاد تهران امروز به ۱۲٬۵۰۰ تومان رسید';
    const freshNews = 'دلار با جهش بی‌سابقه به ۱۳٬۲۰۰ تومان رسید و رکورد تازه ثبت شد';
    const r = dropAlreadySent([item('n1', 'مهر', freshNews)], [tokensFa(sent)]);
    expect(r.dropped).toBe(0);
    expect(r.kept.length).toBe(1);
  });

  test('تصادم یک عدد بین دو ماجرای متفاوت (توکن مشترک < ۳) → می‌ماند', () => {
    const sent = 'قیمت دلار در بازار آزاد تهران امروز به ۱۲٬۵۰۰ تومان رسید';
    const other = 'بودجهٔ عمرانی استان در سال مالی جدید ۱۲٬۵۰۰ میلیارد تومان شد';
    const r = dropAlreadySent([item('n1', 'ایرنا', other)], [tokensFa(sent)]);
    expect(r.dropped).toBe(0);
  });
});

describe('isDuplicateText — دو طبقهٔ قوی/پل', () => {
  test('طبقهٔ قوی: ژاکارد بالا بدون لنگر هم تکرار است', () => {
    const A = tokensFa('وزیر خارجه امروز در نشست خبری از توافق تازه با همسایگان خبر داد');
    const B = tokensFa('وزیر خارجه امروز در نشست خبری از توافق تازه با همسایگان خبر داد و جزئیات بیشتری را تشریح کرد');
    expect(isDuplicateText(A, B)).toBe(true);
  });
  test('بدون هیچ اشتراک → تکرار نیست', () => {
    const A = tokensFa('قیمت جهانی گندم کاهش یافت');
    const B = tokensFa('تیم ملی والیبال به فینال رسید');
    expect(isDuplicateText(A, B)).toBe(false);
  });
});

describe('isSimilarToAny — پل انکری در ضدتکرار بین‌چرخه‌ای', () => {
  test('توییت هم‌مضمون خبر ارسال‌شده با همان عدد → بلاک', () => {
    const sentSets = [tokensFa('قیمت دلار در بازار آزاد تهران امروز به ۱۲٬۵۰۰ تومان رسید')];
    const tweet = 'دلار تهران روی ۱۲٬۵۰۰ تومان ایستاد و معامله کم شد';
    expect(isSimilarToAny(tweet, sentSets, 0.55)).toBe(true);
  });
  test('متن بی‌ربط → عبور', () => {
    const sentSets = [tokensFa('قیمت دلار در بازار آزاد تهران امروز به ۱۲٬۵۰۰ تومان رسید')];
    expect(isSimilarToAny('تیم ملی والیبال به فینال مسابقات رسید', sentSets, 0.55)).toBe(false);
  });
});

// ---------- ۴) دستهٔ خبری در پیکرهٔ تحلیل ----------

describe('buildHourlyCorpus — برچسب دسته برای محوربندی بهتر تحلیل', () => {
  test('رویداد با دسته → «[دسته: اقتصاد]»؛ بدون دسته → بدون برچسب (سازگار با قدیم)', () => {
    const withCat = mergeSimilarItems([item('a', 'ایسنا', 'قیمت دلار امروز در بازار آزاد به ۱۲٬۵۰۰ تومان رسید', 'اقتصاد')]);
    const noCat = mergeSimilarItems([item('b', 'مهر', 'قیمت دلار امروز در بازار آزاد به ۱۲٬۵۰۰ تومان رسید')]);
    expect(buildHourlyCorpus(withCat)).toContain('[دسته: اقتصاد]');
    expect(buildHourlyCorpus(noCat)).not.toContain('[دسته:');
  });
});
