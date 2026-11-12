/**
 * تست‌های وقایع روز در تاریخ — خواستهٔ کاربر (۱۲ نوامبر ۲۰۲۶):
 * «بخش وقایع روز رو جامع‌تر کنی… می‌خوام از این دست وقایع رو تو هم بدی» — نمونهٔ کاربر:
 * «۲۱ آبان ۱۲۷۶؛ زادروز نیما یوشیج، پدر شعر نو فارسی.»
 *
 * پوشش: عنوان صفحهٔ روز، پارسر متن ویکی (رویدادها/زادروزها/درگذشت‌ها، پانویس، مدخل بی‌سال،
 * بخش «درگذشتگان»)، فرمت‌کنندهٔ بلوک (پیشوند زادروز/درگذشت، سقف‌ها، خالی → حذف)،
 * و پیوند با پیام صبحگاهی/شبانگاهی.
 */
import { describe, expect, test } from 'bun:test';
import { faWikiDayTitle, parseFaWikiDayWikitext, formatDayHistoryBlock, cleanWikiText, dayHistoryApiUrl, pruneDayHistoryCache, dayHistoryFromCache, JALALI_MONTHS, type DayHistoryEntry, type DayHistoryCacheEntry } from '../bot/day-history';
import { buildDailyMessage, BISMILLAH } from '../bot/daily';
import { HADITH_BANK } from '../bot/hadiths-data';
import { tripleDateOf } from '../bot/calendar';

// ---------- فیکسچر واقعی — ساختار صفحهٔ «۲۱ آبان» ویکی‌پدیای فارسی (کوتاه‌شده) ----------
const ABAN21_WIKITEXT = `{{آبان}}
'''۲۱ آبان/عقرب''' دویست و سی و هفتمین روز سال در [[گاه‌شماری خورشیدی]] است. به پایان سال ۱۲۸ روز (۱۲۹ روز در سال کبیسه) باقی‌است.

== رویدادها ==
* [[۹۷۷ (خورشیدی)|۹۷۷]] - انتخاب [[اصفهان]] به عنوان [[فهرست پایتخت‌های ایران|پایتخت ایران]] توسط [[شاه عباس یکم]] صفوی <ref>https://donya-e-eqtesad.com/example</ref>
* [[۱۱۰۸ (خورشیدی)|۱۱۰۸]] - [[نبرد مورچه خورت]]
* [[۱۳۲۸ (خورشیدی)|۱۳۲۸]] - بنیان‌گذاری [[جبهه ملی ایران]]
* [[۱۳۹۰ (خورشیدی)|۱۳۹۰]] - [[انفجار بیدگنه]]
* [[۱۳۹۴ (خورشیدی)|۱۳۹۴]] - [[سیل ۱۳۹۴ رودان]]

== زادروزها ==
* [[۱۲۷۶ (خورشیدی)|۱۲۷۶]] - [[نیما یوشیج]]، پدر [[شعر نوی فارسی]]
* [[۱۳۲۷ (خورشیدی)|۱۳۲۷]] - [[حسن روحانی]]، هفتمین [[رئیس‌جمهور ایران]]
* ۱۳۸۲ -علی شمس، استعداد یاب

== درگذشت‌ها ==
* [[۱۳۴۴ (خورشیدی)|۱۳۴۴]] - [[روح‌الله خالقی]]، آهنگساز
* [[۱۳۹۰ (خورشیدی)|۱۳۹۰]] - [[حسن طهرانی مقدم]]، نظامی و ملقب به پدر موشکی [[ایران]]

== منابع ==
{{پانویس}}

[[رده:روزهای آبان]]`;

