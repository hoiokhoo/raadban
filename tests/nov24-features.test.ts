/**
 * تست‌های خواسته‌های ۲۴ نوامبر ۲۰۲۶:
 *  ۱) کارت مجزای «دارایی‌ها و تورم» + تورم نقطه‌به‌نقطهٔ سالانه/ماهانهٔ بانک مرکزی + مسکن تهران؛
 *  ۲) غنی‌سازی هوشمند اطلاعیهٔ فروش خودرو با AI (فقط از فهرست‌های راستی‌آزمایی‌شده)؛
 *  ۳) تراکم رندر ۲× (کیفیت زوم) با احترام به سقف ابعاد بله؛
 *  ۴) نقشهٔ ایران: مرز استان‌ها + چینش برچسب مراکز استان بدون هم‌پوشانی؛
 *  ۵) گیف رادار RainViewer (ریاضیات کاشی/گزینش فریم) و گیف پیش‌بینی ۲۴ساعته (پارس ساعتی).
 */
import { describe, expect, test } from 'bun:test';
import { renderDensityFor, renderGifDensityFor, DENSITY_2X, DENSITY_15X, DENSITY_1X, DENSITY_3X } from '../bot/render-scale';
import {
  assetsSectionsOf, makeAssetsCardSvg, renderAssetsCardPng, assetsRowOf,
} from '../bot/assets-card';
import {
  parseTeInflationYoy, parseTeInflationMom, parseKilidTehranPrice, gregMonthToShamsiFa, formatAssetsMessage, type Quote,
} from '../bot/market';
import { tripleDateOf } from '../bot/calendar';
import {
  buildSaleAiUserPrompt, parseSaleAiDraft, resolveSaleAiDraft, priceGroundedInText, saleAiPortalLabels, saleAiModelLabels,
} from '../bot/sale-announcement';
import {
  MAP_W, MAP_H, mercProject, placeCapitalLabels, PROVINCE_CAPS, provinceFillsSvg, provinceBordersSvg, capitalsSvg, estLabelWidth, pointInPolygon,
} from '../bot/iran-map-base';
import { pickRadarFrames, lonToTileX, latToTileY, iranTileRange, radarTileUrl, frameClockFa, type RvFrame } from '../bot/radar-gif';
import { buildOpenMeteoHourlyUrl, parseHourlyAt, parseForecastFrames, stepLabelFa, makeForecastCellsSvg, FORECAST_STEPS } from '../bot/forecast-gif';
import { IRAN_PROVINCES } from '../bot/iran-provinces';

// ---------- (۱) کارت دارایی‌ها و تورم ----------

const gq = (key: string, title: string, value: number, unit: Quote['unit'], extra: Partial<Quote> = {}): Quote => ({
  key, title, value, unit, srcLabel: 'تست', emoji: 'x', changePct: 1.1, ...extra,
});

const MACRO_FULL = {
  inflationYoy: { pct: 87.9, periodFa: 'تیر ۱۴۰۵', prevPct: 88.6 },
  inflationMom: { pct: 9.5, periodFa: 'خرداد ۱۴۰۵' },
  housingTehran: { tomanPerM2: 237_200_000, periodFa: 'آبان ۱۴۰۵' },
};

