/**
 * خواستهٔ ۲۰ نوامبر ۲۰۲۶ (نهم) — «یه تیکه پرچم آمریکا افتاده روی توییت!!! اینجور علامتها
 * دیگه نیاد رو عکس» — در کارت بستهٔ توییت، ایموجی 🇺🇸ِ متنِ توییت مایک جانسون روی سرور
 * (بدون فونت رنگیِ ایموجی) به قطعهٔ بزرگِ پرچمِ سیاه تبدیل شد که روی چند خط متن افتاد و
 * کلمات را پوشاند.
 *
 * اصلاح دو لایه‌ای:
 *  ۱) لایهٔ رندر — stripCardEmoji: هر سه کارت (خبر/توییت/فوری) متن را پیش از شکستن خط و
 *     محاسبهٔ ارتفاع از ایموجی پالایش می‌کنند — پرچم/نماد هرگز روی تصویر نمی‌آید.
 *  ۲) لایهٔ منبع — پرامپت ترجمه: هیچ ایموجی در ترجمهٔ فارسی نمی‌آید.
 * پیام متنی بله دست‌نخورده — کلاینت بله ایموجی را سالم نشان می‌دهد.
 */
import { describe, expect, test } from 'bun:test';
import {
  stripCardEmoji,
  newsRowHeight,
  tweetRowHeight,
  breakingCardHeight,
  makeNewsCardSvg,
  makeTweetCardSvg,
  makeBreakingCardSvg,
  type NewsCardInput,
  type TweetCardItem,
} from '../bot/news-card';
import { tripleDateOf } from '../bot/calendar';
import { DEFAULT_SYSTEM_BOT_TRANSLATE, BREAKING_PRIORITY_DEFAULT, pickTweetAccountsForCycle } from '../bot/bot';

const DATE = tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura');

describe('stripCardEmoji — پالایش ایموجی متنِ روی کارت', () => {
  test('پرچم آمریکا — همان مورد توییت مایک جانسون — کامل حذف می‌شود', () => {
    const t = 'اقترت جمهوری‌خواه ما در مجلس نمایندگان 🇺🇸 با فرماندهی دونالد ترامپ کار می‌کند';
    expect(stripCardEmoji(t)).toBe('اقترت جمهوری‌خواه ما در مجلس نمایندگان با فرماندهی دونالد ترامپ کار می‌کند');
    expect(stripCardEmoji(t).includes('\u{1F1FA}')).toBe(false);
  });

  test('هر پرچم دیگری هم حذف می‌شود — اسرائیل، روسیه، ترکیبی', () => {
    expect(stripCardEmoji('توصیه 🇮🇱 و 🇷🇺 دربارهٔ آتش‌بس')).toBe('توصیه و دربارهٔ آتش‌بس');
    expect(stripCardEmoji('🇩🇪🇫🇷 نشست برلین')).toBe('نشست برلین');
  });

  test('ZWJ (خانواده)، کی‌کپ، رنگ پوست، انتخاب‌گر نمایش — همه پالایش', () => {
    expect(stripCardEmoji('اعلام 👨‍👩‍👧‍👦 رسمی')).toBe('اعلام رسمی'); // ZWJ sequence
    expect(stripCardEmoji('قیمت ۱️⃣ دلار')).toBe('قیمت ۱ دلار'); // keycap 1️⃣ = ۱+FE0F+20E3
    expect(stripCardEmoji('سلام 👍🏽 دنیا')).toBe('سلام دنیا'); // skin tone
    expect(stripCardEmoji('هشدار ⚠️ رسمی')).toBe('هشدار رسمی'); // VS16
    expect(stripCardEmoji('خبر ❗ مهم')).toBe('خبر مهم');
  });

  test('متن فارسی سالم — حروف، اعداد، علائم نگارشی و گیومه دست‌نخورده', () => {
    const t = '«تحلیل جامع» — رشد ۱۲.۵ درصدی؛ سه‌برابر شد! چرا؟';
    expect(stripCardEmoji(t)).toBe(t);
  });

  test('متن فقط‌ایموجی → خالی؛ خالی → خالی؛ فاصلهٔ اضافه جمع می‌شود', () => {
    expect(stripCardEmoji('🇺🇸')).toBe('');
    expect(stripCardEmoji('')).toBe('');
    expect(stripCardEmoji('   ')).toBe('');
    expect(stripCardEmoji('سلام   🚨   دنیا')).toBe('سلام دنیا');
  });
});

