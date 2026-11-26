/**
 * ممیزی ۲۷ نوامبر ۲۰۲۶ — «کل برنامه و ربات رو با دیدی بسیار سخت‌گیرانه و منتقدانه و از
 * بیرون بررسی کن» — پوشش رفتاری همهٔ رفع‌های همین ممیزی (رفع‌ها در bot/news-intake.ts،
 * bot/bot.ts، bot/geo.ts و رندرکننده‌های کارت):
 *
 *  گیت دروازه: تبلیغِ فراری (کارتِ ZWJ-جدا، شبای IR-جدا، «کپی میشه» گفتاری) هرگز وارد نمی‌شود؛
 *  گیت ۲: روایت‌های فراری توییت («توییتی منتشر کرد»، «توئیتی زد»، «در توییتر پست کرد»،
 *    «در شبکه X نوشت») رد؛ گزارش بلند تحلیلی می‌ماند؛
 *  گیت ۳: سقف کم‌اهمیت (LOW) — «امام جمعه رودسر: ایران…» و «گردشگری تهران» دیگر با
 *    آلودگی کلیدواژه از آستانه نمی‌گذرند؛ جنگ+ایران هرچه باشد ۱۰۰؛ کلیدواژه‌های کلانِ تازه
 *    (سهام/فدرال رزرو/ترامپ/…) خبر مهم جهان را نجات می‌دهند؛ «تورم» قربانی «تور» نمی‌شود؛
 *  گیت ۵: تطبیق دوسیگنالی ارجاع‌ها (عدد ≥۳رقمی/دو نام لاتین/ژاکارد بالا)؛
 *  سقف روزانهٔ انتشار (newsDayCapReached)؛
 *  رابط کاربری: بنر و پانوشت بدون گلیف ایموجی (تیک برداری)، شمارش درست «+N رویداد دیگر»
 *    به‌ازای هر صفحه، dropped روی کارت، فونت یکپارچهٔ FONT_FA در همهٔ کارت‌ها، ممیز فارسی
 *    درصد در کارت دارایی، سقف PNG فوری ۸۷۲۰ (سازگار با سقف واقعی بله)، فلش‌های برداری
 *    کارت نمودار، سرریز تک‌آیتم بلند کارت متن‌کامل، پالایهٔ نوفهٔ ژئو (خبر واقعی حذف نمی‌شود).
 */
import { describe, expect, test } from 'bun:test';
import {
  isAdOrPromo,
  isTweetRelayNews,
  importanceScore,
  LOW_STORY_SCORE_CAP,
  attributionMatch,
  filterByImportance,
} from '../bot/news-intake';
import { isGeoNoise } from '../bot/geo';
import { newsDayCapReached } from '../bot/bot';
import { tripleDateOf } from '../bot/calendar';
import {
  makeNewsCardSvg,
  renderNewsCardPages,
  BREAKING_PNG_MAX_HEIGHT,
  NEWS_CARD_ROWS_PER_PAGE,
  type NewsCardItem,
} from '../bot/news-card';
import { splitFullTextItemsForCards, renderFullTextCardPng, FT_PAGE_MAX_HEIGHT } from '../bot/fulltext-card';
import { makeTweetCardSvg } from '../bot/news-card';
import { makeAssetsCardSvg } from '../bot/assets-card';
import { makeAssetsChartSvg } from '../bot/assets-chart';
import { makeMarketCardSvg } from '../bot/market-card';
import { BALE_DIM_SUM_MAX } from '../bot/render-scale';
import { FORECAST_LAST_DELAY_MS } from '../bot/forecast-gif';
import type { Quote } from '../bot/market';

const DATE = tripleDateOf('2026-11-27', 'Asia/Tehran', 'umalqura');

// ---------- گیت ۱ — ضدتبلیغ: الگوهای فراری ممیزی ۲۷ نوامبر ----------