describe('assetsSectionsOf — بخش‌های کارت مجزای دارایی‌ها (خواستهٔ ۲۴ نوامبر)', () => {
  const quotes: Quote[] = [
    gq('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman'),
    gq('geram24', 'طلای ۲۴ عیار', 123_000_000, 'toman'),
    gq('sekee', 'سکه امامی', 249_590_000, 'toman', { officialToman: 239_840_000 }),
    gq('nim', 'نیم‌سکه', 139_000_000, 'toman'),
    gq('usd', 'دلار (تتر نوبیتکس)', 269_970, 'toman', { officialToman: 193_633 }),
    gq('tedpix', 'شاخص کل بورس', 3_200_000, 'index'),
    gq('btc', 'بیت‌کوین', 9_200_000_000, 'toman'),
    gq('oil_brent', 'نفت برنت', 73.5, 'usd'),
    gq('car:j4', 'جک J4', 3_600_000_000, 'toman', { factoryToman: 1_610_000_000 }),
  ];

  test('چهار بخش: طلا / ارز / تورم بانک مرکزی / مسکن تهران — خودرو غایب', () => {
    const sections = assetsSectionsOf(quotes, MACRO_FULL);
    const titles = sections.map((s) => s.title);
    expect(titles).toContain('طلا و سکه');
    expect(titles).toContain('ارز، بورس و کریپتو');
    expect(titles).toContain('تورم — بانک مرکزی');
    expect(titles).toContain('مسکن تهران');
    expect(titles.some((t) => t.includes('خودرو'))).toBe(false);
    expect(sections.find((s) => s.title.includes('طلا'))!.rows.length).toBe(4);
    expect(sections.find((s) => s.title.includes('ارز'))!.rows.length).toBe(4);
  });

  test('ردیف‌های تورم: مقدار درصد + دورهٔ شمسی + تغییر نسبت به دورهٔ قبل', () => {
    const sections = assetsSectionsOf(quotes, MACRO_FULL);
    const infl = sections.find((s) => s.title.includes('تورم'))!;
    const yoy = infl.rows.find((r) => r.title.includes('سالانه'))!;
    expect(yoy.value).toBe('۸۷٫۹٪');
    expect(yoy.official).toBe('تیر ۱۴۰۵');
    expect(yoy.pct).toBe(-0.7); // ۸۷٫۹ − ۸۸٫۶
    const mom = infl.rows.find((r) => r.title.includes('ماهانه'))!;
    expect(mom.value).toBe('۹٫۵٪');
    expect(mom.official).toBe('خرداد ۱۴۰۵');
  });

  test('ردیف مسکن: میانهٔ هر متر + دوره', () => {
    const sections = assetsSectionsOf(quotes, MACRO_FULL);
    const h = sections.find((s) => s.title.includes('مسکن'))!.rows[0]!;
    expect(h.title).toContain('میانهٔ قیمت هر متر');
    expect(h.value).toContain('۲۳۷٬۲۰۰٬۰۰۰ تومان');
    expect(h.official).toBe('آبان ۱۴۰۵');
  });

  test('آمار کلان غایب → بخش تورم/مسکن صادقانه نمی‌آیند', () => {
    const sections = assetsSectionsOf(quotes, {});
    expect(sections.some((s) => s.title.includes('تورم'))).toBe(false);
    expect(sections.some((s) => s.title.includes('مسکن'))).toBe(false);
    expect(sections.length).toBe(2);
  });
});

