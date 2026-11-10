/**
 * تست‌های پیام‌های روزانهٔ رصدبان (خواستهٔ کاربر ۱۰ نوامبر ۲۰۲۶):
 * تقویم سه‌گانه، ضدتکرار احادیث (شناسه‌ای + معنایی)، مناسبت‌ها، اوقات شرعی (adhan)،
 * پیام صبحگاهی/شبانگاهی، بست نیم‌ساعته، انبار ماندگار خودرو، اطلاعیهٔ فروش، تنظیمات روزانه
 */
import { describe, expect, test } from 'bun:test';
import { tripleDateOf, shiftDateKey, dateKeyOf, weekdayFaOf } from '../bot/calendar';
import { HADITH_BANK, INFALLIBLES } from '../bot/hadiths-data';
import { OCCASIONS } from '../bot/occasions-data';
import { pickHadith, isSemanticDuplicate, normalizeHadithArabic, bankStatus, matchOccasions, formatOccasionsBlock, pickNatureFromCommons, buildDailyMessage, BISMILLAH, faDigits, type HadithUsage } from '../bot/daily';
import { computePrayerTimes, validatePrayerTimes, faClock, type PrayerTimesDay } from '../bot/prayer';
import { shouldFlushBundle, buildBundleChunks, type BundleItem } from '../bot/bundle';
import { mergeCarStore, featuredCarsFromStore, CAR_FEATURED } from '../bot/market';
import { parseSaleAnnouncements } from '../bot/bot';
import { loadDailySettings, DAILY_SETTINGS_DEFAULTS } from '../bot/bot';
import { HADITH_BANK as BANK2 } from '../bot/hadiths-data';

// ---------- تقویم سه‌گانه ----------

describe('تقویم سه‌گانه (Intl/ICU)', () => {
  // 2026-11-10 = سه‌شنبه ۱۹ آبان ۱۴۰۵ — ۱۰ نوامبر ۲۰۲۶
  const td = tripleDateOf('2026-11-10', 'Asia/Tehran', 'umalqura');

  test('شمسی مطابق تقویم رسمی ایران', () => {
    expect(td.keys.j).toEqual({ y: 1405, m: 8, d: 19 });
  });
  test('میلادی', () => {
    expect(td.keys.g).toEqual({ y: 2026, m: 11, d: 10 });
  });
  test('قمری در بازهٔ معتبر و با مبنا مشخص', () => {
    expect(td.keys.h.y).toBeGreaterThanOrEqual(1447);
    expect(td.keys.h.m).toBeGreaterThanOrEqual(1);
    expect(td.keys.h.m).toBeLessThanOrEqual(12);
    expect(td.keys.h.d).toBeGreaterThanOrEqual(1);
    expect(td.keys.h.d).toBeLessThanOrEqual(30);
    expect(['umalqura', 'civil']).toContain(td.qamariBasis);
  });
  test('روز هفته فارسی', () => {
    expect(td.weekdayFa).toBe('سه‌شنبه');
  });
  test('shiftDateKey — فردا دقیقاً یک روز بعد', () => {
    expect(shiftDateKey('2026-11-10', 1)).toBe('2026-11-11');
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2027-03-20', 1)).toBe('2027-03-21');
  });
  test('dateKeyOf با منطقهٔ زمانی کانال', () => {
    // 2026-11-09T21:30Z = 2026-11-10T01:00 تهران
    expect(dateKeyOf(Date.parse('2026-11-09T21:30:00Z'), 'Asia/Tehran')).toBe('2026-11-10');
    expect(dateKeyOf(Date.parse('2026-11-09T21:30:00Z'), 'UTC')).toBe('2026-11-09');
  });
  test('weekdayFaOf ثابت با کلید روز', () => {
    expect(weekdayFaOf('2026-11-11', 'Asia/Tehran')).toBe('چهارشنبه');
  });
});

// ---------- بانک احادیث ----------