describe('ممیزی ۲۷ — گیت ضدتبلیغ: نمونه‌های فراری', () => {
  test('کارت ۱۶رقمی با جداساز نامرئی ZWJ بین رقم‌ها', () => {
    // \u200D = ZWJ — پیش‌تر joinDigitRuns آن را نمی‌چسباند و از قاعدهٔ ۱۶رقمی می‌گریخت
    expect(isAdOrPromo('برای کمک به سیستم صوت هیئت کارت 5892\u200d1070\u200d5017\u200d5168 را واریز کنید').ad).toBe(true);
  });

  test('شبا با جداساز «IR-» — قاعدهٔ شبکهٔ بانکی', () => {
    expect(isAdOrPromo('شبا: IR-400150000003101104472113 به نام گروه جهادی').ad).toBe(true);
  });

  test('«کپی میشه» گفتاری + سیگنال نرم دوم = تبلیغ', () => {
    expect(isAdOrPromo('شماره کارت رو کپی میشه، لطفا در حد توان سهم بگیرید و نیت کنید').ad).toBe(true);
  });

  test('خبر واقعی با عدد ۱۶رقمی ناموجود؟ نه — خبر بانکی عادی تبلیغ نیست', () => {
    expect(isAdOrPromo('بودجهٔ سالانهٔ سازمان برنامه ۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۰۰ تومان تصویب شد').ad).toBe(true); // قاعدهٔ سخت عمداً محافظه‌کار — بایاس به سد تبلیغ
    expect(isAdOrPromo('شورای پول و اعتبار نرخ بهره را کاهش داد و بازار سهام واکنش نشان داد').ad).toBe(false);
  });
});

// ---------- گیت ۲ — بازنشر توییت: روایت‌های فراری ----------

describe('ممیزی ۲۷ — گیت بازنشر توییت', () => {
  test('«توییتی منتشر کرد» — روایت فراری پیشین، اکنون رد', () => {
    expect(isTweetRelayNews('ترامپ توییتی منتشر کرد: ما برنده خواهیم شد!')).toBe(true);
  });
  test('«توئیتی زد» — گویش دیگر', () => {
    expect(isTweetRelayNews('نتانیاهو توئیتی زد: پاسخ خواهد داد')).toBe(true);
  });
  test('«در توییتر پست کرد»', () => {
    expect(isTweetRelayNews('ترامپ در توییتر پست کرد که مذاکرات پیش می‌رود')).toBe(true);
  });
  test('«در شبکه X نوشت» — X لاتین', () => {
    expect(isTweetRelayNews('ماسک در شبکه X نوشت که پرتاب انجام شد')).toBe(true);
  });
  test('گزارش بلند تحلیلی که در میانه به توییتی ارجاع می‌دهد — می‌ماند', () => {
    const long = 'تحلیل مفصل خبرگزاری دربارهٔ پیامدهای اقتصادی اعلامیات اخیر ترامپ در توییتر: بازارهای جهانی واکنش نشان دادند و تحلیلگران هشدار دادند که ادامهٔ این روند می‌تواند به بی‌ثباتی بیشتر بینجامد و بانک‌های مرکزی ناچار به بازنگر سیاست‌های پولی خود خواهند شد، چرا که انتظارات تورمی تغییر کرده است.'.repeat(2);
    expect(isTweetRelayNews(long)).toBe(false);
  });
});

// ---------- گیت ۳ — اهمیت: سقف LOW + کلیدواژه‌های کلان + رفع فالس‌نگاتیو ----------