describe('پارسرهای آمار کلان — دادهٔ واقعی ۲۴ نوامبر', () => {
  test('parseTeInflationYoy — جملهٔ واقعی TE', () => {
    const r = parseTeInflationYoy('Inflation Rate in Iran decreased to 87.90 percent in July from 88.60 percent in June of 2026. This page provides...');
    expect(r).not.toBeNull();
    expect(r!.pct).toBe(87.9);
    expect(r!.prevPct).toBe(88.6);
    expect(r!.periodFa).toBe('تیر ۱۴۰۵');
  });

  test('parseTeInflationMom — جملهٔ واقعی TE', () => {
    const r = parseTeInflationMom('The Consumer Price Index in Iran increased 9.50 percent in June of 2026 over the previous month. Inflation Rate Mom in Iran averaged...');
    expect(r).not.toBeNull();
    expect(r!.pct).toBe(9.5);
    expect(r!.periodFa).toBe('خرداد ۱۴۰۵');
  });

  test('parseKilidTehranPrice — متای واقعی کیلید (میلیون تومان ×۱میلیون)', () => {
    const r = parseKilidTehranPrice('<meta name="description" content="میانهٔ قیمت هر متر آپارتمان در تهران در آبان ۱۴۰۵، ۲۳۷٫۲ میلیون تومان است. روند تغییرات"/>');
    expect(r).not.toBeNull();
    expect(r!.tomanPerM2).toBe(237_200_000);
    expect(r!.periodFa).toBe('آبان ۱۴۰۵');
  });

  test('مقادیر واهی رد می‌شوند (هیچ عدد ساختگی)', () => {
    expect(parseTeInflationYoy('Inflation Rate in Iran decreased to 9999 percent in July of 2026.')).toBeNull();
    expect(parseTeInflationMom('nothing here')).toBeNull();
    expect(parseKilidTehranPrice('میانهٔ قیمت هر متر آپارتمان در تهران در آبان ۱۴۰۵، ۳ میلیون تومان است.')).toBeNull();
    expect(parseKilidTehranPrice('قیمت هر متر در تهران در مهر ۱۴۰۵، ۲۳۰ میلیون دلار است.')).toBeNull();
    expect(gregMonthToShamsiFa('Faketober', 2026)).toBeNull();
  });

  test('formatAssetsMessage — پیام متنی پشتیبان با تورم و مسکن', () => {
    const msg = formatAssetsMessage(
      [gq('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman'), gq('usd', 'دلار', 269_970, 'toman', { officialToman: 193_633 })],
      undefined,
      undefined,
      MACRO_FULL,
    );
    expect(msg).toContain('طلا و سکه');
    expect(msg).toContain('تورم نقطه‌به‌نقطه (بانک مرکزی)');
    expect(msg).toContain('سالانه: ۸۷٫۹٪ (تیر ۱۴۰۵)');
    expect(msg).toContain('ماهانه: ۹٫۵٪ (خرداد ۱۴۰۵)');
    expect(msg).toContain('مسکن تهران');
    expect(msg).toContain('کیلید');
  });
});

describe('SVG و رندر کارت دارایی‌ها', () => {
  const input = () => ({
    date: tripleDateOf('2026-11-24', 'Asia/Tehran', 'umalqura'),
    slotLabel: 'گزارش روزانه (ساعت ۱۵)',
    quotes: [gq('geram18', 'طلای ۱۸ عیار', 92_500_000, 'toman'), gq('usd', 'دلار', 269_970, 'toman', { officialToman: 193_633 })] as Quote[],
    macro: MACRO_FULL,
  });

  test('عنوان، ستون‌ها، تورم و مسکن در SVG', () => {
    const svg = makeAssetsCardSvg(input());
    expect(svg).toContain('دارایی‌ها و تورم');
    expect(svg).toContain('تورم — بانک مرکزی');
    expect(svg).toContain('۸۷٫۹٪');
    expect(svg).toContain('مسکن تهران');
    expect(svg).toContain('رسمی / دوره');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
  });

  test('رندر ۳× و سازگار با سقف بله (کارت کوتاه — خواستهٔ ۲۵ نوامبر)', async () => {
    const card = await renderAssetsCardPng(input());
    expect(card).not.toBeNull();
    expect(card!.width).toBe(3240); // ۳× — کارت دارایی کوتاه است؛ شارپ‌تر با زوم
    expect(card!.width + card!.height).toBeLessThanOrEqual(9800);
  });

  test('هیچ بخشی نیست → SVG خالی/رندر null', async () => {
    expect(makeAssetsCardSvg({ ...input(), quotes: [], macro: {} })).toBe('');
    const card = await renderAssetsCardPng({ ...input(), quotes: [], macro: {} });
    expect(card).toBeNull();
  });
});

// ---------- (۲) غنی‌سازی AI اطلاعیهٔ فروش ----------