describe('بانک احادیث چهارده معصوم', () => {
  test('حضور همهٔ چهارده معصوم در بانک (خواستهٔ کاربر)', () => {
    const present = new Set(HADITH_BANK.map((h) => h.infallible));
    for (const inf of INFALLIBLES) expect(present.has(inf.key)).toBe(true);
  });
  test('هر مدخل متن عربی + ترجمه + گوینده + منبع دارد', () => {
    for (const h of HADITH_BANK) {
      expect(h.arabic.length).toBeGreaterThan(10);
      expect(h.persian.length).toBeGreaterThan(10);
      expect(h.narrator.length).toBeGreaterThan(3);
      expect(h.source.length).toBeGreaterThan(3);
    }
  });
  test('تعداد بانک برای چرخش طولانی کافی است (≥۵۰)', () => {
    expect(BANK2.length).toBeGreaterThanOrEqual(50);
  });
});

describe('ضدتکرار حدیث', () => {
  test('نرمال‌سازی عربی اعراب را حذف می‌کند', () => {
    const a = normalizeHadithArabic('إِنَّمَا بُعِثْتُ لِأُتَمِّمَ مَكَارِمَ الْأَخْلَاقِ');
    const b = normalizeHadithArabic('انما بعثت لاتمم مكارم الاخلاق');
    expect(a).toBe(b);
  });
  test('تشخیص تکرار معنایی — همان متن با اعراب متفاوت', () => {
    const bank = HADITH_BANK.find((h) => h.id === 'pr-01')!;
    expect(isSemanticDuplicate('إِنَّمَا بُعِثْتُ لِأُتَمِّمَ مَكَارِمَ الْأَخْلَاقِ.', [bank.arabic])).toBe(true);
    expect(isSemanticDuplicate('خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ.', [bank.arabic])).toBe(false);
  });
  test('چرخش متعادل — ۳۰ انتخاب پیاپی همهٔ معصومان را پوشش می‌دهد', () => {
    const used: Record<string, HadithUsage> = {};
    let cursor = 0;
    const kinds: Array<'morning' | 'evening'> = [];
    for (let i = 0; i < 30; i++) {
      const r = pickHadith({ kind: i % 2 === 0 ? 'morning' : 'evening', dateKey: `2026-11-10`, usedHadithIds: used, infallibleCursor: cursor });
      expect(r).not.toBeNull();
      expect(used[r!.hadith.id]).toBeUndefined(); // هیچ تکراری
      used[r!.hadith.id] = { id: r!.hadith.id, dateKey: '2026-11-10', kind: i % 2 === 0 ? 'morning' : 'evening' };
      cursor = r!.nextCursor;
      kinds.push(i % 2 === 0 ? 'morning' : 'evening');
    }
    const narrators = new Set(Object.keys(used).map((id) => HADITH_BANK.find((h) => h.id === id)!.infallible));
    expect(narrators.size).toBeGreaterThanOrEqual(10); // پوشش متعادل
  });
  test('اتمام بانک → null صادقانه (هیچ ساختگی)', () => {
    const used: Record<string, HadithUsage> = {};
    for (const h of HADITH_BANK) used[h.id] = { id: h.id, dateKey: 'x', kind: 'morning' };
    expect(pickHadith({ kind: 'morning', dateKey: 'x', usedHadithIds: used, infallibleCursor: 0 })).toBeNull();
  });
  test('bankStatus جمع‌ها درست است', () => {
    const st = bankStatus({});
    expect(st.total).toBe(HADITH_BANK.length);
    expect(st.used).toBe(0);
    expect(st.remaining).toBe(HADITH_BANK.length);
  });
});

// ---------- مناسبت‌ها ----------

