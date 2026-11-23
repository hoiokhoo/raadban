/**
 * خواستهٔ کاربر ۲۳ نوامبر ۲۰۲۶ (رصدبازار) — دو شاخه:
 *  ۱) «بخش قیمتها و نمودار قیمتی باید ساعت ۱۵ هرروز باشه نه ساعت ۳ صبح» —
 *     اسلات واحد ۱۵:۰۰ تهران (پیش‌فرض bot.ts + workflow)؛ پایهٔ درصد = «دیروز ساعت ۱۵».
 *  ۲) «قیمت ماشین ها اولا کاملتر بشن، دوما به ترتیب قیمت چیده بشن، سوما هنوز قیمت
 *     کارخانه بعضیهاشون نیومده، اولا چک کن از سایت باما دات کام آخرین قیمت کارخونه و بازارو» —
 *     ریشهٔ «قیمت کارخانه نیومده»: باما برای بیشتر مدل‌ها «قیمت کارخانه» می‌نویسد نه
 *     «قیمت نمایندگی» (نمونهٔ واقعی: پراید ۱۵۱ کارخانه ۱٬۱۹۰میلیارد)؛ پارسر فقط یکی را
 *     می‌گرفت. پوشش ۳۸ خانواده + ادغام کانال/باما + مرتب‌سازی صعودی قیمت.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseBamaPrices,
  CAR_BAMA_MODELS,
  mergeCarQuotes,
  normalizeCarModel,
  type BamaCarResult,
  type Quote,
} from '../bot/market';
import { makeMarketCardSvg, marketSectionsOf } from '../bot/market-card';

// ---------- (۱) پارسر باما — هر دو برچسب رسمی ----------

describe('parseBamaPrices — «قیمت کارخانه» و «قیمت نمایندگی» هر دو (ریشهٔ سوما)', () => {
  // قالب واقعی صفحهٔ bama.ir/price/pride_151_gx — ۲۳ نوامبر ۲۰۲۶
  const PRIDE_HTML = `<div>قیمت بازار 1,710,000,000 تومان</div>
  <span>1405 قیمت کارخانه 1,190,000,000 تومان</span>
  <span>1404 قیمت کارخانه 1,212,000,000 تومان</span>`;

  test('برچسب «قیمت کارخانه» (اکثر مدل‌های داخلی) — نخستین تطبیق', () => {
    const p = parseBamaPrices(PRIDE_HTML);
    expect(p.market).toBe(1710000000);
    expect(p.factory).toBe(1190000000);
  });

  test('برچسب «قیمت نمایندگی» (جک/فونیکس و…) همچنان می‌گیرد — J4 واقعی', () => {
    const p = parseBamaPrices('<p>قیمت بازار 3,550,000,000 تومان</p><p>قیمت نمایندگی 1,610,000,000 تومان</p>');
    expect(p.market).toBe(3550000000);
    expect(p.factory).toBe(1610000000);
  });

  test('فقط بازار → کارخانه null؛ خالی → هر دو null', () => {
    expect(parseBamaPrices('<p>قیمت بازار 1,200,000,000 تومان</p>').factory).toBeNull();
    expect(parseBamaPrices('')).toEqual({ market: null, factory: null });
  });
});

// ---------- (۲) ادغام کانال/باما + ترتیب قیمت ----------

function chan(key: string, title: string, value: number): Quote {
  return { key: `car:${normalizeCarModel(key)}`, title, value, unit: 'toman', srcLabel: 'کانال اخبار خودرو', emoji: '🚗' };
}

describe('mergeCarQuotes — کاملتر + به ترتیب قیمت + کارخانهٔ باما (خواستهٔ ۲۳ نوامبر)', () => {
  const channel: Quote[] = [
    chan('پ207 tu3', 'پ207 tu3', 2755000000), // کانال می‌نویسد «پ207» نه «پژو 207»
    chan('کوییک gx', 'کوییک gx', 1830000000),
    chan('تیبا', 'تیبا', 900000000), // خارج از پوشش باما (تولید قطع) — باید بماند
    chan('ریرا', 'ریرا', 5680000000), // variant دوم «ریرا»
    chan('هایما s8', 'هایما s8', 8230000000), // variant دوم «هایما s8»
  ];
  const bama: BamaCarResult[] = [
    { variants: ['پژو 207', 'پ207', 'پژو207'], label: 'پژو ۲۰۷', market: 2870000000, factory: 1792000000 },
    { variants: ['کوییک', 'کوئیک'], label: 'کوییک', market: null, factory: 1032000000 }, // بازار باما خالی → بازار کانال
    { variants: ['الیت', 'فیدلیتی الیت'], label: 'فیدلیتی الیت ۷نفره', market: 8000000000, factory: 6458000000 },
    { variants: ['ری را', 'ریرا'], label: 'ری‌را', market: 5500000000, factory: 3230000000 },
    { variants: ['هایما 8s', 'هایما s8'], label: 'هایما 8S', market: 8200000000, factory: 3377000000 },
    { variants: ['ساینا'], label: 'ساینا', market: null, factory: null }, // هیچ منبعی → غایب صادقانه
  ];

  test('مرتب‌سازی صعودی بر اساس قیمت بازار (ارزان → گران)', () => {
    const out = mergeCarQuotes(channel, bama);
    const vals = out.map((q) => q.value);
    expect([...vals].sort((a, b) => a - b)).toEqual(vals);
  });

  test('بازارِ باما مقدم (جفت هم‌تیپ با کارخانه)؛ بازار باما خالی → بازار کانال؛ کارخانه همیشه از باما', () => {
    const out = mergeCarQuotes(channel, bama);
    const peugeot = out.find((q) => q.title === 'پژو ۲۰۷');
    expect(peugeot?.value).toBe(2870000000); // باما، نه ۲٬۷۵۵ کانال
    expect(peugeot?.factoryToman).toBe(1792000000);
    expect(peugeot?.srcLabel).toBe('باما (نت)');
    const quick = out.find((q) => q.title === 'کوییک');
    expect(quick?.value).toBe(1830000000); // پشتیبان کانال
    expect(quick?.factoryToman).toBe(1032000000); // کارخانه از باما
    expect(quick?.srcLabel).toBe('کانال اخبار خودرو');
  });

  test('خانوادهٔ بدون هیچ منبع (ساینا) غایب صادقانه؛ مدل بی‌پوشش باما (تیبا) دست‌نخورده می‌ماند', () => {
    const out = mergeCarQuotes(channel, bama);
    expect(out.some((q) => q.title === 'ساینا')).toBe(false);
    expect(out.some((q) => q.title === 'تیبا')).toBe(true);
  });

  test('تطبیق variantهای کانالی («پ207»، «ریرا»، «هایما s8») — ردیف کانالِ همان خانواده تکرار نمی‌شود', () => {
    const out = mergeCarQuotes(channel, bama);
    expect(out.filter((q) => q.key.includes('207')).length).toBe(1);
    expect(out.filter((q) => q.key.includes('ریرا') || q.key.includes('ری را')).length).toBe(1);
    expect(out.filter((q) => q.key.includes('هایما')).length).toBe(1);
  });

  test('فهرست خالی هر دو طرف → خالی', () => {
    expect(mergeCarQuotes([], [])).toEqual([]);
  });
});

// ---------- (۳) فهرست باما — یکتایی و پوشش ----------

describe('CAR_BAMA_MODELS — یکتایی کلیدها و URLهای واقعی', () => {
  test('هیچ کلید خانواده‌ای دوبار نیست و همه bama.ir/price/… هستند', () => {
    const keys = CAR_BAMA_MODELS.map((m) => normalizeCarModel(m.variants[0]));
    expect(new Set(keys).size).toBe(CAR_BAMA_MODELS.length);
    expect(CAR_BAMA_MODELS.every((m) => /^https:\/\/bama\.ir\/price\/[a-z0-9_.-]+$/.test(m.url))).toBe(true);
  });
});

// ---------- (۴) اسلات ۱۵:۰۰ — پیش‌فرض bot.ts + workflow ----------

describe('اسلات گزارش بازار ۱۵:۰۰ (خواستهٔ ۲۳ نوامبر)', () => {
  test('پیش‌فرض bot.ts ساعت ۱۵ است، نه ۳ صبح', () => {
    const src = readFileSync(resolve(import.meta.dir, '../bot/bot.ts'), 'utf8');
    expect(src).toContain("parseSlots(process.env.PRICE_HOURS, '15:00')");
    expect(src).not.toContain("parseSlots(process.env.PRICE_HOURS, '03:00')");
  });

  test('workflow — PRICE_HOURS فقط 15:00', () => {
    const yml = readFileSync(resolve(import.meta.dir, '../.github/workflows/bale-bot.yml'), 'utf8');
    expect(yml).toContain("PRICE_HOURS: '15:00'");
    expect(yml).not.toContain("PRICE_HOURS: '03:00'");
  });
});

// ---------- (۵) کارت بازار — همهٔ خودروها روی کارت ----------

describe('کارت بازار — سقف ردیف خودرو ۴۰ (کاملتر روی عکس)', () => {
  const mk = (i: number): Quote => ({
    key: `car:m${i}`, title: `مدل ${i}`, value: 1e9 + i * 1e8, unit: 'toman', srcLabel: 'باما (نت)', emoji: '🚗',
  });

  test('۱۲ ردیف خودرو همه در بخش خودرو می‌آیند — بدون «مدل دیگر»', () => {
    const { sections, moreCars } = marketSectionsOf(Array.from({ length: 12 }, (_, i) => mk(i)));
    const cars = sections.find((s) => s.title.includes('خودرو'));
    expect(cars?.rows.length).toBe(12);
    expect(moreCars).toBe(0);
  });

  test('مازاد واقعی فقط با ۴۰+ ردیف — یادداشت «مدل دیگر»', () => {
    const { sections, moreCars } = marketSectionsOf(Array.from({ length: 43 }, (_, i) => mk(i)));
    const cars = sections.find((s) => s.title.includes('خودرو'));
    expect(cars?.rows.length).toBe(40);
    expect(moreCars).toBe(3);
  });

  test('SVG با ۱۲ خودرو رندر می‌شود و پانوشت «دیروز ساعت ۱۵» دارد', () => {
    const svg = makeMarketCardSvg({
      date: { weekdayFa: 'دوشنبه', shamsi: '۱۴۰۵/۰۹/۰۲', miladi: '2026-11-23' } as never,
      slotLabel: 'گزارش روزانه (ساعت ۱۵)',
      quotes: Array.from({ length: 12 }, (_, i) => mk(i)),
    });
    expect(svg).toContain('گزارش روزانه (ساعت ۱۵)');
    expect(svg).toContain('دیروز ساعت ۱۵');
    expect(svg).not.toContain('دیروز ساعت ۳');
  });
});
