/**
 * تست‌های کارت تصویری گزارش بازار (خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «گزارش بازار — همان زیرساخت امروزِ هواشناسی»).
 * بازطراحی ۲۰ نوامبر ۲۰۲۶ (خواستهٔ کاربر): «کل آیتمها به یه شکل — ستون اول اسم،
 * ستون دوم قیمت بازار، ستون سوم قیمت کارخانه یا دولتی اگر هست، ستون چهارم درصد
 * تغییر نسبت به روز قبل» — جدول یکدست ۴ستونی برای همهٔ اقلام؛ بدون سربرگ‌های
 * آماری دیباگ و بدون کپشن زیر عکس.
 */
import { describe, expect, test } from 'bun:test';
import { makeMarketCardSvg, renderMarketCardPng, marketSectionsOf, officialOf } from '../bot/market-card';
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

// ---------- بخش‌بندی ----------

describe('marketSectionsOf — جدول یکدست ۴ستونی (۲۰ نوامبر)', () => {
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
    expect(gold.rows.length).toBe(2);
    const fx = sections.find((s) => s.title.includes('ارز'))!;
    expect(fx.rows.length).toBe(4);
  });

  test('همهٔ ردیف‌ها هم‌شکل‌اند: نام + بازار + کارخانه/دولتی + درصد — «—» برای بی‌قیمت رسمی', () => {
    const { sections } = marketSectionsOf(quotesFixture());
    for (const sec of sections) {
      for (const r of sec.rows) {
        expect(typeof r.title).toBe('string');
        expect(r.value.length).toBeGreaterThan(0);
        expect(r.official === null || r.official.length > 0).toBe(true);
        expect(r.pct === null || typeof r.pct === 'number').toBe(true);
      }
    }
    const cars = sections.find((s) => s.title.includes('خودرو'))!;
    expect(cars.rows[0]!.official).toBeNull(); // پژو ۲۰۷ — قیمت رسمی ندارد → «—»
    expect(cars.rows[1]!.official).toContain('میلیارد تومان'); // J4 کارخانه باما
    const gold = sections.find((s) => s.title.includes('طلا'))!;
    expect(gold.rows.find((r) => r.title.includes('امامی'))!.official).toContain('تومان'); // بهار آزادی بانکی
    const fx = sections.find((s) => s.title.includes('ارز'))!;
    expect(fx.rows.find((r) => r.title.includes('دلار'))!.official).toContain('تومان'); // مرکز مبادله
    expect(fx.rows.find((r) => r.title.includes('بورس'))!.official).toBeNull();
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

  test('officialOf — کارخانهٔ خودرو و قیمت دولتی ارز/سکه', () => {
    expect(officialOf(q('car:j4', 'جک J4', 3.6e9, 'toman', undefined, { factoryToman: 1.61e9 }))).toContain('میلیارد تومان');
    expect(officialOf(q('usd', 'دلار', 269_970, 'toman', undefined, { officialToman: 193_633 }))).toContain('تومان');
    expect(officialOf(q('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman'))).toBeNull();
  });
});

// ---------- SVG خالص ----------

describe('makeMarketCardSvg — جدول یکدست بدون سربرگ دیباگ', () => {
  const input = () => ({
    date: tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura'),
    slotLabel: 'میان‌روز',
    quotes: quotesFixture(),
  });

  test('SVG کامل — عنوان، سطر ستون‌ها، همهٔ اقلام، بدون NaN/undefined، RTL', () => {
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

  test('سطر عنوان ستون‌ها: نام | قیمت بازار | کارخانه / دولتی | تغییر روز', () => {
    const svg = makeMarketCardSvg(input());
    expect(svg).toContain('قیمت بازار');
    expect(svg).toContain('کارخانه / دولتی');
    expect(svg).toContain('تغییر روز');
  });

  test('سربرگ‌های آماری دیباگ حذف شدند (خواستهٔ ۲۰ نوامبر: «عناوین … برای دیباگ برنامست … حذف کن»)', () => {
    const svg = makeMarketCardSvg(input());
    expect(svg).not.toContain('صعودی');
    expect(svg).not.toContain('نزولی');
    expect(svg).not.toContain('قلم قیمت‌گذاری‌شده');
    expect(svg).not.toContain('بدون تغییر / بی‌داده');
  });

  test('همهٔ ردیف‌ها هم‌قدند — خودروهای VIP هم تک‌خطی‌اند (رفع «سه ماشین اول یه شکل دیگه»)', () => {
    const svg = makeMarketCardSvg(input());
    // ارتفاع ثابت ردیف: هر rect ردیف height="68" (ROW_H-12) دارد — نه ۱۲۰ قدیمی VIP
    const rowRects = svg.match(/height="68" rx="12"/g) || [];
    expect(rowRects.length).toBe(9); // ۹ قلم فیکسچر
    expect(svg).not.toContain('اختلاف'); // ستون اختلاف حذف شد — ستون چهارم درصد تغییر روز است
  });

  test('قیمت‌های رسمی در ستون سوم: کارخانهٔ J4، مرکز مبادلهٔ دلار، بانکی سکه', () => {
    const svg = makeMarketCardSvg(input());
    expect(svg).toContain('۱٫۶۱۰ میلیارد تومان'); // J4 کارخانه
    expect(svg).toContain('۱۹۳٬۶۳۳ تومان'); // دلار مرکز مبادله
    expect(svg).toContain('۲۳۹٬۸۴۰٬۰۰۰ تومان'); // سکه بانکی
  });

  test('فلش صعود/نزول برداری رسم می‌شود (بدون فونت ایموجی)', () => {
    const svg = makeMarketCardSvg(input());
    expect((svg.match(/<path d="M /g) || []).length).toBeGreaterThanOrEqual(6);
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

// ---------- کپشن حذف‌شده (خواستهٔ کاربر ۲۰ نوامبر: «زیر عکس به شکل متنی میاد حذف کن») ----------

describe('کپشن حذف‌شده — کارت بازار بدون کپشن ارسال می‌شود', () => {
  test('سازندهٔ کپشن دیگر وجود ندارد', () => {
    const mod = marketCardModule as unknown as Record<string, unknown>;
    expect(mod.buildMarketCardCaption).toBeUndefined();
  });
});

// ---------- رندر واقعی ----------

describe('renderMarketCardPng', () => {
  test('رندر واقعی PNG با ابعاد و امضای درست', async () => {
    const card = await renderMarketCardPng({
      date: tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura'),
      slotLabel: 'میان‌روز',
      quotes: quotesFixture(),
    });
    expect(card).not.toBeNull();
    expect(card!.width).toBe(1080);
    expect(card!.height).toBeGreaterThan(700);
    expect(card!.png.length).toBeGreaterThan(50_000);
    const sig = Array.from(card!.png.slice(0, 8)).join(',');
    expect(sig).toBe('137,80,78,71,13,10,26,10');
  }, 30_000);

  test('بدون قلم → null (هیچ عدد ساختگی در کارت)', async () => {
    expect(
      await renderMarketCardPng({ date: tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura'), slotLabel: 'شب', quotes: [] })
    ).toBeNull();
  });
});