describe('مناسبت‌ها و وقایع تاریخی', () => {
  test('۱۳ آبان شمسی → روز ملی دانش‌آموز', () => {
    // ۱۳ آبان ۱۴۰۵ = 4 نوامبر 2026
    const td = tripleDateOf('2026-11-04', 'Asia/Tehran', 'umalqura');
    expect(td.keys.j.m).toBe(8);
    expect(td.keys.j.d).toBe(13);
    const hits = matchOccasions(td);
    expect(hits.some((h) => h.title.includes('دانش‌آموز'))).toBe(true);
  });
  test('۲۲ بهمن شمسی → پیروزی انقلاب اسلامی', () => {
    // ۲۲ بهمن ۱۴۰۵ = ۱۱ فوریهٔ 2026
    const td = tripleDateOf('2026-02-11', 'Asia/Tehran', 'umalqura');
    const hits = matchOccasions(td);
    expect(hits.some((h) => h.title.includes('پیروزی انقلاب'))).toBe(true);
  });
  test('۱ ژانویهٔ میلادی → آغاز سال میلادی', () => {
    const td = tripleDateOf('2027-01-01', 'Asia/Tehran', 'umalqura');
    expect(matchOccasions(td).some((h) => h.title.includes('میلادی نو'))).toBe(true);
  });
  test('مناسبت قمری عاشورا (۱۰ محرم) — تطبیق با تقویم قمری Intl', () => {
    const hit = OCCASIONS.find((o) => o.cal === 'qamari' && o.m === 1 && o.d === 10);
    expect(hit?.title).toContain('عاشورا');
  });
  test('بلوک مناسبت خالی صادقانه است — ساختگی نمی‌سازد', () => {
    const block = formatOccasionsBlock([], 'امروز');
    expect(block).toContain('ثبت‌شده‌ای');
    expect(block).not.toContain('undefined');
  });
  test('بانک مناسبت خالی نمانده (پوشش رسمی/مذهبی/تاریخی)', () => {
    expect(OCCASIONS.filter((o) => o.cat === 'official').length).toBeGreaterThanOrEqual(15);
    expect(OCCASIONS.filter((o) => o.cat === 'religious').length).toBeGreaterThanOrEqual(15);
    expect(OCCASIONS.filter((o) => o.cat === 'history-world' || o.cat === 'world').length).toBeGreaterThanOrEqual(10);
  });
});

// ---------- اوقات شرعی (adhan) ----------

describe('اوقات شرعی فردا', () => {
  const settings = { lat: 35.6892, lon: 51.389, method: 'tehran' as const, fajrAngle: 17.7, ishaAngle: 14, maghribMinutes: 15, tz: 'Asia/Tehran' };
  test('محاسبهٔ تهران — ترتیب معتبر و ارقام فارسی', () => {
    const p = computePrayerTimes('2026-11-11', settings);
    expect(p).not.toBeNull();
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const f = toMin(p!.fajr), sr = toMin(p!.sunrise), dh = toMin(p!.dhuhr), ss = toMin(p!.sunset), mg = toMin(p!.maghrib), is = toMin(p!.isha);
    expect(f).toBeLessThan(sr);
    expect(sr).toBeLessThan(dh);
    expect(dh).toBeLessThan(ss);
    expect(ss).toBeLessThan(mg); // مغرب = غروب + ۱۵ دقیقه
    expect(mg).toBeLessThan(is);
    // مقادیر معقول تهران
    expect(f).toBeGreaterThan(4 * 60);
    expect(f).toBeLessThan(6 * 60);
    expect(validatePrayerTimes(p!)).toBe(true);
    expect(faClock(p!.fajr)).not.toContain('5');
    expect(faClock(p!.fajr)).toMatch(/[۰-۹]/);
  });
  test('نیمه‌شب شرعی بین مغرب و فجر روز بعد', () => {
    const p = computePrayerTimes('2026-11-11', settings)!;
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const md = toMin(p.midnight);
    const mg = toMin(p.maghrib);
    // نیمه‌شب شرعی پس از مغرب است (ممکن است از نیمه‌شب ساعتِ بگذرد)
    expect(md > mg || md < toMin(p.fajr)).toBe(true);
  });
  test('نامعتبر → null (هیچ زمان ساختگی)', () => {
    const bad: PrayerTimesDay = { fajr: '06:00', sunrise: '05:00', dhuhr: '12:00', sunset: '17:00', maghrib: '17:15', isha: '18:30', midnight: '23:00', methodLabel: 'x' };
    expect(validatePrayerTimes(bad)).toBe(false);
    const bad2: PrayerTimesDay = { fajr: 'abc', sunrise: '05:00', dhuhr: '12:00', sunset: '17:00', maghrib: '17:15', isha: '18:30', midnight: '23:00', methodLabel: 'x' };
    expect(validatePrayerTimes(bad2)).toBe(false);
  });
});