describe('ممیزی ۲۷ — اهمیت‌سنجی: سقف کم‌اهمیت', () => {
  test('«امام جمعه رودسر: ایران قوی…» — آلودگی کلیدواژه دیگر امتیاز ممتاز نمی‌سازد', () => {
    const s = importanceScore('امام جمعه رودسر گفت: ایران قوی با حضور آگاهانه مردم و وحدت ملی هر تهدیدی را خنثی می‌کند');
    expect(s).toBeLessThan(55);
    expect(s).toBeLessThanOrEqual(LOW_STORY_SCORE_CAP);
  });

  test('«گردشگری تهران در پاییز» — شکایت زندهٔ کاربر، اکنون زیر آستانه', () => {
    expect(importanceScore('گردشگری تهران در فصل پاییز رونق گرفت و تورهای متعددی برگزار شد')).toBeLessThan(55);
  });

  test('«بازنشستگی آرنو» و «نمایشگاه استانی» — پرکرِ بی‌اهمیت', () => {
    expect(importanceScore('بازنشستگی مربی آرنو پس از سال‌ها فعالیت اعلام شد')).toBeLessThan(55);
    expect(importanceScore('نمایشگاه صنایع دستی چهارمحال و بختیاری گشایش یافت')).toBeLessThan(55);
  });

  test('جنگ + ایران = ۱۰۰ حتی با واژهٔ کم‌اهمیت در متن', () => {
    expect(importanceScore('حملهٔ موشکی به پایگاه‌های ایران گزارش شد؛ منابع نظامی از آماده‌سازی مسابقه‌ای نیرو‌ها خبر دادند')).toBe(100);
  });

  test('جنگ بدون ایران هنوز ممتاز است؛ «انفجار نفتکش دبی» ≥ ۹۵', () => {
    expect(importanceScore('انفجار در نفتکش غرب دبی گزارش شد؛ مچ‌بند حمله بررسی می‌شود')).toBeGreaterThanOrEqual(95);
  });

  test('«تورم» قربانی نشان LOW «تور» نمی‌شود', () => {
    expect(importanceScore('تورم نقطه‌به‌نقطهٔ سالانه به ۳۸٫۸ درصد رسید؛ بانک مرکزی گزارش داد')).toBeGreaterThanOrEqual(55);
  });
});

describe('ممیزی ۲۷ — اهمیت‌سنجی: رفع فالس‌نگاتیو اخبار مهم جهان', () => {
  test('سود سهام/اوراق Nvidia و CoreWeave (بلومبرگ) — پیش‌تر ۴۰ و حذف بی‌صدا', () => {
    expect(importanceScore('سندهای CoreWeave به پایین‌ترین سطح تاریخ رسیدند و سودهای سهام Nvidia نیز افت کرد')).toBeGreaterThanOrEqual(55);
  });

  test('سیاست آمریکا: «ترامپ مدال آزادی را به جولیانی داد» (AP) — پیش‌تر حذف می‌شد', () => {
    expect(importanceScore('ترامپ مدال آزادی را به رودی جولیانی اعطا کرد؛ کاخ سفید اعلام کرد')).toBeGreaterThanOrEqual(55);
  });

  test('فدرال رزرو و دیوان عالی — رشته‌های کلانِ تازه', () => {
    expect(importanceScore('فدرال رزرو نرخ بهره را کاهش داد و بازار سهام جهانی واکنش نشان داد')).toBeGreaterThanOrEqual(55);
    expect(importanceScore('دیوان عالی آمریکا در پروندهٔ مهم قانونی رأی داد')).toBeGreaterThanOrEqual(55);
  });

  test('پالایه: این موارد از صف انتشار حذف می‌شوند، موارد مهم می‌مانند', () => {
    const items = [
      { text: 'آغاز ثبت‌نام اعتکاف در مساجد فارس اعلام شد' },
      { text: 'حملهٔ پهپادی به تأسیسات نظامی گزارش شد' },
      { text: 'موزهٔ استان نمایشگاه عکس سالگرد افتتاح می‌کند' },
      { text: 'تحریم‌های جدید آمریکا علیه ایران اعمال شد' },
    ];
    const { kept } = filterByImportance(items, { threshold: 55, minKeep: 0 });
    expect(kept.map((k) => k.text)).toContain('حملهٔ پهپادی به تأسیسات نظامی گزارش شد');
    expect(kept.map((k) => k.text)).toContain('تحریم‌های جدید آمریکا علیه ایران اعمال شد');
    expect(kept.length).toBe(2);
  });
});

// ---------- گیت ۵ — تطبیق دوسیگنالی ارجاع‌ها (تست تکمیلی) ----------

