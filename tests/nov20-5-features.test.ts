/**
 * خواسته‌های ۲۰ نوامبر ۲۰۲۶ (دستهٔ پنجم) — ممیزی و اصلاح کامل موتور نمودار دارایی‌ها:
 *  «سوما برای عکس چارت نمودارها … بدون دستکاری ظاهری ریشه خطا را پیدا کن و اصلاح اساسی
 *   انجام بده … برای موتور محاسبات تست بنویس: +۱۰٪ سبز، −۱۰٪ قرمز، ثابت خنثی، صفر
 *   کنترل‌شده، معکوس زمانی مرتب، تکراری حذف، ناقص بدون درصد جعلی، نمودار صعودی با درصد
 *   منفی → شکست، نزولی با مثبت → شکست، بازهٔ متفاوت نمودار/درصد → شکست»
 * + «چراغ گردون رو داخل همون خبر بزار متحرک نه پیام جدا» — کارت فوری GIF متحرک.
 *
 * ریشه‌های یافت‌شده با دادهٔ زندهٔ واقعی هر شش نماد (ممیزی ۲۰۲۶-۱۱-۲۰):
 *  ۱) محور زمانِ راست‌به‌چپ (قدیم=راست) در برابر خوانش چپ‌به‌راست → هر شش پنل
 *     «جهت/درصد متناقض» به نظر می‌رسیدند؛ اکنون چپ→راست + برچسب تاریخ دو سر.
 *  ۲) «۳۰ نقطه» = ۳۰ ردیف معاملاتی → بازه‌های تقویمی ناهمگون (بورس از ۳۰ شهریور!)؛
 *     اکنون پنجرهٔ تقویمی یکسان [امروز−۲۹، امروز] برای همه.
 */
import { describe, expect, test } from 'bun:test';
import {
  CHART_ASSETS,
  CHART_DAYS,
  chartWindow,
  clipSeriesToWindow,
  daysBetweenIso,
  isoAddDays,
  buildChartPanel,
  mergeLivePoint,
  panelMatchesPct,
  makeAssetsChartSvg,
  renderAssetsChartPng,
  type HistSeries,
  type ChartPanel,
} from '../bot/assets-chart';
import { tripleDateOf } from '../bot/calendar';
import {
  makeBreakingCardSvg,
  renderBreakingCardGif,
  BREAKING_CARD_GIF_FRAMES,
} from '../bot/news-card';

const CARD_DATE = tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura');
const TODAY = '2026-11-20';

/** سری کمکی: n نقطهٔ روزانه پیوسته پایان‌یافته در endIso با قیمت‌های داده‌شده (گامِ روزانه گرد‌شده) */
function dailySeries(closes: number[], endIso = TODAY, stepDays = 1): HistSeries {
  const n = closes.length;
  return {
    closes,
    dates: Array.from({ length: n }, (_, i) => isoAddDays(endIso, -Math.round((n - 1 - i) * stepDays))),
  };
}

