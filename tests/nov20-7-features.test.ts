/**
 * خواستهٔ کاربر ۲۰ نوامبر هفتم (رصدبازار):
 * «ستون سوم یا بدون قیمت بود یا نادرست بود، میخوام ستون سوم رو با دقت همراه با
 *  درصد و مبلغ اختلاف کنارش بروز کنی — ستون چهارم هم بشه تغییرات نسبت به روز قبل»
 *
 * پوشش: مبلغ اختلاف در applyDeltas • officialDeltaOf • compactNum/compactDelta •
 * پیام متنی با اختلاف • ترمیم priceSnapAt • حذف تکرار SR3 (وب بعد از VIP).
 */
import { describe, expect, test } from 'bun:test';
import {
  applyDeltas,
  carFactoryDelta,
  compactDelta,
  compactNum,
  officialDeltaOf,
  repairSnapshotAt,
  formatMarketMessage,
  CAR_VIP,
  CAR_WEB_SOURCES,
  normalizeCarModel,
  type Quote,
} from '../bot/market';
import { marketRowOf, makeMarketCardSvg } from '../bot/market-card';
import { tripleDateOf } from '../bot/calendar';

function q(key: string, title: string, value: number, unit: Quote['unit'], extra: Partial<Quote> = {}): Quote {
  return { key, title, value, unit, srcLabel: 'تست', emoji: 'x', ...extra };
}

describe('applyDeltas — مبلغ اختلاف کنار درصد (خواستهٔ هفتم)', () => {
  test('پایهٔ دیروز ساعت ۳ → changeAbs = ارزش امروز منهای دیروز', () => {
    const [out] = applyDeltas([q('usd', 'دلار', 269_970, 'toman')], undefined, { usd: 263_970 });
    expect(out.changePct).toBeCloseTo(2.27, 1);
    expect(out.changeAbs).toBe(6_000);
    expect(out.changeSrc).toBe('prev');
  });

  test('نزولی — مبلغ منفی هم‌جهت با درصد', () => {
    const [out] = applyDeltas([q('btc', 'بیت‌کوین', 92_000, 'usd')], undefined, { btc: 94_000 });
    expect(out.changePct).toBeLessThan(0);
    expect(out.changeAbs).toBe(-2_000);
  });

  test('فقط آخرین گزارش موجود → مبلغ از همان پایه', () => {
    const [out] = applyDeltas([q('geram18', 'طلای ۱۸', 92_500_000, 'toman')], { geram18: 92_000_000 });
    expect(out.changeAbs).toBe(500_000);
  });

  test('پایهٔ عددی نیست (تغییر روز منبع) → مبلغ ساختگی نمی‌شود', () => {
    const [out] = applyDeltas([q('usd', 'دلار', 269_970, 'toman', { changePct: 1.4 })]);
    expect(out.changePct).toBe(1.4);
    expect(out.changeAbs).toBeUndefined();
    expect(out.changeSrc).toBe('source');
  });

  test('هیچ پایه‌ای → درصد و مبلغ هر دو تهی («—» صادقانه)', () => {
    const [out] = applyDeltas([q('car:x', 'مدل', 1_500_000_000, 'toman')]);
    expect(out.changePct).toBeUndefined();
    expect(out.changeAbs).toBeUndefined();
    expect(out.changeSrc).toBe('none');
  });
});

