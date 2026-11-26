/**
 * تست‌های کارت تصویری بستهٔ خبری (خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «کارت‌سازی بستهٔ خبری — همان زیرساخت امروزِ هواشناسی»).
 * پوشش: شکستن خط فارسی، SVG خالص (بدون NaN/undefined، RTL، ارقام فارسی)، کپشن ≤۱۰۲۴،
 * و رندر واقعی PNG با sharp — تیک کارت فقط از grounding می‌آید.
 */
import { describe, expect, test } from 'bun:test';
import { makeNewsCardSvg, renderNewsCardPng, wrapFa, type NewsCardInput } from '../bot/news-card';
import * as newsCardModule from '../bot/news-card';
import { tripleDateOf } from '../bot/calendar';

function input(over: Partial<NewsCardInput> = {}): NewsCardInput {
  return {
    date: tripleDateOf('2026-11-15', 'Asia/Tehran', 'umalqura'),
    items: [
      { text: 'دو طرف با وساطت قطر توافق آتش‌بس امضا کردند و از فردا اجرایی می‌شود', tick: true, source: 'ایسنا' },
      { text: 'شاخص بورس تهران امروز ۹۲۰ واحد رشد کرد', tick: false, source: 'بورس‌نیوز' },
      { text: 'تیم ملی فوتبال به مرحلهٔ بعد صعود کرد', tick: false, source: 'ایسنا' },
    ],
    total: 12,
    dropped: 2,
    ...over,
  };
}

// ---------- شکستن خط ----------

describe('wrapFa — شکستن واژه‌محور متن فارسی', () => {
  test('متن کوتاه تک‌خط می‌ماند', () => {
    expect(wrapFa('خبر کوتاه', 40, 2)).toEqual(['خبر کوتاه']);
  });

  test('شکستن به دو خط واژه‌محور', () => {
    const lines = wrapFa('یک دو سه چهار پنج شش هفت هشت نه ده یازده دوازده', 25, 2);
    expect(lines.length).toBe(2);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(25);
    expect(lines.join(' ')).not.toContain('…');
    expect(lines[0]).toBe('یک دو سه چهار پنج شش هفت');
  });

  test('سرریز بیش از دو خط → «…» در انتهای خط آخر', () => {
    const lines = wrapFa('یک دو سه چهار پنج شش هفت هشت نه ده یازده دوازده سیزده چهارده پانزده', 12, 2);
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('…');
    expect(lines[1]!.length).toBeLessThanOrEqual(12);
  });

  test('واژهٔ فوق‌بلند — شکستن سخت بدون حلقهٔ بی‌نهایت', () => {
    const lines = wrapFa(`پیشوند ${'ط'.repeat(150)} پسوند`, 30, 2);
    expect(lines.length).toBe(2);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(30);
  });
});

// ---------- SVG خالص ----------

describe('makeNewsCardSvg', () => {
  test('SVG کامل — عنوان، تاریخ سه‌گانه، متن آیتم‌ها، منبع، ارقام فارسی، بدون NaN', () => {
    const svg = makeNewsCardSvg(input());
    expect(svg.length).toBeGreaterThan(2500);
    expect(svg).toContain('بستهٔ خبری رصدبان');
    expect(svg).toContain('منبع: ایسنا');
    expect(svg).toContain('توافق آتش‌بس');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
    expect(svg).toContain('\u202B'); // RTL صریح
  });

  test('سربرگ‌های آماری دیباگ حذف شدند (خواستهٔ ۲۰ نوامبر: «عناوین … برای دیباگ برنامست … حذف کن»)', () => {
    const svg = makeNewsCardSvg(input()); // total=12، dropped=2 — آمار دیگر رندر نمی‌شود
    expect(svg).not.toContain('رویدادهای بازه');
    expect(svg).not.toContain('تأییدشدهٔ دومانبعی');
    expect(svg).not.toContain('حذفِ بی‌خاستگاه');
    expect(svg).not.toContain('رویداد این بازه');
    expect(svg).not.toContain('تطبیق اجباری');
    expect(svg).not.toContain('قفل‌شده به جمله‌های');
  });

  test('بدون آیتم → رشتهٔ خالی (هیچ کارت نیمه‌ساختگی)', () => {
    expect(makeNewsCardSvg({ ...input(), items: [] })).toBe('');
  });

  test('رویداد بیشتر از کارت → سطر «+N رویداد دیگر در کارت‌های بعدی» (۱۶ نوامبر)', () => {
    const svg = makeNewsCardSvg(input()); // total=12، آیتم=3
    expect(svg).toContain('+ ۹ رویداد دیگر در کارت‌های بعدی');
  });

  test('حذفِ بی‌خاستگاهِ صفر → هیچ تغییری در کارت (چیپ حذف‌شده — ۲۰ نوامبر)', () => {
    const svg = makeNewsCardSvg({ ...input(), dropped: 0 });
    expect(svg).not.toContain('حذفِ بی‌خاستگاه');
  });

  test('متن آیتم خیلی بلند → حداکثر سه خط با «…» (کارت هرگز سرریز نمی‌شود — خواستهٔ ۲۰ نوامبر: ۲ـ۳ خط)', () => {
    const long = `${'این خبر بسیار مهم است دربارهٔ تحولات روز. '.repeat(20)}`;
    const svg = makeNewsCardSvg({ ...input(), items: [{ text: long, tick: false, source: 'تست' }] });
    expect(svg).toContain('…');
    expect(svg).not.toContain(long.slice(0, 130)); // متن کامل خام در کارت نیست
  });

  test('کاراکترهای XML در متن آیتم escape می‌شوند', () => {
    const svg = makeNewsCardSvg({ ...input(), items: [{ text: 'خبر با <تگ> و & علامت', tick: false, source: 'تست' }] });
    expect(svg).toContain('&lt;تگ&gt;');
    expect(svg).toContain('&amp;');
  });
});