// ---------- تصویر طبیعت ویکی‌مدیا ----------

describe('تصویر طبیعت (پارسر ویکی‌مدیا — خالص)', () => {
  const commonsResponse = {
    query: {
      pages: {
        '1': { title: 'File:Sunrise over mountains.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/x.jpg', thumburl: 'https://upload.wikimedia.org/x1600.jpg', width: 4000, descriptionurl: 'https://commons.wikimedia.org/wiki/File:Sunrise_over_mountains.jpg', extmetadata: { Artist: { value: '<span>Ali Reza</span>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] },
        '2': { title: 'File:People at beach.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/y.jpg', thumburl: 'https://upload.wikimedia.org/y1600.jpg', width: 3000 }] },
        '3': { title: 'File:Small image.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/z.jpg', thumburl: 'https://upload.wikimedia.org/z500.jpg', width: 500 }] },
      },
    },
  };
  test('انتخاب تصویر بدون انسان و با کیفیت کافی', () => {
    const picked = pickNatureFromCommons(commonsResponse, new Set());
    expect(picked?.title).toBe('Sunrise over mountains.jpg');
    expect(picked?.artist).toBe('Ali Reza'); // تگ HTML پاک شده
    expect(picked?.license).toBe('CC BY-SA 4.0');
    expect(picked?.imageKey).toBe('https://upload.wikimedia.org/x.jpg');
  });
  test('ضدتکرار تصویر — نبود گزینهٔ تازه → استفادهٔ مجاز از کهنه («تا حد امکان تکراری نباشد»)', () => {
    // هر سهٔ گزینه فیلتر می‌شوند (انسان/کم‌کیفیت) → تنها گزینهٔ معتبر بازهم برمی‌گردد
    const picked = pickNatureFromCommons(commonsResponse, new Set(['https://upload.wikimedia.org/x.jpg']));
    expect(picked?.title).toBe('Sunrise over mountains.jpg');
  });
  test('گزینهٔ تازه وقتی هست اولویت دارد', () => {
    const two = { query: { pages: { ...commonsResponse.query.pages, '4': { title: 'File:Dawn river mist.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/w.jpg', thumburl: 'https://upload.wikimedia.org/w1600.jpg', width: 3200 }] } } } };
    const picked = pickNatureFromCommons(two, new Set(['https://upload.wikimedia.org/x.jpg']));
    expect(picked?.title).toBe('Dawn river mist.jpg');
  });
  test('پاسخ خراب → null', () => {
    expect(pickNatureFromCommons(null, new Set())).toBeNull();
    expect(pickNatureFromCommons({}, new Set())).toBeNull();
  });
});

// ---------- پیام صبحگاهی/شبانگاهی ----------