// بخش «درگذشتگان» (نام دوم رایج) + بخش «مناسبت‌ها» که باید نادیده گرفته شود — صفحهٔ «۲۲ بهمن»
const BAHMAN22_WIKITEXT = `'''۲۲ بهمن''' سیصد و بیست و هشتمین روز سال است.

== مناسبت‌ها ==
* [[دهه فجر|دهه فجر]]
* [[راهپیمایی ۲۲ بهمن]]

== رویدادها ==
* [[۱۲۰۷ (خورشیدی)|۱۲۰۷]] - [[حمله به سفارت روسیه در تهران]] و قتل سفیر روسیه
* [[۱۳۵۷ (خورشیدی)|۱۳۵۷]] - [[انقلاب ۱۳۵۷|پیروزی انقلاب ۱۳۵۷]]<ref name="تقویم ۸۵">منبع تقویم دانشگاه تهران</ref>

== زادروزها ==
* [[۱۳۲۹ (خورشیدی)|۱۳۲۹]] - [[مجید مظفری]]، بازیگر

== درگذشتگان ==
* [[۱۴۰۰ (خورشیدی)|۱۴۰۰]] - [[حلیمه سعیدی]]، بازیگر`;

// مدخل بی‌سال (واقعی صفحهٔ ۱ فروردین) — باید صادقانه رد شود
const NO_YEAR_LINE = `== رویدادها ==
* [[۱ (خورشیدی)|۱]] - سرآغاز گاه‌شماری هجری خورشیدی
* اعلام [[سید ضیاءالدین طباطبایی]] مبنی بر تشکیل اداره بلدیه در تهران`;

describe('عنوان صفحهٔ روز خورشیدی', () => {
  test('۲۱ آبان — روزِ نمونهٔ کاربر (۱۲ نوامبر ۲۰۲۶ = ۲۱ آبان ۱۴۰۵)', () => {
    expect(faWikiDayTitle({ y: 1405, m: 8, d: 21 })).toBe('۲۱ آبان');
    // تطبیق تقویم Intl با عنوان ویکی‌پدیا
    const td = tripleDateOf('2026-11-12', 'Asia/Tehran', 'umalqura');
    expect(td.keys.j.m).toBe(8);
    expect(td.keys.j.d).toBe(21);
    expect(faWikiDayTitle(td.keys.j)).toBe('۲۱ آبان');
  });
  test('۳۰ اسفند و ماه‌ها', () => {
    expect(faWikiDayTitle({ y: 1405, m: 12, d: 30 })).toBe('۳۰ اسفند');
    expect(JALALI_MONTHS.length).toBe(12);
    expect(JALALI_MONTHS[0]).toBe('فروردین');
    expect(JALALI_MONTHS[2]).toBe('خرداد');
  });
  test('ورودی نامعتبر → رشتهٔ خالی', () => {
    expect(faWikiDayTitle({ y: 1405, m: 13, d: 1 })).toBe('');
    expect(faWikiDayTitle({ y: 1405, m: 8, d: 0 })).toBe('');
    expect(faWikiDayTitle({ y: 1405, m: 8, d: 32 })).toBe('');
  });
  test('نشانی API عنوان را درست کد می‌کند', () => {
    const u = dayHistoryApiUrl('۲۱ آبان');
    expect(u).toContain('fa.wikipedia.org');
    expect(u).toContain(encodeURIComponent('۲۱ آبان'));
    expect(u).toContain('rvprop=content');
  });
});

