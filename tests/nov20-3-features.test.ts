/**
 * ویژگی‌های خواستهٔ کاربر — ۲۰ نوامبر ۲۰۲۶ (سوم):
 *  ۱) «اگر خبر مهمی نبود اصلا چیزی ارسال نشه که کانال شلوغ بشه» — پالایهٔ مناسکتی بخش چپ‌وراست
 *     (isGeoRitualPost / filterGeoGeopolitical) + گیت دیجست خالی (geoReportableEventCount) با
 *     نمونهٔ واقعی پیام کاربر (جمعه ۲۹ آبان — قرائت قرآن/زیارت امام رضا/دعای ندبه).
 *  ۲) «حداکثر ۵ واقعهٔ خیلی مهم‌تر تاریخی … اصلا تولد و فوت شاعران و بازیگران و هنرمندان
 *     و ... نمیخوام» — isMajorHistoricalEvent + رفتار بلوک (در day-history.test.ts هم پوشش داده شد).
 *  ۳) رادار هواشناسی بارشی فقط ایران — هندسه، دسته‌بندی رنگ (آبی برف/نارنجی باران/بی‌رنگ آفتابی)،
 *     سایهٔ پیش‌بینی، SVG و رندر واقعی PNG.
 *  ۴) اخبار ایران متمایز — isIranRelated (بدون ایرانسل) + بولد موارد در متن HTML.
 *  ۵) خبر فوری — isBreakingTweetText (ایران/جنگ) + گیف چراغ گردان چندفریمی «فوری».
 *  ۶) حساب‌های اولویت‌دار توییت — pickTweetAccountsForCycle (هر چرخه چک شوند).
 */
import { describe, expect, test } from 'bun:test';
import {
  isGeoRitualPost,
  filterGeoGeopolitical,
  geoReportableEventCount,
  type GeoPost,
} from '../bot/geo';
import { isMajorHistoricalEvent, DAY_HISTORY_EVENT_CAP } from '../bot/day-history';
import {
  pointInIran,
  buildIranGrid,
  buildOpenMeteoGridUrl,
  classifyRadarSample,
  radarColor,
  parseOpenMeteoPoint,
  makeIranRadarSvg,
  makeRadarCellsSvg,
  lonLatToXY,
  RADAR_W,
  RADAR_MAP_H,
  fetchIranRadarPng,
} from '../bot/iran-radar';
import { isIranRelated, highlightIranItemsHtml } from '../bot/iran';
import { isBreakingTweetText, makeBreakingGifFrameSvg, renderBreakingGif, BREAKING_GIF_FRAMES } from '../bot/breaking';
import { pickTweetAccountsForCycle, rotateAccounts } from '../bot/bot';
import type { TweetAccount } from '../bot/bot';
import { tripleDateOf } from '../bot/calendar';

// ---------- ۱) بخش چپ‌وراست: خبر مهم نبود → هیچ پیامی ----------

describe('پالایهٔ محتوای صرفاً دینی/مناسکتی — خواستهٔ ۲۰ نوامبر', () => {
  test('نمونهٔ واقعی کاربر (جمعه ۲۹ آبان) — قرائت قرآن/زیارت/دعا مناسکت است نه خبر', () => {
    expect(isGeoRitualPost('به مناسبت صبح جمعه، قرائت قرآن و زیارت امام رضا (ع) و دعای ندبه و سلام امام زمان (عج) در کانال‌ها')).toBe(true);
    expect(isGeoRitualPost('زیارت عاشورا و صلوات برای تعجیل فرج')).toBe(true);
    expect(isGeoRitualPost('پیام تسلیت ارسال شد به مناسبت شهادت امام رضا (ع) — یوم شهادت گرامی باد')).toBe(true);
  });
  test('خبر سخت هرگز مناسکت شمرده نمی‌شود — حتی با بافت دینی', () => {
    expect(isGeoRitualPost('قرائت بیانیهٔ سپاه دربارهٔ حملهٔ موشکی به پایگاه آمریکا')).toBe(false);
    expect(isGeoRitualPost('امام جمعه تهران: حملهٔ دشمن به تهران محاسبه‌شده و پاسخ داده می‌شود')).toBe(false);
    expect(isGeoRitualPost('آمریکا تحریم‌های تازهٔ ایران را اعلام کرد')).toBe(false);
    expect(isGeoRitualPost('دلار در بازار تهران جهش کرد — قیمت طلا')).toBe(false);
  });
  test('فیلتر فهرست — پیام‌های مناسکتی حذف؛ خبرها می‌مانند', () => {
    const posts: GeoPost[] = [
      { id: 'a', channel: 'c1', channelName: '۱', platform: 'telegram', text: 'قرائت قرآن صبح جمعه و دعای ندبه برای حاجت‌ها', at: null },
      { id: 'b', channel: 'c1', channelName: '۱', platform: 'telegram', text: 'اعلام آمادگی ارش برای پاسخ به هر حملهٔ جدید دشمن در منطقه', at: null },
      { id: 'c', channel: 'c2', channelName: '۲', platform: 'eitaa', text: 'زیارت امین‌الله در ماه رجب', at: null },
    ];
    const out = filterGeoGeopolitical(posts);
    expect(out.length).toBe(1);
    expect(out[0]!.id).toBe('b');
  });
});

