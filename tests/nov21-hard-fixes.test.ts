/**
 * نقد سخت‌گیرانهٔ ۲۱ نوامبر ۲۰۲۶ — «همه ی مشکلات رو دقیق برطرف کن».
 * ممیزی پنج‌گانهٔ مستقل (ترجمه/زمان‌بندی/شبکه/تشخیص تکرار/فوری) ۳۸ یافته داد؛
 * این پروندهٔ آزمون اصلاحات کد-سطحِ آن نقد است. هر describe به یک یافته وصل است.
 */
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  isBreakingTweetText,
  normalizeArabicVariants,
} from '../bot/breaking';
import { cutAtSentence, isPureArabic } from '../bot/lang';
import { tokensFa, validateHourlyText, strongAnchors } from '../bot/hourly';
import { validateDigestText } from '../bot/digest';
import { validateGeoText } from '../bot/geo';
import {
  sniffImageMime,
  needsTranslation,
  composeNewsMessage,
  tokensOf,
  isSimilarToAny,
  saveState,
  loadState,
  isSlotKeyOfDate,
  saleSeenAfterSend,
  CYCLE_BUDGET_MS,
  type BotState,
} from '../bot/bot';
import {
  splitTweetItemsByLineCap,
  splitTweetItemsForCards,
  breakingPngTooTall,
  BREAKING_PNG_MAX_HEIGHT,
  TW_MAX_LINES,
  type TweetCardItem,
} from '../bot/news-card';
import { windowGeoPosts, GEO_SEEN_CAP, type GeoPost } from '../bot/geo';

// ────────────────────────────────────────────────────────────────────
// ۱) کلیدواژه‌های فوری — ۵ مثبت کاذب ریشه‌کن + ۲ منفی کاذب بسته شد
// ────────────────────────────────────────────────────────────────────
describe('نقد ۲۱ نوامبر — کلیدواژهٔ فوری: مثبت‌های کاذب (برندها/جنگل/کشورهای دیگر)', () => {
  test('«جنگل» دیگر فوری نیست (جنگِ درونِ جنگل) — جنگاورها می‌مانند', () => {
    expect(isBreakingTweetText('کاشت نهال در جنگل‌های شمال انجام شد')).toBe(false);
    expect(isBreakingTweetText('جنگل‌های هیرکانی در آتش سوخت')).toBe(false);
    expect(isBreakingTweetText('آتش‌سوزی گسترده در جنگل')).toBe(false);
    // جنگ‌واره‌های واقعی هنوز فوری‌اند — استثنا فقط «جنگل» است
    expect(isBreakingTweetText('جنگنده‌های دشمن رهگیری شدند')).toBe(true);
    expect(isBreakingTweetText('صنایع جنگ‌افزار رونق گرفت')).toBe(true);
  });
  test('برندهای «ایران‌…» دیگر فوری نیستند — هر سه رسم‌الخط', () => {
    expect(isBreakingTweetText('تولید جدید ایران‌خودرو آغاز شد')).toBe(false); // نیم‌فاصله
    expect(isBreakingTweetText('قیمت ایران خودرو اعلام شد')).toBe(false); // فاصله
    expect(isBreakingTweetText('افتتاح رسمی ایران‌مال')).toBe(false);
    expect(isBreakingTweetText('تور جدید ایران‌تور呈现')).toBe(false);
    expect(isBreakingTweetText('ایرانسل اینترنت را ارزان کرد')).toBe(false);
    expect(isBreakingTweetText('شارژ ایران‌سل')).toBe(false); // نیم‌فاصله
    // ایرانِ واقعی هرگز قربانی استثنا نمی‌شود
    expect(isBreakingTweetText('ایران سلطنت را نمی‌خواهد')).toBe(true);
    expect(isBreakingTweetText('رئیس‌جمهور ایران سخن گفت')).toBe(true);
    expect(isBreakingTweetText('ایرانی‌ها به خیابان آمدند')).toBe(true);
  });
  test('«جمهوری اسلامی» کشورهای دیگر دیگر فوری نیست — فارسی/عربی/انگلیسی', () => {
    expect(isBreakingTweetText('جمهوری اسلامی افغانستان بیانیه داد')).toBe(false);
    expect(isBreakingTweetText('جمهوری اسلامی پاکستان محکوم کرد')).toBe(false);
    expect(isBreakingTweetText('الجمهورية الإسلامية الأفغانية أعلنت')).toBe(false);
    expect(isBreakingTweetText('Islamic Republic of Pakistan rejects talks')).toBe(false);
    expect(isBreakingTweetText('the Islamic republic of Mauritania held elections')).toBe(false);
    // جمهوری اسلامیِ ایران می‌ماند
    expect(isBreakingTweetText('جمهوری اسلامی ایران پاسخ داد')).toBe(true);
    expect(isBreakingTweetText('Islamic Republic of Israel no; of Iran yes')).toBe(true);
  });
  test('منفی‌های کاذب بسته شد — تهران/IRGC/طهران/رسم‌الخط غیررسمی عربی', () => {
    expect(isBreakingTweetText('Missile barrage hits Tehran')).toBe(true);
    expect(isBreakingTweetText('IRGC launches drones')).toBe(true);
    expect(isBreakingTweetText('طهران تشهد تشدیدا')).toBe(true); // عربی
    expect(isBreakingTweetText('الجمهوريه الاسلاميه في ايران')).toBe(true); // ه پایانی غیررسمی
    expect(isBreakingTweetText('إيـــران دولة كبيرة')).toBe(true); // کشیده + اعراب
    expect(normalizeArabicVariants('مـحـافظ')).toBe('محافظ');
  });
  test('حرفِ مشخصات کاربر دست‌نخورده — «کلمه جنگ» شامل جنگ تجاری می‌ماند', () => {
    expect(isBreakingTweetText('جنگ تجاری ادامه دارد')).toBe(true);
    expect(isBreakingTweetText('Trade war with China is winnable')).toBe(true);
    expect(isBreakingTweetText('ایراد مجلس به بودجه ادامه دارد')).toBe(false); // ایراد ≠ ایران
  });
});

