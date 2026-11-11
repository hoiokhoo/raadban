/**
 * مناسبت‌ها و وقایع تاریخی — پیام صبحگاهی/شبانگاهی رصدبان
 * خواستهٔ کاربر (۱۰ نوامبر ۲۰۲۶): مناسبت‌های رسمی تقویم جمهوری اسلامی ایران، ملی و مذهبی،
 * مناسبت‌های قمری، وقایع تاریخی ایران و جهان — «هر واقعه تاریخی باید واقعاً در همان تاریخ
 * تقویمی رخ داده باشد… اگر مناسبت مهمی وجود ندارد، اطلاعات ساختگی تولید نشود.»
 *
 * قواعد: فقط مناسبت‌های پایدار و مستند. سال وقایع تاریخی درج شده (برای رویدادهای شناخته‌شده).
 * تقویم‌ها: shamsi (ماه ۱-۱۲، روز ۱-۳۱) | qamari (ماه ۱-۱۲) | miladi (ماه ۱-۱۲).
 */

export type OccasionCalendar = 'shamsi' | 'qamari' | 'miladi';
export type OccasionCategory = 'official' | 'religious' | 'history-ir' | 'world' | 'history-world';

export interface Occasion {
  cal: OccasionCalendar;
  m: number;
  d: number;
  title: string;
  /** سال وقوع — فقط برای رویدادهای تاریخی مستند */
  year?: number;
  cat: OccasionCategory;
}