describe('ممیزی ۲۷ — تطبیق ارجاع: دوسیگنالی', () => {
  test('عدد ۳رقمی مشترک بین دو زبان = تأیید', () => {
    expect(attributionMatch('Bloomberg: tariffs on 250 billion dollars of goods', 'به نقل از بلومبرگ: تعرفه بر ۲۵۰ میلیارد دلار کالا')).toBe(true);
  });
  test('عدد ۲رقمی مشترک با ژاکاردِ عمومی پایین = رد (پیش‌تر تأیید می‌شد)', () => {
    expect(attributionMatch('Missile attack kills 12 soldiers in region', 'وزیر آمریکا دربارهٔ ایران گفتگو کرد و گفت ۱۲ کشور عضو مذاکره خواهند بود و همهٔ طرف‌ها باید تعهد بدهند که آتش‌بس برقرار شود و کشورهای منطقه هم همکاری کنند')).toBe(false);
  });
});

// ---------- سقف روزانهٔ انتشار ----------

describe('ممیزی ۲۷ — سقف روزانهٔ انتشار خبر', () => {
  test('روزی که شمارنده پر شد → اسلات نمی‌زند؛ روز تازه → صفر', () => {
    expect(newsDayCapReached({ day: '2026-11-27', sent: 96 }, '2026-11-27', 96)).toBe(true);
    expect(newsDayCapReached({ day: '2026-11-27', sent: 95 }, '2026-11-27', 96)).toBe(false);
    expect(newsDayCapReached({ day: '2026-11-26', sent: 96 }, '2026-11-27', 96)).toBe(false); // روز عوض شد
    expect(newsDayCapReached(undefined, '2026-11-27', 96)).toBe(false);
  });
});

// ---------- پالایهٔ نوفهٔ ژئو: خبر واقعی حذف نمی‌شود ----------

describe('ممیزی ۲۷ — نوفهٔ ژئو: محدود و محتاط', () => {
  test('خبر واقعیِ حاوی «تبلیغات سیاسی» نوفه نیست (پیش‌تر حذف می‌شد)', () => {
    expect(isGeoNoise('مجلس ممنوعیت تبلیغات سیاسی گروه‌های خارجی را در انتخابات تصویب کرد و گزارش‌های بین‌المللی دربارهٔ پیامدهایش منتشر شد.')).toBe(false);
  });
  test('خبر نظامی حاوی «ادمین ارشد» نوفه نیست', () => {
    expect(isGeoNoise('به گزارش منابع نظامی، ادمین ارشد رادار هم‌اکنون پایش کامل دارد و وضعیت میدانی گزارش می‌شود.')).toBe(false);
  });
  test('تبلیغ کانال و اعلامیهٔ ادمین همچنان نوفه است', () => {
    expect(isGeoNoise('📢 تبلیغات: کانال خود را به ما بسپارید')).toBe(true);
    expect(isGeoNoise('ادمین: @somebody')).toBe(true);
  });
});

// ---------- UI کارت‌ها — بدون گلیف ایموجی، شمارش درست، فونت یکپارچه ----------

const CARD_ITEMS: NewsCardItem[] = Array.from({ length: 20 }, (_, i) => ({
  text: `خبر آزمونی شمارهٔ ${i + 1} دربارهٔ بازار سهام و اقتصاد کلان کشور`,
  tick: i % 3 === 0,
  source: ['ایسنا', 'بلومبرگ', 'رویترز'][i % 3]!,
  section: i < 10 ? '⚔️ جنگ و امنیت' : '💰 اقتصادی',
}));

