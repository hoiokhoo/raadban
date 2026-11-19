/**
 * خواسته‌های ۲۰ نوامبر ۲۰۲۶ (دستهٔ دوم):
 *  ۱) «قرار بود چارت نمودار دارایی ها رو هم بزاری،اما الآن نیست» — ماژول تازهٔ
 *     bot/assets-chart.ts: نمودار اسپارک‌لاین ۳۰روزهٔ شش دارایی شاخص (دلار، طلا، سکهٔ
 *     بانکی، بورس، بیت‌کوین، برنت) از تاریخچهٔ tgju + نقطهٔ زندهٔ امروز.
 *  ۲) «هنوز بعضی اخبار به شکل ناقص بعد از دوخط با سه نقطه پایان پیدا میکنند … میخوام
 *     کل کامل اون خبر در ۲ـ۳ خط خلاصه بشه با معنی کامل نه ناقص» — کارت خبر ارتفاع
 *     متغیر (تا سه خط کامل) + پرامپت‌های سطر-سوم‌مجاز.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  makeNewsCardSvg,
  newsRowHeight,
  NEWS_MAX_LINES,
  type NewsCardInput,
} from '../bot/news-card';
import { tripleDateOf } from '../bot/calendar';
import { faDigits } from '../bot/daily';
import {
  CHART_ASSETS,
  CHART_DAYS,
  parseHistorySeries,
  mergeLivePoint,
  buildChartPanel,
  sparklinePoints,
  makeAssetsChartSvg,
  renderAssetsChartPng,
  historyUrl,
  type HistSeries,
  type ChartPanel,
} from '../bot/assets-chart';

const CARD_DATE = tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura');

// ---------- (۱) کارت خبر — سه خط کامل، دیگر «…» در خط دوم نیست ----------

describe('کارت خبر — خلاصهٔ کامل ۲ـ۳خطی (خواستهٔ ۲۰ نوامبر: «نه ناقص»)', () => {
  const base: NewsCardInput = { date: CARD_DATE, items: [] };

  test('NEWS_MAX_LINES = ۳ و ارتفاع ردیف متغیر: ۱خط=۱۱۸، ۲خط=۱۵۸، ۳خط=۱۹۸', () => {
    expect(NEWS_MAX_LINES).toBe(3);
    expect(newsRowHeight('خبر کوتاه تک‌خطی')).toBe(118);
    // ~۵۶ نویسه در هر خط — دقیقاً دو خط
    const two = 'کلمه‌ای که تکرار می‌شود تا خط دومی پر شود و کشیده شود درست به اندازهٔ'; // ۷۰ نویسه → ۲ خط
    expect(two.length).toBeGreaterThan(56);
    expect(two.length).toBeLessThanOrEqual(112);
    expect(newsRowHeight(two)).toBe(158);
    // ۱۱۲–۱۶۸ نویسه → سه خط
    const three = `${two} و این هم ادامهٔ خبر در سطر سوم برای کامل‌بودن معنا`;
    expect(three.length).toBeGreaterThan(112);
    expect(three.length).toBeLessThanOrEqual(168);
    expect(newsRowHeight(three)).toBe(198);
  });

  test('خبر سه‌خطی — کامل رندر می‌شود، بدون «…» (ریشهٔ شکایت: بریدن در خط دوم)', () => {
    // ۱۴۶ نویسه — با سقف قبلیِ ۲خط (۱۱۲) بریده می‌شد؛ اکنون سه خط کامل
    const words = 'وزیر فرهنگ گفت نمایشگاه کتاب امسال با حضور صد و چهل کشور و بیش از سه هزار ناشر ایرانی و خارجی برگزار می‌شود و رکورد جدید ناشران در آن ثبت خواهد شد';
    expect(words.length).toBeGreaterThan(112);
    expect(words.length).toBeLessThanOrEqual(168);
    const svg = makeNewsCardSvg({ ...base, items: [{ text: words, tick: true, source: 'ایسنا' }] });
    expect(svg).not.toContain('…');
    expect(svg).toContain('رکورد جدید ناشران'); // انتهای خبر حاضر است — معنا کامل
    expect(svg).toContain('وزیر فرهنگ'); // آغاز خبر
  });

  test('خبر دخطی — همان‌قدر قبل رندر می‌شود (بدون تغییر رفتار)', () => {
    const two = 'شاخص بورس تهران امروز با رشد یک درصدی به کانال جدید وارد شد و معاملات پرحجم شد';
    expect(two.length).toBeGreaterThan(56);
    expect(two.length).toBeLessThanOrEqual(112);
    const svg = makeNewsCardSvg({ ...base, items: [{ text: two, tick: false, source: 'بورس' }] });
    expect(svg).not.toContain('…');
  });

  test('کارت با خبر سه‌خطی بلندتر از کارت فقط-دخطی است (ارتفاع SVG واقعی)', () => {
    const two = 'خبر دخطی نمونه که دقیقاً در دو خط جا می‌شود و طول آن حدود هفتاد نویسه است';
    const three = `${two} و ادامهٔ همان خبر در سطر سوم چون معنا ناتمام بود`;
    const h = (svg: string): number => Number(/height="(\d+)"/.exec(svg)?.[1] ?? 0);
    const svgTwo = makeNewsCardSvg({ ...base, items: [{ text: two, tick: false, source: 'الف' }] });
    const svgThree = makeNewsCardSvg({ ...base, items: [{ text: three, tick: false, source: 'الف' }] });
    expect(h(svgThree)).toBe(h(svgTwo) + 40); // فقط یک خط بیشتر — ۱۹۸ در برابر ۱۵۸
  });

  test('متن فراتر از سه خط → «…» فقط سپر آخر (کارت هرگز سرریز نمی‌کند)', () => {
    const way = `${'این جملهٔ خبری بلند است و تکرار می‌شود. '.repeat(12)}`;
    expect(way.length).toBeGreaterThan(168);
    const svg = makeNewsCardSvg({ ...base, items: [{ text: way, tick: false, source: 'الف' }] });
    expect(svg).toContain('…');
  });
});

// ---------- (۲) پرامپت‌ها — سطر سوم مجاز، معنای کامل مقدم بر کوتاهی ----------

describe('پرامپت‌ها — سطر سوم مجاز و «معنای کامل مقدم بر کوتاهی» (۲۰ نوامبر دومی)', () => {
  test('پرامپت ساعتی: سقف سه خط ~۱۶۵ نویسه + قاعدهٔ طلایی؛ «سطر سوم مطلقاً نیست» حذف شد', async () => {
    const { DEFAULT_SYSTEM_HOURLY } = await import('../bot/hourly');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('سطر سوم');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('۱۶۵');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('معنای کامل مقدم بر کوتاهی');
    expect(DEFAULT_SYSTEM_HOURLY).not.toContain('مطلقاً نیست');
  });

  test('پرامپت خلاصهٔ خبرهای خارجی: سقف ~۱۶۵ نویسه + ناقص‌تمام‌نشدن مورد', async () => {
    const { DEFAULT_NEWS_SUMMARY_PROMPT } = await import('../bot/bot');
    expect(DEFAULT_NEWS_SUMMARY_PROMPT).toContain('سقف ~۱۶۵');
    expect(DEFAULT_NEWS_SUMMARY_PROMPT).toContain('معنای کامل مقدم');
    expect(DEFAULT_NEWS_SUMMARY_PROMPT).toContain('ناقص تمام نمی‌شود');
  });

  test('bot/prompts.json — کلیدهای hourly و summary هم‌متن پیش‌فرض تازه (سایهٔ کهته نماند)', async () => {
    const { DEFAULT_SYSTEM_HOURLY } = await import('../bot/hourly');
    const { DEFAULT_NEWS_SUMMARY_PROMPT } = await import('../bot/bot');
    const o = JSON.parse(readFileSync(new URL('../bot/prompts.json', import.meta.url).pathname, 'utf8'));
    expect(o.hourly).toBe(DEFAULT_SYSTEM_HOURLY);
    expect(o.summary).toBe(DEFAULT_NEWS_SUMMARY_PROMPT);
  });
});

// ---------- (۳) نمودار دارایی‌ها — خواستهٔ ۲۰ نوامبر: «قرار بود چارت نمودار دارایی ها رو هم بزاری» ----------

/** پاسخ نمونهٔ summary-table-data — ردیف‌ها جدید→قدیم (مثل tgju واقعی) */
function histFixture(count: number, basePrice: number): string {
  const rows: string[][] = [];
  for (let i = 0; i < count; i++) {
    // روز i از امروز به عقب؛ قیمت پایه + رشد پلکانی
    const d = new Date(Date.UTC(2026, 10, 20 - i)); // 2026-11-20 به عقب
    const iso = d.toISOString().slice(0, 10).replace(/-/g, '/');
    const price = Math.round((basePrice + i * 100) * 100) / 100;
    const s = String(price).replace('.', '.');
    rows.push([s, s, s, s, '<span>100</span>', '<span>1%</span>', iso, '—']);
  }
  return JSON.stringify({ draw: 1, recordsTotal: count, recordsFiltered: count, data: rows });
}

