/**
 * تست‌های واحد بخش مجزای رصد کانال‌های چپ و راست و تحلیل ۸ساعتهٔ ژئوپلیتیک (bot/geo.ts)
 * — خواستهٔ کاربر (۱۳ نوامبر ۲۰۲۶):
 * «کانال‌های چپ و راست ایتا و تلگرام در بخش مجزا؛ اخبارشان تجمیع و اعتبارسنجی شود و هر ۴ ساعت
 *  یک تحلیل به رصدبان اضافه شود؛ تحلیل ذخیره شود و برای تحلیل ساعت ۲۲:۳۰ هم منبع باشد»
 * — خواستهٔ کاربر (۲۰ نوامبر ۲۰۲۶): «تحلیل ۴ ساعته باید بشه ۸ ساعتی — ۱۰ هر شب شبانگاهی،
 *  ۶ هر صبح صبحگاهی، ۲ هر ظهر ظهرگاهی» → اسلات‌های ۰۶/۱۴/۲۲ + عنوان روزانه + پنجرهٔ ۸ساعته.
 * پوشش: سوپرپرامپت، فهرست کانال‌ها، پارس صفحات ایتا/تلگرام، فیلتر تبلیغ، پنجرهٔ زمانی +
 * ضدتکرار شناسه، تجمیع چندکاناله (تیک ≥۲ منبع)، دفتر حافظه (ضدتکرار اسلات + سقف ۲۱)،
 * بلوک حافظهٔ بازه‌ها، برش امروز و بلوک شبانه، اعتبارسنجی متن و بازنویسی پرامپت «geo».
 * اجرا: bun test tests/geo.test.ts
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { resolve } from 'node:path';
import {
  DEFAULT_SYSTEM_GEO,
  GEO_HISTORY_CAP,
  GEO_WINDOW_HOURS,
  appendGeoAnalysis,
  buildGeoCorpus,
  buildGeoMemoryBlock,
  buildNightlyGeoBlock,
  filterGeoPosts,
  geoDaypartLabel,
  geoItemsForMerge,
  geoSummaryOf,
  isGeoNoise,
  loadGeoChannels,
  parseEitaaPagePosts,
  parseGeoChannelsFile,
  parseGeoTgPage,
  todayGeoSlice,
  validateGeoText,
  windowGeoPosts,
  splitGeoFooter,
  GEO_MEMORY_TAG,
  type GeoAnalysis,
  type GeoPost,
} from '../bot/geo';
import { mergeSimilarItems } from '../bot/hourly';
import { parseSlots } from '../bot/digest';
import { DEFAULT_SYSTEM_NIGHTLY, MEMORY_FOOTER_TAG } from '../bot/nightly';
import { applyPromptOverrides, parsePromptFile, getGeoPrompt } from '../bot/bot';

// ---------- کمکی ----------

function post(id: string, text: string, at: string | null = null, channelName = 'وستانیوز'): GeoPost {
  return { id: `eitaa:westanews:${id}`, channel: 'westanews', channelName, platform: 'eitaa', text, at, url: `https://eitaa.com/westanews/${id}` };
}

function analysis(slotKey: string, text: string, summary?: string): GeoAnalysis {
  return { slotKey, at: `${slotKey}:00.000Z`, text, summary, items: 4, channels: 9 };
}

const FA_EVENT = 'روسیه و اوکراین پس از دو روز مذاکره با میانجی‌گری آمریکا بر سر تبادل اسرا به توافق رسیدند اما بر سر آتش‌بس به توافق نرسیدند.';

// ---------- سوپرپرامپت ----------

describe('DEFAULT_SYSTEM_GEO — سوپرپرامپت تحلیل ۸ساعته (خواستهٔ کاربر)', () => {
  test('ساختار الزامی کامل — همهٔ بخش‌ها و ایموجی‌ها', () => {
    expect(DEFAULT_SYSTEM_GEO.length).toBeGreaterThan(1500);
    for (const marker of ['🧭', '🗂 رویدادهای کلیدی بازه', '📊 روایت‌های دو طیف', '⚖️ اعتبارسنجی', '🔍 تحلیل', '🔮 نتیجه‌گیری', '🗞 منابع', GEO_MEMORY_TAG]) {
      expect(DEFAULT_SYSTEM_GEO).toContain(marker);
    }
  });

  test('تیک اعتبارسنجی، حافظهٔ پایدار و بی‌طرفی دو طیف صریح است', () => {
    expect(DEFAULT_SYSTEM_GEO).toContain('۲ منبع مستقل');
    expect(DEFAULT_SYSTEM_GEO).toContain('حافظهٔ پایدار');
    expect(DEFAULT_SYSTEM_GEO).toContain('بی‌طرفی مطلق');
    expect(DEFAULT_SYSTEM_GEO).toContain('هیچ خبر، عدد، نام، نقل‌قول یا تاریخ از حافظهٔ خودتان اضافه نکنید');
  });
});

// ---------- فهرست کانال‌ها ----------

describe('parseGeoChannelsFile — فهرست کانال‌های بخش چپ و راست', () => {
  test('فایل واقعی پروژه — ۹ کانال ایتای خواستهٔ کاربر', () => {
    const chs = loadGeoChannels(resolve(import.meta.dir, '../bot/geo-channels.json'));
    expect(chs.length).toBe(9);
    const ids = chs.map((c) => c.id);
    for (const want of ['yapressagency', 'SEPAHCYBERY', 'westanews', 'aboghasem', 'eshg313', 'sarbaz_Enghelab313', 'Majalle_siasy', 'syriankhabar', 'Bisimchimedia']) {
      expect(ids).toContain(want);
    }
    const westa = chs.find((c) => c.id === 'westanews')!;
    expect(westa.name).toBe('وستانیوز'); // نام عین کاربر
    expect(westa.platform).toBe('eitaa');
  });

  test('پلتفرم/شناسه نامعتبر حذف؛ @ ابتدای شناسه بریده؛ تکراری یکی می‌شود', () => {
    const raw = JSON.stringify({
      channels: [
        { platform: 'eitaa', id: '@westanews', name: 'وستانیوز' },
        { platform: 'eitaa', id: 'westanews', name: 'تکراری' },
        { platform: 'facebook', id: 'nolink', name: 'بی‌پشتیبانی' },
        { platform: 'telegram', id: 'ab', name: 'کوتاه' },
        { platform: 'telegram', id: 'presstv', name: '' },
      ],
    });
    const chs = parseGeoChannelsFile(raw);
    expect(chs.length).toBe(2);
    expect(chs[0]).toEqual({ platform: 'eitaa', id: 'westanews', name: 'وستانیوز' });
    expect(chs[1]!.name).toBe('@presstv'); // نام خالی → دستهٔ خود کانال
  });

  test('JSON خراب → خالی (بخش غیرفعال، نه ری‌کرش)', () => {
    expect(parseGeoChannelsFile('نه-جیسون')).toEqual([]);
    expect(loadGeoChannels('/nonexistent/file.json')).toEqual([]);
  });
});

// ---------- پارس صفحات ----------

describe('parseEitaaPagePosts — پارس صفحهٔ عمومی ایتا', () => {
  const html = `
  <div class="etme_widget_message_wrap js-widget_message_wrap" id="791">
    <div data-post="yapressagency/791">
      <time datetime="2026-11-13T06:30:00+00:00" class="time"></time>
      <div class="etme_widget_message_text js-widget_message_text">روایت اول &amp; متن خبر <br>خط دوم</div>
    </div>
  </div>
  <div class="etme_widget_message_wrap" id="790">
    <div data-post="yapressagency/790">
      <time datetime="2026-11-13T05:10:00+00:00"></time>
      <div class="etme_widget_message_text">متن پیام دوم</div>
    </div>
  </div>`;

  test('دو پیام با شناسه/زمان/متن و رمزگشایی موجودیت‌ها', () => {
    const msgs = parseEitaaPagePosts(html);
    expect(msgs.length).toBe(2);
    expect(msgs[0]!.dataPost).toBe('yapressagency/791');
    expect(msgs[0]!.timeISO).toBe('2026-11-13T06:30:00+00:00');
    expect(msgs[0]!.text).toContain('روایت اول & متن خبر');
    expect(msgs[0]!.text).toContain('خط دوم');
  });

  test('پیام بی‌متن حذف می‌شود؛ صفحهٔ خالی → خالی', () => {
    expect(parseEitaaPagePosts('<div class="etme_widget_message_wrap"><div data-post="x/1"></div></div>')).toEqual([]);
    expect(parseEitaaPagePosts('')).toEqual([]);
  });
});

describe('parseGeoTgPage — پارس صفحهٔ پیش‌نمایش تلگرام', () => {
  const html = `
  <div class="tgme_widget_message js-widget_message" data-post="westanews/12">
    <time datetime="2026-11-13T07:00:00+00:00"></time>
    <div class="tgme_widget_message_text js-message_text">خبر تلگرامی &quot;مهم&quot;</div>
  </div>`;

  test('پیام تلگرامی با زمان و رمزگشایی نقل‌قول', () => {
    const msgs = parseGeoTgPage(html);
    expect(msgs.length).toBe(1);
    expect(msgs[0]!.dataPost).toBe('westanews/12');
    expect(msgs[0]!.text).toBe('خبر تلگرامی "مهم"');
  });
});

// ---------- فیلتر نوفه/تبلیغ ----------

describe('isGeoNoise و filterGeoPosts — اعتبارسنجی خام پیش از تحلیل', () => {
  test('تبلیغ و دعوت‌نامه نوفه است', () => {
    expect(isGeoNoise('📢 تبلیغات: کانال خود را به ما بسپارید')).toBe(true);
    expect(isGeoNoise('برای عضویت: t.me/+AbCdEf123')).toBe(true);
    expect(isGeoNoise('پیام ویژه اعضای VIP')).toBe(true);
    expect(isGeoNoise('ادمین: @somebody')).toBe(true);
  });

  test('خبر واقعی نوفه نیست — حتی با واژه‌های نزدیک', () => {
    expect(isGeoNoise(FA_EVENT)).toBe(false);
    expect(isGeoNoise('مذاکرات وین درباره برنامه هسته‌ای ادامه یافت؛ روایت دو طرف متفاوت بود.')).toBe(false);
  });

  test('فیلتر: کوتاه‌تر از ۴۰ نویسه و نوفه حذف؛ خبر سالم می‌ماند', () => {
    const posts = [
      post('1', 'کوتاه'),
      post('2', '📢 تبلیغ: سفارش رپورتاژ در تلگرام — کلیک کنید'),
      post('3', FA_EVENT),
      post('4', 'خبر بدون منبع اما طولانی‌تر از خط چهل نویسه‌ای آزمون سامانه فیلتر'),
    ];
    const kept = filterGeoPosts(posts);
    expect(kept.map((p) => p.id)).toEqual([posts[2]!.id, posts[3]!.id]);
  });
});

// ---------- زمان‌بندی ۸ساعته — خواستهٔ کاربر ۲۰ نوامبر ۲۰۲۶ ----------

describe('زمان‌بندی ۸ساعتهٔ ژئوپلیتیک — ۰۶ صبحگاهی / ۱۴ ظهرگاهی / ۲۲ شبانگاهی', () => {
  test('پنجرهٔ هر تحلیل ۸ ساعت است و حافظه ۲۱ تحلیل ≈ ۷ روز (۳ تحلیل در شبانه‌روز)', () => {
    expect(GEO_WINDOW_HOURS).toBe(8);
    expect(GEO_HISTORY_CAP).toBe(21);
  });

  test('geoDaypartLabel — عنوان روزانهٔ هر اسلات (خواستهٔ ۲۰ نوامبر)', () => {
    expect(geoDaypartLabel('2026-11-20T06:00')).toBe('صبحگاهی');
    expect(geoDaypartLabel('2026-11-20T14:00')).toBe('ظهرگاهی');
    expect(geoDaypartLabel('2026-11-20T22:00')).toBe('شبانگاهی');
  });

  test('geoDaypartLabel — پوشش ساعات دیگر شبانه‌روز و کلید force', () => {
    expect(geoDaypartLabel('2026-11-20T04:00')).toBe('صبحگاهی');
    expect(geoDaypartLabel('2026-11-20T10:59')).toBe('صبحگاهی');
    expect(geoDaypartLabel('2026-11-20T11:00')).toBe('ظهرگاهی');
    expect(geoDaypartLabel('2026-11-20T16:59')).toBe('ظهرگاهی');
    expect(geoDaypartLabel('2026-11-20T17:00')).toBe('شبانگاهی');
    expect(geoDaypartLabel('2026-11-20T03:00')).toBe('شبانگاهی');
    expect(geoDaypartLabel('force-2026-11-20T22:40')).toBe('شبانگاهی');
  });

  test('parseSlots پیش‌فرض ژئو — اسلات‌های ۰۶/۱۴/۲۲ تهران', () => {
    expect(parseSlots(undefined, '6,14,22')).toEqual(['06:00', '14:00', '22:00']);
    expect(parseSlots('22,6,14')).toEqual(['06:00', '14:00', '22:00']);
    expect(parseSlots('', '6,14,22')).toEqual(['06:00', '14:00', '22:00']);
  });
});

// ---------- پنجرهٔ زمانی + ضدتکرار ----------

describe('windowGeoPosts — پنجرهٔ ۸ساعته و دفتر دیده‌شده‌ها', () => {
  const now = Date.parse('2026-11-13T08:00:00.000Z');
  const since = now - (GEO_WINDOW_HOURS * 3600_000 + 30 * 60_000);

  test('فقط پیام‌های درون پنجره؛ دیده‌شده‌ها حذف؛ بی‌زمانِ تازه می‌ماند', () => {
    const posts = [
      post('a', 'خبر تازهٔ بازه', '2026-11-13T07:30:00.000Z'),
      post('b', 'خیلی قدیمی — پیش از پنجره', '2026-11-12T10:00:00.000Z'),
      post('c', 'دیده‌شده در بازهٔ قبل', '2026-11-13T06:00:00.000Z'),
      post('d', 'پیام بی‌زمان اما تازه', null),
      post('e', 'پیام از آینده — خرابی ساعت کانال', '2026-11-13T09:00:00.000Z'),
    ];
    const seen = { 'eitaa:westanews:c': now - 3 * 3600_000 };
    const r = windowGeoPosts(posts, since, seen, now);
    expect(r.picked.map((p) => p.id.slice(-1))).toEqual(['a', 'd']);
    expect(r.seen['eitaa:westanews:a']).toBe(now);
  });

  test('هرس ۷ روزهٔ دفتر و سقف ۱۸۰ پیام (پنجرهٔ ۸ساعته)', () => {
    const oldSeen: Record<string, number> = { 'eitaa:x:1': now - 8 * 86_400_000, 'eitaa:x:2': now - 6 * 86_400_000 };
    const r = windowGeoPosts([], since, oldSeen, now);
    expect(r.seen['eitaa:x:1']).toBeUndefined();
    expect(r.seen['eitaa:x:2']).toBe(now - 6 * 86_400_000);

    const many: GeoPost[] = [];
    for (let i = 0; i < 250; i++) many.push(post(`m${i}`, `خبر شماره ${i} درون پنجره`, '2026-11-13T07:00:00.000Z'));
    const r2 = windowGeoPosts(many, since, {}, now);
    expect(r2.picked.length).toBe(180);
  });

  test('بدون ورودی معتبر → خالی', () => {
    expect(windowGeoPosts([], since, {}).picked).toEqual([]);
  });
});

// ---------- تجمیع چندکاناله (تیک اعتبارسنجی) ----------

describe('geoItemsForMerge + buildGeoCorpus — تجمیع و پیکره', () => {
  test('یک رویداد از دو کانال مستقل → یک مورد تأییدشده با «(+۱ منبع دیگر)»', () => {
    const a = post('1', FA_EVENT, '2026-11-13T07:00:00.000Z', 'وستانیوز');
    const b: GeoPost = { ...a, id: 'eitaa:SEPAHCYBERY:9', channel: 'SEPAHCYBERY', channelName: 'غرب آسیا', text: `${FA_EVENT} منبع نظامی تأیید کرد.` };
    const merged = mergeSimilarItems(geoItemsForMerge([a, b]));
    expect(merged.length).toBe(1);
    expect(merged[0]!.verified).toBe(true);
    expect(merged[0]!.sources.length).toBe(2);
    const corpus = buildGeoCorpus(merged);
    expect(corpus).toContain('(+1 منبع دیگر)');
    expect(corpus).toContain('وستانیوز');
  });

  test('رویدادهای بی‌ربط یکی نمی‌شوند؛ ترتیب تازه‌ترین اول', () => {
    const a = post('1', FA_EVENT, '2026-11-13T07:00:00.000Z');
    const b = post('2', 'شاخص بورس تهران امروز با رشد خفیف بسته شد و ارزش معاملات افزایش یافت.', '2026-11-13T06:00:00.000Z');
    const merged = mergeSimilarItems(geoItemsForMerge([a, b]));
    expect(merged.length).toBe(2);
    expect(merged[0]!.id).toBe(a.id);
  });
});

// ---------- دفتر حافظهٔ بازه‌ها ----------

describe('appendGeoAnalysis — دفتر تحلیل‌های ۸ساعته', () => {
  test('تحلیل دوبارهٔ همان اسلات جایگزین می‌شود (ضدتکرار slotKey)', () => {
    let list: GeoAnalysis[] = [analysis('2026-11-13T00:00', 'بازهٔ نیمه‌شب')];
    list = appendGeoAnalysis(list, analysis('2026-11-13T04:00', 'بازهٔ بامداد'));
    expect(list.length).toBe(2);
    list = appendGeoAnalysis(list, analysis('2026-11-13T04:00', 'نسخهٔ کامل‌تر بامداد'));
    expect(list.length).toBe(2);
    expect(list.filter((a) => a.slotKey === '2026-11-13T04:00')[0]!.text).toBe('نسخهٔ کامل‌تر بامداد');
  });

  test(`سقف ${GEO_HISTORY_CAP} تحلیل — کهن‌ترین‌ها هرس می‌شوند`, () => {
    let list: GeoAnalysis[] = [];
    for (let i = 0; i < GEO_HISTORY_CAP + 4; i++) {
      list = appendGeoAnalysis(list, analysis(`2026-10-${String(1 + i).padStart(2, '0')}T04:00`, `بازهٔ ${i}`));
    }
    expect(list.length).toBe(GEO_HISTORY_CAP);
    expect(list[0]!.text).toBe('بازهٔ 4');
  });

  test('مدخل نامعتبر حذف می‌شود', () => {
    const bad = { slotKey: '', at: 'x', text: 'y', items: 0, channels: 0 } as unknown as GeoAnalysis;
    expect(appendGeoAnalysis([bad], analysis('2026-11-13T04:00', 'امروز')).length).toBe(1);
  });
});

// ---------- خلاصهٔ حافظه و پانوشت ----------

describe('geoSummaryOf و splitGeoFooter — حافظهٔ بازه', () => {
  const body = [
    '🧭 تنش دریای سرخ در کانون توجه',
    '',
    '🗂 رویدادهای کلیدی بازه',
    '۱. ✅ حملهٔ دریایی گزارش شد.',
    '',
    '🔮 نتیجه‌گیری',
    'پیام اصلی بازه تنش دریایی است؛ بازهٔ بعد واکنش‌ها را رصد کنید.',
    '',
    '🗞 منابع: وستانیوز، غرب آسیا',
  ].join('\n');

  test('geoSummaryOf — عنوان + نتیجه‌گیری؛ فهرست رویدادها نمی‌آید', () => {
    const s = geoSummaryOf(body);
    expect(s).toContain('عنوان: تنش دریای سرخ در کانون توجه');
    expect(s).toContain('نتیجه‌گیری: پیام اصلی بازه تنش دریایی است');
    expect(s).toContain('بازهٔ بعد واکنش‌ها را رصد کنید');
    expect(s).not.toContain('حملهٔ دریایی');
  });

  test('geoSummaryOf — متن خالی', () => {
    expect(geoSummaryOf('')).toBe('');
  });

  test('splitGeoFooter — همان قرارداد 🧷 شبانه', () => {
    const r = splitGeoFooter(`🧭 عنوان\n\nمتن کامل\n\n${GEO_MEMORY_TAG} خلاصهٔ حافظه: گوهر بازه.`);
    expect(r.body).toContain('متن کامل');
    expect(r.summary).toBe('گوهر بازه.');
    expect(GEO_MEMORY_TAG).toBe(MEMORY_FOOTER_TAG);
  });
});

// ---------- بلوک حافظه و برش امروز ----------

describe('buildGeoMemoryBlock و todayGeoSlice و buildNightlyGeoBlock', () => {
  test('حافظهٔ خالی → پیام صادقانهٔ «اولین تحلیل»', () => {
    expect(buildGeoMemoryBlock([])).toContain('اولین تحلیل');
    expect(buildNightlyGeoBlock([])).toContain('ثبت نشده');
  });

  test('هر بازه با ساعت اسلات؛ تازه‌ترین اول برای حافظهٔ درون‌بازه', () => {
    const block = buildGeoMemoryBlock([
      analysis('2026-11-13T00:00', 'بازهٔ نیمه‌شب: تنش دریایی', 'خلاصهٔ نیمه‌شب'),
      analysis('2026-11-13T04:00', 'بازهٔ بامداد: مذاکرات', 'خلاصهٔ بامداد'),
    ]);
    expect(block).toContain('— ساعت ۰۴:۰۰: خلاصهٔ بامداد');
    expect(block).toContain('— ساعت ۰۰:۰۰: خلاصهٔ نیمه‌شب');
    expect(block.indexOf('۰۴:۰۰')).toBeLessThan(block.indexOf('۰۰:۰۰')); // تازه‌ترین اول
    expect(block).not.toContain('مذاکرات ادامه یافت'); // خلاصه بود → متن کامل نخوانده نمی‌شود
  });

  test('todayGeoSlice — فقط اسلات‌های امروز (پیشوند تاریخ)', () => {
    const list = [analysis('2026-11-12T20:00', 'دیروز'), analysis('2026-11-13T04:00', 'بامداد امروز'), analysis('2026-11-13T08:00', 'صبح امروز')];
    expect(todayGeoSlice(list, '2026-11-13').map((a) => a.slotKey)).toEqual(['2026-11-13T04:00', '2026-11-13T08:00']);
    expect(todayGeoSlice(list, '2026-11-14')).toEqual([]);
  });

  test('buildNightlyGeoBlock — کهن‌ترین اول برای روایت شبانه + سقف طول هر مدخل', () => {
    const block = buildNightlyGeoBlock([
      analysis('2026-11-13T04:00', 'بامداد', 'خلاصهٔ بامداد'),
      analysis('2026-11-13T08:00', 'صبح', 'خلاصهٔ صبح'),
    ]);
    expect(block.indexOf('۰۴:۰۰')).toBeLessThan(block.indexOf('۰۸:۰۰'));
    const long = buildNightlyGeoBlock([analysis('2026-11-13T04:00', 'x', 'y'.repeat(1000))], 8, 120);
    for (const line of long.split('\n')) expect(line.length).toBeLessThan(160);
  });
});

// ---------- اعتبارسنجی متن ----------

describe('validateGeoText — اعتبارسنجی متن تحلیل ۸ساعته', () => {
  const GOOD = `🧭 تنش دریایی و مذاکرات موازی\n\n${FA_EVENT}\n\n🗂 رویدادهای کلیدی بازه\n۱. ${FA_EVENT}\n\n🔍 تحلیل\n• روند دیروز ادامه یافت.\n\n🔮 نتیجه‌گیری\n• پیام اصلی: تنش دریایی؛ فردا واکنش‌ها.\n\n🗞 منابع: وستانیوز، غرب آسیا`;

  test('متن معتبر فارسی پاس می‌شود', () => {
    const t = validateGeoText(GOOD);
    expect(t).not.toBeNull();
    expect(t).toContain('مذاکرات موازی');
  });

  test('کوتاه‌تر از کف ۳۰۰ نویسه → null', () => {
    expect(validateGeoText('🧭 عنوان\n\nمتن کوتاه')).toBeNull();
  });

  test('متن انگلیسی مطلقاً رد می‌شود', () => {
    expect(validateGeoText('Russia and Ukraine reached a prisoner exchange deal after talks. '.repeat(8))).toBeNull();
  });

  test('مارک‌داون و لینک پاک می‌شود؛ سقف ۵۲۰۰ رعایت می‌شود', () => {
    const raw = `# تیتر\n\n${FA_EVENT}\n\nلینک: https://example.com/x\n\n${'**مهم**\n\n'.repeat(200)}${FA_EVENT.repeat(20)}`;
    const t = validateGeoText(raw)!;
    expect(t).not.toBeNull();
    expect(t).not.toContain('https://');
    expect(t).not.toContain('**');
    expect(t.length).toBeLessThanOrEqual(5300);
  });
});

// ---------- بازنویسی پرامپت از bot/prompts.json ----------

describe('پرامپت geo — بازنویسی از اپلیکیشن', () => {
  const LONG = 'پرامپت ۴ساعتهٔ ویرایش‌شدهٔ کاربر برای بخش چپ و راست. '.repeat(10).trim();

  test('parsePromptFile کلید geo را می‌خواند', () => {
    const pf = parsePromptFile(JSON.stringify({ geo: LONG, updatedAt: '2026-11-13T00:00:00Z' }));
    expect(pf.geo).toBe(LONG);
  });

  test('اعمال فقط با متن بلند (≥۴۰۰ نویسه) و بازیابی پیش‌فرض پس از آزمون', () => {
    const def = getGeoPrompt();
    const short = applyPromptOverrides({ geo: 'کوتاه' });
    expect(short.geo).toBe(false);
    expect(getGeoPrompt()).toBe(def);
    const ok = applyPromptOverrides({ geo: LONG });
    expect(ok.geo).toBe(true);
    expect(getGeoPrompt()).toBe(LONG);
    applyPromptOverrides({ geo: def }); // بازیابی — اثر آزمون روی سایر تست‌ها نماند
  });

  afterAll(() => {
    applyPromptOverrides({ geo: DEFAULT_SYSTEM_GEO });
  });
});

// ---------- پیوند با تحلیل جامع شبانهٔ ۲۲:۳۰ ----------

describe('تحلیل شبانه — بخش چپ و راست به‌عنوان منبع تکمیلی (خواستهٔ کاربر)', () => {
  test('سوپرپرامپت شبانه بخش ۸ساعته‌ها را به‌عنوان ورودی می‌شناسد', () => {
    expect(DEFAULT_SYSTEM_NIGHTLY).toContain('ورودی شما سه بخش است');
    expect(DEFAULT_SYSTEM_NIGHTLY).toContain('تحلیل‌های ۸ساعتهٔ امروز — بخش رصد کانال‌های چپ و راست');
    expect(DEFAULT_SYSTEM_NIGHTLY).toContain('(ج)');
  });
});