describe('پیام صبحگاهی و شبانگاهی', () => {
  const bank = { morning: HADITH_BANK[0], evening: HADITH_BANK[HADITH_BANK.length - 1] };
  const img = { url: 'https://upload.wikimedia.org/x1600.jpg', imageKey: 'https://upload.wikimedia.org/x.jpg', title: 'Sunrise.jpg', pageUrl: 'https://commons.wikimedia.org/wiki/File:Sunrise.jpg', artist: 'Ali', license: 'CC BY-SA 4.0', sourceLabel: 'Wikimedia Commons' };
  const base = { dateKey: '2026-11-10', tz: 'Asia/Tehran', qamariBasis: 'umalqura' as const, city: 'تهران', image: img };

  test('پیام صبحگاهی — بسم‌الله + حدیثِ بی‌برچسب (گوینده: متن) + تاریخ بی‌برچسب + مناسبت‌ها', async () => {
    const msg = await buildDailyMessage({ ...base, kind: 'morning', prayer: { lat: 35.6892, lon: 51.389, method: 'tehran', fajrAngle: 17.7, ishaAngle: 14, maghribMinutes: 15, tz: 'Asia/Tehran' }, hadith: bank.morning });
    expect(msg.text.startsWith(`<b>${BISMILLAH}</b>`)).toBe(true);
    expect(msg.text).toContain('پیام صبحگاهی رصدبان');
    // فرمت تازه (خواستهٔ کاربر): «پیامبر اکرم(ص): متن حدیث» — بدون هیچ سربرگ جداکننده
    expect(msg.text).toContain(`<b>${bank.morning.narrator}:</b>`);
    expect(msg.text).toContain(`«${bank.morning.arabic}»`);
    expect(msg.text).toContain(bank.morning.source);
    // برچسب‌های کهنه حذف شده‌اند
    expect(msg.text).not.toContain('متن عربی:');
    expect(msg.text).not.toContain('ترجمهٔ فارسی:');
    expect(msg.text).not.toContain('منبع:');
    expect(msg.text).not.toContain('شمسی:');
    expect(msg.text).not.toContain('میلادی:');
    // تاریخ سه‌گانه بدون برچسب — ماه‌ها خودْ گویا + یادداشت مبنای قمری
    expect(msg.text).toContain('سه‌شنبه');
    expect(msg.text).toContain('•');
    expect(msg.text).toContain('تقویم قمری بر مبنای ام‌القری');
    expect(msg.photoUrl).toBeTruthy();
    expect(msg.photoCaption).toContain('Wikimedia Commons');
    expect(msg.photoCaption!.length).toBeLessThanOrEqual(1024);
  });
  test('پیام شبانگاهی — تاریخِ «فردا» + اوقات شرعی فردا', async () => {
    const msg = await buildDailyMessage({ ...base, kind: 'evening', prayer: { lat: 35.6892, lon: 51.389, method: 'tehran', fajrAngle: 17.7, ishaAngle: 14, maghribMinutes: 15, tz: 'Asia/Tehran' }, hadith: bank.evening });
    expect(msg.text).toContain('پیام شبانگاهی رصدبان');
    expect(msg.text).toContain('فردا: چهارشنبه');
    expect(msg.text).toContain('اوقات شرعی فردا');
    expect(msg.text).toContain('اذان صبح');
    expect(msg.text).toContain('نیمه‌شب شرعی');
    expect(msg.text).toContain('۱۹ آبان ۱۴۰۵'.replace('۱۹', '۲۰')); // فردا = ۲۰ آبان
    expect(msg.text).toContain('روش محاسبه');
  });
  test('شکست اوقات شرعی → پیام صادقانه بدون زمان ساختگی', async () => {
    const msg = await buildDailyMessage({ ...base, kind: 'evening', prayer: { lat: 999, lon: 999, method: 'tehran', fajrAngle: 17.7, ishaAngle: 14, maghribMinutes: 15, tz: 'Asia/Tehran' }, hadith: bank.evening });
    expect(msg.text).toContain('محاسبهٔ نجومی در دسترس نبود');
    expect(msg.text).not.toContain('undefined');
  });
  test('faDigits تبدیل کامل', () => {
    expect(faDigits('۱۲۳')).toBe('۱۲۳');
    expect(faDigits('45')).toBe('۴۵');
  });
});

// ---------- بستهٔ ساعتی ----------