describe('پارسر متن ویکی صفحهٔ روز', () => {
  test('رویدادها، زادروزها و درگذشت‌های صفحهٔ ۲۱ آبان — دقیقاً نمونهٔ کاربر', () => {
    const es = parseFaWikiDayWikitext(ABAN21_WIKITEXT);
    // رویدادها
    const events = es.filter((e) => e.kind === 'event');
    expect(events.length).toBe(5);
    expect(events[0].year).toBe(977);
    expect(events.find((e) => e.year === 1328)?.text).toContain('جبهه ملی ایران');
    expect(events.find((e) => e.year === 1390)?.text).toBe('انفجار بیدگنه');
    // زادروزها — نیما یوشیج مثل نمونهٔ کاربر
    const births = es.filter((e) => e.kind === 'birth');
    expect(births.find((e) => e.year === 1276)?.text).toBe('نیما یوشیج، پدر شعر نوی فارسی');
    expect(births.find((e) => e.year === 1327)?.text).toContain('حسن روحانی');
    // مدخل بدون پیوند («۱۳۸۲ -علی شمس») هم پارس می‌شود
    expect(births.find((e) => e.year === 1382)?.text).toBe('علی شمس، استعداد یاب');
    // درگذشت‌ها — تهرانی مقدم مثل نمونهٔ کاربر
    const deaths = es.filter((e) => e.kind === 'death');
    expect(deaths.find((e) => e.year === 1390)?.text).toBe('حسن طهرانی مقدم، نظامی و ملقب به پدر موشکی ایران');
    expect(deaths.find((e) => e.year === 1344)?.text).toBe('روح‌الله خالقی، آهنگساز');
  });
  test('پانویس و پیوندها کاملاً پاک می‌شوند', () => {
    const es = parseFaWikiDayWikitext(ABAN21_WIKITEXT);
    for (const e of es) {
      expect(e.text).not.toContain('<ref');
      expect(e.text).not.toContain('[');
      expect(e.text).not.toContain(']');
      expect(e.text).not.toContain('https://');
    }
    expect(es.find((e) => e.year === 977)?.text).not.toContain('ref');
  });
  test('بخش «درگذشتگان» (نام دوم) هم شناسایی می‌شود؛ بخش «مناسبت‌ها» نادیده گرفته می‌شود', () => {
    const es = parseFaWikiDayWikitext(BAHMAN22_WIKITEXT);
    expect(es.filter((e) => e.kind === 'event').length).toBe(2);
    expect(es.filter((e) => e.kind === 'birth').length).toBe(1);
    expect(es.filter((e) => e.kind === 'death').map((e) => e.text)).toEqual(['حلیمه سعیدی، بازیگر']);
    // مدخل‌های بخش مناسبت‌ها (دهه فجر و راهپیمایی) وارد بانک وقایع نشده‌اند
    expect(es.some((e) => e.text.includes('دهه فجر'))).toBe(false);
  });
  test('مدخل بی‌سال صادقانه رد می‌شود — در خط زمانی سال‌دار نمی‌نشیند', () => {
    const es = parseFaWikiDayWikitext(NO_YEAR_LINE);
    expect(es.length).toBe(1);
    expect(es[0].year).toBe(1);
    expect(es[0].text).toContain('سرآغاز گاه‌شماری');
    expect(es.some((e) => e.text.includes('ضیاءالدین'))).toBe(false);
  });
  test('ضدتکرار — مدخل یکسان دوبار نمی‌آید', () => {
    const dup = `${ABAN21_WIKITEXT}\n* [[۱۳۹۰ (خورشیدی)|۱۳۹۰]] - [[انفجار بیدگنه]]`;
    const es = parseFaWikiDayWikitext(dup);
    expect(es.filter((e) => e.year === 1390 && e.kind === 'event').length).toBe(1);
  });
  test('متن خراب/خالی → خروجی خالی (نه خطا)', () => {
    expect(parseFaWikiDayWikitext('')).toEqual([]);
    expect(parseFaWikiDayWikitext('{{آبان}} بدون بخش')).toEqual([]);
  });
  test('cleanWikiText — قالب درون پانویس و کدهای HTML', () => {
    expect(cleanWikiText('متن <ref name="x">{{یادکرد وب|عنوان=کتاب}}</ref> پایان')).toBe('متن پایان');
    expect(cleanWikiText('[[سید ضیاءالدین طباطبایی]]')).toBe('سید ضیاءالدین طباطبایی');
    expect(cleanWikiText('«[[الف|ب]]»')).toBe('«ب»');
  });
});

