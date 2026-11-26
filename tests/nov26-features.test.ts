/**
 * تست‌های خواستهٔ ۲۶ نوامبر ۲۰۲۶ — موتور ورودی، حقیقت‌سنجی و تجمیع/تحلیل خبر:
 *  ۱) «اولاً به هیچ عنوان پیام‌های تبلیغاتی کانال‌ها یا خبرگزاری‌ها وارد برنامه نشن» —
 *     ضدتبلیغ (isAdOrPromo): نمونهٔ واقعیِ کاربر (درخواست کمک با کارت ۱۶رقمی + شبا +
 *     تلفن + @دستگیره) رد؛ خبرهای واقعی (ایسنا/ایلنا/مهر/DW) ماند.
 *  ۲) «دوماً تمامی اخبار در قالب تصویری بشن» — آبشار تصویری: آستانهٔ کارت ۳→۱ و
 *     پشتیبانِ کارت خبر = کارت بنفش «متن کامل» (نقش آبشار در bot.ts؛ هندسه در تست‌های
 *     nov25) — اینجا قواعد ورودی آبشار سنجیده می‌شود (تک‌مورد هم کارت می‌شود).
 *  ۳) «سوماً موتور حقیقت‌سنجی: اگر زده فلانی توییت زد اصلاً واردش نکن» —
 *     isTweetRelayNews؛ «به نقل از بلومبرگ … اگر درست بود همون خبر از خبرگزاری اصلی
 *     بفرسته» — attributionOf + تأیید وب (جاکارد عنوان نتیجه/متن)؛ «صحت انطباق با
 *     واقعه تاریخی» — historyConsistencyOf.
 *  ۴) «حجم اخبار خیلی زیاده؛ اخبار بی‌اهمیت منتشر نشن» — importanceScore/
 *     filterByImportance: اعتکاف استانی/امام‌جمعه محلّی افتند؛ نفتکش دبی و ایران-
 *     اقتصاد می‌مانند؛ جنگ/ایران (≥۹۵) هرگز حذف نمی‌شوند؛ سهمیهٔ حداقل روز بی‌خبر.
 *  ۵) پالایهٔ یکپارچه (filterNewsIntake) — تفکیک چهار دستهٔ رد + حکم یکپارچه
 *     (intakeVerdict) روی نمونه‌های واقعی کاربر.
 *  ۶) تنظیمات ورک‌فلو — NEWS_BUNDLE_MAX_ITEMS=16 و متغیرهای موتور ورودی در yml.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  isAdOrPromo,
  isTweetRelayNews,
  importanceScore,
  filterByImportance,
  attributionOf,
  attributionMatch,
  historyConsistencyOf,
  intakeVerdict,
  filterNewsIntake,
  joinDigitRuns,
} from '../bot/news-intake';

// ────────────────────────────────────────────────────────────────────
// نمونه‌های واقعی کاربر (پیام ۲۶ نوامبر ۲۰۲۶) — سند مبنا
// ────────────────────────────────────────────────────────────────────

/** نمونهٔ ۱ — خبر واقعی ایسنا: باید سالم بماند */
const ISNA_HOSPITAL = 'خبرگزاری ایسنا: گلایه کارکنان بیمارستان رحیمیان از کمبود تجهیزات و فضای اداری کارکنان بیمارستان رحیمیان ضمن ابراز نگرانی از وضعیت موجود در این مرکز درمانی، نسبت به کمبود فضا در بخش‌های اداری و درمانگاه هشدار دادند.';

/** نمونهٔ ۲ — تبلیغ واقعیِ نشت‌کرده به کانال (پیام درخواست کمک با کارت/شبا/تلفن) */
const DONATION_AD = `🚨 #فوری کار میدان #مردمی زمین مونده
✋عزیزان و هموطنان انقلابی به کمک شما نیاز دارد 🎥تصویر بالا ماشین لیدری انقلاب است که بعد ۸ ماه حضور #سیستم_صوتش بخاطر فشار و نیاز به تعمیر و تجهیز داره
در حد توان یاعلی بگید از یک تا چند سهم، الان از دستگاه ضعیف امانتی استفاده میکنیم که جوابگو نیست
منتظر کمک های شما هستیم
کلیک کنید رو کارت کپی میشه🔻
کارت🔺شبا🔻 حقوقی 🔻رسمی
 ▪️ 5892 1070 5017 5168
▪️ IR40 0150 0000 0310 1104 4721 13
فقط #۵۰۰ نفر زن و مرد یاعلی بگید نفری به نیت امام زمان عج #۳۱۳هزار تومان نیت کنید
ارتباط با خادم و اعلام سهم🔻
@mokeb_2
📞 09010252299`;