describe('ممیزی ۱ — پنجرهٔ تقویمی یکسان ۳۰روزه برای همهٔ دارایی‌ها', () => {
  test('chartWindow — [امروز−۲۹، امروز]؛ دقیقاً ۳۰ روز تقویمی', () => {
    const win = chartWindow(TODAY);
    expect(win.end).toBe(TODAY);
    expect(win.start).toBe('2026-10-22');
    expect(daysBetweenIso(win.start, win.end)).toBe(29); // ۳۰ روز شامل هر دو سر
  });

  test('clipSeriesToWindow — نقاط بیرون پنجره حذف؛ داخل پنجره با ترتیب حفظ می‌شوند', () => {
    const s: HistSeries = {
      closes: [10, 20, 30, 40, 50],
      dates: ['2026-10-01', '2026-10-21', '2026-10-22', '2026-11-19', '2026-11-21'],
    };
    const c = clipSeriesToWindow(s, chartWindow(TODAY));
    expect(c.dates).toEqual(['2026-10-22', '2026-11-19']); // ۱۰-۰۱ و ۱۰-۲۱ قبل از شروع، ۱۱-۲۱ بعد از امروز
    expect(c.closes).toEqual([30, 40]);
  });

  test('همهٔ دارایی‌ها در یک کارت از همان پنجرهٔ واحد بریده می‌شوند — حتی دادهٔ کم‌تراکم (بورس)', () => {
    const win = chartWindow(TODAY);
    const dense = buildChartPanel(CHART_ASSETS[0]!, dailySeries(Array.from({ length: 30 }, (_, i) => 100 + i)), win)!;
    // بورس: ۵ روزِ کاری در هفته → ~۲۲ نقطه در ۳۰ روز تقویمی + تأخیر فید (بدون ۵ روز آخر)
    const sparseTse = buildChartPanel(
      CHART_ASSETS[3]!,
      dailySeries(Array.from({ length: 20 }, (_, i) => 7_000_000 + i * 60_000), '2026-11-14', 1.4),
      win,
    )!;
    expect(dense.firstDate).toBe(win.start); // نقطهٔ آغاز دقیقاً لبهٔ پنجره
    expect(dense.points).toBe(30);
    // ۲۰ نقطهٔ کم‌تراکم از ۱۸ مهر تا ۱۴ آبان: ۳ نقطهٔ پیش از پنجره (۱۸/۲۰/۲۱ مهر) حذف → ۱۷ نقطه صادقانه
    expect(sparseTse.points).toBe(17);
    expect(sparseTse.firstDate).toBe('2026-10-23'); // نخستین نقطهٔ «درون» پنجره
    expect(sparseTse.lastDate).toBe('2026-11-14'); // فید بورس عقب است — همان روز آخرِ واقعی
    expect(sparseTse.spanDays).toBe(22); // صادقانه: گسترهٔ واقعی کمتر از ۳۰ روز اعلام می‌شود
    // هر دو پنل در یک پنجرهٔ واحد‌اند — تاریخ پایان هر دو ≤ امروز و ≥ شروع پنجره
    for (const p of [dense, sparseTse]) {
      expect(p.firstDate >= win.start && p.lastDate <= win.end).toBe(true);
      expect(panelMatchesPct(p)).toBe(true);
    }
  });

  test('دادهٔ ناکافی در پنجره → پنل null (بدون درصد جعلی) — نقاط بیرون پنجره نجاتش نمی‌دهند', () => {
    const win = chartWindow(TODAY);
    const oldOnly: HistSeries = {
      closes: Array.from({ length: 12 }, (_, i) => 100 + i),
      dates: Array.from({ length: 12 }, (_, i) => isoAddDays('2026-09-15', i)),
    };
    expect(buildChartPanel(CHART_ASSETS[0]!, oldOnly, win)).toBeNull(); // همه بیرون پنجره
    const few: HistSeries = {
      closes: Array.from({ length: 7 }, (_, i) => 100 + i),
      dates: Array.from({ length: 7 }, (_, i) => isoAddDays('2026-11-14', i)),
    };
    expect(buildChartPanel(CHART_ASSETS[0]!, few, win)).toBeNull(); // ۷ نقطه < ۸
  });
});