describe('گیت دیجست خالی — geoReportableEventCount با نمونهٔ واقعی پیام کاربر', () => {
  const emptyDigest = `🧭 بازه ۰۸:۱۲ — محتوای دینی و یادبود امام رضا (ع) و امام زمان (عج) در کانال‌های رصدشده، بدون رویداد ژئوپلیتیکی تازه

🗂 رویدادهای کلیدی بازه
۱. رویداد تازه‌ای در این بازه در کانال‌های رصدشده ثبت نشد؛ پیام‌های دریافتی منحصراً شامل قرائت قرآن، زیارت امام رضا (ع)، دعای ندبه و سلام امام زمان (عج) به مناسبت صبح جمعه ۲۹ آبان بوده است.

📊 روایت‌های دو طیف
• رویدادی با روایت دوگانه در این بازه وجود ندارد.

⚖️ اعتبارسنجی
• هیچ رویداد ژئوپلیتیکی/امنیتی برای اعتبارسنجی وجود ندارد؛ تمام پیام‌ها محتوای دینی/یادبودی هستند.

🔍 تحلیل
• کانال‌های رصدشده در این بازه تمرکز کامل بر مناسبت‌های دینی جمعه داشته‌اند.

🔮 نتیجه‌گیری
• این بازه فاقد داده ژئوپلیتیکی قابل‌تحلیل از کانال‌های رصدشده است.

🗞 منابع: @ch1، @ch2`;

  const fullDigest = `🧭 تشدید تنش در هرمز

🗂 رویدادهای کلیدی بازه
۱. ایران تازه‌ترین مانور موشکی سپاه را در خلیج فارس اعلام کرد.
۲. رویداد تازه‌ای در این بازه ثبت نشد؛ پیام‌ها محتوای دینی بود.
۳. ترامپ در تروث‌سوشال نوشت آمادهٔ مذاکره با تهران است.

📊 روایت‌های دو طیف
• رسانه‌های دو سو روایت متفاوتی دارند.

🔮 نتیجه‌گیری
• تنش ادامه دارد.`;

  test('دیجستِ همه‌اش «ثبت نشد/محتوای دینی» → صفر رویداد → ارسال نمی‌شود', () => {
    expect(geoReportableEventCount(emptyDigest)).toBe(0);
  });
  test('دیجست با رویداد واقعی → شمارش درست (سطر «ثبت نشد» شمرده نمی‌شود)', () => {
    expect(geoReportableEventCount(fullDigest)).toBe(2);
  });
  test('سطر شماره‌دارِ «رویداد تازه: حملهٔ …» خبر است نه بی‌رویداد — حذف نمی‌شود', () => {
    const t = '🗂 رویدادها\n۱. رویداد تازه: حملهٔ پهپادی به پایگاه آمریکایی در علی‌السلم.';
    expect(geoReportableEventCount(t)).toBe(1);
  });
  test('نبود سربرگ 🗂 → شمارش کل سطرهای مورد (پشتیبان محافظه‌کار)', () => {
    expect(geoReportableEventCount('۱. حملهٔ موشکی به نفت‌کش در هرمز.\n• بی‌مورد دیگر')).toBe(2);
    expect(geoReportableEventCount('رویداد تازه‌ای در این بازه ثبت نشد.')).toBe(0);
    expect(geoReportableEventCount('')).toBe(0);
  });
});