export const OCCASIONS: Occasion[] = [
  // ---------- تقویم رسمی شمسی — ملی و رسمی ----------
  { cal: 'shamsi', m: 1, d: 1, title: 'آغاز سال نو و جشن نوروز', cat: 'official' },
  { cal: 'shamsi', m: 1, d: 12, title: 'روز جمهوری اسلامی ایران', year: 1979, cat: 'official' },
  { cal: 'shamsi', m: 1, d: 13, title: 'روز طبیعت (سیزده‌بدر نوروز)', cat: 'official' },
  { cal: 'shamsi', m: 2, d: 1, title: 'بزرگداشت سعدی، روز ارتقای ارتباطات و روابط عمومی', cat: 'official' },
  { cal: 'shamsi', m: 2, d: 25, title: 'بزرگداشت فردوسی و پاسداشت زبان فارسی', cat: 'official' },
  { cal: 'shamsi', m: 3, d: 14, title: 'رحلت امام خمینی (ره)', year: 1989, cat: 'official' },
  { cal: 'shamsi', m: 3, d: 15, title: 'قیام خونین ۱۵ خرداد', year: 1963, cat: 'official' },
  { cal: 'shamsi', m: 4, d: 27, title: 'بزرگداشت حافظ شیرازی', cat: 'official' },
  { cal: 'shamsi', m: 5, d: 30, title: 'بزرگداشت علامه محمدباقر مجلسی', cat: 'official' },
  { cal: 'shamsi', m: 6, d: 31, title: 'آغاز جنگ تحمیلی و هفتهٔ دفاع مقدس', year: 1980, cat: 'official' },
  { cal: 'shamsi', m: 6, d: 30, title: 'روز دولت و شهادت رجایی و باهنر', year: 1981, cat: 'official' },
  { cal: 'shamsi', m: 7, d: 7, title: 'شهادت آیت‌الله بهشتی و یارانش', year: 1981, cat: 'official' },
  { cal: 'shamsi', m: 7, d: 13, title: 'روز ملی مبارزه با استکبار جهانی (تسخیر سفارت آمریکا)', year: 1979, cat: 'official' },
  { cal: 'shamsi', m: 8, d: 13, title: 'روز ملی دانش‌آموز (تبعید امام به ترکیه و شهادت دانش‌آموزان)', year: 1964, cat: 'official' },
  { cal: 'shamsi', m: 8, d: 24, title: 'روز کتاب، کتاب‌خوانی و موزه', cat: 'official' },
  { cal: 'shamsi', m: 9, d: 1, title: 'روز نیروی انتظامی', cat: 'official' },
  { cal: 'shamsi', m: 9, d: 16, title: 'روز دانشجو', year: 1953, cat: 'official' },
  { cal: 'shamsi', m: 9, d: 25, title: 'روز پژوهش', cat: 'official' },
  { cal: 'shamsi', m: 10, d: 9, title: 'روز همدلی ملت و رهبری (۹ دی)', year: 2009, cat: 'official' },
  { cal: 'shamsi', m: 10, d: 20, title: 'روز قاصدک؟ — حذف شود', cat: 'official' }, // نگهبان خطا — حذف در پایین
  { cal: 'shamsi', m: 11, d: 12, title: 'بازگشت امام خمینی به ایران و آغاز دههٔ فجر', year: 1979, cat: 'official' },
  { cal: 'shamsi', m: 11, d: 19, title: 'روز نیروی هوایی', cat: 'official' },
  { cal: 'shamsi', m: 11, d: 22, title: 'پیروزی انقلاب اسلامی ایران', year: 1979, cat: 'official' },
  { cal: 'shamsi', m: 12, d: 29, title: 'روز ملی شدن صنعت نفت ایران', year: 1951, cat: 'official' },

  // ---------- مناسبت‌های مذهبی قمری (تقویم رسمی ایران) ----------
  { cal: 'qamari', m: 1, d: 1, title: 'آغاز ماه محرم', cat: 'religious' },
  { cal: 'qamari', m: 1, d: 3, title: 'ورود کاروان امام حسین (ع) به کربلا', year: 680, cat: 'religious' },
  { cal: 'qamari', m: 1, d: 9, title: 'تاسوعای حسینی', cat: 'religious' },
  { cal: 'qamari', m: 1, d: 10, title: 'عاشورای حسینی — شهادت امام حسین (ع)', year: 680, cat: 'religious' },
  { cal: 'qamari', m: 1, d: 12, title: 'روز عزای سیدالشهدا (ع)', cat: 'religious' },
  { cal: 'qamari', m: 2, d: 20, title: 'اربعین حسینی', cat: 'religious' },
  { cal: 'qamari', m: 2, d: 28, title: 'شهادت پیامبر اکرم (ص) و شهادت امام حسن مجتبی (ع)', cat: 'religious' },
  { cal: 'qamari', m: 2, d: 30, title: 'شهادت امام رضا (ع) — آخر صفر', cat: 'religious' },
  { cal: 'qamari', m: 3, d: 8, title: 'شهادت امام حسن عسکری (ع) — آغاز امامت امام زمان (عج)', cat: 'religious' },
  { cal: 'qamari', m: 3, d: 17, title: 'میلاد پیامبر اکرم (ص) و امام جعفر صادق (ع) — هفتهٔ وحدت', cat: 'religious' },
  { cal: 'qamari', m: 5, d: 10, title: 'شهادت حضرت فاطمه معصومه (س)', cat: 'religious' },
  { cal: 'qamari', m: 6, d: 20, title: 'میلاد حضرت فاطمه زهرا (س) — روز زن و مادر', cat: 'religious' },
  { cal: 'qamari', m: 7, d: 1, title: 'میلاد امام محمد باقر (ع)', cat: 'religious' },
  { cal: 'qamari', m: 7, d: 3, title: 'شهادت امام موسی کاظم (ع)', cat: 'religious' },
  { cal: 'qamari', m: 7, d: 13, title: 'میلاد امام علی (ع) — روز پدر', cat: 'religious' },
  { cal: 'qamari', m: 7, d: 25, title: 'شهادت امام موسی کاظم (ع)', cat: 'religious' },
  { cal: 'qamari', m: 7, d: 27, title: 'مبعث حضرت رسول اکرم (ص)', cat: 'religious' },
  { cal: 'qamari', m: 8, d: 3, title: 'میلاد امام حسین (ع) — روز پاسدار', cat: 'religious' },
  { cal: 'qamari', m: 8, d: 5, title: 'میلاد امام سجاد (ع)', cat: 'religious' },
  { cal: 'qamari', m: 8, d: 15, title: 'میلاد امام زمان (عج) — نیمهٔ شعبان', cat: 'religious' },
  { cal: 'qamari', m: 9, d: 1, title: 'آغاز ماه مبارک رمضان — ماه روزه', cat: 'religious' },
  { cal: 'qamari', m: 9, d: 10, title: 'وفات حضرت خدیجه (س)', cat: 'religious' },
  { cal: 'qamari', m: 9, d: 15, title: 'میلاد امام حسن مجتبی (ع)', cat: 'religious' },
  { cal: 'qamari', m: 9, d: 21, title: 'شهادت امام علی (ع) — شب قدر', cat: 'religious' },
  { cal: 'qamari', m: 10, d: 1, title: 'عید سعید فطر', cat: 'religious' },
  { cal: 'qamari', m: 10, d: 25, title: 'شهادت امام جعفر صادق (ع)', cat: 'religious' },
  { cal: 'qamari', m: 11, d: 1, title: 'میلاد حضرت فاطمه معصومه (س)', cat: 'religious' },
  { cal: 'qamari', m: 11, d: 29, title: 'شهادت امام محمد تقی جواد (ع)', cat: 'religious' },
  { cal: 'qamari', m: 12, d: 7, title: 'شهادت امام محمد باقر (ع)', cat: 'religious' },
  { cal: 'qamari', m: 12, d: 10, title: 'عید سعید قربان', cat: 'religious' },
  { cal: 'qamari', m: 12, d: 15, title: 'میلاد امام علی النقی هادی (ع)', cat: 'religious' },
  { cal: 'qamari', m: 12, d: 18, title: 'عید بزرگ غدیر خم', cat: 'religious' },
  { cal: 'qamari', m: 12, d: 24, title: 'عید مباهله', cat: 'religious' },

  // ---------- روزهای جهانی و وقایع تاریخی جهان (میلادی) ----------
  { cal: 'miladi', m: 1, d: 1, title: 'آغاز سال میلادی نو', cat: 'world' },
  { cal: 'miladi', m: 3, d: 8, title: 'روز جهانی زن', cat: 'world' },
  { cal: 'miladi', m: 3, d: 21, title: 'روز جهانی شعر و روز جهانی جنگل‌ها', cat: 'world' },
  { cal: 'miladi', m: 4, d: 7, title: 'روز جهانی بهداشت', cat: 'world' },
  { cal: 'miladi', m: 4, d: 12, title: 'نخستین پرواز انسانی فضایی — یوری گاگارین', year: 1961, cat: 'history-world' },
  { cal: 'miladi', m: 4, d: 22, title: 'روز جهانی زمین', year: 1970, cat: 'world' },
  { cal: 'miladi', m: 5, d: 1, title: 'روز جهانی کارگر', cat: 'world' },
  { cal: 'miladi', m: 6, d: 5, title: 'روز جهانی محیط‌زیست', cat: 'world' },
  { cal: 'miladi', m: 6, d: 20, title: 'روز جهانی پناهندگان', cat: 'world' },
  { cal: 'miladi', m: 7, d: 11, title: 'روز جهانی جمعیت', cat: 'world' },
  { cal: 'miladi', m: 7, d: 20, title: 'فرود انسان بر ماه — مأموریت آپولو ۱۱', year: 1969, cat: 'history-world' },
  { cal: 'miladi', m: 8, d: 12, title: 'روز جهانی جوانان', cat: 'world' },
  { cal: 'miladi', m: 9, d: 1, title: 'آغاز جنگ جهانی دوم — تهاجم آلمان به لهستان', year: 1939, cat: 'history-world' },
  { cal: 'miladi', m: 9, d: 8, title: 'روز جهانی سوادآموزی', cat: 'world' },
  { cal: 'miladi', m: 9, d: 21, title: 'روز جهانی صلح', cat: 'world' },
  { cal: 'miladi', m: 10, d: 4, title: 'پرتاب نخستین ماهوارهٔ بشری (اسپوتنیک ۱)', year: 1957, cat: 'history-world' },
  { cal: 'miladi', m: 10, d: 5, title: 'روز جهانی معلم', cat: 'world' },
  { cal: 'miladi', m: 10, d: 16, title: 'روز جهانی غذا', cat: 'world' },
  { cal: 'miladi', m: 10, d: 24, title: 'روز ملل متحد', year: 1945, cat: 'world' },
  { cal: 'miladi', m: 12, d: 10, title: 'روز جهانی حقوق بشر', year: 1948, cat: 'world' },
  { cal: 'miladi', m: 11, d: 9, title: 'سقوط دیوار برلین', year: 1989, cat: 'history-world' },
  { cal: 'miladi', m: 6, d: 28, title: 'آغاز جنگ جهانی اول — ترور ولیعهد اتریش', year: 1914, cat: 'history-world' },
  { cal: 'miladi', m: 8, d: 6, title: 'بمباران هسته‌ای هیروشیما', year: 1945, cat: 'history-world' },
  { cal: 'miladi', m: 5, d: 14, title: 'ارتباط سراسری اولین شبکهٔ تلگراف اروپا؟ — حذف شود', cat: 'history-world' },

  // ---------- روزهای جهانی پرطرفدار (خواستهٔ کاربر ۱۲ نوامبر ۲۰۲۶: «مناسبت‌های بین‌المللی
  //  مثه روز جهانی زن و ... یا هالووین یا کریسمس و ... رو هم بزاری اگر روزشون هست») ----------
  { cal: 'miladi', m: 3, d: 22, title: 'روز جهانی آب', cat: 'world' },
  { cal: 'miladi', m: 4, d: 23, title: 'روز جهانی کتاب و حق مؤلف', cat: 'world' },
  { cal: 'miladi', m: 10, d: 1, title: 'روز جهانی سالمندان', cat: 'world' },
  { cal: 'miladi', m: 10, d: 31, title: 'هالووین (شب کدو)', cat: 'world' },
  { cal: 'miladi', m: 11, d: 12, title: 'روز جهانی پنومونی (ذات‌الریه)', cat: 'world' },
  { cal: 'miladi', m: 11, d: 16, title: 'روز جهانی رواداری', cat: 'world' },
  { cal: 'miladi', m: 11, d: 20, title: 'روز جهانی کودک', cat: 'world' },
  { cal: 'miladi', m: 11, d: 25, title: 'روز جهانی حذف خشونت علیه زنان', cat: 'world' },
  { cal: 'miladi', m: 12, d: 1, title: 'روز جهانی مبارزه با ایدز', cat: 'world' },
  { cal: 'miladi', m: 12, d: 25, title: 'کریسمس — میلاد حضرت مسیح (ع)', cat: 'world' },
];

/** مدخل ناقص/نامطمئن در زمان ساخت — بانک نهایی حذف می‌کند (صادقانه) */
export const OCCASIONS_REJECTED: Array<{ cal: OccasionCalendar; m: number; d: number; title: string }> = [
  { cal: 'shamsi', m: 10, d: 20, title: 'روز قاصدک؟ — حذف شود' },
  { cal: 'miladi', m: 5, d: 14, title: 'ارتباط سراسری اولین شبکهٔ تلگراف اروپا؟ — حذف شود' },
];

// پاک‌سازی: مدخل‌های ذخیره‌نشدهٔ نامطمئن از بانک حذف می‌شوند
for (const bad of OCCASIONS_REJECTED) {
  const i = OCCASIONS.findIndex((o) => o.cal === bad.cal && o.m === bad.m && o.d === bad.d && o.title === bad.title);
  if (i >= 0) OCCASIONS.splice(i, 1);
}