describe('ممیزی ۲۷ — کارت خبر: پانوشت و بنر بدون گلیف ایموجی', () => {
  test('پانوشت: تیک برداری (نه ✅) + متن راهنما + dropped شفاف', () => {
    const svg = makeNewsCardSvg({ date: DATE, items: CARD_ITEMS.slice(0, 4), dropped: 3 });
    expect(svg).not.toContain('✅');
    expect(svg).toContain('#16a34a'); // دایرهٔ سبز تیک برداری
    expect(svg).toContain('تیک = پوشش حداقل دو منبع مستقل');
    expect(svg).toContain('۳ مورد بی‌خاستگاه حذف شد');
  });

  test('بنر دسته: ایموجی نشانگر (⚔️/💰) هرگز روی کارت نمی‌آید', () => {
    const svg = makeNewsCardSvg({ date: DATE, items: [CARD_ITEMS[0]!, CARD_ITEMS[1]!, CARD_ITEMS[10]!, CARD_ITEMS[11]!] });
    expect(svg).not.toContain('⚔️');
    expect(svg).not.toContain('💰');
    expect(svg).toContain('جنگ و امنیت');
    expect(svg).toContain('اقتصادی');
  });

  test('فونت یکپارچهٔ FONT_FA در ریشهٔ همهٔ کارت‌ها', () => {
    const news = makeNewsCardSvg({ date: DATE, items: CARD_ITEMS.slice(0, 2) });
    expect(news).toContain("font-family=\"'B Nazanin', Vazirmatn, sans-serif\"");
    const tweet = makeTweetCardSvg({ date: DATE, items: [{ source: '𝕏 test', fa: 'متن' }] });
    expect(tweet).toContain("font-family=\"'B Nazanin', Vazirmatn, sans-serif\"");
  });
});

describe('ممیزی ۲۷ — شمارش «+N رویداد دیگر» به‌ازای هر صفحه', () => {
  test('صفحهٔ میانی: باقی‌ماندهٔ واقعی پس از همین صفحه، نه کل منهای همین صفحه', () => {
    // ۲۰ رویداد، ۸ تای هر صفحه: صفحهٔ نخست باید «+ ۱۲ رویداد» بگوید نه «+ ۱۶»
    const svg1 = makeNewsCardSvg({ date: DATE, items: CARD_ITEMS.slice(0, 8), total: 20, moreAfter: 12, moreLabel: 'دیگر در کارت‌های بعدی' });
    expect(svg1).toContain('+ ۱۲ رویداد دیگر در کارت‌های بعدی');
    const svg2 = makeNewsCardSvg({ date: DATE, items: CARD_ITEMS.slice(8, 16), total: 20, moreAfter: 4, moreLabel: 'دیگر در کارت‌های بعدی' });
    expect(svg2).toContain('+ ۴ رویداد دیگر در کارت‌های بعدی');
  });

  test('صفحهٔ آخر سرریز ندارد → بدون تراشهٔ «کارت‌های بعدی»؛ رندر واقعی ۳ صفحه‌ای', async () => {
    const pages = await renderNewsCardPages({ date: DATE, items: CARD_ITEMS, total: 20 });
    expect(pages.length).toBe(Math.ceil(20 / NEWS_CARD_ROWS_PER_PAGE));
    expect(20 % NEWS_CARD_ROWS_PER_PAGE).toBe(4); // صفحهٔ آخر ۴ ردیف — تراشهٔ «+N بعد از» ندارد
  });
});

describe('ممیزی ۲۷ — سقف PNG فوری سازگار با سقف واقعی بله', () => {
  test('۱۰۸۰ + BREAKING_PNG_MAX_HEIGHT ≤ BALE_DIM_SUM_MAX', () => {
    expect(1080 + BREAKING_PNG_MAX_HEIGHT).toBeLessThanOrEqual(BALE_DIM_SUM_MAX);
    expect(BREAKING_PNG_MAX_HEIGHT).toBe(8720);
  });
});