// ---------- ۲) وقایع تاریخی — فقط بسیار مهم ----------

describe('واقعهٔ تاریخی «خیلی مهم» — خواستهٔ ۲۰ نوامبر', () => {
  test('جنگ/پیمان/انقلاب/بلأا مهم‌اند', () => {
    expect(isMajorHistoricalEvent('آغاز جنگ جهانی اول')).toBe(true);
    expect(isMajorHistoricalEvent('پایان جنگ ایران و عراق و پذیرش قطعنامه ۵۹۸')).toBe(true);
    expect(isMajorHistoricalEvent('انعقاد معاهدهٔ ترکمانچای')).toBe(true);
    expect(isMajorHistoricalEvent('وقوع انقلاب اسلامی')).toBe(true);
    expect(isMajorHistoricalEvent('زمین‌لرزهٔ بم')).toBe(true);
    expect(isMajorHistoricalEvent('ترور نخست‌وزیر')).toBe(true);
    expect(isMajorHistoricalEvent('تأسیس سازمان ملل متحد')).toBe(true);
  });
  test('رویدادهای عادی و زادروز/درگذشت چهره‌ها مهم نیستند', () => {
    expect(isMajorHistoricalEvent('زادروز نیما یوشیج، پدر شعر نو فارسی')).toBe(false);
    expect(isMajorHistoricalEvent('درگذشت ستارخان، سردار ملی')).toBe(false);
    expect(isMajorHistoricalEvent('آغاز پخش رسمی شبکه جهانی سحر')).toBe(false);
    expect(isMajorHistoricalEvent('انتخاب اصفهان به عنوان پایتخت')).toBe(false);
    expect(isMajorHistoricalEvent('')).toBe(false);
  });
  test('سقف ۵ مورد', () => {
    expect(DAY_HISTORY_EVENT_CAP).toBe(5);
  });
});

// ---------- ۳) رادار بارشی ایران ----------

describe('رادار بارشی ایران — هندسه', () => {
  test('نقاط معلوم داخل/خارج خاک', () => {
    expect(pointInIran(51.42, 35.7)).toBe(true); // تهران
    expect(pointInIran(48.68, 31.32)).toBe(true); // اهواز
    expect(pointInIran(55.9, 26.75)).toBe(true); // قشم
    expect(pointInIran(53.98, 26.53)).toBe(true); // کیش
    expect(pointInIran(29.0, 41.0)).toBe(false); // استانبول
    expect(pointInIran(50.0, 20.0)).toBe(false); // عربستان
    expect(pointInIran(70.0, 35.0)).toBe(false); // افغانستان شرق
  });
  test('گرید غیرخالی داخل ایران — بیرون‌مانده‌ها حذف', () => {
    const g = buildIranGrid(0.7);
    expect(g.length).toBeGreaterThan(150);
    for (const p of g) expect(pointInIran(p.lon, p.lat)).toBe(true);
  });
  test('تصویرگردانی خطی — شمال بالا', () => {
    const [x1, y1] = lonLatToXY(45, 38);
    const [x2, y2] = lonLatToXY(55, 28);
    expect(y1).toBeLessThan(y2); // شمالی‌تر → بالاتر در تصویر
    expect(x1).toBeLessThan(x2); // شرقی‌تر → راست‌تر
    expect(x1).toBeGreaterThanOrEqual(0);
    expect(x2).toBeLessThanOrEqual(RADAR_W);
    expect(y2).toBeLessThanOrEqual(RADAR_MAP_H);
  });
});