describe('غنی‌سازی AI اطلاعیهٔ فروش — فقط از فهرست‌های راستی‌آزمایی‌شده', () => {
  const clean = 'پیش‌فروش فیدلیتی الیت ۷نفره مدیران خودرو آغاز شد. قیمت هر دستگاه ۳٫۳۵ میلیارد تومان است. ثبت‌نام از سامانهٔ فروش انجام می‌شود.';

  test('پارس پاسخ AI — JSON خام/fenced/null-متنی', () => {
    expect(parseSaleAiDraft('{"automaker": "سامانه فروش مدیران خودرو", "model": "فیدلیتی الیت ۷نفره", "factory_price_toman": 3350000000}')).toEqual({
      automaker: 'سامانه فروش مدیران خودرو', model: 'فیدلیتی الیت ۷نفره', factory_price_toman: 3350000000,
    });
    expect(parseSaleAiDraft('```json\n{"automaker": null, "model": null, "factory_price_toman": null}\n```')).toEqual({});
    expect(parseSaleAiDraft('هیچ jsonی نیست')).toBeNull();
  });

  test('resolveSaleAiDraft — URL همیشه از فهرست تأییدشده؛ قیمت باید در متن باشد', () => {
    const fill = resolveSaleAiDraft({ automaker: 'مدیران خودرو', model: 'فیدلیتی الیت ۷نفره', factory_price_toman: 3_350_000_000 }, clean);
    expect(fill.portal!.url).toBe('https://customer.mvmco.ir'); // از SALE_PORTALS خودمان
    expect(fill.model!.bamaUrl).toBe('https://bama.ir/price/fidelity_elite_7seater'); // از CAR_BAMA_MODELS خودمان
    expect(fill.factoryToman).toBe(3_350_000_000); // «۳٫۳۵ میلیارد» در متن هست
  });

  test('قیمتِ نیست در متن → رد می‌شود (پایست‌بندی به متن)', () => {
    const fill = resolveSaleAiDraft({ automaker: 'مدیران خودرو', factory_price_toman: 2_500_000_000 }, clean);
    expect(fill.factoryToman).toBeUndefined();
  });

  test('برچسب واهی خودروساز/مدیل → رد', () => {
    const fill = resolveSaleAiDraft({ automaker: 'تویوتا ایران', model: 'پراید ۱۴۱' }, clean);
    expect(fill.portal).toBeUndefined();
    expect(fill.model).toBeUndefined();
  });

  test('priceGroundedInText — اشکال عدد کامل/میلیارد/میلیون/ریال', () => {
    expect(priceGroundedInText(1_610_000_000, 'قیمت ۱٬۶۱۰٬۰۰۰٬۰۰۰ تومان')).toBe(true);
    expect(priceGroundedInText(1_610_000_000, 'قیمت ۱۶٬۱۰۰٬۰۰۰٬۰۰۰ ریال')).toBe(true); // ریال ×۱۰
    expect(priceGroundedInText(1_610_000_000, 'حدود ۱٫۶۱ میلیارد تومان')).toBe(true);
    expect(priceGroundedInText(300_000_000, '۳۰۰ میلیون تومان')).toBe(true);
    expect(priceGroundedInText(1_610_000_000, 'هیچ قیمتی نیست')).toBe(false);
  });

  test('اعلان AI فهرست‌های تأییدشده را می‌دهد و عدد نمی‌سازد', () => {
    const prompt = buildSaleAiUserPrompt(clean);
    expect(prompt).toContain(clean.slice(0, 100));
    expect(prompt).toContain(saleAiPortalLabels()[0]);
    expect(prompt).toContain(saleAiModelLabels()[0]);
    expect(prompt).toContain('null');
    expect(prompt).toContain('factory_price_toman');
  });
});

// ---------- (۳) تراکم رندر ----------