describe('officialDeltaOf — اختلاف بازار از قیمت رسمی، مبلغ و درصد با هم', () => {
  test('دلار: بازار ۲۶۹٬۹۷۰ / مرکز مبادله ۱۹۳٬۶۳۳ → ۷۶٬۳۳۷ (۳۹٫۴۲٪)', () => {
    const g = officialDeltaOf(q('usd', 'دلار', 269_970, 'toman', { officialToman: 193_633 }));
    expect(g).not.toBeNull();
    expect(g!.diff).toBe(76_337);
    expect(g!.pct).toBeCloseTo(39.42, 1);
  });

  test('سکه امامی: بازار بالاتر از بانکی → مثبت', () => {
    const g = officialDeltaOf(q('sekee', 'سکه امامی', 249_590_000, 'toman', { officialToman: 239_840_000 }));
    expect(g!.diff).toBe(9_750_000);
  });

  test('کارخانهٔ خودرو (factoryToman) هم پوشش داده می‌شود', () => {
    const g = officialDeltaOf(q('car:j4', 'جک J4', 3_600_000_000, 'toman', { factoryToman: 1_610_000_000 }));
    expect(g!.diff).toBe(1_990_000_000);
    expect(carFactoryDelta(3_600_000_000, 1_610_000_000)!.pct).toBeCloseTo(123.6, 1);
  });

  test('بازار پایین‌تر از رسمی → اختلاف منفی (سبز)', () => {
    const g = officialDeltaOf(q('usd', 'دلار', 150_000, 'toman', { officialToman: 193_633 }));
    expect(g!.diff).toBe(-43_633);
    expect(g!.pct).toBeLessThan(0);
  });

  test('بی‌قیمت رسمی → null («—»، هیچ عدد ساختگی)', () => {
    expect(officialDeltaOf(q('geram18', 'طلای ۱۸', 92_500_000, 'toman'))).toBeNull();
    expect(officialDeltaOf(q('usd', 'دلار', 269_970, 'toman', { officialToman: 0 }))).toBeNull();
  });
});

describe('compactNum/compactDelta — مبلغ فشردهٔ خوانا با واژهٔ مقیاس', () => {
  test('تومان: میلیارد / میلیون / گروه‌بندی ساده', () => {
    expect(compactNum(1_930_000_000, 'toman')).toBe('۱٫۹۳۰ میلیارد');
    expect(compactNum(9_750_000, 'toman')).toBe('۹٫۷۵۰ میلیون');
    expect(compactNum(120_000_000, 'toman')).toBe('۱۲۰ میلیون');
    expect(compactNum(76_337, 'toman')).toBe('۷۶٬۳۳۷');
    expect(compactDelta(1_930_000_000, 'toman')).toBe('۱٫۹۳۰ میلیارد تومان');
    expect(compactDelta(9_750_000, 'toman')).toBe('۹٫۷۵۰ میلیون تومان');
  });

  test('دلار و شاخص', () => {
    expect(compactDelta(-1_597, 'usd')).toBe('۱٬۵۹۷ دلار'); // قدرمطلق — جهت با فلش/رنگ
    expect(compactDelta(1.33, 'usd')).toBe('۱٫۳۳ دلار');
    expect(compactDelta(12_500, 'index')).toBe('۱۲٬۵۰۰');
  });
});

describe('marketRowOf و کارت — ستون‌های سوم/چهارم تازه', () => {
  const usd = applyDeltas(
    [q('usd', 'دلار آزاد', 269_970, 'toman', { officialToman: 193_633, officialSrc: 'مرکز مبادله' })],
    undefined,
    { usd: 263_970 },
  )[0]!;
  const bare = applyDeltas([q('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman')])[0]!;

  test('ردیف دلار: رسمی + اختلاف + مبلغ تغییر نسبت به پایه', () => {
    const r = marketRowOf(usd);
    expect(r.official).toBe('۱۹۳٬۶۳۳ تومان');
    expect(r.gapAbs).toBe('۷۶٬۳۳۷');
    expect(r.gapPct).toBe('۳۹٫۴٪');
    expect(r.gapUp).toBe(true);
    expect(r.chgAbs).toBe('۶٬۰۰۰ تومان');
  });

  test('ردیف بی‌رسمی/بی‌پایه: «—» صادقانه، هیچ ساختگی', () => {
    const r = marketRowOf(bare);
    expect(r.official).toBeNull();
    expect(r.gapAbs).toBeNull();
    expect(r.gapPct).toBeNull();
    expect(r.gapUp).toBeNull();
    expect(r.chgAbs).toBeNull();
  });

  test('SVG — سربرگ تازهٔ ستون چهارم و زیرخط اختلاف ستون سوم', () => {
    const svg = makeMarketCardSvg({
      date: tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura'),
      slotLabel: 'بامداد (ساعت ۳)',
      quotes: [usd, bare],
    });
    expect(svg).toContain('تغییر نسبت به روز قبل');
    expect(svg).toContain('اختلاف ۷۶٬۳۳۷ (۳۹٫۴٪)');
    expect(svg).toContain('۶٬۰۰۰ تومان');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
  });

  test('جهت اختلاف در رنگ می‌آید — بازار زیر رسمی سبز، بالای رسمی کهربایی', () => {
    const below = marketRowOf(
      applyDeltas([q('usd', 'دلار', 150_000, 'toman', { officialToman: 193_633 })])[0]!,
    );
    expect(below.gapUp).toBe(false);
    const svgBelow = makeMarketCardSvg({
      date: tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura'),
      slotLabel: 'بامداد (ساعت ۳)',
      quotes: [q('usd', 'دلار', 150_000, 'toman', { officialToman: 193_633 })],
    });
    expect(svgBelow).toContain('#4ade80'); // سبز — ارزان‌تر از رسمی
  });
});

