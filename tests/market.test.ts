/**
 * تست‌های واحد گزارش بازار رصدبان (bot/market.ts) — خواستهٔ ۹ نوامبر ۲۰۲۶:
 * پارس tgju/نوبیتکس/تستمسن، پارس فهرست قیمت خودرو کانال، درصد تغییر نسبت به گزارش قبلی، قالب پیام
 */
import { describe, expect, test } from 'bun:test';
import {
  applyDeltas, deltaPct, faGroup, faToEnDigits, formatMarketMessage, formatMoney, formatPct,
  normalizeCarModel, num, parseBamaMarketPrice, parseCarLine, parseCarPriceLists, parseNobitexStats, parseTgjuCurrent,
  parseTsetmcMarketTotal, pickFeaturedCars, rialToToman, snapshotOf, xmlEsc,
  CAR_FEATURED,
  type Quote,
} from '../bot/market';

// ---------- ابزار عدد ----------

describe('num و faToEnDigits', () => {
  test('اعداد با جداکنندهٔ هزارگان و ارقام فارسی', () => {
    expect(num('2,649,000')).toBe(2649000);
    expect(num('۲۵۴٬۱۷۱٬۰۰۰')).toBe(254171000);
    expect(num('98.32')).toBe(98.32);
    expect(num('')).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num('قیمت نیست')).toBeNull();
  });

  test('faToEnDigits همهٔ ارقام فارسی/عربی', () => {
    expect(faToEnDigits('۱۲۳')).toBe('123');
    expect(faToEnDigits('٤٥٦')).toBe('456');
  });

  test('rialToToman — tgju ریال می‌دهد، تومان = ÷۱۰', () => {
    expect(rialToToman(2541710000)).toBe(254171000);
    expect(rialToToman(0)).toBeNull();
    expect(rialToToman(null)).toBeNull();
  });
});

describe('قالب فارسی', () => {
  test('faGroup جداکنندهٔ هزارگان', () => {
    expect(faGroup(25417100)).toBe('۲۵٬۴۱۷٬۱۰۰');
    expect(faGroup(1200)).toBe('۱٬۲۰۰');
    expect(faGroup(8089993.5, 0)).toBe('۸٬۰۸۹٬۹۹۴');
  });

  test('formatMoney — تومان/دلار/میلیارد', () => {
    expect(formatMoney(25417100, 'toman')).toContain('تومان');
    expect(formatMoney(1.249e9, 'toman')).toContain('میلیارد تومان');
    expect(formatMoney(98.32, 'usd')).toContain('دلار');
  });

  test('formatPct — صعودی/نزولی/بدون تغییر/نامشخص', () => {
    expect(formatPct(1.2).startsWith('▲')).toBe(true);
    expect(formatPct(-0.8).startsWith('▼')).toBe(true);
    expect(formatPct(0)).toBe('بدون تغییر');
    expect(formatPct(undefined)).toBe('—');
  });

  test('xmlEsc امن برای parse_mode HTML', () => {
    expect(xmlEsc('<b>&')).toBe('&lt;b&gt;&amp;');
  });
});

// ---------- tgju ----------

describe('parseTgjuCurrent', () => {
  test('پارس پاسخ واقعی‌نما', () => {
    const cur = parseTgjuCurrent(JSON.stringify({
      current: {
        geram18: { p: '2,541,710,000', d: '1.24', dt: 'high' },
        geram24: { p: '3,388,920,000', d: '0' },
        sekee: { p: '25,741,000,000' },
        oil_brent: { p: '98.32' },
        bourse: { p: '8,089,993.5' },
      },
    }));
    expect(cur.geram18?.p).toBe('2,541,710,000');
    expect(Object.keys(cur).length).toBe(5);
  });

  test('پاسخ خراب → خالی (هیچ استثنا)', () => {
    expect(parseTgjuCurrent('not json')).toEqual({});
    expect(parseTgjuCurrent('{"current":null}')).toEqual({});
  });
});

// ---------- نوبیتکس ----------

describe('parseNobitexStats', () => {
  test('پارس پاسخ استاندارد (ریال → تومان)', () => {
    const st = parseNobitexStats(JSON.stringify({
      status: 'ok',
      stats: {
        btc: { latest: '201500000000', dayChange: '2.1' },
        usdt: { latest: '26500000', dayChange: '-0.3' },
      },
    }));
    expect(st.btcToman).toBe(20150000000);
    expect(st.usdToman).toBe(2650000);
    expect(st.btcChangePct).toBe(2.1);
    expect(st.usdChangePct).toBe(-0.3);
  });

  test('پاسخ خطا → خالی', () => {
    expect(parseNobitexStats('{"status":"error"}')).toEqual({});
    expect(parseNobitexStats('garbage')).toEqual({});
  });
});

// ---------- شاخص بورس ----------