describe('renderDensityFor — نردبان ۳×→۲×→۱٫۵×→۱× (خواستهٔ ۲۵ نوامبر: کیفیت عکسها)', () => {
  test('کارت کوتاه ۱۰۸۰×۲۰۰۰ → ۳× (۳۲۴۰px عرض — شارپ‌تر با زوم)', () => {
    expect(renderDensityFor(1080, 2000)).toBe(DENSITY_3X);
  });
  test('کارت بلند ۱۰۸۰×۴۵۰۰ → ۱٫۵× (۲× و ۳× از سقف بله می‌گذرند)', () => {
    expect(renderDensityFor(1080, 4500)).toBe(DENSITY_15X);
  });
  test('کارت خیلی بلند ۱۰۸۰×۵۵۰۰ → ۱× (سقف بله)', () => {
    expect(renderDensityFor(1080, 5500)).toBe(DENSITY_1X);
  });
  test('کارت میانه ۱۰۸۰×۳۰۰۰ → ۲×', () => {
    expect(renderDensityFor(1080, 3000)).toBe(DENSITY_2X);
  });
  test('ابعاد نامعتبر → ۱×', () => {
    expect(renderDensityFor(0, 100)).toBe(DENSITY_1X);
    expect(renderDensityFor(-5, 100)).toBe(DENSITY_1X);
  });
  test('renderGifDensityFor — سقف ۲× برای فریم‌های گیف (۳× فقط PNG؛ حجم گیف در سقف می‌ماند)', () => {
    expect(renderGifDensityFor(1080, 2000)).toBe(DENSITY_2X);
    expect(renderGifDensityFor(1080, 4500)).toBe(DENSITY_15X);
    expect(renderGifDensityFor(1080, 5500)).toBe(DENSITY_1X);
    expect(renderGifDensityFor(1100, 1315)).toBe(DENSITY_2X); // گیف نقشه — ۲×
  });
});

// ---------- (۴) نقشهٔ ایران — استان‌ها و مراکز ----------

describe('نقشهٔ ایران — مرز استان‌ها و چینش برچسب مراکز (خواستهٔ ۲۴ نوامبر)', () => {
  test('۳۱ استان و ۳۱ مرکز استان', () => {
    expect(IRAN_PROVINCES.length).toBe(31);
    expect(PROVINCE_CAPS.length).toBe(31);
    const names = new Set(PROVINCE_CAPS.map((c) => c.province));
    for (const p of IRAN_PROVINCES) expect(names.has(p.nameFa)).toBe(true);
  });

  test('مرکز هر استان داخل مرز نقشه است (تصویرسازی مرکاتور)', () => {
    for (const c of PROVINCE_CAPS) {
      const [x, y] = mercProject(c.lon, c.lat);
      expect(x).toBeGreaterThan(4);
      expect(x).toBeLessThan(MAP_W - 4);
      expect(y).toBeGreaterThan(4);
      expect(y).toBeLessThan(MAP_H - 4);
    }
  });

  test('هیچ دو برچسبی هم‌پوشان نیست (خواستهٔ صریح «بهم نخورن»)', () => {
    const placed = placeCapitalLabels();
    expect(placed.length).toBe(31);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        const pad = 3;
        const hit = Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.y - b.y) < 22 + pad;
        expect(hit).toBe(false);
      }
    }
  });

  test('برچسب‌ها درون بوم می‌مانند', () => {
    for (const p of placeCapitalLabels()) {
      expect(p.x - p.w / 2).toBeGreaterThanOrEqual(2);
      expect(p.x + p.w / 2).toBeLessThanOrEqual(MAP_W - 2);
    }
  });

  test('SVG استان‌ها و مراکز ساخته می‌شود — تهران و دورترین‌ها حاضرند', () => {
    const fills = provinceFillsSvg();
    const borders = provinceBordersSvg();
    const caps = capitalsSvg();
    expect(fills).toContain('<path');
    expect(borders).toContain('stroke');
    for (const name of ['تهران', 'زاهدان', 'بندرعباس', 'ارومیه', 'بجنورد', 'سمنان']) {
      expect(caps).toContain(name);
    }
    expect(estLabelWidth('تهران')).toBeGreaterThan(20);
  });

  test('نقطه‌درمضلع — مراکز استان‌ها درون استان خویش‌اند (با تحمل ۸px ساحل ساده‌شده)', () => {
    // مرز Natural Earth پس از ساده‌سازی Douglas-Peucker خط ساحلی را چند پیکسل جابه‌جا
    // می‌کند — شهرهای ساحلی (بندرعباس) تا ۸px بیرون چندضلعی می‌افتند؛ این تحمل است
    // نه ساختگی — مختصات شهرها واقعی‌اند.
    for (const p of IRAN_PROVINCES) {
      const cap = PROVINCE_CAPS.find((c) => c.province === p.nameFa);
      if (!cap) continue;
      const [x, y] = mercProject(cap.lon, cap.lat);
      const inside = p.rings.some((ring) => {
        const poly = ring.map(([lon, lat]) => mercProject(lon, lat) as [number, number]);
        if (pointInPolygon(x, y, poly)) return true;
        // تحمل ساحل: فاصله تا نزدیک‌ترین ضلع مضلع
        let best = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const ax = poly[j]![0]!, ay = poly[j]![1]!;
          const bx = poly[i]![0]!, by = poly[i]![1]!;
          const dx = bx - ax, dy = by - ay;
          const len2 = dx * dx + dy * dy;
          const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
          best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
        }
        return best <= 8;
      });
      expect(inside).toBe(true); // نشانِ مرکز هر استان درون (یا بر مرزِ ساده‌شدهٔ) همان استان است
    }
  });

  test('برچسب هیچ مرکزی در استان همسایه نمی‌افتد (خواستهٔ ۲۵ نوامبر: «داخل مرز هر استان»)', () => {
    const polysOf = new Map<string, Array<Array<[number, number]>>>(
      IRAN_PROVINCES.map((p) => [p.nameFa, p.rings.map((r) => r.map(([lon, lat]) => mercProject(lon, lat) as [number, number]))]),
    );
    for (const placed of placeCapitalLabels()) {
      const polys = polysOf.get(placed.cap.province)!;
      const cx = placed.x;
      const cy = placed.y;
      const centerInside = polys.some((poly) => pointInPolygon(cx, cy, poly));
      expect(centerInside).toBe(true); // مرکز برچسب هر مرکز استان درون همان استان می‌ماند
      expect(placed.forced).toBeUndefined(); // هیچ برچسبی ناگزیر بیرون از استان نیفتاده
    }
  });
});