/** نمونهٔ ۳ — خبر کم‌اهمیت (از نمونه‌های واقعی کاربر): ثبت‌نام اعتکاف استانی */
const ETEKAF = 'خبرآنلاین: آغاز ثبت‌نام اعتکاف ۱۴۰۵ در فارس از ۷ آذرماه دبیر ستاد مردمی اعتکاف استان فارس، از آغاز ثبت‌نام مراسم اعتکاف سال ۱۴۰۵ در استان فارس از هفتم آذرماه خبر داد و گفت: اعتکاف امسال با شعار «اعتکاف؛ راهبرد امام شهید» و با برنامه‌های فرهنگی در مساجد استان برگزار می‌شود.';

/** نمونهٔ ۴ — خبر مهم (از نمونه‌های واقعی کاربر): انفجار نفتکش غرب دبی */
const TANKER = 'خبرگزاری مهر: سازمان دریانوردی انگلیس: انفجار پرتابه ناشناس در یک نفتکش در غرب دبی سازمان دریانوردی انگلیس از وقوع انفجاری ناشی از یک پرتابه ناشناس در یک نفتکش، در فاصله ۵۰ مایل دریایی غرب دبی خبر داد.';

/** نمونهٔ ۵ — خبر ایران‌دار (از نمونه‌های واقعی کاربر): بسنت/نفت‌کش */
const BESSENT = 'DW Persian: وزیر خزانه‌داری آمریکا: کشتی جمهوری اسلامی در حال غرق شدن است اسکات بسنت، وزیر خزانه‌داری آمریکا در پیامی اعلام کرد که ایران از زمان آغاز عملیات "طرد اقتصادی" دولت آمریکا در ماه اوت، حتی یک نفتکش را هم بارگیری نکرده و دیگر حتی یک قطره نفت هم روی آب برای فروش ندارد. به نقل از بلومبرگ، این اظهارات در جلسه گفت‌وگو با سرمایه‌گذاران مطرح شد.';

// ────────────────────────────────────────────────────────────────────
// ۱) ضدتبلیغ — «به هیچ عنوان پیام‌های تبلیغاتی وارد برنامه نشن»
// ────────────────────────────────────────────────────────────────────

describe('isAdOrPromo — گیت ضدتبلیغ (خواستهٔ ۲۶ نوامبر اول)', () => {
  test('نمونهٔ واقعی کاربر (کارت+شبا+تلفن+دستگیره+نیت) رد می‌شود', () => {
    const v = isAdOrPromo(DONATION_AD);
    expect(v.ad).toBe(true);
  });

  test('شماره کارت ۱۶رقمیِ گروه‌بندی‌شده و ارقام فارسی', () => {
    expect(isAdOrPromo('کارت به نام گروه جهادی: ۵۸۹۲ ۱۰۷۰ ۵۰۱۷ ۵۱۶۸').ad).toBe(true);
    expect(isAdOrPromo('لطفا به شماره کارت 6219861012345678 واریز کنید').ad).toBe(true);
  });

  test('شماره شبا IR+۲۴رقم', () => {
    expect(isAdOrPromo('شبای صندوق: IR400150000003101104472113').ad).toBe(true);
  });

  test('دو سیگنال نرم (واریز + تلفن همراه) = تبلیغ', () => {
    expect(isAdOrPromo('برای مشارکت واریز کنید و تماس بگیرید ۰۹۱۲۳۴۵۶۷۸۹').ad).toBe(true);
  });

  test('خبرهای واقعی کاربر تبلیغ نیستند (منفی کاذب ممنوع)', () => {
    expect(isAdOrPromo(ISNA_HOSPITAL).ad).toBe(false);
    expect(isAdOrPromo(TANKER).ad).toBe(false);
    expect(isAdOrPromo(BESSENT).ad).toBe(false);
    expect(isAdOrPromo(ETEKAF).ad).toBe(false);
  });

  test('«سهم» در خبر واقعی اقتصاد سیگنال تبلیغ نیست', () => {
    expect(isAdOrPromo('سهم ایران از تولید نفت اوپک در گفت‌وگوهای جدید بررسی شد و دلار بالا رفت').ad).toBe(false);
  });

  test('joinDigitRuns — چسباندن رقم‌های گروه‌بندی‌شده', () => {
    expect(joinDigitRuns('۵۸۹۲ ۱۰۷۰ ۵۰۱۷ ۵۱۶۸')).toBe('5892107050175168');
    expect(joinDigitRuns('1234-5678-9012-3456')).toBe('1234567890123456');
  });
});