describe('پیام متنی — اختلاف مبلغ/درصد کنار قیمت رسمی (خواستهٔ هفتم)', () => {
  test('دلار با مرکز مبادله و اختلاف؛ بی‌رسمی بدون اختلاف', () => {
    const msg = formatMarketMessage(
      [
        q('usd', 'دلار', 269_970, 'toman', { officialToman: 193_633 }),
        q('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman'),
      ],
      undefined,
      { usd: 263_970, geram18: 92_000_000 },
    );
    expect(msg).toContain('(▲۲٫۳٪ | ۶٬۰۰۰ تومان)');
    expect(msg).toContain('مرکز مبادله: ۱۹۳٬۶۳۳ تومان (اختلاف ۷۶٬۳۳۷ تومان / ۳۹٫۴٪)');
    expect(msg).toContain('طلای ۱۸ عیار: ۹۲٬۵۰۰٬۰۰۰ تومان (▲۰٫۵٪ | ۵۰۰٬۰۰۰ تومان)');
    expect(msg).not.toContain('اختلاف ۰');
  });
});

describe('ترمیم priceSnapAt — ستون چهارم خالی نماند', () => {
  test('snapshot بی‌مهر + کلید اسلات تهران → مهر واقعی آخرین گزارش', () => {
    const iso = repairSnapshotAt({ usd: 269_970 }, undefined, '2026-11-20T12:30');
    expect(iso).toBe('2026-11-20T09:00:00.000Z'); // ۱۲:۳۰ تهران = ۰۹:۰۰ UTC
  });

  test('مهدار یا بی‌snapshot یا کلید force → هیچ مهر ساختگی', () => {
    expect(repairSnapshotAt({ usd: 1 }, '2026-11-20T09:00:00.000Z', '2026-11-20T12:30')).toBeUndefined();
    expect(repairSnapshotAt(undefined, undefined, '2026-11-20T12:30')).toBeUndefined();
    expect(repairSnapshotAt({ usd: 1 }, undefined, 'force-price-2026-11-20T12:30')).toBeUndefined();
    expect(repairSnapshotAt({ usd: 1 }, undefined, 'garbage')).toBeUndefined();
  });

  test('مهر ترمیم‌شده از گارد تازگی (≤۳۶ ساعت) می‌گذرد', async () => {
    const { snapshotBaseOf, SNAPSHOT_STALE_MS } = await import('../bot/market');
    const iso = repairSnapshotAt({ usd: 269_970 }, undefined, '2026-11-20T12:30')!;
    const now = Date.parse('2026-11-21T00:00:00.000Z'); // فردا صبح تهران
    expect(snapshotBaseOf({ usd: 269_970 }, iso, { usd: 263_970 }, now, SNAPSHOT_STALE_MS).fresh).toBe(true);
  });
});

describe('بدون تکرار ردیف خودرو — پشتیبان وب مدلِ VIP را دوباره نمی‌آورد', () => {
  test('هر مدل پشتیبان وب که در سه‌گانهٔ VIP هست در پیکربندی بی‌معناست — SR3 فقط یک‌بار', () => {
    const vipModels = CAR_VIP.map((v) => normalizeCarModel(v.match));
    for (const w of CAR_WEB_SOURCES) {
      expect(vipModels).not.toContain(normalizeCarModel(w.match));
    }
  });
});