describe('parseTsetmcMarketTotal', () => {
  test('خط اول CSV — شاخص و تغییر', () => {
    const t = parseTsetmcMarketTotal('8089993.50,-5321.10,8050000,8120000,...');
    expect(t.index).toBe(8089993.5);
    expect(t.changePct).toBeCloseTo(-0.07, 2);
  });

  test('متن خراب → خالی', () => {
    expect(parseTsetmcMarketTotal('').index).toBeUndefined();
    expect(parseTsetmcMarketTotal('garbage,..').index).toBeUndefined();
  });
});

// ---------- خودرو ----------

const SAMPLE_LIST = `🔴قیمت روز خودرو

🔹آخرین بروزرسانی قیمت خودروهای پرفروش پلاک ملی، ۱۷ مرداد ۱۴۰۵.

ساینا ضبط⬅️1.249
سهند⬅️1.380
کوئیک(S)ضبط⬅️1.179
شاهین دنده بامانیتور⬅️1.855
سورن(XU7P)⬅️برق:1.565/رینگ:1.597
تارا(V1)⬅️1.905
پ۲۰۷ هیدرول⬅️1.775
دنا اتو⬅️2.683
پراید⬅️485
تیبا⬅️520
پیکان⬅️350`;

describe('parseCarLine', () => {
  test('خط استاندارد «مدل⬅️قیمت» — زیر ۳۰ = میلیارد تومان', () => {
    const e = parseCarLine('ساینا ضبط⬅️1.249');
    expect(e?.model).toBe('ساینا ضبط');
    expect(e?.valueToman).toBe(1.249e9);
  });

  test('قیمت ≥ ۳۰ = میلیون تومان (خودروی اقتصادی)', () => {
    expect(parseCarLine('پراید⬅️485')?.valueToman).toBe(485e6);
  });

  test('خط مرکب — اولین عدد بعد از جداکننده', () => {
    const e = parseCarLine('سورن(XU7P)⬅️برق:1.565/رینگ:1.597');
    expect(e?.valueToman).toBe(1.565e9);
    expect(e?.model).toContain('سورن');
  });

  test('خط بی‌قیمت/تبلیغات رد می‌شود', () => {
    expect(parseCarLine('این متن خبری معمولی است')).toBeNull();
    expect(parseCarLine('تماس: 09133530284')).toBeNull();
    expect(parseCarLine('⬅️1.2')).toBeNull();
  });
});

describe('parseCarPriceLists و pickFeaturedCars', () => {
  test('فهرست واقعی — همهٔ خطوط با مدل یکتا؛ پیام کمتر از ۳ خط رد می‌شود', () => {
    const cars = parseCarPriceLists([{ text: SAMPLE_LIST, date: '2026-11-08T09:00:00+00:00' }, { text: 'یک خط⬅️1.2' }]);
    const models = cars.map((c) => normalizeCarModel(c.model));
    expect(models.length).toBeGreaterThanOrEqual(10);
    expect(models).toContain(normalizeCarModel('پراید'));
    expect(models).toContain(normalizeCarModel('تیبا'));
  });

  test('تازه‌ترین قیمت هر مدل می‌ماند', () => {
    const cars = parseCarPriceLists([
      { text: SAMPLE_LIST, date: '2026-11-08T09:00:00+00:00' },
      { text: 'پراید⬅️490\nتیبا⬅️525\nپیکان⬅️355', date: '2026-11-08T11:00:00+00:00' },
    ]);
    const prid = cars.find((c) => normalizeCarModel(c.model) === normalizeCarModel('پراید'));
    expect(prid?.valueToman).toBe(490e6);
  });

  test('pickFeaturedCars — مدل‌های پرتقاضا اول؛ کمتر از ۴ → تازه‌ترین‌ها', () => {
    const cars = parseCarPriceLists([{ text: SAMPLE_LIST }]);
    const feat = pickFeaturedCars(cars, 10);
    expect(feat.length).toBe(10);
    const norm = feat.map((c) => normalizeCarModel(c.model));
    expect(norm.some((m) => m.includes('پراید'))).toBe(true);
    expect(norm.some((m) => m.includes('تارا'))).toBe(true);
  });
});

// ---------- درصد تغییر نسبت به گزارش قبلی ----------