describe('رادار بارشی ایران — دسته‌بندی رنگ (آبی برف، نارنجی باران، بی‌رنگ آفتابی)', () => {
  test('برف مقدم بر باران', () => {
    expect(classifyRadarSample({ precipitation: 1, rain: 0, snowfall: 0.3, cloudCover: 100 })).toEqual({ kind: 'snow', level: 1 });
    expect(classifyRadarSample({ precipitation: 2, rain: 2, snowfall: 1.5 })).toEqual({ kind: 'snow', level: 2 });
  });
  test('باران سبک/متوسط/شدید', () => {
    expect(classifyRadarSample({ precipitation: 0.3, rain: 0.3, snowfall: 0, cloudCover: 90 })).toEqual({ kind: 'rain', level: 0 });
    expect(classifyRadarSample({ precipitation: 2, rain: 2, snowfall: 0 })).toEqual({ kind: 'rain', level: 1 });
    expect(classifyRadarSample({ precipitation: 7, rain: 7, snowfall: 0 })).toEqual({ kind: 'rain', level: 2 });
  });
  test('ابری و آفتابی (بی‌رنگ)', () => {
    expect(classifyRadarSample({ precipitation: 0, rain: 0, snowfall: 0, cloudCover: 90 })).toEqual({ kind: 'cloud', level: 0 });
    expect(classifyRadarSample({ precipitation: 0, rain: 0, snowfall: 0, cloudCover: 10 })).toEqual({ kind: 'clear', level: 0 });
    expect(classifyRadarSample(null)).toEqual({ kind: 'clear', level: 0 });
  });
  test('رنگ‌ها — آبی برف، نارنجی→قرمز باران', () => {
    expect(radarColor('snow', 0)).toContain('#');
    expect(radarColor('rain', 1)).toBe('#f97316'); // نارنجی — خواستهٔ کاربر
    expect(radarColor('clear', 0)).toBe('');
  });
  test('سایهٔ پیش‌بینی — سلول بزرگ‌تر از نشان فعلی (سبک رادار حرفه‌ای)', () => {
    const cells = [{ lat: 35.7, lon: 51.4, cur: { precipitation: 2, rain: 2, snowfall: 0 }, fc: { precipitation: 6, rain: 6, snowfall: 0 } }];
    const { current, shadow } = makeRadarCellsSvg(cells);
    expect(current).toContain('<rect');
    expect(shadow).toContain('<rect');
    const sCur = Number(/width="(\d+)"/.exec(current)?.[1]);
    const sSh = Number(/width="(\d+)"/.exec(shadow)?.[1]);
    expect(sSh).toBeGreaterThan(sCur); // سایه بزرگ‌تر و محوتر
  });
  test('آفتابی هیچ نشان ندارد', () => {
    const { current, shadow } = makeRadarCellsSvg([
      { lat: 35.7, lon: 51.4, cur: { precipitation: 0, rain: 0, snowfall: 0, cloudCover: 5 }, fc: null },
    ]);
    expect(current).toBe('');
    expect(shadow).toBe('');
  });
});

describe('رادار بارشی ایران — دادهٔ Open-Meteo', () => {
  test('نشانی گرید چندنقطه‌ای', () => {
    const url = buildOpenMeteoGridUrl([35.7, 32.4], [51.4, 53.1]);
    expect(url).toContain('api.open-meteo.com/v1/forecast');
    expect(url).toContain('latitude=35.70%2C32.40');
    expect(url).toContain('forecast_hours=4');
    expect(url).toContain('timezone=Asia%2FTehran');
  });
  test('پارس نقطه — فعلی + خانهٔ چهارم (+۳ ساعت) به‌عنوان سایه', () => {
    const p = parseOpenMeteoPoint({
      current: { precipitation: 0.4, rain: 0.4, snowfall: 0, cloud_cover: 95 },
      hourly: { precipitation: [0.4, 1, 3, 6], rain: [0.4, 1, 3, 6], snowfall: [0, 0, 0, 0] },
    });
    expect(p?.cur.rain).toBe(0.4);
    expect(p?.fc?.rain).toBe(6); // +۳ ساعت
    expect(parseOpenMeteoPoint({ current: null })).toBeNull();
    expect(parseOpenMeteoPoint(null)).toBeNull();
  });
});