describe('ممیزی ۲ — درصد/رنگ/جهت از یک متغیر واحد (چک‌لیست تست ممیز)', () => {
  const win = chartWindow(TODAY);

  function panelOf(closes: number[]): ChartPanel {
    return buildChartPanel(CHART_ASSETS[4]!, dailySeries(closes), win)!;
  }

  test('افزایش واقعی ۱۰٪ → pct=+۱۰، فلش ▲، رنگ سبز', () => {
    const p = panelOf(Array.from({ length: 12 }, (_, i) => 100_000 * (1 + 0.1 * (i / 11))));
    expect(p.pct).toBeCloseTo(10, 0);
    expect(p.values[p.values.length - 1]!).toBeGreaterThan(p.values[0]!); // نقطهٔ پایانی بالاتر — نه فقط عدد
    const svg = makeAssetsChartSvg({ date: CARD_DATE, panels: [p, panelOf([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 90]), panelOf(Array.from({ length: 12 }, (_, i) => 100 - i))] });
    expect(svg).toContain('▲');
    expect(svg).toContain('#4ade80'); // سبز فقط برای رشد واقعی
  });

  test('کاهش واقعی ۱۰٪ → pct=−۱۰، فلش ▼، رنگ قرمز', () => {
    const p = panelOf(Array.from({ length: 12 }, (_, i) => 100_000 * (1 - 0.1 * (i / 11))));
    expect(p.pct).toBeCloseTo(-10, 0);
    expect(p.values[p.values.length - 1]!).toBeLessThan(p.values[0]!);
    const svg = makeAssetsChartSvg({ date: CARD_DATE, panels: [p, panelOf([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 110]), panelOf(Array.from({ length: 12 }, (_, i) => 100 + i))] });
    expect(svg).toContain('▼');
    expect(svg).toContain('#f87171');
  });

  test('قیمت ثابت → 0٪، فلش —، رنگ خنثی', () => {
    const p = panelOf(Array.from({ length: 12 }, () => 61_774));
    expect(p.pct).toBe(0);
    expect(Math.abs(p.values[p.values.length - 1]! - p.values[0]!)).toBeLessThan(0.001);
    const svg = makeAssetsChartSvg({ date: CARD_DATE, panels: [p, panelOf(Array.from({ length: 12 }, (_, i) => 100 + i)), panelOf(Array.from({ length: 12 }, (_, i) => 100 - i))] });
    expect(svg).toContain('—');
    expect(svg).toContain('#cbd5e1');
  });

  test('قیمت ابتدایی صفر → null کنترل‌شده؛ نه NaN نه Infinity نه درصد جعلی', () => {
    expect(buildChartPanel(CHART_ASSETS[0]!, dailySeries([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), win)).toBeNull();
    expect(buildChartPanel(CHART_ASSETS[0]!, dailySeries([Number.NaN, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), win)).toBeNull();
  });

  test('نمودار صعودی با درصد منفی / نزولی با مثبت / بازهٔ متفاوت → ناگزیر می‌شکند', () => {
    const asc = panelOf(Array.from({ length: 12 }, (_, i) => 100 + i)); // واقعاً +~۱۱٪
    // جعل ۱: values صعودی، pct منفی
    expect(panelMatchesPct({ ...asc, pct: -27 })).toBe(false);
    // جعل ۲: values نزولی، pct مثبت
    const desc = panelOf(Array.from({ length: 12 }, (_, i) => 100 - i));
    expect(panelMatchesPct({ ...desc, pct: 14.7 })).toBe(false);
    // جعل ۳: pct از بازهٔ دیگری (ناسازگار عددی با values حتی با علامت درست)
    expect(panelMatchesPct({ ...asc, pct: 2.3 })).toBe(false);
    // سالم: علامت و مقدار هم‌خوان
    expect(panelMatchesPct(asc)).toBe(true);
    expect(panelMatchesPct(desc)).toBe(true);
  });

  test('درصد از «همان» سری بریده‌شده در پنجره محاسبه می‌شود — نه از کل سری خام', () => {
    // سری ۴۵نقطه‌ای که بیرون پنجره سقوط ۵۰٪ دارد؛ درون پنجره صعود ۵٪
    const closes = [
      ...Array.from({ length: 15 }, (_, i) => 200 + i), // ۲۰۰→۲۱۴ (بیرون پنجره، ماه قبل)
      ...Array.from({ length: 30 }, (_, i) => 100 + i), // ۱۰۰→۱۲۹ (درون پنجره)
    ];
    const s = dailySeries(closes);
    const p = buildChartPanel(CHART_ASSETS[4]!, s, win)!;
    expect(p.points).toBe(30); // فقط درون پنجره
    expect(p.values[0]).toBe(100); // نخستِ «پنجره»، نه نخستِ سری خام
    expect(p.values[p.values.length - 1]).toBe(129);
    expect(p.pct).toBeCloseTo(29, 0); // (129−100)/100 — از اولین قیمتِ معتبر همان بازه
  });
});

describe('ممیزی ۳ — نقطهٔ زنده: هم‌مقیاس یا رد', () => {
  const series = dailySeries([100_000, 102_000, 104_000, 106_000], '2026-11-19'); // آخرین نقطه دیروز → زندهٔ امروز «الحاق» می‌شود

  test('زندهٔ هم‌مقیاس (±۳۰٪) → الحاق؛ زندهٔ ۱۰×/۰٫۱× (خطای واحد) → رد', () => {
    expect(mergeLivePoint(series, TODAY, 107_000, false).closes.length).toBe(5);
    expect(mergeLivePoint(series, TODAY, 1_060_000, false)).toBe(series); // ۱۰× — ریال/تومان قاطی
    expect(mergeLivePoint(series, TODAY, 10_600, false)).toBe(series); // ۰٫۱×
    expect(mergeLivePoint(series, TODAY, 0, false)).toBe(series);
  });
});

describe('کارت فوری متحرک — چراغ گردان داخل خود خبر (خواستهٔ ۲۰ نوامبر پنجم)', () => {
  const input = { source: '𝕏 Donald Trump', text: 'ترامپ: اگر جنگ ادامه یابد پاسخ ما قاطع خواهد بود و هیچ گزینه‌ای از میز برداشته نمی‌شود.', faName: 'دونالد ترامپ، رئیس‌جمهور آمریکا' };

  test('فریم‌ها فقط در چراغ گردان تفاوت دارند؛ متن و عنوان «فوری» در همه ثابت‌اند', () => {
    const f0 = makeBreakingCardSvg(input, 0);
    const f5 = makeBreakingCardSvg(input, 5);
    for (const f of [f0, f5]) {
      expect(f).toContain('فوری');
      expect(f).toContain('ترامپ');
      expect(f).toContain('دونالد ترامپ');
      expect(f).not.toContain('undefined');
      expect(f).not.toContain('NaN');
    }
    expect(f0).not.toBe(f5); // پرتو چرخان → فریم‌ها واقعاً متفاوت‌اند
    expect(BREAKING_CARD_GIF_FRAMES).toBe(12);
  });

  test('رندر واقعی GIF — امضای GIF، ابعاد کارت، حجم معقول', async () => {
    const gif = await renderBreakingCardGif(input);
    expect(gif).not.toBeNull();
    expect(gif!.png.slice(0, 3).toString('latin1')).toBe('GIF');
    expect(gif!.width).toBe(1080);
    expect(gif!.height).toBeGreaterThan(400);
    expect(gif!.png.length).toBeGreaterThan(20_000);
    expect(gif!.png.length).toBeLessThan(8_000_000);
  }, 60_000);
});

describe('ممیزی ۴ — رندر نهایی کارت شش‌دارایی با دادهٔ واقع‌گرایانه', () => {
  test('شش پنل پنجرهٔ مشترک؛ کارت PNG سالم؛ هیچ «…» یا NaN در متن نیست', async () => {
    const win = chartWindow(TODAY);
    const panels = [
      buildChartPanel(CHART_ASSETS[0]!, dailySeries(Array.from({ length: 30 }, (_, i) => 260_000 + i * 300)), win)!,
      buildChartPanel(CHART_ASSETS[1]!, dailySeries(Array.from({ length: 26 }, (_, i) => 26_000_000 - i * 80_000), '2026-11-18', 1.15), win)!,
      buildChartPanel(CHART_ASSETS[2]!, dailySeries(Array.from({ length: 30 }, (_, i) => 250_000_000 - i * 400_000)), win)!,
      buildChartPanel(CHART_ASSETS[3]!, dailySeries(Array.from({ length: 22 }, (_, i) => 7_300_000 + i * 48_000), '2026-11-14', 1.4), win)!,
      buildChartPanel(CHART_ASSETS[4]!, dailySeries(Array.from({ length: 30 }, (_, i) => 84_000 - i * 750)), win)!,
      buildChartPanel(CHART_ASSETS[5]!, dailySeries(Array.from({ length: 30 }, (_, i) => 105 - i * 0.5)), win)!,
    ];
    expect(panels.length).toBe(6);
    for (const p of panels) {
      expect(p.firstDate >= win.start && p.lastDate <= win.end).toBe(true);
      expect(panelMatchesPct(p)).toBe(true); // جهت/درصد/مقدار همیشه هم‌خوان
    }
    const svg = makeAssetsChartSvg({ date: CARD_DATE, panels });
    expect(svg).not.toContain('…');
    expect(svg).not.toContain('NaN');
    const card = await renderAssetsChartPng({ date: CARD_DATE, panels });
    expect(card).not.toBeNull();
    expect(card!.width).toBe(1080);
  }, 30_000);
});
