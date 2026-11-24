/**
 * تست‌های کارت تصویری گزارش بازار خودرو — بازطراحی ۲۴ نوامبر ۲۰۲۶ (خواستهٔ کاربر):
 * «ستون چهارم رو با ستون دوم ادغام کن، یعنی اول قیمت بازار کنارش داخل پرانتز در صد
 *  تغییر نسبت به قیمت ۲۴ ساعت گذشته» + «تعداد ستونها رو بکن ۶ تا در بخش ماشین، نصف
 *  بقیه ماشینها رو در همون سه ستون بعدی قرار بده که ارتفاع عکس کمتر بشه».
 *
 *  → کارت فقط خودروست (طلا/ارز/تورم → کارت مجزای دارایی‌ها — tests/nov24-features.test.ts)؛
 *  → دو بلوک سه‌ستونی: راست = نیمهٔ ارزان‌تر، چپ = نیمهٔ گران‌تر؛
 *  → درصد ۲۴ساعته داخل پرانتز کنار قیمت بازار.
 */
import { describe, expect, test } from 'bun:test';
import { makeMarketCardSvg, renderMarketCardPng, carTableBlocks, carRowOf, officialCompactOf, blockAnchors } from '../bot/market-card';
import { tripleDateOf } from '../bot/calendar';
import { applyDeltas, type Quote } from '../bot/market';
import * as marketCardModule from '../bot/market-card';

function q(key: string, title: string, value: number, unit: Quote['unit'], changePct?: number, extra: Partial<Quote> = {}): Quote {
  return { key, title, value, unit, srcLabel: 'تست', changePct, emoji: 'x', ...extra };
}

function quotesFixture(): Quote[] {
  const raw: Quote[] = [
    q('car:peugeot207', 'پژو ۲۰۷ اتوماتیک', 2_590_000_000, 'toman', 1.2),
    q('car:j4', 'جک J4', 3_600_000_000, 'toman', 0.8, { factoryToman: 1_610_000_000, factorySrc: 'باما' }),
    q('car:tiba', 'تیبا ۲', 1_120_000_000, 'toman', -0.8),
    q('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman', 0.6),
    q('sekee', 'سکهٔ امامی', 249_590_000, 'toman', -1.1, { officialToman: 239_840_000, officialSrc: 'بانکی (بهار آزادی)' }),
    q('usd', 'دلار آزاد', 269_970, 'toman', 0.3, { officialToman: 193_633, officialSrc: 'مرکز مبادله' }),
    q('tedpix', 'شاخص کل بورس', 3_200_000, 'index', 1.5),
    q('btc', 'بیت‌کوین', 92_000, 'usd', -2.4),
    q('oil_brent', 'نفت برنت', 73.5, 'usd', 0.9),
  ];
  return applyDeltas(raw, undefined);
}

const car = (i: number, value = 1e9 + i * 1e8): Quote => ({
  key: `car:m${i}`, title: `مدل ${i}`, value, unit: 'toman', srcLabel: 'باما (نت)', emoji: '🚗',
});

// ---------- دو بلوک سه‌ستونی ----------