describe('رادار بارشی ایران — SVG و رندر واقعی', () => {
  const date = tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura');
  test('SVG — عنوان، راهنما، مرز و نشان‌ها', () => {
    const cells = [
      { lat: 35.7, lon: 51.4, cur: { precipitation: 6, rain: 6, snowfall: 0, cloudCover: 100 }, fc: { precipitation: 2, rain: 2, snowfall: 0 } },
      { lat: 37.0, lon: 49.0, cur: { precipitation: 0.3, rain: 0, snowfall: 0.3, cloudCover: 100 }, fc: null },
      { lat: 30.5, lon: 57.0, cur: { precipitation: 0, rain: 0, snowfall: 0, cloudCover: 80 }, fc: { precipitation: 0.2, rain: 0.2, snowfall: 0 } },
    ];
    const svg = makeIranRadarSvg(date, cells, '۱۴:۳۰', '۳ ساعت آینده');
    expect(svg).toContain('رادار هواشناسی بارشی ایران');
    expect(svg).toContain('برف');
    expect(svg).toContain('باران');
    expect(svg).toContain('آفتابی');
    expect(svg).toContain('فقط ایران');
    expect(svg).toContain('feGaussianBlur'); // سایهٔ محو پیش‌بینی
    expect(svg).toContain('clipPath'); // دادهٔ بارش فقط داخل مرز ایران
    expect(svg).toContain('stroke-dasharray'); // چیپ خط‌چین آفتابی (بی‌رنگ)
  });
  test('رندر واقعی PNG — فقط ایران (بدون دادهٔ شبکهٔ خارجی)', async () => {
    const png = await fetchIranRadarPng(date);
    // شبِ بدون بارش هم نقشهٔ مرز+گرید باید رندر شود؛ شکست شبکه → null مجاز است (صادقانه)
    if (png) {
      expect(png.png.length).toBeGreaterThan(15_000);
      expect(png.width).toBe(1100);
    }
  }, 60_000);
});

// ---------- ۴) اخبار ایران متمایز ----------

describe('شناسایی و برجسته‌سازی اخبار ایران — خواستهٔ ۲۰ نوامبر', () => {
  test('isIranRelated — واژه‌های نشانه', () => {
    expect(isIranRelated('دلار در بازار تهران کاهش یافت')).toBe(true);
    expect(isIranRelated('سپاه مانور موشکی برگزار کرد')).toBe(true);
    expect(isIranRelated('ترامپ: Iran will not get nukes')).toBe(true);
    expect(isIranRelated('قیمت نفت در بازارهای جهانی بالا رفت')).toBe(false);
    expect(isIranRelated('')).toBe(false);
  });
  test('«ایرانسل» برند است نه ایران', () => {
    expect(isIranRelated('ایرانسل اینترنت را ارزان کرد')).toBe(false);
    expect(isIranRelated('ایرانسل و ایران‌موبایل قرارداد بستند')).toBe(true); // ایران‌موبایل دارد
  });
  test('بولد موارد ایران‌مرتبط — فقط سطرهای مورد و بدون دوبار بولد', () => {
    const t = [
      '🗂 رویدادهای کلیدی بازه',
      '۱. دلار در بازار تهران به کانال جدید رسید.',
      '۲. تیم فوتبال بایرن قهرمان شد.',
      '• سپاه پاسداران بیانیه صادر کرد.',
      '🧭 عنوان بازه',
    ].join('\n');
    const out = highlightIranItemsHtml(t);
    expect(out).toContain('۱. <b>دلار در بازار تهران به کانال جدید رسید.</b>');
    expect(out).toContain('۲. تیم فوتبال بایرن قهرمان شد.'); // بدون تغییر
    expect(out).toContain('• <b>سپاه پاسداران بیانیه صادر کرد.</b>');
    expect(out).toContain('🧭 عنوان بازه'); // سربرگ دست‌نخورده
    expect(out).not.toContain('<b><b>');
  });
  test('سطر بولد‌شده از قبل دست نمی‌خورد', () => {
    const out = highlightIranItemsHtml('۱. <b>خبر تهران</b>');
    expect(out).toBe('۱. <b>خبر تهران</b>');
  });
});

// ---------- ۵) خبر فوری ----------