describe('فرمت‌کنندهٔ بلوک وقایع', () => {
  const entries: DayHistoryEntry[] = [
    { year: 977, text: 'انتخاب اصفهان به عنوان پایتخت ایران', kind: 'event' },
    { year: 1276, text: 'نیما یوشیج، پدر شعر نوی فارسی', kind: 'birth' },
    { year: 1390, text: 'حسن طهرانی مقدم، نظامی', kind: 'death' },
  ];
  test('قالب مثل نمونهٔ کاربر — سال؛ متن + پیشوند زادروز/درگذشت', () => {
    const b = formatDayHistoryBlock(entries, 'امروز');
    expect(b).toContain('📜 وقایع امروز در تاریخ');
    expect(b).toContain('• ۹۷۷؛ انتخاب اصفهان به عنوان پایتخت ایران');
    expect(b).toContain('• ۱۲۷۶؛ زادروز نیما یوشیج، پدر شعر نوی فارسی');
    expect(b).toContain('• ۱۳۹۰؛ درگذشت حسن طهرانی مقدم، نظامی');
    // ترتیب: رویدادها قبل از زادروزها قبل از درگذشت‌ها
    expect(b.indexOf('۹۷۷')).toBeLessThan(b.indexOf('۱۲۷۶'));
    expect(b.indexOf('۱۲۷۶')).toBeLessThan(b.indexOf('۱۳۹۰'));
  });
  test('خالی → رشتهٔ خالی (کل بخش از پیام حذف — هیچ ساختگی)', () => {
    expect(formatDayHistoryBlock([], 'امروز')).toBe('');
    expect(formatDayHistoryBlock(null as unknown as DayHistoryEntry[], 'فردا')).toBe('');
  });
  test('برچسب فردا', () => {
    expect(formatDayHistoryBlock(entries, 'فردا')).toContain('📜 وقایع فردا در تاریخ');
  });
  test('سقف‌ها — بیش از ۱۰ رویداد/۵ زادروز/۵ درگذشت نمایش داده نمی‌شود', () => {
    const many: DayHistoryEntry[] = [
      ...Array.from({ length: 14 }, (_, i) => ({ year: 1300 + i, text: `واقعهٔ شماره ${i}`, kind: 'event' as const })),
      ...Array.from({ length: 8 }, (_, i) => ({ year: 1300 + i, text: `چهرهٔ شماره ${i}`, kind: 'birth' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ year: 1300 + i, text: `درگذشتهٔ شماره ${i}`, kind: 'death' as const })),
    ];
    const b = formatDayHistoryBlock(many, 'امروز');
    expect(b).toContain('واقعهٔ شماره 9'); // دهمین رویداد
    expect(b).not.toContain('واقعهٔ شماره 10'); // یازدهمین نمایش داده نمی‌شود
    expect(b).toContain('چهرهٔ شماره 4');
    expect(b).not.toContain('چهرهٔ شماره 5');
    expect(b).toContain('درگذشتهٔ شماره 4');
    expect(b).not.toContain('درگذشتهٔ شماره 5');
  });
  test('متن بلند کوتاه می‌شود (حداکثر ۱۶۰ نویسه)', () => {
    const b = formatDayHistoryBlock([{ year: 1400, text: 'م'.repeat(400), kind: 'event' }], 'امروز');
    const line = b.split('\n').find((l) => l.includes('۱۴۰۰'))!;
    expect(line.length).toBeLessThan(180);
    expect(line.endsWith('…')).toBe(true);
  });
});