// ---------- (۵) گیف رادار RainViewer ----------

describe('radar-gif — ریاضیات کاشی و گزینش فریم (کپی از RainViewer)', () => {
  const frames = (n: number): RvFrame[] => Array.from({ length: n }, (_, i) => ({ time: 1795450000 + i * 600, path: `/v2/radar/${i}` }));

  test('گزینش فریم — گام ۲ از گذشته + آخرین + nowcast؛ بدون تکرار', () => {
    const picked = pickRadarFrames(frames(13), frames(4).map((f) => ({ ...f, time: f.time + 5000 })));
    expect(picked.length).toBeGreaterThan(2);
    expect(picked.length).toBeLessThanOrEqual(9);
    const times = picked.map((f) => f.time);
    expect(new Set(times).size).toBe(times.length);
    // آخرین گذشته (تازه‌ترین وضعیت) همیشه هست
    expect(times).toContain(1795450000 + 12 * 600);
  });

  test('فریم کم → null خالص (بدون گیف نیمه‌ساختگی)', () => {
    expect(pickRadarFrames([], []).length).toBe(0);
    expect(pickRadarFrames(frames(1), []).length).toBe(1);
  });

  test('بازهٔ کاشی ایران در z=6 — همان جعبهٔ نقشه', () => {
    const r = iranTileRange(6);
    expect(r.x1).toBeGreaterThanOrEqual(r.x0);
    expect(r.y1).toBeGreaterThanOrEqual(r.y0);
    // تهران (۵۱٫۴، ۳۵٫۷) داخل بازهٔ کاشی‌هاست
    expect(lonToTileX(51.4, 6)).toBeGreaterThanOrEqual(r.x0);
    expect(lonToTileX(51.4, 6)).toBeLessThanOrEqual(r.x1);
    expect(latToTileY(35.7, 6)).toBeGreaterThanOrEqual(r.y0);
    expect(latToTileY(35.7, 6)).toBeLessThanOrEqual(r.y1);
  });

  test('نشانی کاشی — قالب RainViewer با رنگ TWC و برف', () => {
    const url = radarTileUrl('https://tilecache.rainviewer.com', '/v2/radar/abc', 6, 20, 12);
    expect(url).toBe('https://tilecache.rainviewer.com/v2/radar/abc/512/6/20/12/4/1_1.png');
  });

  test('ساعت فریم به وقت تهران — رقم فارسی', () => {
    // 1795452600 = 2026-11-23 ~20:50 UTC = ~00:20 تهران (۲۴ نوامبر)
    const fa = frameClockFa(1795452600);
    expect(fa).toMatch(/^[۰-۹]{2}:[۰-۹]{2}$/);
  });
});