describe('تشخیص خبر فوری — فقط توییت‌های حاوی «ایران» (خواستهٔ ۲۰ نوامبر پنجم)', () => {
  test('فارسی و انگلیسی — حاوی ایران', () => {
    expect(isBreakingTweetText('آمریکا تحریم‌های تازهٔ ایران را اعلام کرد')).toBe(true);
    expect(isBreakingTweetText('Iran rejects negotiations')).toBe(true);
    expect(isBreakingTweetText('Persia has a long history')).toBe(true);
  });
  test('جنگ بدون ایران دیگر فوری نیست (تنگهٔ آستانه ۲۰ نوامبر پنجم)', () => {
    expect(isBreakingTweetText('جنگ در خاورمیانه گسترش یافت')).toBe(false); // جنگِ بدون ایران
    expect(isBreakingTweetText('Trump: We are ready for war')).toBe(false); // war بدون Iran
    expect(isBreakingTweetText('جنگ داخلی سودان شدت گرفت')).toBe(false);
    // جنگ + ایران → همچنان فوری
    expect(isBreakingTweetText('جنگ علیه ایران گسترش یافت')).toBe(true);
    expect(isBreakingTweetText('Iran is ready for war')).toBe(true);
  });
  test('غیرفوری', () => {
    expect(isBreakingTweetText('قیمت بیت‌کوین رکورد زد')).toBe(false);
    expect(isBreakingTweetText('جام جهانی شروع شد')).toBe(false);
    expect(isBreakingTweetText('ایرانسل پلن جدید برداشت')).toBe(false); // برند — نه ایران
    expect(isBreakingTweetText('')).toBe(false);
  });
});

describe('گیف چراغ گردان «فوری»', () => {
  test('هر فریم عنوان «فوری» و پرتو چرخان دارد', () => {
    for (let i = 0; i < BREAKING_GIF_FRAMES; i += 3) {
      const svg = makeBreakingGifFrameSvg(i);
      expect(svg).toContain('فوری');
      expect(svg).toContain('<path'); // پرتو نور چرخان
    }
  });
  test('رندر واقعی — GIF چندفریمی معتبر', async () => {
    const g = await renderBreakingGif();
    expect(g).not.toBeNull();
    expect(g!.gif.slice(0, 3).toString('latin1')).toBe('GIF');
    expect(g!.width).toBe(560);
    // چندفریمی بودن با sharp
    const sharp = (await import('sharp')).default;
    const meta = await sharp(g!.gif, { pages: -1 }).metadata();
    expect(meta.pages).toBe(BREAKING_GIF_FRAMES);
  }, 60_000);
});

// ---------- ۶) حساب‌های اولویت‌دار توییت ----------

describe('گزینش حساب‌های هر چرخه با سرِ اولویت‌دار', () => {
  const accs: TweetAccount[] = Array.from({ length: 12 }, (_, i) => ({
    handle: `h${i}`, platform: 'x' as const, name: `n${i}`,
  }));
  test('سرِ اولویت‌دار در «هر» چرخه هست — حتی وقتی پنجرهٔ چرخشی جای دیگر است', () => {
    const r = pickTweetAccountsForCycle(accs, 10, 3, 8);
    expect(r.picked.length).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < 8; i++) expect(r.picked.some((a) => a.handle === `h${i}`)).toBe(true);
    // پنجرهٔ چرخشی هم هست (h10, h11, h0)
    expect(r.picked.some((a) => a.handle === 'h10')).toBe(true);
    expect(r.picked.some((a) => a.handle === 'h11')).toBe(true);
    // nextCursor همان منطق چرخشی
    expect(r.nextCursor).toBe(1);
  });
  test('بدون اولویت — عینن rotateAccounts قبلی', () => {
    const a = pickTweetAccountsForCycle(accs, 4, 5, 0);
    const b = rotateAccounts(accs, 4, 5);
    expect(a.picked.map((x) => x.handle)).toEqual(b.picked.map((x) => x.handle));
  });
  test('تکراری‌ها فقط یک‌بار (مرجع یکسان)', () => {
    const r = pickTweetAccountsForCycle(accs, 0, 6, 8);
    const uniq = new Set(r.picked.map((x) => x.handle));
    expect(uniq.size).toBe(r.picked.length);
  });
});