describe('deltaPct و applyDeltas', () => {
  test('deltaPct محاسبهٔ دقیق', () => {
    expect(deltaPct(100, 105)).toBe(5);
    expect(deltaPct(100, 98)).toBe(-2);
    expect(deltaPct(0, 5)).toBeNull();
    expect(deltaPct(100, 100)).toBe(0);
  });

  const mk = (key: string, value: number, srcPct?: number): Quote =>
    ({ key, title: key, value, unit: 'toman', srcLabel: 'tgju', emoji: '•', ...(srcPct !== undefined ? { changePct: srcPct } : {}) });

  test('اولویت: تغییر نسبت به گزارش قبلی؛ نبود → تغییر روز منبع؛ هیچ → none', () => {
    const quotes = [mk('geram18', 10500000, 1.24), mk('usd', 2650000, -0.3), mk('sekee', 2574100000, 1.24), mk('nim', 135000000)];
    const out = applyDeltas(quotes, { geram18: 10000000, usd: 2700000 });
    expect(out[0].changePct).toBe(5);
    expect(out[0].changeSrc).toBe('prev');
    expect(out[1].changePct).toBeCloseTo(-1.85, 2);
    expect(out[1].changeSrc).toBe('prev');
    expect(out[2].changePct).toBe(1.24); // بی‌سابقه → تغییر روز منبع
    expect(out[2].changeSrc).toBe('source');
    expect(out[3].changePct).toBeUndefined();
    expect(out[3].changeSrc).toBe('none');
  });

  test('snapshotOf فقط مقادیر معتبر', () => {
    const snap = snapshotOf([mk('a', 100), mk('b', 0)]);
    expect(snap).toEqual({ a: 100 });
  });
});

// ---------- قالب پیام ----------

describe('formatMarketMessage', () => {
  test('پیام کامل — بدون سربرگ، بدون سطر شکست/راهنما/منابع؛ خودرو با عنوان تازه (خواستهٔ ۱۲ نوامبر)', () => {
    const quotes: Quote[] = [
      { key: 'car:پراید', title: 'پراید', value: 485e6, unit: 'toman', srcLabel: 'کانال اخبار خودرو', emoji: '🚗' },
      { key: 'car:sr3', title: 'کی ام سی SR3', value: 5.55e9, unit: 'toman', srcLabel: 'باما (نت)', emoji: '🚗' },
      { key: 'geram18', title: 'طلای ۱۸ عیار', value: 25417100, unit: 'toman', srcLabel: 'tgju', emoji: '🥇' },
      { key: 'usd', title: 'دلار (تتر نوبیتکس)', value: 2649000, unit: 'toman', srcLabel: 'نوبیتکس', emoji: '💵', changePct: -0.3 },
      { key: 'tedpix', title: 'شاخص کل بورس', value: 8089993, unit: 'index', srcLabel: 'tgju', emoji: '📈' },
      { key: 'btc', title: 'بیت‌کوین', value: 76100, unit: 'usd', srcLabel: 'tgju', emoji: '₿' },
      { key: 'oil_brent', title: 'نفت برنت', value: 98.32, unit: 'usd', srcLabel: 'tgju', emoji: '🛢' },
    ];
    const msg = formatMarketMessage(quotes, { 'car:پراید': 480e6, geram18: 25417100 });
    expect(msg).not.toContain('گزارش بازار رصدبان');
    expect(msg).not.toContain('دریافت نشد');
    expect(msg).not.toContain('منابع:');
    expect(msg).not.toContain('٪ تغییر نسبت به');
    expect(msg).not.toContain('کف بازار');
    expect(msg).toContain('🚗 آخرین قیمت بازار آزاد خودرو:');
    expect(msg).toContain('پراید: ۴۸۵٬۰۰۰٬۰۰۰ تومان');
    expect(msg).toContain('کی ام سی SR3: ۵٫۵۵۰ میلیارد تومان');
    expect(msg).toContain('طلای ۱۸ عیار: ۲۵٬۴۱۷٬۱۰۰ تومان (بدون تغییر)');
    expect(msg).toContain('شاخص کل بورس');
    expect(msg).toContain('بیت‌کوین');
    expect(msg).toContain('۹۸٫۳۲ دلار');
    // مقایسه با گزارش قبل: پراید ۴۸۵ → ۴۸۵ میلیون
    expect(msg).toContain('▲۱٫۰٪');
  });

  test('پیام بدون قلم خودرو — بخش خودرو نمی‌آید', () => {
    const msg = formatMarketMessage([{ key: 'usd', title: 'دلار', value: 2650000, unit: 'toman', srcLabel: 'tgju', emoji: '💵' }], undefined);
    expect(msg).not.toContain('خودرو');
    expect(msg).toContain('دلار');
  });

  test('parseBamaMarketPrice — نخستین قیمت بازار صفحهٔ باما (تیپ جدیدتر)', () => {
    const html = '<div>1405 قیمت بازار 5,550,000,000 تومان</div><div>1404 قیمت بازار 5,350,000,000 تومان</div>';
    expect(parseBamaMarketPrice(html)).toBe(5550000000);
    expect(parseBamaMarketPrice('<p>قیمت یافت نشد</p>')).toBeNull();
    expect(parseBamaMarketPrice('')).toBeNull();
  });

  test('خانوادهٔ کرمان موتور در فهرست پرتقاضا — خواستهٔ کاربر: j4 و sr3 حتماً', () => {
    const m = CAR_FEATURED.map((f) => f.match);
    expect(m).toContain('sr3');
    expect(m).toContain('j4');
    expect(m).toContain('j7');
  });
});