// ---------- (۶) گیف پیش‌بینی ۲۴ساعته ----------

describe('forecast-gif — مدل عددی Open-Meteo در ۲۵ فریم ساعتی', () => {
  test('نشانی درخواست ساعتی — ۲۵ ساعت، منطقهٔ تهران', () => {
    const url = buildOpenMeteoHourlyUrl([35.7, 32.6], [51.4, 51.7]);
    expect(url).toContain('hourly=precipitation%2Crain%2Csnowfall%2Ccloud_cover');
    expect(url).toContain('forecast_hours=25');
    expect(url).toContain('timezone=Asia%2FTehran');
  });

  test('parseHourlyAt — نمونهٔ بارش/برف/ابر در ساعت t', () => {
    const p = { hourly: { precipitation: [0, 0, 0, 2.2], rain: [0, 0, 0, 2.2], snowfall: [0, 0, 0, 0], cloud_cover: [10, 20, 30, 80] } };
    const s = parseHourlyAt(p, 3);
    expect(s).not.toBeNull();
    expect(s!.rain).toBe(2.2);
    expect(s!.cloudCover).toBe(80);
    expect(parseHourlyAt(p, 9)).toBeNull();
  });

  test('parseForecastFrames — ۲۵ گام ساعتی × نقاط گرید', () => {
    const grid = [{ lat: 35.7, lon: 51.4 }, { lat: 32.6, lon: 51.7 }];
    const json = [
      { hourly: { precipitation: Array(25).fill(1), rain: Array(25).fill(1), snowfall: Array(25).fill(0), cloud_cover: Array(25).fill(50) } },
      { hourly: { precipitation: Array(25).fill(0), rain: Array(25).fill(0), snowfall: Array(25).fill(0.5), cloud_cover: Array(25).fill(90) } },
    ];
    const frames = parseForecastFrames(json, grid);
    expect(frames.length).toBe(FORECAST_STEPS.length);
    expect(frames[0]!.length).toBe(2);
  });

  test('برچسب گام و لایهٔ سلول — همان زبان رنگ رادار (آبی برف، نارنجی باران)', () => {
    expect(stepLabelFa(0)).toBe('همین حالا');
    expect(stepLabelFa(24)).toContain('۲۴');
    const svg = makeForecastCellsSvg([
      { lat: 35.7, lon: 51.4, cur: { precipitation: 2, rain: 2, snowfall: 0 }, fc: null },
      { lat: 32.6, lon: 51.7, cur: { precipitation: 0.3, rain: 0, snowfall: 0.9 }, fc: null },
      { lat: 31.3, lon: 48.7, cur: { precipitation: 0, rain: 0, snowfall: 0, cloudCover: 90 }, fc: null },
    ]);
    expect(svg).toContain('#f97316'); // باران سبک
    expect(svg).toContain('#3b82f6'); // برف (شدت ۱)
    expect(svg).toContain('#8ea6bd'); // ابری
  });
});