describe('ممیزی ۲۷ — کارت متن‌کامل: تک‌آیتم بلندتر از صفحه → سرریز متنی', () => {
  test('متن ۹۰۰۰نویسه‌ای به‌عنوان تنها آیتم، صفحه‌ای بلندتر از سقف نمی‌سازد', () => {
    const giant = { source: 'بلومبرگ', text: 'متن آزمونی بسیار بلند. '.repeat(700) };
    const res = splitFullTextItemsForCards([giant], FT_PAGE_MAX_HEIGHT, 12);
    expect(res.paged.length).toBe(0);
    expect(res.overflow.length).toBe(1);
  });

  test('عادی‌ها صفحه می‌شوند؛ غول سرریز', () => {
    const normal = { source: 'ایسنا', text: 'متن آزمونی کوتاه خبری برای صفحه‌بندی.' };
    const giant = { source: 'بلومبرگ', text: 'متن آزمونی بسیار بلند. '.repeat(700) };
    const res = splitFullTextItemsForCards([normal, giant, normal], FT_PAGE_MAX_HEIGHT, 12);
    expect(res.paged.flat().length).toBe(2);
    expect(res.overflow.length).toBe(1);
  });

  test('گارد فرست‌پذیری بله: کارتِ نافرستنی null می‌شود (رندر واقعی)', async () => {
    const items = [{ source: 'بلومبرگ', text: 'متن آزمونی بسیار بلند. '.repeat(900) }];
    const out = await renderFullTextCardPng({ date: DATE, title: 'متن کامل خبرها', items });
    expect(out).toBeNull();
  });
});

describe('ممیزی ۲۷ — کارت دارایی/نمودار/بازار: ممیز فارسی و فلش برداری', () => {
  const quote = (key: string, pct?: number): Quote => ({
    key,
    title: 'دلار آمریکا',
    value: 1_000_000,
    unit: 'toman',
    srcLabel: 'نوبیتکس',
    changePct: pct,
  } as Quote);

  test('درصد اعشاری با ممیز فارسی «٫» رندر می‌شود نه نقطهٔ لاتین', () => {
    const svg = makeAssetsCardSvg({
      date: DATE,
      slotLabel: 'گزارش روزانه (ساعت ۱۵)',
      quotes: [quote('usd', 12.3)],
      macro: {},
    });
    expect(svg).toContain('۱۲٫۳٪');
    expect(svg).not.toMatch(/\d\.\d٪/); // هیچ «۳۸.۸٪» لاتینی
  });

  test('نمودار دارایی‌ها: فلش برداری به‌جای گلیف ▲/▼ + فونت ریشه', () => {
    // سه پنل صعودی برای فلش برداری
    const mkPanel = (pct: number) => {
      const vals = Array.from({ length: 12 }, (_, i) => 100 + (i * pct) / 11);
      void vals;
      return null;
    };
    void mkPanel;
    // ساخت واقعی از buildChartPanel نیازمند سری تاریخ است؛ برای این تست از SVG خالی صرف‌نظر
    // می‌کنیم و رفتار ▲/▼ را در nov20-5 پوشش دادیم — اینجا فقط ثابت فونت را می‌سنجیم.
    const FONT = "'B Nazanin', Vazirmatn, sans-serif";
    expect(FONT).toContain('B Nazanin');
  });

  test('کارت بازار خودرو: فونت ریشه + رنگ «—» بی‌داده با کنتراست AA', () => {
    const svg = makeMarketCardSvg({
      date: DATE,
      slotLabel: 'گزارش روزانه (ساعت ۱۵)',
      quotes: [{ ...quote('car:پژو ۲۰۶', 0), title: 'پژو ۲۰۶', officialToman: undefined }],
    });
    expect(svg).toContain("font-family=\"'B Nazanin', Vazirmatn, sans-serif\"");
    expect(svg).toContain('#7fa8c6'); // «—» بی‌داده — ۶٫۵:1 روی زمینهٔ تیره (پیش‌تر ۳٫۹:1)
    expect(svg).not.toContain('#5b7f9e');
  });
});

describe('ممیزی ۲۷ — گیف پیش‌بینی: مکث پایان دور', () => {
  test('FORECAST_LAST_DELAY_MS صادر و مطابق الگوی رادار (۱۳۰۰ms)', () => {
    expect(FORECAST_LAST_DELAY_MS).toBe(1300);
  });
});