describe('assets-chart — پارس تاریخچهٔ tgju (خالص)', () => {
  test('ردیف‌های جدید→قدیم به قدیم→جدید وارونه و به ۳۰ نقطهٔ آخر بریده می‌شود', () => {
    const s = parseHistorySeries(histFixture(45, 1_000_000), { rial: true });
    expect(s).not.toBeNull();
    expect(s!.closes.length).toBe(30);
    // جدیدترین ردیف (قیمت پایه) باید آخرین نقطه باشد؛ قدیمی‌ترینِ ۳۰تایی نخست
    expect(s!.closes[0]).toBeGreaterThan(s!.closes[s!.closes.length - 1]!);
    expect(s!.dates[0]).toBe('2026-10-22');
    expect(s!.dates[s!.dates.length - 1]).toBe('2026-11-20');
  });

  test('پرچم ریالی → تقسیم بر ۱۰ (تومان)؛ نماد دلاری دست‌نخورده', () => {
    const rial = parseHistorySeries(histFixture(10, 2_000_000), { rial: true });
    expect(rial!.closes[rial!.closes.length - 1]).toBe(200_000); // ۲٬۰۰۰٬۰۰۰ ریال → ۲۰۰٬۰۰۰ تومان
    const usd = parseHistorySeries(histFixture(10, 92.5), { rial: false });
    expect(usd!.closes[usd!.closes.length - 1]).toBeCloseTo(92.5, 1);
  });

  test('سری کوتاه (<۸) و JSON خراب → null صادقانه', () => {
    expect(parseHistorySeries(histFixture(5, 100), { rial: true })).toBeNull();
    expect(parseHistorySeries('not json', {} as never)).toBeNull();
    expect(parseHistorySeries('{"data":null}', {} as never)).toBeNull();
  });

  test('historyUrl — API عمومی tgju بدون کلید', () => {
    expect(historyUrl('price_dollar_rl')).toBe('https://api.tgju.org/v1/market/indicator/summary-table-data/price_dollar_rl?lang=fa');
    expect(historyUrl('crypto-bitcoin')).toContain('crypto-bitcoin');
  });
});

