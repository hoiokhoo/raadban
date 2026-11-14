/**
 * تست‌های کارت تصویری گزارش بازار (خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «گزارش بازار — همان زیرساخت امروزِ هواشناسی قابل استفادهٔ مجدد است»).
 * پوشش: بخش‌بندی اقلام، SVG خالص (فلش صعود/نزول برداری، بدون NaN)، کپشن ≤۱۰۲۴، رندر واقعی.
 */
import { describe, expect, test } from 'bun:test';
import { makeMarketCardSvg, buildMarketCardCaption, renderMarketCardPng, marketSectionsOf } from '../bot/market-card';
import { tripleDateOf } from '../bot/calendar';
import { applyDeltas, type Quote } from '../bot/market';

function q(key: string, title: string, value: number, unit: Quote['unit'], changePct?: number): Quote {
  return { key, title, value, unit, srcLabel: 'تست', changePct, emoji: 'x' };
}

function quotesFixture(): Quote[] {
  const raw: Quote[] = [
    q('car:peugeot207', 'پژو ۲۰۷ اتوماتیک', 2_590_000_000, 'toman', 1.2),
    q('car:tiba', 'تیبا ۲', 1_120_000_000, 'toman', -0.8),
    q('car:qendre', 'قندر شاسی‌بلند', 1_990_000_000, 'toman'), // بدون تغییر
    q('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman', 0.6),
    q('geram24', 'طلای ۲۴ عیار', 123_300_000, 'toman', 0.4),
    q('sekee', 'سکهٔ امامی', 125_000_000, 'toman', -1.1),
    q('usd', 'دلار آزاد', 254_000, 'toman', 0.3),
    q('tedpix', 'شاخص کل بورس', 3_200_000, 'index', 1.5),
    q('btc', 'بیت‌کوین', 92_000, 'usd', -2.4),
    q('oil_brent', 'نفت برنت', 73.5, 'usd', 0.9),
  ];
  return applyDeltas(raw, undefined);
}

// ---------- بخش‌بندی ----------

describe('marketSectionsOf — همان گروه‌بندی پیام متنی', () => {
  test('سه بخش: خودرو / طلا و سکه / ارز، بورس و کریپتو', () => {
    const { sections, moreCars } = marketSectionsOf(quotesFixture());
    expect(moreCars).toBe(0);
    const titles = sections.map((s) => s.title);
    expect(titles).toContain('خودرو — بازار آزاد');
    expect(titles).toContain('طلا و سکه');
    expect(titles).toContain('ارز، بورس و کریپتو');
    const cars = sections.find((s) => s.title.includes('خودرو'))!;
    expect(cars.rows.length).toBe(3);
    const gold = sections.find((s) => s.title.includes('طلا'))!;
    expect(gold.rows.length).toBe(3);
    const fx = sections.find((s) => s.title.includes('ارز'))!;
    expect(fx.rows.length).toBe(4);
  });

  test('سقف ۱۰ خودرو — مازاد در «moreCars»', () => {
    const many: Quote[] = [];
    for (let i = 0; i < 14; i++) many.push(q(`car:m${i}`, `مدل ${i}`, 1_000_000_000 + i * 1000, 'toman'));
    const { sections, moreCars } = marketSectionsOf(many);
    expect(sections.find((s) => s.title.includes('خودرو'))!.rows.length).toBe(10);
    expect(moreCars).toBe(4);
  });

  test('فقط طلا — بخش خودرو نمی‌آید (هیچ بخش خالی)', () => {
    const { sections } = marketSectionsOf([q('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman')]);
    expect(sections.length).toBe(1);
    expect(sections[0]!.title).toContain('طلا');
  });

  test('مقدار و درصد تغییر همان فرمت پیام متنی', () => {
    const { sections } = marketSectionsOf(quotesFixture());
    const usd = sections.find((s) => s.title.includes('ارز'))!.rows.find((r) => r.title.includes('دلار'))!;
    expect(usd.value).toContain('تومان'); // واحد toman → «... تومان»
    expect(usd.pct).toBe(0.3);
  });
});

// ---------- SVG خالص ----------

describe('makeMarketCardSvg', () => {
  const input = () => ({
    date: tripleDateOf('2026-11-15', 'Asia/Tehran', 'umalqura'),
    slotLabel: 'میان‌روز',
    quotes: quotesFixture(),
  });

  test('SVG کامل — عنوان، بخش‌ها، اقلام، بدون NaN/undefined، RTL', () => {
    const svg = makeMarketCardSvg(input());
    expect(svg.length).toBeGreaterThan(2500);
    expect(svg).toContain('گزارش بازار رصدبان');
    expect(svg).toContain('خودرو — بازار آزاد');
    expect(svg).toContain('پژو ۲۰۷ اتوماتیک');
    expect(svg).toContain('دلار آزاد');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
    expect(svg).toContain('\u202B');
  });

  test('فلش صعود/نزول برداری رسم می‌شود (بدون فونت ایموجی)', () => {
    const svg = makeMarketCardSvg(input());
    expect((svg.match(/<path d="M /g) || []).length).toBeGreaterThanOrEqual(8); // فلش‌های صعودی/نزولی
    expect(svg).toContain('#4ade80'); // صعودی
    expect(svg).toContain('#f87171'); // نزولی
  });

  test('بدون قلم → رشتهٔ خالی', () => {
    expect(makeMarketCardSvg({ ...input(), quotes: [] })).toBe('');
  });

  test('عنوان خیلی بلند بریده می‌شود با «…»', () => {
    const svg = makeMarketCardSvg({
      ...input(),
      quotes: [q('car:x', `${'مدل'.repeat(25)} خودرو`, 1_500_000_000, 'toman')],
    });
    expect(svg).toContain('…');
  });
});

// ---------- کپشن ----------

describe('buildMarketCardCaption', () => {
  test('کپشن کامل زیر سقف ۱۰۲۴ — تاریخ، شمار صعودی/نزولی، دلار', () => {
    const cap = buildMarketCardCaption({ date: tripleDateOf('2026-11-15', 'Asia/Tehran', 'umalqura'), slotLabel: 'شب', quotes: quotesFixture() });
    expect(cap.length).toBeLessThanOrEqual(1024);
    expect(cap).toContain('<b>گزارش بازار رصدبان</b>');
    expect(cap).toContain('دلار آزاد');
    expect(cap).toContain('صعودی');
    expect(cap).toContain('گزارش قبلی');
  });
});

// ---------- رندر واقعی ----------

describe('renderMarketCardPng', () => {
  test('رندر واقعی PNG با ابعاد و امضای درست', async () => {
    const card = await renderMarketCardPng({
      date: tripleDateOf('2026-11-15', 'Asia/Tehran', 'umalqura'),
      slotLabel: 'میان‌روز',
      quotes: quotesFixture(),
    });
    expect(card).not.toBeNull();
    expect(card!.width).toBe(1080);
    expect(card!.height).toBeGreaterThan(800);
    expect(card!.png.length).toBeGreaterThan(50_000);
    const sig = Array.from(card!.png.slice(0, 8)).join(',');
    expect(sig).toBe('137,80,78,71,13,10,26,10');
  }, 30_000);

  test('بدون قلم → null (هیچ عدد ساختگی در کارت)', async () => {
    expect(
      await renderMarketCardPng({ date: tripleDateOf('2026-11-15', 'Asia/Tehran', 'umalqura'), slotLabel: 'شب', quotes: [] })
    ).toBeNull();
  });
});