// ────────────────────────────────────────────────────────────────────
// ۲) ریشه‌کن «…» — برش مرز جمله در همهٔ اعتبارسنج‌ها و پیام خبر
// ────────────────────────────────────────────────────────────────────
describe('نقد ۲۱ نوامبر — برش مرز جمله (cutAtSentence) به‌جای «…» میان‌جمله', () => {
  test('متن کوتاه عیناً برمی‌گردد', () => {
    expect(cutAtSentence('سلام. این تست است.', 100)).toBe('سلام. این تست است.');
  });
  test('متن بلند در آخرین پایانِ جملهٔ درون سقف می‌ایستد — بدون هیچ «…»', () => {
    const t = 'جملهٔ اول اینجا تمام می‌شود. جملهٔ دوم هم همین‌طور تمام شد. جملهٔ سوم بسیار طولانی است و ادامه دارد.';
    const out = cutAtSentence(t, 50);
    expect(out.endsWith('…')).toBe(false);
    expect(/[.!؟…]$/.test(out)).toBe(true);
    expect(out.length).toBeLessThanOrEqual(50);
  });
  test('متن بدون هیچ مرز جمله → مرز واژه + «…» (سپر آخر)', () => {
    const out = cutAtSentence('یکدوچارپنجششششنهشتده', 8);
    expect(out.endsWith('…')).toBe(true);
  });
  test('اعتبارسنج ساعتی: متن ۱۲هزارنویسه‌ای با جمله‌های کامل پایان می‌یابد نه «\\n…»', () => {
    const sentences: string[] = [];
    for (let i = 0; i < 200; i++) sentences.push(`گزارش شمارهٔ ${i} از جبههٔ اقتصادی امروز صادر شد.`);
    const long = sentences.join(' ');
    const v = validateHourlyText(long, 9000);
    expect(v).not.toBeNull();
    expect(v!.endsWith('…')).toBe(false);
    expect(v!.endsWith('.')).toBe(true);
    expect(v!.length).toBeLessThanOrEqual(9000);
  });
  test('اعتبارسنج ژئو و دیجست هم مرز جمله می‌گیرند', () => {
    const sentences: string[] = [];
    for (let i = 0; i < 150; i++) sentences.push(`رویداد مهم ${i} در منطقهٔ غرب آسیا رخ داد.`);
    const long = sentences.join(' ');
    for (const [v, name] of [[validateGeoText(long, 5200), 'geo'], [validateDigestText(long, 3400), 'digest']] as const) {
      expect(v).not.toBeNull();
      expect(v!.endsWith('…')).toBe(false);
      expect(v!.length).toBeLessThanOrEqual(name === 'geo' ? 5200 : 3400);
    }
  });
  test('شکاف دیجست — عربی خالص اکنون رد می‌شود (مثل سه اعتبارسنج دیگر)', () => {
    const ar = 'قالت الجمهورية العربية إن القمة العربية أكدت على أهمية التنسيق العربي المشترك في جميع المجالات الاقتصادية والسياسية والعسكرية.'; // ة/ي عربی — isPureArabic
    expect(isPureArabic(ar)).toBe(true);
    expect(validateDigestText(ar, 3400)).toBeNull();
  });
  test('پیام خبری (composeNewsMessage) دیگر میان‌واژه نمی‌بُرد', () => {
    const body: string[] = [];
    for (let i = 0; i < 120; i++) body.push(`بخش ${i} از گزارش مفصل همین امروز منتشر شد.`);
    const msg = composeNewsMessage({ sourceName: 'خبرگزاری تست', text: body.join(' ') }, 3400);
    const textPart = msg.split('\n')[0]!;
    expect(textPart.includes('…')).toBe(false); // جمله‌های کامل بودند — بریدگی نقطه‌ای لازم نشد
    expect(/[.]$/.test(textPart.trim())).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// ۳) سپر سرریز کارت توییت — پایان حذفِ بی‌صدا و «…» ترجمه‌های بلند
// ────────────────────────────────────────────────────────────────────
const twItem = (fa: string): TweetCardItem => ({ source: '𝕏 Test', fa, faName: 'تستی', verified: false });

describe('نقد ۲۱ نوامبر — سپر سرریز کارت توییت', () => {
  test('ترجمهٔ بلندتر از سقف ۳۲ خط به پیام متنی جداگانه می‌رود نه «…» کارت', () => {
    const long = Array.from({ length: 80 }, (_, i) => `بخش ${i + 1} از توییت بلند تروث‌سوشال ترامپ دربارهٔ سیاست‌های اقتصادی و تعرفه‌های جدید واردات.`).join(' ');
    const { card, overflow } = splitTweetItemsByLineCap([twItem('کوتاه'), twItem(long)]);
    expect(card.length).toBe(1);
    expect(overflow.length).toBe(1);
    expect(overflow[0]!.fa).toBe(long); // متن کامل — هرگز بریده
    expect(long.length).toBeGreaterThan(TW_MAX_LINES * 60); // واقعاً بلندتر از ظرفیت است
  });
  test('مازاد بیش از سقف صفحات در overflow برمی‌گردد نه حذف بی‌صدا', () => {
    // ردیف‌های بلند (~۱۴ خط ≈ ۷۰۴px) → ۲ ردیف در هر صفحهٔ ۲۱۰۰px (خواستهٔ ۲۵ نوامبر:
    // سقف ارتفاع ۶۴۰۰→۲۱۰۰ — «تعداد توییتهای هر عکس کمتر، تعداد عکس بیشتر»)؛ سقف صفحات ۱۰
    const heavy = Array.from({ length: 14 }, (_, j) => `سطر ${j} از توییت بلند مقام دربارهٔ تحولات منطقه‌ای و اقتصادی روز است و ادامه دارد.`).join(' ');
    const many = Array.from({ length: 60 }, (_, i) => twItem(`توییت ${i}: ${heavy}`));
    const { paged, overflow } = splitTweetItemsForCards(many);
    expect(paged.length).toBe(10); // سقف صفحات رعایت شد
    expect(overflow.length).toBeGreaterThan(0); // مازاد حذف نشد — به فراخواننده برگشت
    expect(paged.length + Math.ceil(overflow.length / 12)).toBeGreaterThanOrEqual(11); // همه جایی دارند
    // هیچ آیتمی هم در صفحات و هم در سرریز نیست
    const inPages = paged.flat();
    for (const o of overflow) expect(inPages.includes(o)).toBe(false);
  });
  test('صفحه‌بندی سازگار (paginateTweetItems) همان صفحات را می‌دهد', () => {
    const { paged } = splitTweetItemsForCards([twItem('یک'), twItem('دو'), twItem('سه')]);
    expect(paged.length).toBe(1);
    expect(paged[0]!.length).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────
// ۴) سقف ارتفاع PNG فوری — کارت بلندتر از حد بله پیش از آپلود رد می‌شود
// ────────────────────────────────────────────────────────────────────
describe('نقد ۲۱ نوامبر — سقف ارتفاع PNG کارت فوری (عرض+ارتفاع ≤ ~۱۰هزار)', () => {
  test('کارت فوری بلندتر از سقف شناسایی می‌شود — متن کامل از مسیر گیف/متن می‌رود', () => {
    const long = Array.from({ length: 400 }, () => 'جملهٔ کامل و بلند برای سنجش ارتفاع کارت فوری رصدبان در آزمون نقد سخت‌گیرانه.') .join(' ');
    expect(breakingPngTooTall(long, true)).toBe(true);
    expect(breakingPngTooTall('خبر فوری کوتاه', true)).toBe(false);
    expect(BREAKING_PNG_MAX_HEIGHT).toBeLessThan(10000 - 1080); // حاشیهٔ سقف خانوادهٔ تلگرام
  });
});

// ────────────────────────────────────────────────────────────────────
// ۵) ذخیرهٔ اتمیک state + بازیابی پشتیبان — پایان ریستِ بی‌صدای ضدتکرار
// ────────────────────────────────────────────────────────────────────
describe('نقد ۲۱ نوامبر — saveState اتمیک و loadState با بازیابی پشتیبان', () => {
  const dir = join(import.meta.dir, '.tmp-state-test');
  const path = join(dir, 'state.json');
  beforeAll(() => { mkdirSync(dir, { recursive: true }); });
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

  test('saveState: نوشتن اتمیک + پشتیبان غلتان .bak + بدون فایل .tmp باقی‌مانده', () => {
    const st: BotState = { sentIds: { 'x1': 1, 'x2': 2 }, sentTitles: {}, sentTitleTexts: {}, sentMsgTexts: {}, tweetCursor: 7 };
    saveState(path, st);
    expect(existsSync(path)).toBe(true);
    expect(existsSync(`${path}.bak`)).toBe(true);
    expect(existsSync(`${path}.tmp`)).toBe(false); // موقت پس از rename نمی‌ماند
    expect(JSON.parse(readFileSync(path, 'utf8')).sentIds.x1).toBe(1);
  });
  test('loadState: state نیم‌کاره (کشته‌شده در میانهٔ نوشتن) از .bak بازیابی می‌شود نه ریست بی‌صدا', () => {
    saveState(path, { sentIds: { 'keep-me': 12345 }, sentTitles: {}, sentTitleTexts: {}, sentMsgTexts: {} } as BotState);
    writeFileSync(path, '{"sentIds": {"broken": tru', 'utf8'); // شبیه‌سازی نوشتن ناتمام
    const loaded = loadState(path);
    expect(loaded.sentIds['keep-me']).toBe(12345); // از پشتیبان برگشت
    expect(loaded.sentIds.broken).toBeUndefined();
  });
  test('loadState: نبود هر دو → emptyState صادقانه', () => {
    const empty = loadState(join(dir, 'nonexistent.json'));
    expect(empty.sentIds).toEqual({});
  });
});

// ────────────────────────────────────────────────────────────────────
// ۶) شبکه — ردیابی magic bytes و پیش‌بررسی حجم
// ────────────────────────────────────────────────────────────────────
describe('نقد ۲۱ نوامبر — sniffImageMime: پاسخِ HTML-به‌جای-عکس رد می‌شود', () => {
  test('امضاهای واقعی PNG/JPEG/GIF/WEBP شناسایی می‌شوند', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    expect(sniffImageMime(png)).toBe('image/png');
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    expect(sniffImageMime(jpg)).toBe('image/jpeg');
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 2]);
    expect(sniffImageMime(gif)).toBe('image/gif');
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImageMime(webp)).toBe('image/webp');
  });
  test('صفحهٔ خطای HTML با Content-Type جعلی رد می‌شود', () => {
    const html = new TextEncoder().encode('<html><body><h1>404 Not Found</h1></body></html>');
    expect(sniffImageMime(html)).toBeNull();
    expect(sniffImageMime(new Uint8Array(64))).toBeNull(); // بایت‌های بی‌معنا
  });
});

// ────────────────────────────────────────────────────────────────────
// ۷) دروازهٔ زبان — هشتگ/منشن دیگر ترجمهٔ درست را پس نمی‌زنند
// ────────────────────────────────────────────────────────────────────
describe('نقد ۲۱ نوامبر — needsTranslation: هشتگ/منشن/لینک از سنجش سهم لاتین کنار', () => {
  test('ترجمهٔ فارسیِ درست با هشتگ‌های لاتین می‌گذرد (قبلاً پس زده می‌شد)', () => {
    const fa = 'ترامپ در گردهمایی انتخاباتی گفت سیاست‌های اقتصادی جدید را ادامه می‌دهد #MAGA @POTUS https://example.com/x';
    expect(needsTranslation(fa)).toBe(false);
  });
  test('متن واقعاً انگلیسی هنوز ترجمه می‌خواهد — با و بدون هشتگ', () => {
    expect(needsTranslation('Trump said the trade war with China is winnable and will continue next year too')).toBe(true);
    expect(needsTranslation('#MAGA #KAG2026 @POTUS winning winning winning')).toBe(true); // فقط هشتگ لاتین → خارجی
  });
});

// ────────────────────────────────────────────────────────────────────
// ۸) زمان‌بندی — گارد هم‌روز و علامت فروش پس از ارسال
// ────────────────────────────────────────────────────────────────────
describe('نقد ۲۱ نوامبر — زمان‌بندی', () => {
  test('گارد هم‌روز: تغییر ساعتِ تنظیمات دیگر پیام دوباره نمی‌فرستد', () => {
    // نمونهٔ واقعی state: 2026-11-20T05:00 و 05:45 هر دو «sent» شده بودند
    expect(isSlotKeyOfDate('2026-11-20T05:00', '2026-11-20')).toBe(true); // همان روز → رد
    expect(isSlotKeyOfDate('2026-11-20T05:45', '2026-11-20')).toBe(true);
    expect(isSlotKeyOfDate('2026-11-19T05:00', '2026-11-20')).toBe(false); // دیروز → مجاز
    expect(isSlotKeyOfDate(undefined, '2026-11-20')).toBe(false);
  });
  test('اطلاعیهٔ فروش: فقط ارسال‌شده علامت می‌خورد — شکست بله دیگر «خاموشی همیشگی» نیست', () => {
    const parsed = {
      fresh: [{ dataPost: 'ch/1' }, { dataPost: 'ch/2' }, { dataPost: 'ch/3' }],
      seen: { 'ch/1': 1, 'ch/2': 1, 'ch/3': 1, 'ch/old': 999 }, // همهٔ fresh در seenِ parse نشسته‌اند
    };
    // فقط ch/1 ارسال شد (شکست بله برای ch/2؛ ch/3 سقف چرخه)
    const out = saleSeenAfterSend(parsed, ['ch/1'], 5000);
    expect(out['ch/1']).toBe(5000); // ارسال‌شده → علامت
    expect(out['ch/2']).toBeUndefined(); // شکست‌خورده → چرخهٔ بعد دوباره
    expect(out['ch/3']).toBeUndefined(); // سقف چرخه → چرخهٔ بعد
    expect(out['ch/old']).toBe(999); // غیرتازه دست‌نخورده
  });
  test('مهلت چرخه export شده و در بازهٔ بودجهٔ ۳۰ دقیقه‌ای رانر است', () => {
    expect(CYCLE_BUDGET_MS).toBeLessThanOrEqual(25 * 60_000);
  });
});

// ────────────────────────────────────────────────────────────────────
// ۹) تشخیص تکرار بین‌رسم‌الخطی — ك/ؤ/ئ عربی و ارقام یکدست
// ────────────────────────────────────────────────────────────────────
describe('نقد ۲۱ نوامبر — tokensFa بین‌رسم‌الخطی', () => {
  test('ك عربی و ک فارسی یک توکن‌اند — تکرار منبع عربی‌نویس شناسایی می‌شود', () => {
    const fa = tokensFa('وزیر الخارجية الكويتي يزور طهران');
    expect(fa.has('الکویتی')).toBe(true); // ك→ک + ي→ی
    expect(fa.has('الخارجیه')).toBe(true); // ة→ه + ي→ی — پیش‌تر «الخارجية» توکنی جدا و بی‌همریخت بود
  });
  test('لنگر عددی بین رسم‌الخط‌ها یکی شد — ۱۲٬۵۰۰ == 12500 لنگر مشترک', () => {
    const a = strongAnchors(tokensFa('دلار به ۱۲٬۵۰۰ تومان رسید'));
    const b = tokensFa('dollar at 12500 toman');
    expect(a.has('12500')).toBe(true);
    expect(b.has('12500')).toBe(true); // پل انکریِ عدد مشترک بین دو منبع
  });
});

// ────────────────────────────────────────────────────────────────────
// ۱۰) geoSeenIds — سقف مستند ۴۰۰۰ سرانجام پیاده شد
// ────────────────────────────────────────────────────────────────────
describe('نقد ۲۱ نوامبر — سقف ۴۰۰۰ دفتر geoSeenIds (کامنت قبلاً ادعا می‌کرد)', () => {
  test('دفتر بزرگ‌تر از سقف به تازه‌ترین‌های ۴۰۰۰تایی هرس می‌شود', () => {
    const now = Date.now();
    const seen: Record<string, number> = {};
    for (let i = 0; i < 4100; i++) seen[`k${i}`] = now - i * 1000; // k0 تازه‌ترین
    const posts: GeoPost[] = [{ id: 'eitaa:new1', channel: 'ch', channelName: 'کانال', platform: 'eitaa', text: 'متن', at: new Date(now - 60_000).toISOString() }];
    const out = windowGeoPosts(posts, now - 8 * 3600_000, seen, now, 180);
    expect(Object.keys(out.seen).length).toBeLessThanOrEqual(GEO_SEEN_CAP + 180);
    expect(out.seen['k0']).toBeDefined(); // تازه‌ترین ماند
    expect(out.seen['k4099']).toBeUndefined(); // کهنه‌ترین حذف
    expect(out.picked.length).toBe(1);
    expect(GEO_SEEN_CAP).toBe(4000);
  });
});

// ────────────────────────────────────────────────────────────────────
// ۱۱) پژواک هم‌چرخه‌ای فوری — زیرساخت شباهت (ترامپ ایکس+تروث در یک چرخه)
// ────────────────────────────────────────────────────────────────────
describe('نقد ۲۱ نوامبر — پژواک هم‌چرخه‌ای فوری (زیرساخت سنجش)', () => {
  test('هم‌متنِ ارسال‌شدهٔ همین چرخه با آستانهٔ ۰٫۵۵ دوباره نمی‌رود', () => {
    // حلقهٔ فوری حالا از همان isSimilarToAny/tokensOf استفاده می‌کند — سنجش رفتار پایه
    const fa = 'ترامپ: هیچ معامله‌ای با ایران نخواهیم کرد؛ تحریم‌ها کامل می‌ماند.';
    const echo = `RT @realDonaldTrump: ${fa}`;
    expect(isSimilarToAny(fa, [tokensOf(echo)], 0.55)).toBe(true); // پژواک شناسایی می‌شود
    const other = 'وزیر بهداشت از برنامهٔ بیمهٔ جدید در مجلس خبر داد.';
    expect(isSimilarToAny(other, [tokensOf(fa)], 0.55)).toBe(false); // خبر متفاوت رد نمی‌شود
  });
});