describe('assets-chart — الحاق نقطهٔ زندهٔ امروز (خالص)', () => {
  const series: HistSeries = { closes: [100, 110, 120], dates: ['2026-11-17', '2026-11-18', '2026-11-19'] };

  test('آخرین نقطه امروز نیست → نقطهٔ زنده الحاق می‌شود', () => {
    const m = mergeLivePoint(series, '2026-11-20', 130, false);
    expect(m.closes).toEqual([100, 110, 120, 130]);
    expect(m.dates).toEqual(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
    expect(series.closes.length).toBe(3); // ورودی دست‌نخورده
  });

  test('آخرین نقطه امروز است → جایگزین می‌شود (نه الحاق دوباره)', () => {
    const m = mergeLivePoint(series, '2026-11-19', 125, false);
    expect(m.closes).toEqual([100, 110, 125]);
    expect(m.dates.length).toBe(3);
  });

  test('قیمت ریالی زنده → تقسیم بر ۱۰؛ زندهٔ نامعتبر → سری دست‌نخورده', () => {
    const m = mergeLivePoint(series, '2026-11-20', 2_600_000, true);
    expect(m.closes[3]).toBe(260_000);
    const none = mergeLivePoint(series, '2026-11-20', null, false);
    expect(none).toBe(series);
    const bad = mergeLivePoint(series, '2026-11-20', Number.NaN, false);
    expect(bad).toBe(series);
  });
});

describe('assets-chart — پنل و اسپارک‌لاین (خالص)', () => {
  const asset = CHART_ASSETS.find((a) => a.key === 'usd')!;

  test('CHART_ASSETS — شش دارایی شاخص با کلید/نماد یکتا', () => {
    expect(CHART_ASSETS.length).toBe(6);
    expect(new Set(CHART_ASSETS.map((a) => a.key)).size).toBe(6);
    expect(new Set(CHART_ASSETS.map((a) => a.symbol)).size).toBe(6);
    expect(CHART_ASSETS.map((a) => a.key)).toEqual(['usd', 'gold', 'coin', 'tse', 'btc', 'brent']);
    expect(CHART_DAYS).toBe(30);
  });

  test('buildChartPanel — درصد بازه (نخست→آخر) و واحد؛ سری نال/کوتاه → null', () => {
    const series: HistSeries = {
      closes: Array.from({ length: 10 }, (_, i) => 100 + i), // ۱۰۰→۱۰۹ → +۹٪
      dates: Array.from({ length: 10 }, (_, i) => `2026-11-${11 + i}`),
    };
    const p = buildChartPanel(asset, series);
    expect(p).not.toBeNull();
    expect(p!.pct).toBe(9);
    expect(p!.title).toBe('دلار آزاد');
    expect(p!.firstDate).toBe('2026-11-11');
    expect(p!.lastDate).toBe('2026-11-20');
    expect(buildChartPanel(asset, null)).toBeNull();
    expect(buildChartPanel(asset, { closes: [1, 2], dates: ['a', 'b'] })).toBeNull();
  });

  test('sparklinePoints — راست‌به‌چپ: قدیم در راست، جدید در چپ؛ بیشینه بالا/کمینه پایین', () => {
    const values = [10, 30, 20, 50, 40]; // نخست=۱۰ (قدیم)، آخر=۴۰ (جدید)
    const sp = sparklinePoints(values, 0, 0, 100, 50);
    const [x0] = sp.pts.split(' ')[0]!.split(',').map(Number);
    const [xLast, yLast] = sp.pts.split(' ')[4]!.split(',').map(Number);
    expect(x0).toBeCloseTo(100, 0); // قدیم‌ترین → راست
    expect(xLast).toBeCloseTo(0, 0); // جدیدترین → چپ
    // بیشینه (۵۰) → کمترین y (بالا)
    const [xMax, yMax] = sp.pts.split(' ')[3]!.split(',').map(Number);
    expect(xMax).toBeCloseTo(25, 0);
    expect(yMax).toBeCloseTo(0, 0);
    expect(yLast).toBeGreaterThan(0); // ۴۰ بین بالا و پایین
    expect(sp.area.startsWith('100.0,50.0')).toBe(true); // ناحیه از پایینِ راست شروع می‌شود
  });

  test('سری ثابت (بدون نوسان) → خط وسط، بدون NaN', () => {
    const sp = sparklinePoints([5, 5, 5, 5], 10, 20, 100, 40);
    expect(sp.pts).not.toContain('NaN');
    const ys = sp.pts.split(' ').map((p) => Number(p.split(',')[1]));
    for (const y of ys) expect(y).toBe(40); // y + h/2 = ۲۰+۲۰
  });
});

describe('assets-chart — SVG و رندر PNG', () => {
  function panelsFixture(): { date: typeof CARD_DATE; panels: ChartPanel[] } {
    const panels: ChartPanel[] = CHART_ASSETS.map((a, ai) => {
      const up = ai % 2 === 0;
      const closes = Array.from({ length: 30 }, (_, i) => 1000 + (up ? i : -i) * (ai + 1));
      const dates = Array.from({ length: 30 }, (_, i) => `2026-10-${String(22 + i).padStart(2, '0')}`);
      return buildChartPanel(a, { closes, dates })!;
    }).filter((p): p is ChartPanel => Boolean(p));
    return { date: CARD_DATE, panels };
  }

  test('SVG کامل — هر شش عنوان، نشان درصد فارسی، بدون NaN/undefined', () => {
    const svg = makeAssetsChartSvg(panelsFixture());
    expect(svg.length).toBeGreaterThan(3000);
    for (const a of CHART_ASSETS) expect(svg).toContain(a.title);
    expect(svg).toContain('نمودار روند دارایی‌ها');
    expect(svg).toContain(`روند ${faDigits('30')} روز اخیر`);
    expect(svg).toContain('▲');
    expect(svg).toContain('▼');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
  });

  test('کمتر از ۳ پنل → SVG خالی (هیچ نیم‌نموداری ارسال نمی‌شود)', () => {
    const { date, panels } = panelsFixture();
    expect(makeAssetsChartSvg({ date, panels: panels.slice(0, 2) })).toBe('');
    expect(makeAssetsChartSvg({ date, panels: [] })).toBe('');
  });

  test('رندر واقعی PNG — ابعاد شبکهٔ ۲×۳ (۱۰۸۰×۱۱۰۲) و امضای درست', async () => {
    const card = await renderAssetsChartPng(panelsFixture());
    expect(card).not.toBeNull();
    expect(card!.width).toBe(1080);
    expect(card!.height).toBe(1102); // ۱۷۰ سربرگ + ۲۰ + ۳×۲۶۰ + ۲×۲۴ + ۸۴ پانوشت
    expect(card!.png.length).toBeGreaterThan(50_000);
    const sig = Array.from(card!.png.slice(0, 8)).join(',');
    expect(sig).toBe('137,80,78,71,13,10,26,10');
  }, 30_000);

  test('پنل ناکافی → رندر null', async () => {
    const { date, panels } = panelsFixture();
    expect(await renderAssetsChartPng({ date, panels: panels.slice(0, 1) })).toBeNull();
  });
});