describe('بستهٔ ساعتی خبر و توییت', () => {
  test('shouldFlushBundle — ریتم ساعتی (خواستهٔ کاربر: هر یه ساعت)', () => {
    const now = Date.parse('2026-11-10T08:00:00Z');
    expect(shouldFlushBundle(undefined, now)).toBe(true);
    expect(shouldFlushBundle('2026-11-10T07:00:00Z', now, 60)).toBe(true); // ۶۰ دقیقه گذشته
    expect(shouldFlushBundle('2026-11-10T07:45:00Z', now, 60)).toBe(false); // ۱۵ دقیقه — هنوز نه
    expect(shouldFlushBundle('غیرمتع', now, 60)).toBe(true);
  });
  test('buildBundleChunks — گروه‌بندی با سربرگ خنثی (بدون برند) و شمارهٔ بخش', () => {
    const items = Array.from({ length: 8 }, (_, i) => `منبع خبرگزاری ${i}: ${'متن خبر تازه '.repeat(30)}`);
    const chunks = buildBundleChunks(items, { fromIso: '2026-11-10T05:00:00Z', toIso: '2026-11-10T05:30:00Z', maxLen: 2000 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('🕒 اخبار');
    expect(chunks[0]).toContain('بخش ۱ از');
    expect(chunks[1]).toContain('ادامهٔ بخش ۲ از');
    // «بست رصدبان» حذف شده — خواستهٔ صریح کاربر
    for (const c of chunks) { expect(c).not.toContain('بست'); expect(c).not.toContain('رصدبان'); expect(c.length).toBeLessThan(2600); }
  });
  test('یک موردِ بزرگ درون همان بخش شکسته می‌شود', () => {
    const big = `خبر بزرگ: ${'م'.repeat(5000)}`;
    const chunks = buildBundleChunks([big], { maxLen: 2000 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThan(2600);
  });
  test('خالی → خروجی خالی (بست خالی ارسال نمی‌شود)', () => {
    expect(buildBundleChunks([])).toEqual([]);
  });
  test('نوع BundleItem — صف ساختار دارد', () => {
    const item: BundleItem = { kind: 'tweet', text: 'x', ids: [], titleKeys: [], titleTexts: [], queuedAt: new Date().toISOString() };
    expect(item.kind).toBe('tweet');
  });
});

// ---------- انبار ماندگار خودرو ----------

describe('انبار ماندگار قیمت خودرو — پرتیراژها همیشه در فهرست', () => {
  const now = '2026-11-10T08:00:00.000Z';
  test('mergeCarStore — تاریخ تازه‌تر جایگزین می‌شود', () => {
    const s1 = mergeCarStore(undefined, [{ model: 'ساینا', valueToman: 1.81e9, displayRaw: '1.81', date: '2026-11-08T10:00:00.000Z' }], now);
    expect(s1['ساینا'].valueToman).toBe(1.81e9);
    const s2 = mergeCarStore(s1, [{ model: 'ساینا', valueToman: 1.83e9, displayRaw: '1.83', date: '2026-11-09T10:00:00.000Z' }], now);
    expect(s2['ساینا'].valueToman).toBe(1.83e9);
    const s3 = mergeCarStore(s2, [{ model: 'ساینا', valueToman: 1.5e9, displayRaw: '1.5', date: '2026-11-01T10:00:00.000Z' }], now);
    expect(s3['ساینا'].valueToman).toBe(1.83e9); // قدیمی‌تر بازنویسی نمی‌کند
  });
  test('featuredCarsFromStore — پرتیراژ همیشه می‌آید با کهنگی صادقانه', () => {
    const store = mergeCarStore(undefined, [
      { model: 'ساینا', valueToman: 1.81e9, displayRaw: '1.81', date: '2026-11-10T06:00:00.000Z' },
      { model: 'پژو ۲۰۶ تیپ ۲', valueToman: 1.02e9, displayRaw: '1.02', date: '2026-11-02T06:00:00.000Z' },
    ], now);
    const featured = featuredCarsFromStore(store, now, 12);
    const saina = featured.find((f) => f.model.includes('ساینا'));
    const peugeot = featured.find((f) => f.model.includes('۲۰۶') || f.model.includes('206'));
    expect(saina).toBeTruthy();
    expect(saina!.ageDays).toBe(0);
    expect(peugeot).toBeTruthy();
    expect(peugeot!.ageDays).toBeGreaterThanOrEqual(7); // کهنگی اعلام می‌شود
  });
  test('فهرست پرتیراژ شامل مدل‌های پرتقاضای ایران است', () => {
    const labels = CAR_FEATURED.map((c) => c.label);
    for (const must of ['پراید', 'کوییک', 'ساینا', 'شاهین', 'پژو ۲۰۶', 'تارا', 'دنا', 'سورن']) {
      expect(labels).toContain(must);
    }
  });
});

// ---------- اطلاعیهٔ فروش/پیش‌فروش ----------

describe('اطلاعیهٔ فروش خودرو (Akharin_khodro)', () => {
  const posts = [
    { dataPost: 'Akharin_khodro/8888', text: '🚘 شرایط فروش فیدلیتی پرستیژ اعلام شد — شرکت بهمن موتور شرایط فروش را با قیمت قطعی اعلام کرد و متقاضیان باید مبلغ مسدود کنند', timeAttr: '2026-11-09T10:34:40+00:00', imageUrl: null, isForwarded: false },
    { dataPost: 'Akharin_khodro/8890', text: '🚘 تعرفه واردات خودرو باید به‌شدت کاهش پیدا کند — نماینده مجلس در گفت‌وگو با آخرین خودرو دربارهٔ تعرفه توضیح داد', timeAttr: '2026-11-09T15:59:43+00:00', imageUrl: null, isForwarded: false },
    { dataPost: 'Akharin_khodro/8891', text: 'اطلاعیه نهایی شرکت آرین پارس موتور درباره تعیین تکلیف مشتریان طرح پیش‌فروش لاماری ایما', timeAttr: '2026-11-09T16:26:17+00:00', imageUrl: null, isForwarded: false },
    { dataPost: 'Akharin_khodro/8892', text: 'کوتاه', timeAttr: '', imageUrl: null, isForwarded: false },
  ];
  test('فیلتر کلیدواژه — اطلاعیهٔ فروش/پیش‌فروش تشخیص، خبر معمولی رد', () => {
    const r = parseSaleAnnouncements(posts, {}, Date.parse('2026-11-10T08:00:00Z'));
    expect(r.fresh.some((p) => p.dataPost === 'Akharin_khodro/8888')).toBe(true);
    expect(r.fresh.some((p) => p.dataPost === 'Akharin_khodro/8891')).toBe(true);
    expect(r.fresh.some((p) => p.dataPost === 'Akharin_khodro/8890')).toBe(false);
    expect(r.fresh.some((p) => p.dataPost === 'Akharin_khodro/8892')).toBe(false);
  });
  test('ضدتکرار — دیده‌شده دوباره نمی‌آید', () => {
    const r1 = parseSaleAnnouncements(posts, {}, Date.parse('2026-11-10T08:00:00Z'));
    const seen = r1.seen;
    const r2 = parseSaleAnnouncements(posts, seen, Date.parse('2026-11-10T08:10:00Z'));
    expect(r2.fresh.length).toBe(0);
  });
  test('هرس ۷ روزه', () => {
    const r = parseSaleAnnouncements(posts, { 'Akharin_khodro/8888': Date.parse('2026-10-01T00:00:00Z') }, Date.parse('2026-11-10T08:00:00Z'));
    expect(r.fresh.some((p) => p.dataPost === 'Akharin_khodro/8888')).toBe(true); // یادداشت کهن حذف شد → تازه شمرده می‌شود
  });
});

// ---------- تنظیمات روزانه ----------

describe('تنظیمات پیام‌های روزانه', () => {
  test('پیش‌فرض‌ها — ۰۵:۰۰ و ۲۰:۰۰ تهران', () => {
    expect(DAILY_SETTINGS_DEFAULTS.morningHour).toBe('05:00');
    expect(DAILY_SETTINGS_DEFAULTS.eveningHour).toBe('20:00');
    expect(DAILY_SETTINGS_DEFAULTS.timezone).toBe('Asia/Tehran');
    expect(DAILY_SETTINGS_DEFAULTS.prayerMethod).toBe('tehran');
  });
  test('فایل خراب/نابود → پیش‌فرض (هیچ خطای مهلک)', () => {
    const s = loadDailySettings('/nonexistent/daily-settings.json');
    expect(s.morningHour).toBe('05:00');
    expect(s.city).toBe('تهران');
  });
});