describe('carTableBlocks — شش‌ستونی: دو بلوک، نصف در ستون‌های بعدی (خواستهٔ ۲۴ نوامبر)', () => {
  test('مرتب‌سازی صعودی + نصف‌کردن: راست ارزان‌ترها، چپ گران‌ترها', () => {
    const unordered = [car(0, 3e9), car(1, 1e9), car(2, 2e9), car(3, 4e9), car(4, 1.5e9)];
    const { right, left, more } = carTableBlocks(unordered);
    expect(more).toBe(0);
    expect(right.length).toBe(3); // ceil(5/2)
    expect(left.length).toBe(2);
    // نیمهٔ ارزان (راست): ۱٬۱٫۵٬۲ میلیارد — نیمهٔ گران (چپ): ۳٬۴
    expect(right.map((r) => r.value)).toEqual(['۱٫۰۰۰ میلیارد', '۱٫۵۰۰ میلیارد', '۲٫۰۰۰ میلیارد']);
    expect(left.map((r) => r.value)).toEqual(['۳٫۰۰۰ میلیارد', '۴٫۰۰۰ میلیارد']);
  });

  test('فقط خودروها — طلا/ارز/بورس در کارت خودرو نمی‌آیند (کارت مجزای دارایی‌ها دارد)', () => {
    const { right, left } = carTableBlocks(quotesFixture());
    const all = [...right, ...left];
    expect(all.length).toBe(3); // فقط سه خودرو
    expect(all.every((r) => r.title.includes('پژو') || r.title.includes('جک') || r.title.includes('تیبا'))).toBe(true);
  });

  test('سقف ۴۰ خودرو + شمارش مازاد', () => {
    const { right, left, more } = carTableBlocks(Array.from({ length: 43 }, (_, i) => car(i)));
    expect(right.length + left.length).toBe(40);
    expect(more).toBe(3);
  });

  test('بدون خودرو → بلوک خالی (کارت ساخته نمی‌شود)', () => {
    const { right, left } = carTableBlocks([q('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman')]);
    expect(right.length).toBe(0);
    expect(left.length).toBe(0);
  });
});

// ---------- ردیف خودرو ----------

describe('carRowOf — قالب فشردهٔ ردیف شش‌ستونی', () => {
  test('قیمت فشرده + درصد + کارخانه + اختلاف', () => {
    const r = carRowOf(q('car:j4', 'جک J4', 3_600_000_000, 'toman', 2.5, { factoryToman: 1_610_000_000 }));
    expect(r.value).toBe('۳٫۶۰۰ میلیارد');
    expect(r.pct).toBe(2.5);
    expect(r.official).toContain('میلیارد');
    expect(r.gapAbs).toBe('۱٫۹۹۰ میلیارد');
    expect(r.gapPct).toBe('۱۲۴٪');
    expect(r.gapUp).toBe(true);
  });

  test('بی‌کارخانه/بی‌درصد → «—» صادقانه', () => {
    const r = carRowOf(q('car:tiba', 'تیبا ۲', 1_120_000_000, 'toman'));
    expect(r.official).toBeNull();
    expect(r.pct).toBeNull();
    expect(r.gapAbs).toBeNull();
    expect(r.gapUp).toBeNull();
  });

  test('officialCompactOf — کارخانه/دولتی؛ نبود → null', () => {
    expect(officialCompactOf(q('car:j4', 'جک J4', 3.6e9, 'toman', undefined, { factoryToman: 1.61e9 }))).toContain('میلیارد');
    expect(officialCompactOf(q('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman'))).toBeNull();
  });
});

// ---------- لنگرهای بلوک ----------

describe('blockAnchors — هندسهٔ شش‌ستونی', () => {
  test('لنگرهای دو بلوک جدا و درون بوم', () => {
    const W = 1080, PAD = 32, GAP = 26, BW = Math.floor((W - PAD * 2 - GAP) / 2);
    const right = blockAnchors(W - PAD);
    const left = blockAnchors(PAD + BW);
    expect(right.blockL).toBeGreaterThan(W / 2);
    expect(left.blockL).toBe(PAD);
    // ستون‌ها از راست به چپ: نام > بازار > کارخانه
    expect(right.nameR).toBeGreaterThan(right.mktR);
    expect(right.mktR).toBeGreaterThan(right.offR);
    expect(right.offR).toBeGreaterThan(right.blockL);
    // بلوک‌ها هم‌پوشان نیستند
    expect(left.nameR + 8).toBeLessThan(right.blockL);
  });
});

// ---------- SVG ----------