describe('کارت‌ها بدون ایموجی — ارتفاع و رندر سازگار (پرچم هرگز روی متن نمی‌افتد)', () => {
  test('tweetRowHeight — با پرچم = بدون پرچم (پالایش پیش از شمارش خط)', () => {
    expect(tweetRowHeight('متن توییت 🇺🇸 آزمونی')).toBe(tweetRowHeight('متن توییت آزمونی'));
    expect(tweetRowHeight('🇺🇸🇮🇱🇷🇺')).toBe(tweetRowHeight('')); // فقط‌ایموجی = یک خط خالی سالم
  });

  test('makeTweetCardSvg — هیچ Regional Indicator در SVG نیست', () => {
    const item: TweetCardItem = { source: '𝕏 Mike Johnson', fa: 'اقترت جمهوری‌خواه ما در مجلس نمایندگان 🇺🇸 با فرماندهی ترامپ کار می‌کند', faName: 'مایک جانسون (رئیس مجلس نمایندگان آمریکا)' };
    const svg = makeTweetCardSvg({ date: DATE, items: [item] });
    expect(svg.includes('\u{1F1FA}')).toBe(false);
    expect(svg.includes('\u{1F1F8}')).toBe(false);
    expect(svg).toContain('اقترت جمهوری‌خواه'); // خود متن سالم رندر شده
  });

  test('newsRowHeight و کارت خبر — پالایش پیش از شمارش', () => {
    expect(newsRowHeight('خبر آزمونی 🚨 دربارهٔ نفت')).toBe(newsRowHeight('خبر آزمونی دربارهٔ نفت'));
    const input: NewsCardInput = { date: DATE, items: [{ source: 'خبرگزاری', text: 'ادعای دخالت 🇺🇸 در انتخابات مطرح شد', tick: false }] };
    const svg = makeNewsCardSvg(input);
    expect(svg.includes('\u{1F1FA}')).toBe(false);
    expect(svg).toContain('ادعای دخالت');
  });

  test('کارت فوری — پرچم حذف و ارتفاع با متن پالایش‌شده برابر', () => {
    const raw = 'پایان مذاکرات 🇺🇸 با تهران — توافق خبری امروز اعلام می‌شود';
    expect(breakingCardHeight(raw, false)).toBe(breakingCardHeight(stripCardEmoji(raw), false));
    const svg = makeBreakingCardSvg({ source: '🅣 Donald Trump (تروث‌سوشال)', text: raw, date: DATE });
    expect(svg.includes('\u{1F1FA}')).toBe(false);
    expect(svg).toContain('پایان مذاکرات');
  });

  test('دست‌نخوردن منابع نمایشی خودِ اپ — برچسب 𝕏/🅣 و تیک تأیید سرِ جای خودشان', () => {
    // پالایش فقط متنِ بدنه است؛ برچسب منبع و تیک‌بَج برداریِ اپ پالایش نمی‌شوند
    const item: TweetCardItem = { source: '𝕏 Mike Johnson', fa: 'متن آزمونی', faName: 'مایک جانسون', verified: true };
    const svg = makeTweetCardSvg({ date: DATE, items: [item] });
    expect(svg).toContain('Mike Johnson');
    expect(svg).toContain('✅'); // نشان تأیید — برداری/سالم در خط منبع
  });
});

describe('لایهٔ منبع — پرامپت ترجمه دیگر ایموجی نمی‌دهد', () => {
  test('DEFAULT_SYSTEM_BOT_TRANSLATE قاعدهٔ ممنوعیت ایموجی دارد', () => {
    expect(DEFAULT_SYSTEM_BOT_TRANSLATE).toContain('ایموجی');
    expect(DEFAULT_SYSTEM_BOT_TRANSLATE).toContain('پرچم');
  });
});

describe('حساب‌های نظامی تازه — سنتکام و ستاد کل ارتش رژیم صهیونیستی در سرِ اولویت', () => {
  test('اولویت پیش‌فرض ۸→۱۰ — بدون حذف هیچ حساب قبلی از سرِ فهرست', () => {
    expect(BREAKING_PRIORITY_DEFAULT).toBe(10);
  });

  test('با ۱۰ حساب اولویت، سنتکام و ستاد کل هر چرخه چک می‌شوند و ترامپ/رهبری دست‌نخورده می‌مانند', () => {
    const accs = [
      'realDonaldTrump', 'realDonaldTrump-truth', 'mb_ghalibaf', 'khamenei_ir', 'drpezeshkian',
      'araghchi', 'netanyahu', 'elonmusk', 'CENTCOM', 'IDF', 'JDVance', 'SecRubio',
    ].map((h) => ({ handle: h, name: h, faName: h, platform: 'x' as const }));
    const { picked } = pickTweetAccountsForCycle(accs, 10, 6, BREAKING_PRIORITY_DEFAULT); // چرخش از بیرون سرِ فهرست
    const handles = new Set(picked.map((a) => a.handle));
    // سرِ اولویت — هر چرخه
    for (const h of ['realDonaldTrump', 'khamenei_ir', 'araghchi', 'netanyahu', 'CENTCOM', 'IDF']) {
      expect(handles.has(h)).toBe(true);
    }
    expect(picked.length).toBe(BREAKING_PRIORITY_DEFAULT + 2); // ۱۰ اولویت + ۲ چرخشی متمایز (JDVance, SecRubio)
  });
});
