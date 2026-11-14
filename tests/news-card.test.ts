/**
 * تست‌های کارت تصویری بستهٔ خبری (خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «کارت‌سازی بستهٔ خبری — همان زیرساخت امروزِ هواشناسی»).
 * پوشش: شکستن خط فارسی، SVG خالص (بدون NaN/undefined، RTL، ارقام فارسی)، کپشن ≤۱۰۲۴،
 * و رندر واقعی PNG با sharp — تیک کارت فقط از grounding می‌آید.
 */
import { describe, expect, test } from 'bun:test';
import { makeNewsCardSvg, buildNewsCardCaption, renderNewsCardPng, wrapFa, type NewsCardInput } from '../bot/news-card';
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
    expect(svg).toContain('رویدادهای بازه');
    expect(svg).toContain('تأییدشدهٔ دومانبعی');
    expect(svg).toContain('حذفِ بی‌خاستگاه');
    expect(svg).toContain('منبع: ایسنا');
    expect(svg).toContain('توافق آتش‌بس');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
    expect(svg).toContain('\u202B'); // RTL صریح
  });

  test('بدون آیتم → رشتهٔ خالی (هیچ کارت نیمه‌ساختگی)', () => {
    expect(makeNewsCardSvg({ ...input(), items: [] })).toBe('');
  });

  test('رویداد بیشتر از کارت → سطر «+N رویداد دیگر در پیام متنی»', () => {
    const svg = makeNewsCardSvg(input()); // total=12، آیتم=3
    expect(svg).toContain('+ ۹ رویداد دیگر در پیام متنی');
  });

  test('حذفِ بی‌خاستگاهِ صفر → تراشهٔ حذف نمی‌آید', () => {
    const svg = makeNewsCardSvg({ ...input(), dropped: 0 });
    expect(svg).not.toContain('حذفِ بی‌خاستگاه');
  });

  test('متن آیتم خیلی بلند → حداکثر دو خط با «…» (کارت هرگز سرریز نمی‌شود)', () => {
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

// ---------- کپشن ----------

describe('buildNewsCardCaption', () => {
  test('کپشن کامل زیر سقف ۱۰۲۴ بله — تاریخ، شمار، تیک', () => {
    const cap = buildNewsCardCaption(input());
    expect(cap.length).toBeLessThanOrEqual(1024);
    expect(cap).toContain('<b>بستهٔ خبری رصدبان</b>');
    expect(cap).toContain('۱۲ رویداد');
    expect(cap).toContain('۱ مورد تأییدشده');
    expect(cap).toContain('۲ مورد بی‌خاستگاه');
    expect(cap).toContain('در پیام متنی');
  });
});

// ---------- رندر واقعی (sharp + وزیرمتن) ----------

describe('renderNewsCardPng', () => {
  test('رندر واقعی PNG با ابعاد و امضای درست', async () => {
    const card = await renderNewsCardPng(input());
    expect(card).not.toBeNull();
    expect(card!.width).toBe(1080);
    expect(card!.height).toBeGreaterThan(600);
    expect(card!.png.length).toBeGreaterThan(50_000);
    const sig = Array.from(card!.png.slice(0, 8)).join(',');
    expect(sig).toBe('137,80,78,71,13,10,26,10');
  }, 30_000);

  test('بدون آیتم → null (هیچ کارت ساختگی)', async () => {
    expect(await renderNewsCardPng({ ...input(), items: [] })).toBeNull();
  });
});