// ────────────────────────────────────────────────────────────────────
// ۲) توییت‌نما — «اگر زده فلانی توییت زد اصلاً واردش نکن»
// ────────────────────────────────────────────────────────────────────

describe('isTweetRelayNews — گیت بازنشر توییت (خواستهٔ ۲۶ نوامبر سوماً)', () => {
  test('روایت کوتاهِ صرفِ توییت رد می‌شود (بخش توییت خودمان هست)', () => {
    expect(isTweetRelayNews('ترامپ در توییتر نوشت: ایران هرگز به بمب هسته‌ای دست نخواهد یافت.')).toBe(true);
    expect(isTweetRelayNews('بنیامین نتانیاهو در شبکه اجتماعی ایکس اعلام کرد: عملیات نظامی ادامه دارد.')).toBe(true);
    expect(isTweetRelayNews('ترامپ در تروث سوشال منتشر کرد: ما برنده شدیم.')).toBe(true);
  });

  test('گزارش بلندِ تحلیلی دربارهٔ توییت می‌ماند (پوشش خبری واقعی)', () => {
    const longJournalism = 'ترامپ در توییتر نوشت که تحریم‌های تازه اعمال می‌شود. ' + 'کارشناسان می‌گویند این اظهارات در پی مذاکرات دیروزمقام مقام‌های ارشد وزارت خارجه آمریکا دربارهٔ پروندهٔ هسته‌ای و پیامدهای اقتصادی آن برای بازار نفت شکل گرفته و واکنش سردبیران رسانه‌های بین‌المللی را در پی داشته است. '.repeat(3);
    expect(isTweetRelayNews(longJournalism)).toBe(false);
  });

  test('خبرهای واقعی کاربر توییت‌نما نیستند', () => {
    expect(isTweetRelayNews(ISNA_HOSPITAL)).toBe(false);
    expect(isTweetRelayNews(TANKER)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// ۳) حقیقت‌سنجی تاریخی — «صحت انطباق با واقعه تاریخی»
// ────────────────────────────────────────────────────────────────────

describe('historyConsistencyOf — انطباق سالِ رویداد تاریخی', () => {
  test('سال سازگار می‌ماند (شمسی و میلادی)', () => {
    expect(historyConsistencyOf('انقلاب اسلامی در سال ۱۳۵۷ به پیروزی رسید.').ok).toBe(true);
    expect(historyConsistencyOf('جنگ جهانی دوم (۱۹۳۹-۱۹۴۵) میلیون‌ها قربانی گرفت.').ok).toBe(true);
    expect(historyConsistencyOf('برجام در سال ۲۰۱۵ منعقد شد.').ok).toBe(true);
  });

  test('سال ناسازگار در همان جمله رد می‌شود', () => {
    expect(historyConsistencyOf('جنگ جهانی دوم در سال ۲۰۰۳ آغاز شد و جهان را تغییر داد.').ok).toBe(false);
    expect(historyConsistencyOf('برجام در سال ۱۳۹۲ به امضا رسید.').ok).toBe(false);
    expect(historyConsistencyOf('فروپاشی شوروی در سال ۱۹۷۹ رخ داد.').ok).toBe(false);
  });

  test('سالِ جملهٔ دیگر ماجرایی ندارد (بدون مثبت کاذب)', () => {
    expect(historyConsistencyOf('جنگ جهانی دوم پایان یافت. امروز در سال ۲۰۲۶ جهان دگرگون شده است.').ok).toBe(true);
  });

  test('سال غیرممکن رد می‌شود', () => {
    expect(historyConsistencyOf('این برنامه تا سال ۱۶۰۰ شمسی اجرا می‌شود.').ok).toBe(false);
    expect(historyConsistencyOf('گزارش سال ۱۶۵۰ منتشر شد.').ok).toBe(false);
  });

  test('خبرهای واقعی کاربر سالم‌اند', () => {
    expect(historyConsistencyOf(TANKER).ok).toBe(true);
    expect(historyConsistencyOf(BESSENT).ok).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// ۴) ارجاع‌یابی + تأیید وب — «به نقل از بلومبرگ … از خبرگزاری اصلی»
// ────────────────────────────────────────────────────────────────────

describe('attributionOf — استخراج ارجاع به رسانهٔ مرجع', () => {
  test('«به نقل از بلومبرگ» شناسایی می‌شود', () => {
    const a = attributionOf(BESSENT);
    expect(a?.outlet).toBe('بلومبرگ');
    expect(a?.outletEn).toBe('Bloomberg');
  });

  test('سایر رسانه‌های مرجع', () => {
    expect(attributionOf('به گزارش رویترز، قیمت نفت رشد کرد.')?.outletEn).toBe('Reuters');
    expect(attributionOf('به گفتهٔ الجزیره، آتش‌بس برقرار شد.')?.outletEn).toBe('Al Jazeera');
    expect(attributionOf('به نقل از روزنامهٔ واشنگتن‌پست، مذاکره انجام شد.')?.outlet).toBe('واشنگتن‌پست');
  });

  test('خبر بی‌ارجاع و ارجاع به رسانهٔ نامرجع', () => {
    expect(attributionOf(ISNA_HOSPITAL)).toBeNull();
    expect(attributionOf('به نقل از منبع آگاه، مذاکرات انجام شد.')).toBeNull();
  });
});

describe('attributionMatch — تطبیق چندسیگنالی نتیجهٔ وب با متن خبر', () => {
  test('عدد مشترک ≥۳رقمی — سنگین‌ترین سیگنال، حتی بین دو زبان (ممیزی ۲۷ نوامبر)', () => {
    expect(attributionMatch('Oil surges after OPEC cuts 120 thousand barrels', 'به نقل از بلومبرگ، قیمت نفت بعد از کاهش ۱۲۰ هزار بشکری اوپک رشد کرد')).toBe(true);
    // عدد ۲رقمی به‌تنهایی دیگر تأیید نیست — «۱۲» مشترک با خبر بی‌ربط پیش‌تر تأیید می‌شد
    expect(attributionMatch('Oil surges 12 percent after OPEC meeting in Vienna', 'به نقل از بلومبرگ، قیمت نفت ۱۲ درصد بعد از نشست اوپک در وین رشد کرد و تحلیل‌های متفاوتی از پیامدهای آن برای بازارهای جهانی و اقتصاد کشورهای تولیدکننده منتشر شد')).toBe(false);
  });

  test('دو نام لاتین مشترک (Bessent + Iran)', () => {
    expect(attributionMatch('Bessent says Iran has no oil on the water', 'Bloomberg: Bessent گفت ایران دیگر نفت ندارد — تحریم Iran')).toBe(true);
  });

  test('پیکرهٔ هم‌زبان (فارسی-فارسی) با ژاکارد (ممیزی ۲۷ نوامبر: بالا ≥۰٫۳۵ تنها کافی؛ متوسط با سیگنال دوم)', () => {
    // نزدیک‌هم‌متنی (ژاکارد ~۰٫۳۷ = همان داستان) — تأیید
    expect(attributionMatch('بسنت: ایران دیگر نفت روی آب ندارد', 'وزیر خارجه آمریکا بسنت گفت ایران دیگر هیچ نفت روی آب برای فروش ندارد و نفتکش بارگیری نکرده است')).toBe(true);
    // ژاکاردِ واژه‌های عمومیِ پایین (۰٫۱۸ — پیش‌تر تأیید می‌شد) با سیگنال دوم — رد
    expect(attributionMatch('وزیر آمریکا دربارهٔ ایران گفتگو کرد', TANKER)).toBe(false);
  });

  test('نتیجهٔ بی‌ربط تطبیق نمی‌شود', () => {
    expect(attributionMatch('نتایج فوتبال لیگ برتر و بازی‌های یکشنبه', TANKER)).toBe(false);
    expect(attributionMatch('دانلود اپلیکیشن جدید بانک', ETEKAF)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// ۵) اهمیت‌سنجی — «اخبار بی‌اهمیت منتشر نشن» + سهمیهٔ حداقل
// ────────────────────────────────────────────────────────────────────

describe('importanceScore — امتیاز قطعی اهمیت', () => {
  test('جنگ/ایران همیشه ≥۹۵ (هرگز حذف نمی‌شوند)', () => {
    expect(importanceScore('حمله موشکی به پایگاه آمریکا در منطقه انجام شد')).toBeGreaterThanOrEqual(95);
    expect(importanceScore('تحریم‌های جدید آمریکا علیه ایران نفت را گرفت')).toBeGreaterThanOrEqual(95);
    expect(importanceScore('سپاه توان ضربه به رادارهای آمریکا را دارد')).toBeGreaterThanOrEqual(95);
  });

  test('خبرهای مهم نمونه‌های کاربر بالای آستانه', () => {
    expect(importanceScore(TANKER)).toBeGreaterThanOrEqual(55);
    expect(importanceScore(BESSENT)).toBeGreaterThanOrEqual(55);
  });

  test('خبرهای پرکر استانی زیر آستانه', () => {
    expect(importanceScore(ETEKAF)).toBeLessThan(55);
    expect(importanceScore('امام‌جمعه بیرجند: احیای اراده و خودباوری ملت‌ها از مهم‌ترین دستاوردهای انقلاب اسلامی است')).toBeLessThan(55);
  });
});

describe('filterByImportance — سقف حجم + سهمیهٔ حداقل + ممتاز جنگ/ایران', () => {
  test('کم‌اهمیت‌ها حذف می‌شوند', () => {
    const r = filterByImportance([{ text: TANKER }, { text: ETEKAF }, { text: BESSENT }], { threshold: 55, minKeep: 1 });
    expect(r.kept.map((x) => x.text)).toContain(TANKER);
    expect(r.kept.map((x) => x.text)).toContain(BESSENT);
    expect(r.dropped.map((x) => x.text)).toContain(ETEKAF);
  });

  test('جنگ/ایران با کف امتیاز همیشه می‌ماند حتی اگر آستانه ۱۰۰ باشد', () => {
    const war = { text: 'ایران به حمله دشمن پاسخ موشکی داد' };
    const r = filterByImportance([war, { text: ETEKAF }], { threshold: 100, minKeep: 0 });
    expect(r.kept).toContain(war);
    expect(r.dropped).not.toContain(war);
  });

  test('سهمیهٔ حداقل — روز بی‌خبر: بهترینِ موجود می‌ماند (گرسنگی ممنوع)', () => {
    const r = filterByImportance([{ text: ETEKAF }, { text: ISNA_HOSPITAL }], { threshold: 55, minKeep: 1 });
    expect(r.kept.length).toBe(1);
    expect(r.kept[0]!.text).toBe(ISNA_HOSPITAL); // ۴۰ > ۱۳ — بهترینِ موجود
  });
});

// ────────────────────────────────────────────────────────────────────
// ۶) حکم یکپارچه + پالایهٔ دسته‌ای — کل پیام کاربر در یک آزمون
// ────────────────────────────────────────────────────────────────────

describe('intakeVerdict — حکم یکپارچهٔ ورودی', () => {
  test('تبلیغ با دلیل رد', () => {
    const v = intakeVerdict(DONATION_AD);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('تبلیغ');
  });

  test('توییت‌نما با دلیل رد', () => {
    const v = intakeVerdict('ترامپ در توییتر نوشت: ما آماده‌ایم.');
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('توییت');
  });

  test('تاریخ ناساز با دلیل رد', () => {
    const v = intakeVerdict('جنگ جهانی دوم در سال ۲۰۰۳ آغاز شد و همه‌چیز عوض شد و کشتار ویرانی بلا بلا ادامه یافت');
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('تاریخی');
  });

  test('خبر مهم سالم ok=true', () => {
    expect(intakeVerdict(TANKER).ok).toBe(true);
    expect(intakeVerdict(BESSENT).ok).toBe(true);
  });
});

describe('filterNewsIntake — پالایهٔ یکپارچهٔ دسته‌ای (نمونه‌های واقعی کاربر)', () => {
  test('تفکیک چهار دستهٔ رد + نگه‌داشتن سالم‌ها + سهمیهٔ حداقل', () => {
    const items = [
      { text: ISNA_HOSPITAL },      // کم‌اهمیت (۴۰) — اما با سهمیهٔ حداقل (۳) بهترینِ زیر آستانه می‌ماند
      { text: DONATION_AD },        // تبلیغ
      { text: 'ترامپ در توییتر نوشت: ایران آماده مذاکره است.' }, // توییت‌نما
      { text: ETEKAF },              // کم‌اهمیت (۱۳) — حذف قطعی
      { text: TANKER },              // مهم — می‌ماند
      { text: BESSENT },             // مهم — می‌ماند
      { text: 'جنگ جهانی دوم در سال ۲۰۰۳ آغاز شد و کشتار و ویرانی گسترده به بار آورد و تاریخ جهان عوض شد' }, // ناساز تاریخی
    ];
    const r = filterNewsIntake(items, { threshold: 55, minKeep: 3 });
    expect(r.droppedAds.length).toBe(1);
    expect(r.droppedTweetRelay.length).toBe(1);
    expect(r.droppedHistory.length).toBe(1);
    expect(r.droppedLowImportance.length).toBe(1); // فقط اعتکاف (۱۳) — ایسنا (۴۰) بهترینِ زیر آستانه و با سهمیهٔ حداقل ماند
    expect(r.kept.length).toBe(3);
    expect(r.kept.map((x) => x.text)).toContain(TANKER);
    expect(r.kept.map((x) => x.text)).toContain(BESSENT);
    expect(r.kept.map((x) => x.text)).toContain(ISNA_HOSPITAL); // سهمیهٔ حداقل — گرسنگی ممنوع
  });

  test('بدون سهمیهٔ حداقل (minKeep=0) همهٔ زیر آستانه می‌افتند', () => {
    const r = filterNewsIntake([{ text: ISNA_HOSPITAL }, { text: ETEKAF }], { threshold: 55, minKeep: 0 });
    expect(r.kept.length).toBe(0);
    expect(r.droppedLowImportance.length).toBe(2);
  });

  test('اهمیت خاموش (پیکرهٔ تحلیل جامع) — فقط گیت‌های سخت', () => {
    const r = filterNewsIntake([{ text: ETEKAF }, { text: DONATION_AD }], { importance: false });
    expect(r.droppedAds.length).toBe(1);
    expect(r.kept.length).toBe(1); // اعتکاف برای «تحلیل» می‌ماند
  });
});

// ────────────────────────────────────────────────────────────────────
// ۷) تنظیمات ورک‌فلو — سقف ۱۶ و متغیرهای موتور ورودی
// ────────────────────────────────────────────────────────────────────

describe('تنظیمات موتور ورودی خبر (bale-bot.yml + CFG)', () => {
  test('سقف بستهٔ خبری ۱۶ و متغیرهای گیت‌ها در ورک‌فلوی تعریف‌شده‌اند', () => {
    const yml = readFileSync('.github/workflows/bale-bot.yml', 'utf8');
    expect(yml).toContain("NEWS_BUNDLE_MAX_ITEMS: '16'");
    expect(yml).toContain("NEWS_IMPORTANCE_THRESHOLD: '55'");
    // ممیزی ۲۷ نوامبر — سهمیهٔ حداقل ۳→۰ («اخبار بی‌اهمیت رو دیگه منتشر نکنی») +
    // سپر سوم حجم: سقف روزانهٔ انتشار خبر
    expect(yml).toContain("NEWS_INTAKE_MIN_KEEP: '0'");
    expect(yml).toContain("NEWS_DAILY_MAX_ITEMS: '96'");
    expect(yml).toContain("ATTRIBUTION_VERIFY_MAX: '6'");
    expect(yml).not.toContain("NEWS_BUNDLE_MAX_ITEMS: '24'");
  });
});