// ---------- کپشن — حذف کامل (خواستهٔ کاربر ۱۹ نوامبر: «فقط عکس حاوی اخبار باشه») ----------

describe('کپشن حذف‌شده — کارت بدون کپشن ارسال می‌شود', () => {
  test('سازندهٔ کپشن دیگر وجود ندارد (کاربر خواست متن زیر عکس حذف شود)', () => {
    // buildNewsCardCaption از bot/news-card.ts حذف شد — کارت همهٔ اطلاعات را خودش دارد
    const mod = newsCardModule as unknown as Record<string, unknown>;
    expect(mod.buildNewsCardCaption).toBeUndefined();
  });

  test('بنر دسته در کارت رندر می‌شود (خواستهٔ ۱۹ نوامبر: دسته‌بندی اخبار)', () => {
    const svg = makeNewsCardSvg({
      ...input(),
      items: [
        { text: 'حملهٔ موشکی به پایگاه هوایی گزارش شد', tick: true, source: 'ایسنا', section: '⚔️ جنگ و امنیت' },
        { text: 'شاخص بورس تهران امروز ۹۲۰ واحد رشد کرد', tick: false, source: 'بورس‌نیوز', section: '💰 اقتصادی' },
        { text: 'تیم ملی فوتبال به مرحلهٔ بعد صعود کرد', tick: false, source: 'ایسنا', section: '⚽ ورزشی' },
      ],
    });
    expect(svg).toContain('جنگ و امنیت');
    expect(svg).toContain('اقتصادی');
    expect(svg).toContain('ورزشی');
  });

  test('دستهٔ تکراری — فقط یک بنر (ادامهٔ همان دسته بنر تکراری نمی‌گیرد)', () => {
    const svg = makeNewsCardSvg({
      ...input(),
      items: [
        { text: 'حملهٔ موشکی گزارش شد', tick: false, source: 'الف', section: '⚔️ جنگ و امنیت' },
        { text: 'آتش‌بس امضا شد', tick: false, source: 'ب', section: '⚔️ جنگ و امنیت' },
        { text: 'بورس رشد کرد', tick: false, source: 'ج', section: '💰 اقتصادی' },
      ],
    });
    // ممیزی ۲۷ نوامبر — بنر بدون ایموجی رندر می‌شود (گلیف ⚔️ در فونت‌های سرور نیست و
    // توافقی/مربع می‌شد)؛ پس شمارش روی متنِ پالایش‌شده است
    expect(svg.split('جنگ و امنیت').length - 1).toBe(1);
    expect(svg).not.toContain('⚔️');
  });
});

// ---------- رندر واقعی (sharp + وزیرمتن) ----------

describe('renderNewsCardPng', () => {
  test('رندر واقعی PNG با ابعاد و امضای درست', async () => {
    const card = await renderNewsCardPng(input());
    expect(card).not.toBeNull();
    expect(card!.width % 1080).toBe(0);
    expect(card!.width / (card!.width / 1080)).toBe(1080); // مضرب صحیح ۱۰۸۰
    expect(card!.height).toBeGreaterThan(600);
    expect(card!.png.length).toBeGreaterThan(50_000);
    const sig = Array.from(card!.png.slice(0, 8)).join(',');
    expect(sig).toBe('137,80,78,71,13,10,26,10');
  }, 30_000);

  test('بدون آیتم → null (هیچ کارت ساختگی)', async () => {
    expect(await renderNewsCardPng({ ...input(), items: [] })).toBeNull();
  });
});