describe('makeMarketCardSvg — کارت خودروی شش‌ستونی (۲۴ نوامبر)', () => {
  const input = () => ({
    date: tripleDateOf('2026-11-24', 'Asia/Tehran', 'umalqura'),
    slotLabel: 'گزارش روزانه (ساعت ۱۵)',
    quotes: quotesFixture(),
  });

  test('عنوان خودرو + ستون‌های «بازار (۲۴ ساعت)» در هر دو بلوک + پانوشت درصد', () => {
    const svg = makeMarketCardSvg(input());
    expect(svg).toContain('گزارش بازار خودرو');
    expect(svg).toContain('بازار (۲۴ ساعت)');
    expect(svg).toContain('مرتب از ارزان به گران');
    expect(svg).toContain('دیروز ساعت ۱۵');
    expect(svg).not.toContain('دیروز ساعت ۳');
  });

  test('درصد داخل پرانتز کنار قیمت بازار (ادغام ستون چهارم — خواستهٔ ۲۴ نوامبر)', () => {
    const withBase = applyDeltas(quotesFixture(), undefined, {
      'car:peugeot207': 2_590_000_000 / 1.012,
      'car:tiba': 1_120_000_000 / 0.992,
    });
    const svg = makeMarketCardSvg({ ...input(), quotes: withBase });
    expect(svg).toMatch(/\(\+۱٫۲٪\)/);
    expect(svg).toMatch(/\(−۰٫۸٪\)/);
  });

  test('اختلاف کارخانه با مبلغ و درصد زیر ستون کارخانه', () => {
    const svg = makeMarketCardSvg(input());
    expect(svg).toContain('اختلاف');
    expect(svg).toContain('٪');
  });

  test('بدون خودرو / ورودی خالی → رشتهٔ خالی', () => {
    expect(makeMarketCardSvg({ ...input(), quotes: [] })).toBe('');
    expect(makeMarketCardSvg({ ...input(), quotes: [q('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman')] })).toBe('');
  });

  test('هیچ NaN/undefined در SVG نیست', () => {
    const svg = makeMarketCardSvg(input());
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
  });

  test('ارتفاع با نصف‌کردن خودروها تقریباً نصف می‌شود (هدف: عکس کوتاه‌تر)', () => {
    const hOf = (n: number) => {
      const m = makeMarketCardSvg({ ...input(), quotes: Array.from({ length: n }, (_, i) => car(i)) }).match(/height="(\d+)"/);
      return Number(m![1]);
    };
    const h24 = hOf(24);
    const h12 = hOf(12);
    // ۲۴ خودرو = ۱۲ ردیف بلوکی؛ ۱۲ خودرو = ۶ ردیف — اختلاف ~۶×ROW_H (کارت با نصف خودروها کوتاه‌تر است)
    expect(h12).toBeLessThan(h24);
    expect(h24 - h12).toBeGreaterThanOrEqual(6 * 70);
  });
});

// ---------- سازگاری صادرات ماژول ----------

describe('صادرات ماژول market-card', () => {
  test('خروجی‌های قدامی که باید حذف می‌شدند حذف شده‌اند', () => {
    expect((marketCardModule as Record<string, unknown>).marketSectionsOf).toBeUndefined();
    expect((marketCardModule as Record<string, unknown>).marketRowOf).toBeUndefined();
  });
});

// ---------- رندر واقعی ----------

describe('renderMarketCardPng', () => {
  test('رندر ۳× (کیفیت زوم — خواستهٔ ۲۵ نوامبر) و ابعاد سازگار با بله', async () => {
    const card = await renderMarketCardPng({
      date: tripleDateOf('2026-11-24', 'Asia/Tehran', 'umalqura'),
      slotLabel: 'گزارش روزانه (ساعت ۱۵)',
      quotes: quotesFixture(),
    });
    expect(card).not.toBeNull();
    expect(card!.width).toBe(3240); // ۱۰۸۰ × ۳ — کارت کوتاه = شارپ‌تر با زوم
    expect(card!.width + card!.height).toBeLessThanOrEqual(9800);
    expect(card!.png.length).toBeGreaterThan(5000);
  });

  test('بدون خودرو → null', async () => {
    const card = await renderMarketCardPng({
      date: tripleDateOf('2026-11-24', 'Asia/Tehran', 'umalqura'),
      slotLabel: 'گزارش روزانه (ساعت ۱۵)',
      quotes: [q('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman')],
    });
    expect(card).toBeNull();
  });
});