describe('حافظهٔ وقایع روز (ضد فشار به ویکی‌پدیا)', () => {
  const cache: Record<string, DayHistoryCacheEntry> = {
    '2026-11-10': { title: '۱۹ آبان', entries: [{ year: 1390, text: 'انفجار بیدگنه', kind: 'event' }], at: '2026-11-10T05:00:00.000Z' },
    '2026-11-12': { title: '۲۱ آبان', entries: [{ year: 1276, text: 'نیما یوشیج، پدر شعر نوی فارسی', kind: 'birth' }], at: '2026-11-12T01:30:00.000Z' },
    '2026-11-13': { title: '۲۲ آبان', entries: [], at: '2026-11-13T01:30:00.000Z' },
  };
  test('خواندن حافظهٔ همان روز — فقط مدخل غیرخالی معتبر است', () => {
    const h = dayHistoryFromCache(cache, '2026-11-12');
    expect(h?.title).toBe('۲۱ آبان');
    expect(h?.entries[0].text).toContain('نیما یوشیج');
    expect(h?.pageUrl).toContain(encodeURIComponent('۲۱ آبان'));
    // روز بی‌مدخل → null (بخش حذف می‌شود)
    expect(dayHistoryFromCache(cache, '2026-11-13')).toBeNull();
    // روز غایب → null
    expect(dayHistoryFromCache(cache, '2026-11-01')).toBeNull();
    expect(dayHistoryFromCache(undefined, '2026-11-12')).toBeNull();
  });
  test('هرس حافظه — فقط آخرین ۸ روز می‌ماند', () => {
    const big: Record<string, DayHistoryCacheEntry> = {};
    for (let i = 1; i <= 12; i++) {
      const k = `2026-11-${String(i).padStart(2, '0')}`;
      big[k] = { title: 'x', entries: [{ year: 1400, text: 'واقعه', kind: 'event' }], at: k };
    }
    const pruned = pruneDayHistoryCache(big, 8);
    expect(Object.keys(pruned).length).toBe(8);
    expect(Object.keys(pruned)[0]).toBe('2026-11-05'); // قدیمی‌ها حذف شده‌اند
    expect(pruned['2026-11-12']).toBeTruthy();
    expect(pruneDayHistoryCache(undefined, 8)).toEqual({});
  });
});

describe('پیوند وقایع با پیام صبحگاهی/شبانگاهی', () => {
  const hadith = HADITH_BANK[0];
  const prayer = { lat: 35.6892, lon: 51.389, method: 'tehran' as const, fajrAngle: 17.7, ishaAngle: 14, maghribMinutes: 15, tz: 'Asia/Tehran' };
  const base = { dateKey: '2026-11-12', tz: 'Asia/Tehran', qamariBasis: 'umalqura' as const, city: 'تهران', image: null, prayer, hadith };
  test('پیام صبحگاهی با وقایع — بلوک بعد از تاریخ و مناسبت‌ها می‌آید', async () => {
    const msg = await buildDailyMessage({
      ...base,
      kind: 'morning',
      dayHistory: [{ year: 1276, text: 'نیما یوشیج، پدر شعر نوی فارسی', kind: 'birth' }],
    });
    expect(msg.text.startsWith(`<b>${BISMILLAH}</b>`)).toBe(true);
    expect(msg.text).toContain('📜 وقایع امروز در تاریخ');
    expect(msg.text).toContain('• ۱۲۷۶؛ زادروز نیما یوشیج، پدر شعر نوی فارسی');
    expect(msg.text.indexOf('امروز')).toBeLessThan(msg.text.indexOf('زادروز نیما'));
  });
  test('پیام صبحگاهی بدون وقایع — بلوک کلًا حذف می‌شود (خواستهٔ کاربر: نبود → بخش ارسال نشود)', async () => {
    const msg = await buildDailyMessage({ ...base, kind: 'morning' });
    expect(msg.text).not.toContain('وقایع');
    expect(msg.text).not.toContain('undefined');
  });
  test('پیام شبانگاهی — وقایعِ فردا با برچسب فردا + اوقات شرعی', async () => {
    const msg = await buildDailyMessage({
      ...base,
      kind: 'evening',
      dayHistory: [
        { year: 1396, text: 'زمین‌لرزه ازگله', kind: 'event' },
        { year: 1381, text: 'مهدی باقری، بازیکن', kind: 'birth' },
      ],
    });
    expect(msg.text).toContain('فردا: جمعه');
    expect(msg.text).toContain('📜 وقایع فردا در تاریخ');
    expect(msg.text).toContain('• ۱۳۹۶؛ زمین‌لرزه ازگله');
    expect(msg.text).toContain('• ۱۳۸۱؛ زادروز مهدی باقری، بازیکن');
    expect(msg.text).toContain('اوقات شرعی فردا');
  });
});
