/**
 * داده منابع جهانی — رسانه‌ها، نهادها و اشخاص اثرگذار
 * اصل: گرایش سیاسی = توصیف مستند مالکیت/خط تحریریه (مطابق مراجع سوگیری رسانه) برای پوشش متوازن.
 * مسیرها: RSS مستقیم → تجمیع‌کننده گوگل‌نیوز (site:) → خطای صادقانه. هیچ منبع ساختگی.
 */

export const GB = (site: string, when: string, hl: string, gl: string, ceid: string) =>
  `https://news.google.com/rss/search?q=site:${site}+when:${when}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

export const GN_LIMITS =
  'دریافت از تجمیع‌کننده عمومی گوگل‌نیوز (مسیر جایگزین مجاز) چون RSS مستقیم در دسترس نیست؛ پوشش تابع فهرست گوگل‌نیوز است و پیوندها از ریدایرکت گوگل باز می‌شوند.';

export interface GlobalSource {
  name: string;
  platform: 'rss' | 'twitter' | 'truthsocial' | 'telegram' | 'eitaa' | 'bale' | 'web';
  identifier: string;
  url: string;
  language: string;
  region: string; // کشور/قلمرو
  entityType: 'رسانه' | 'شخصیت' | 'نهاد رسمی';
  politicalOrientation: string;
  trustNote: string;
  notes?: string;
  limitsNote?: string;
  fetchMethod?: string;
  fetchIntervalMin?: number;
  maxItemsPerFetch?: number;
  categories: string[];
  topic: string;
}

export const MEDIA_SOURCES: GlobalSource[] = [
  // ==================== ایران (داخلی) ====================
  {
    name: 'خبرگزاری ایسنا (ISNA)', platform: 'rss', identifier: 'https://www.isna.ir/rss', url: 'https://www.isna.ir',
    language: 'fa', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'میانه — خبرگزاری عمومی با گرایش اصلاح‌طلبانه در پوشش سیاسی',
    trustNote: 'خبرگزاری معتبر ایرانی با شبکه خبرنگاران سراسری؛ آمار رسمی را خوب منبع‌یابی می‌کند؛ در تحلیل سیاسی نزدیک به جریان اصلاح‌طلب ارزیابی شده است.',
    fetchMethod: 'عمومی', categories: ['domestic-politics', 'agriculture', 'health'], topic: 'عمومی ایران',
  },
  {
    name: 'خبرگزاری ایلنا (ILNA)', platform: 'rss', identifier: 'https://www.ilna.ir/rss', url: 'https://www.ilna.ir',
    language: 'fa', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'اصلاح‌طلب — خبرگزاری خانه کارگر',
    trustNote: 'پوشش مسائل اجتماعی و کارگری قوی؛ چارچوب تحریریه نزدیک به اصلاح‌طلبان.',
    fetchMethod: 'عمومی', categories: ['domestic-politics'], topic: 'اخبار کار و جامعه',
  },
  {
    name: 'خبرگزاری فارس (Fars)', platform: 'rss', identifier: 'https://farsnews.ir/rss', url: 'https://farsnews.ir',
    language: 'fa', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'اصولگرا — نزدیک به بدنه امنیتی و جریان انقلابی',
    trustNote: 'خبرگزاری بزرگ اصولگرا؛ در پوشش دفاعی-نظامی سریع است؛ چارچوب تحریریه هم‌سو با بدنه امنیتی — ادعاهای سیاسی آن با منابع متفاوت مقایسه شود.',
    fetchMethod: 'عمومی', categories: ['domestic-politics', 'military'], topic: 'عمومی و دفاعی',
  },
  {
    name: 'باشگاه خبرنگاران جوان (YJC)', platform: 'rss', identifier: 'https://www.yjc.ir/rss', url: 'https://www.yjc.ir',
    language: 'fa', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'اصولگرا — وابسته به صدا و سیما',
    trustNote: 'وابسته به صدا و سیمای جمهوری اسلامی؛ پوشش پرحجم با تمرکز خبری؛ آمار رسمی را بازنشر می‌کند.',
    fetchMethod: 'عمومی', categories: ['domestic-politics', 'sports'], topic: 'عمومی',
  },
  {
    name: 'خبرگزاری صدا و سیما (IRIB News)', platform: 'rss', identifier: 'https://www.iribnews.ir/rss', url: 'https://www.iribnews.ir',
    language: 'fa', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — رسانه قانون‌گذارشده دولتی',
    trustNote: 'خبرگزاری رسمی صدا و سیما؛ منبع بیانیه‌های رسمی؛ چارچوب تحریریه تابع سیاست کلی نظام.',
    fetchMethod: 'عمومی', categories: ['domestic-politics', 'culture'], topic: 'عمومی',
  },
  {
    name: 'عصر ایران (Asr-e Iran)', platform: 'rss', identifier: GB('asriran.com', '3d', 'fa', 'IR', 'IR:fa'), url: 'https://www.asriran.com',
    language: 'fa', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'میانه — پراگماتیست با چرخش بین جریان‌ها',
    trustNote: 'سایت خبری-تحلیلی پرخواننده؛ ترکیبی از خبر و تحلیل شخصی نویسندگان؛ تحلیل‌هایش اظهارنظر فردی است نه خبر مستند.',
    notes: GN_LIMITS + ' — RSS مستقیم سایت قابل‌اعتماد یافت نشد.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['domestic-politics'], topic: 'خبر و تحلیل',
  },
  {
    name: 'انصاف نیوز (Ensaf)', platform: 'rss', identifier: 'https://ensafnews.com/feed', url: 'https://ensafnews.com',
    language: 'fa', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'اصولگرای منتقد — خط انتقادی از دولت در چارچوب نظام',
    trustNote: 'خبری تحلیلی با رویکرد انتقادی؛ پیگیری مسائل قوا و حقوق شهروندی در چارچوب رسمی.',
    fetchMethod: 'عمومی', categories: ['domestic-politics'], topic: 'سیاسی انتقادی',
  },
  {
    name: 'اعتمادآنلاین (Etemad Online)', platform: 'rss', identifier: GB('etemadonline.com', '5d', 'fa', 'IR', 'IR:fa'), url: 'https://etemadonline.com',
    language: 'fa', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'اصلاح‌طلب — هم‌خانواده روزنامه اعتماد',
    trustNote: 'پوشش سیاسی-اقتصادی با چارچوب اصلاح‌طلب؛ مصاحبه‌های فعال جریان اصلاح.',
    notes: GN_LIMITS + ' — RSS مستقیم سایت در دسترس نیست.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['domestic-politics'], topic: 'سیاسی',
  },
  {
    name: 'تجارت نیوز (Tejarat News)', platform: 'rss', identifier: GB('tejaratnews.com', '5d', 'fa', 'IR', 'IR:fa'), url: 'https://tejaratnews.com',
    language: 'fa', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'میانه — تمرکز تخصصی اقتصادی',
    trustNote: 'رسانه تخصصی اقتصاد و تجارت؛ پوشش بازار ارز، سکه، مسکن و بورس.',
    notes: GN_LIMITS + ' — RSS مستقیم سایت در دسترس نیست.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['economy'], topic: 'اقتصاد',
  },
  {
    name: 'پرس‌تی‌وی (Press TV — انگلیسی)', platform: 'rss', identifier: GB('presstv.ir', '3d', 'en', 'US', 'US:en'), url: 'https://www.presstv.ir',
    language: 'en', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — صدا و سیمای جمهوری اسلامی (نسخه بین‌المللی)',
    trustNote: 'رسانه بین‌المللی رسمی ایران؛ در پوشش سیاست خارجی و دفاعی چارچوب رسمی حاکمیت را بازتاب می‌دهد؛ ادعاهای منطقه‌ای با منابع مستقل مقایسه شود.',
    notes: GN_LIMITS + ' — دسترسی مستقیم از این سرور محدود است.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'military'], topic: 'بین‌الملل',
  },

  // ==================== فارسی‌زبان بین‌المللی ====================
  {
    name: 'ایران اینترنشنال (Iran International)', platform: 'rss', identifier: GB('iranintl.com', '3d', 'fa', 'IR', 'IR:fa'), url: 'https://www.iranintl.com',
    language: 'fa', region: 'بریتانیا', entityType: 'رسانه',
    politicalOrientation: 'اپوزیسیون — منتقد حاکمیت ایران (مستقر در لندن)',
    trustNote: 'شبکه فارسی‌زبان مستقر در لندن با پوشش گسترده اخبار ایران؛ منتقد صریح حاکمیت؛ مالکیت و تأمین مالی آن موضوع بحث‌های سیاسی است — ادعاهای داخلی ایران را با منابع مستقل دیگر سنج.',
    notes: GN_LIMITS + ' — RSS مستقیم سایت در دسترس نیست.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'ایران و جهان',
  },
  {
    name: 'رادیو فردا (Radio Farda — تجمیعی)', platform: 'rss', identifier: GB('radiofarda.com', '3d', 'fa', 'IR', 'IR:fa'), url: 'https://www.radiofarda.com',
    language: 'fa', region: 'چک/آمریکا', entityType: 'رسانه',
    politicalOrientation: 'اپوزیسیون‌گرا — وابسته به RFE/RL با تأمین مالی کنگره آمریکا',
    trustNote: 'سرویس فارسی رادیو اروپای آزاد (RFE/RL) — رسانه federally-funded آمریکا؛ پوشش منتقد حاکمیت ایران؛ استانداردهای خبری رسمی دارد ولی چارچوب سیاست خارجی آمریکا را دارد.',
    notes: GN_LIMITS + ' — خوراک API مستقیم رادیو فردا از این سرور خالی برمی‌گردد.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'ایران و جهان',
  },
  {
    name: 'دی‌وی فارسی (DW Persian)', platform: 'rss', identifier: 'https://rss.dw.com/rdf/rss-per-all', url: 'https://www.dw.com/fa-IR',
    language: 'fa', region: 'آلمان', entityType: 'رسانه',
    politicalOrientation: 'رسمی/اروپایی — رسانه دولتی آلمان (Deutsche Welle)',
    trustNote: 'رسانه بین‌المللی آلمان با استاندارد خبری قانونی (فدرالیسم و تنوع)؛ پوشش فارسی منتقد حاکمیت ایران در حوزه حقوق بشر.',
    fetchMethod: 'عمومی', categories: ['foreign-policy', 'culture'], topic: 'جهان به فارسی',
  },
  {
    name: 'فرانس ۲۴ فارسی (France 24 Persian)', platform: 'rss', identifier: 'https://www.france24.com/fa/rss', url: 'https://www.france24.com/fa/',
    language: 'fa', region: 'فرانسه', entityType: 'رسانه',
    politicalOrientation: 'رسمی/فرانسوی — شبکه دولتی فرانسه',
    trustNote: 'رسانه عمومی فرانسه (با سرمایه شبکه تلویزیونی فرانسه)؛ پوشش فارسی خبرمحور؛ چارچوب سیاست خارجی فرانسه.',
    fetchMethod: 'عمومی', categories: ['foreign-policy'], topic: 'جهان به فارسی',
  },
  {
    name: 'یورونیوز فارسی (Euronews Persian)', platform: 'rss', identifier: 'https://parsi.euronews.com/rss', url: 'https://parsi.euronews.com',
    language: 'fa', region: 'فرانسه/اروپا', entityType: 'رسانه',
    politicalOrientation: 'میانه اروپایی — کنسرسیوم رسانه‌های عمومی اروپا',
    trustNote: 'رسانه اروپایی چندملیتی؛ پوشش خبری نسبتاً فاکتوگرا با تمرکز اروپایی.',
    fetchMethod: 'عمومی', categories: ['foreign-policy', 'environment'], topic: 'جهان به فارسی',
  },
  {
    name: 'رادیو زمانه (Radio Zamaneh — تجمیعی)', platform: 'rss', identifier: GB('radiozamaneh.com', '3d', 'fa', 'IR', 'IR:fa'), url: 'https://radiozamaneh.com',
    language: 'fa', region: 'هلند', entityType: 'رسانه',
    politicalOrientation: 'اپوزیسیون‌گرای مستقل — تأمین مالی هلندی، منتقد حاکمیت ایران',
    trustNote: 'رسانه فارسی مستقر در آمستردام؛ پوشش حقوق بشر و جامعه مدنی ایران؛ منتقد حاکمیت با استاندارد خبری مستقل.',
    notes: GN_LIMITS + ' — خوراک مستقیم زمانه از این سرور خالی برمی‌گردد.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'culture'], topic: 'ایران و فرهنگ',
  },

  // ==================== چین ====================
  {
    name: 'شینهوا انگلیسی (Xinhua English)', platform: 'rss', identifier: GB('english.news.cn', '3d', 'en', 'US', 'US:en'), url: 'https://english.news.cn',
    language: 'en', region: 'چین', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — خبرگزاری رسمی دولت چین',
    trustNote: 'خبرگزاری رسمی چین؛ منبع اولیه مواضع حزب کمونیست و دولت؛ آمار اقتصادی رسمی چین را از اینجا می‌گیریم ولی قاب‌بندی سیاسی تابع حزب است.',
    notes: GN_LIMITS + ' — RSS مستقیم شینهوا عمومی نیست.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'economy'], topic: 'چین و جهان',
  },
  {
    name: 'گلوبال تایمز (Global Times)', platform: 'rss', identifier: GB('globaltimes.cn', '3d', 'en', 'US', 'US:en'), url: 'https://www.globaltimes.cn',
    language: 'en', region: 'چین', entityType: 'رسانه',
    politicalOrientation: 'ناسیونالیست — ارگان روزنامه حزب کمونیست (دیه)',
    trustNote: 'روزیانه وابسته به روزنامه حزب مردم؛ لحن ملی‌گرا و سخت در موضوعات تایوان/آمریکا؛ بیانیه‌های رسمی را بازتاب می‌دهد ولی قاب‌بندی شدیداً حزبی است.',
    notes: GN_LIMITS, limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'military'], topic: 'چین',
  },
  {
    name: 'CGTN (China Global TV Network)', platform: 'rss', identifier: GB('cgtn.com', '3d', 'en', 'US', 'US:en'), url: 'https://www.cgtn.com',
    language: 'en', region: 'چین', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — تلویزیون بین‌المللی دولت چین',
    trustNote: 'شبکه بین‌المللی CCTV؛ در چند کشور اروپایی مجوزش با چالش رگولاتوری مواجه بوده؛ پوشش رسمی چین.',
    notes: GN_LIMITS, limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'tech'], topic: 'چین و جهان',
  },
  {
    name: 'روزنامه مردم انگلیسی (People\'s Daily English)', platform: 'rss', identifier: GB('en.people.cn', '5d', 'en', 'US', 'US:en'), url: 'https://en.people.cn',
    language: 'en', region: 'چین', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — ارگان مستقیم کمیته مرکزی حزب کمونیست چین',
    trustNote: 'ارگان رسمی حزب؛ دقیق‌ترین بازتاب مواضع رسمی حزب کمونیست چین؛ ذاتاً بدون انتقاد از خط حزب.',
    notes: GN_LIMITS, limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'economy'], topic: 'خط رسمی چین',
  },
  {
    name: 'چاینا دیلی (China Daily)', platform: 'rss', identifier: GB('chinadaily.com.cn', '3d', 'en', 'US', 'US:en'), url: 'https://www.chinadaily.com.cn',
    language: 'en', region: 'چین', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — روزنامه انگلیسی‌زبان دولت چین',
    trustNote: 'روزنامه رسمی انگلیسی‌زبان؛ بازتاب مواضع دولت برای مخاطب خارجی.',
    notes: GN_LIMITS, limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'economy'], topic: 'چین',
  },
  {
    name: 'ساوت چاینا مورنینگ پست (SCMP)', platform: 'rss', identifier: 'https://www.scmp.com/rss/4/feed', url: 'https://www.scmp.com',
    language: 'en', region: 'هنگ‌کنگ', entityType: 'رسانه',
    politicalOrientation: 'میانه با چارچوب چین — مالکیت علی‌بابا (هنگ‌کنگ)',
    trustNote: 'روزنامه تاریخی هنگ‌کنگ؛ پس از خرید توسط علی‌بابا، خودسانسوری سیاسی گزارش شده اما پوشش خبری‌اش نسبت به رسانه‌های سرزمین اصلی مستقل‌تر و باکیفیت‌تر است.',
    fetchMethod: 'عمومی', categories: ['foreign-policy', 'economy', 'tech'], topic: 'چین و آسیا',
  },

  // ==================== روسیه ====================
  {
    name: 'تاس انگلیسی (TASS English)', platform: 'rss', identifier: 'https://tass.com/rss/v2.xml', url: 'https://tass.com',
    language: 'en', region: 'روسیه', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — خبرگزاری رسمی دولت روسیه',
    trustNote: 'خبرگزاری رسمی روسیه؛ منبع اولیه مواضع کرملین؛ در پوشش جنگ اوکراین قاب‌بندی رسمی روسی دارد.',
    fetchMethod: 'عمومی', categories: ['foreign-policy', 'military', 'economy'], topic: 'روسیه و جهان',
  },
  {
    name: 'RT (Russia Today)', platform: 'rss', identifier: 'https://www.rt.com/rss/news/', url: 'https://www.rt.com',
    language: 'en', region: 'روسیه', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — شبکه دولتی روسیه (در اتحادیه اروپا تحریم پخش)',
    trustNote: 'شبکه بین‌المللی روسیه با بودجه دولت؛ در پوشش جنگ اوکراین و سیاست غرب قاب‌بندی کرملین؛ در EU پخش ممنوع است — ادعاهای آن حتماً با منابع مستقل سنجیده شود.',
    fetchMethod: 'عمومی', categories: ['foreign-policy', 'military'], topic: 'روسیه',
  },
  {
    name: 'اسپوتنیک (Sputnik)', platform: 'rss', identifier: GB('sputnikglobe.com', '3d', 'en', 'US', 'US:en'), url: 'https://sputnikglobe.com',
    language: 'en', region: 'روسیه', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — خبرگزاری دولتی روسیه ( Rossiya Segodnya)',
    trustNote: 'وابسته به آژانس خبری دولتی روسیه؛ قاب‌بندی رسمی کرملین؛ ادعاهای نظامی با منابع مستقل سنجیده شود.',
    notes: GN_LIMITS + ' — RSS مستقیم در دسترس نیست.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'military'], topic: 'روسیه',
  },

  // ==================== آمریکا ====================
  {
    name: 'نیویورک تایمز (NYT World)', platform: 'rss', identifier: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', url: 'https://www.nytimes.com/section/world',
    language: 'en', region: 'آمریکا', entityType: 'رسانه',
    politicalOrientation: 'میانه‌چپ/لیبرال — روزنامه پرنفوذ آمریکا',
    trustNote: 'روزنامه مرجع آمریکا؛ گزارش‌کاری عمیق با استاندارد تحریریه بالا؛ در انتخابات تمایل تحریریه به دموکرات‌ها ثبت شده است.',
    fetchMethod: 'عمومی', categories: ['foreign-policy', 'economy'], topic: 'جهان',
  },
  {
    name: 'آسوشیتد پرس (AP News)', platform: 'rss', identifier: GB('apnews.com', '2d', 'en', 'US', 'US:en'), url: 'https://apnews.com',
    language: 'en', region: 'آمریکا', entityType: 'رسانه',
    politicalOrientation: 'مرکز — آژانس تعاونی غیرانتفاعی',
    trustNote: 'آژانس خبری تعاونی با استاندارد بی‌طرفی ساختاری؛ مرجع سنجش ادعاهای سایر رسانه‌های آمریکا.',
    notes: GN_LIMITS + ' — RSS عمومی AP بازنشسته شده.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'جهان',
  },
  {
    name: 'ان‌پی‌آر (NPR World)', platform: 'rss', identifier: 'https://feeds.npr.org/1004/rss.xml', url: 'https://www.npr.org/sections/world',
    language: 'en', region: 'آمریکا', entityType: 'رسانه',
    politicalOrientation: 'میانه‌چپ — رادیو عمومی با بودجه عضویتی/فدرال',
    trustNote: 'رادیو عمومی آمریکا؛ گزارش‌های میدانی با کیفیت؛ تحلیل‌هایش تمایل لیبرال دارد.',
    fetchMethod: 'عمومی', categories: ['foreign-policy', 'health'], topic: 'جهان',
  },
  {
    name: 'پولیتیکو (Politico — تجمیعی)', platform: 'rss', identifier: GB('politico.com', '2d', 'en', 'US', 'US:en'), url: 'https://www.politico.com',
    language: 'en', region: 'آمریکا', entityType: 'رسانه',
    politicalOrientation: 'میانه‌چپ — پوشش تخصصی واشنگتن',
    trustNote: 'تخصصی سیاست واشنگتن؛ خبرهای پرتفصیل کاپیتول هیل؛ اکوسیستم منابعش واشنگتنی است.',
    notes: GN_LIMITS + ' — RSS مستقیم پولیتیکو درخواست این سرور را مسدود می‌کند (403).', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'سیاست آمریکا',
  },
  {
    name: 'د هیل (The Hill)', platform: 'rss', identifier: 'https://thehill.com/feed/', url: 'https://thehill.com',
    language: 'en', region: 'آمریکا', entityType: 'رسانه',
    politicalOrientation: 'میانه — پوشش کنگره',
    trustNote: 'پوشش نسبتاً متوازن کنگره و سیاست‌گذاری آمریکا؛ مفید برای پیگیری رأی‌ها و مصوبات.',
    fetchMethod: 'عمومی', categories: ['foreign-policy'], topic: 'کنگره آمریکا',
  },
  {
    name: 'بلومبرگ (Bloomberg — تجمیعی)', platform: 'rss', identifier: GB('bloomberg.com', '2d', 'en', 'US', 'US:en'), url: 'https://www.bloomberg.com',
    language: 'en', region: 'آمریکا', entityType: 'رسانه',
    politicalOrientation: 'مرکز — رسانه تخصصی بازارهای مالی',
    trustNote: 'مرجع بازارهای مالی؛ داده‌محور؛ دیوار پرداخت پشت بسیاری از مطالب.',
    notes: GN_LIMITS + ' — RSS رسمی بلومبرگ عمومی نیست.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['economy', 'energy'], topic: 'بازارهای مالی',
  },
  {
    name: 'واشنگتن پست (Washington Post — تجمیعی)', platform: 'rss', identifier: GB('washingtonpost.com', '3d', 'en', 'US', 'US:en'), url: 'https://www.washingtonpost.com',
    language: 'en', region: 'آمریکا', entityType: 'رسانه',
    politicalOrientation: 'میانه‌چپ/لیبرال — روزنامه واشنگتن',
    trustNote: 'روزنامه مرجع آمریکا (مالکیت جف بزوس)؛ پوشش قدرت فدرال قوی؛ تمایل لیبرال تحریریه ثبت‌شده است.',
    notes: GN_LIMITS + ' — RSS رسمی محدود به اشتراک است.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'سیاست آمریکا',
  },
  {
    name: 'وال‌استریت ژورنال (WSJ World)', platform: 'rss', identifier: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', url: 'https://www.wsj.com',
    language: 'en', region: 'آمریکا', entityType: 'رسانه',
    politicalOrientation: 'راست‌میانه اقتصادی — روزنامه مالی داوجونز',
    trustNote: 'مرجع اقتصاد و بازار؛ صفحه سرمقاله‌اش محافظه‌کار است ولی بخش خبری استاندارد بالا دارد؛ بسیاری مطالبش پشت دیوار پرداخت.',
    fetchMethod: 'عمومی', categories: ['economy', 'foreign-policy'], topic: 'اقتصاد جهانی',
  },

  // ==================== اروپا ====================
  {
    name: 'گاردین — بین‌الملل (Guardian World)', platform: 'rss', identifier: 'https://www.theguardian.com/world/rss', url: 'https://www.theguardian.com/world',
    language: 'en', region: 'بریتانیا', entityType: 'رسانه',
    politicalOrientation: 'چپ‌لیبرال — روزنامه گاردین',
    trustNote: 'روزنامه بریتانیایی با مالکیت اسکات تراست (مستقل از دولت/شرکت)؛ تمایل چپ‌لیبرال صریح؛ گزارش‌های حقوق بشری قوی.',
    fetchMethod: 'عمومی', categories: ['foreign-policy', 'environment'], topic: 'جهان',
  },
  {
    name: 'گاردین — محیط زیست (Guardian Environment)', platform: 'rss', identifier: 'https://www.theguardian.com/environment/rss', url: 'https://www.theguardian.com/environment',
    language: 'en', region: 'بریتانیا', entityType: 'رسانه',
    politicalOrientation: 'چپ‌لیبرال — پوشش تخصصی اقلیم',
    trustNote: 'پوشش تخصصی و پرکار اقلیم و محیط زیست؛ هم‌سو با علم اقلیم و فعال‌گرایی محیط‌زیستی.',
    fetchMethod: 'عمومی', categories: ['environment'], topic: 'اقلیم و محیط زیست',
  },
  {
    name: 'دی‌وی انگلیسی (DW English World)', platform: 'rss', identifier: 'https://rss.dw.com/rdf/rss-en-world', url: 'https://www.dw.com/en',
    language: 'en', region: 'آلمان', entityType: 'رسانه',
    politicalOrientation: 'رسمی/آلمانی — رسانه دولتی آلمان',
    trustNote: 'رسانه بین‌المللی آلمان؛ استاندارد قانونی استقلال تحریریه؛ چارچوب سیاست خارجی برلین.',
    fetchMethod: 'عمومی', categories: ['foreign-policy', 'environment'], topic: 'جهان',
  },
  {
    name: 'فرانس ۲۴ انگلیسی (France 24 English)', platform: 'rss', identifier: 'https://www.france24.com/en/rss', url: 'https://www.france24.com/en',
    language: 'en', region: 'فرانسه', entityType: 'رسانه',
    politicalOrientation: 'رسمی/فرانسوی — شبکه دولتی فرانسه',
    trustNote: 'شبکه عمومی فرانسه؛ پوشش جهانی؛ چارچوب دیپلماسی پاریس.',
    fetchMethod: 'عمومی', categories: ['foreign-policy'], topic: 'جهان',
  },

  // ==================== ترکیه ====================
  {
    name: 'آژانس آناتولی (Anadolu — تجمیعی)', platform: 'rss', identifier: GB('aa.com.tr', '2d', 'en', 'US', 'US:en'), url: 'https://www.aa.com.tr/en',
    language: 'en', region: 'ترکیه', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — آژانس دولتی ترکیه (نزدیک به حزب AKP)',
    trustNote: 'آژانس رسمی ترکیه؛ در پوشش منطقه‌ای (سوریه، قاره آفریقا) چارچوب آنکارا؛ پوشش وسیع جهانی دارد.',
    notes: GN_LIMITS + ' — RSS مستقیم آناتولی (404) در دسترس نیست.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'military'], topic: 'ترکیه و جهان',
  },
  {
    name: 'TRT فارسی (TRT Persian — تجمیعی)', platform: 'rss', identifier: GB('trt.net.tr', '7d', 'fa', 'TR', 'TR:fa'), url: 'https://www.trt.net.tr/persian',
    language: 'fa', region: 'ترکیه', entityType: 'رسانه',
    politicalOrientation: 'رسمی/دولتی — رسانه دولتی ترکیه (نسخه فارسی)',
    trustNote: 'رسانه بین‌المللی ترکیه؛ در پوشش خاورمیانه چارچوب آنکارا؛ نسخه فارسی برای مخاطب ایرانی.',
    notes: GN_LIMITS, limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'ترکیه به فارسی',
  },

  // ==================== اسرائیل ====================
  {
    name: 'تایمز آو اسرائیل (Times of Israel — تجمیعی)', platform: 'rss', identifier: GB('timesofisrael.com', '3d', 'en', 'US', 'US:en'), url: 'https://www.timesofisrael.com',
    language: 'en', region: 'اسرائیل', entityType: 'رسانه',
    politicalOrientation: 'میانه‌راست اسرائیلی — روزنامه آنلاین مستقل',
    trustNote: 'روزنامه آنلاین اسرائیلی؛ پوشش داخلی اسرائیل باکیفیت و نسبتاً متوازن با چارچوب امنیت ملی؛ وبلاگ‌هایش اظهارنظر فردی است.',
    notes: GN_LIMITS + ' — RSS مستقیم تایمز آو اسرائیل با Cloudflare (403) مسدود است.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'military'], topic: 'اسرائیل',
  },
  {
    name: 'هاآرتص انگلیسی (Haaretz English)', platform: 'rss', identifier: GB('haaretz.com', '3d', 'en', 'US', 'US:en'), url: 'https://www.haaretz.com',
    language: 'en', region: 'اسرائیل', entityType: 'رسانه',
    politicalOrientation: 'چپ‌لیبرال اسرائیلی — روزنامه منتقد دولت',
    trustNote: 'روزنامه قدیمی اسرائیلی؛ منتقد صریح دولت‌های راست اسرائیل؛ گزارش تحقیقی قوی درباره اشغال‌گری و سیاست داخلی.',
    notes: GN_LIMITS + ' — RSS مستقیم هاآرتص محدود است.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'اسرائیل',
  },

  // ==================== عربی ====================
  {
    name: 'الشرق الاوسط (Asharq Al-Awsat)', platform: 'rss', identifier: GB('aawsat.com', '3d', 'ar', 'SA', 'SA:ar'), url: 'https://www.aawsat.com',
    language: 'ar', region: 'عربستان سعودی', entityType: 'رسانه',
    politicalOrientation: 'هم‌سو با حاکمیت عربستان سعودی (گروه ORPC)',
    trustNote: 'روزیانه پان‌عربی مستقر در لندن با مالکیت سعودی؛ پوشش گسترده جهان عرب.',
    notes: GN_LIMITS, limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy', 'economy'], topic: 'جهان عرب',
  },
  {
    name: 'السومرية (Alsumaria — عراق)', platform: 'rss', identifier: GB('alsumaria.tv', '5d', 'ar', 'IQ', 'IQ:ar'), url: 'https://www.alsumaria.tv',
    language: 'ar', region: 'عراق', entityType: 'رسانه',
    politicalOrientation: 'میانه — رسانه خصوصی عراقی',
    trustNote: 'شبکه خصوصی عراقی؛ پوشش داخلی عراق و مناقشات سیاسی بغداد.',
    notes: GN_LIMITS, limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'عراق',
  },
  {
    name: 'العربی الجدید (Al-Araby Al-Jadeed)', platform: 'rss', identifier: GB('alaraby.co.uk', '5d', 'ar', 'QA', 'QA:ar'), url: 'https://www.alaraby.co.uk',
    language: 'ar', region: 'قطر/بریتانیا', entityType: 'رسانه',
    politicalOrientation: 'هم‌سو با حاکمیت قطر',
    trustNote: 'رسانه عربی وابسته به شبکه قطر (Fadaat Media)؛ پوشش منتقدانه از نظام‌های عربی رقیب قطر.',
    notes: GN_LIMITS, limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'جهان عرب',
  },

  // ==================== آسیا ====================
  {
    name: 'تایمز آو ایندیا (Times of India)', platform: 'rss', identifier: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', url: 'https://timesofindia.indiatimes.com',
    language: 'en', region: 'هند', entityType: 'رسانه',
    politicalOrientation: 'میانه‌راست — پرتیراژترین روزنامه انگلیسی هند',
    trustNote: 'روزنامه پرتیراژ هند؛ پوشش گسترده با کیفیت متغیر؛ در سیاست تمایل به بی‌ج‌پی دارد.',
    fetchMethod: 'عمومی', categories: ['foreign-policy', 'economy'], topic: 'هند و آسیا',
  },
  {
    name: 'د هیندو (The Hindu — International)', platform: 'rss', identifier: 'https://www.thehindu.com/news/international/feeder/default.rss', url: 'https://www.thehindu.com/news/international',
    language: 'en', region: 'هند', entityType: 'رسانه',
    politicalOrientation: 'چپ‌میانه — روزنامه مرجع هند',
    trustNote: 'روزنامه جدی و مرجع هند؛ پوشش بین‌المللی با کیفیت؛ تمایل چپ‌میانه.',
    fetchMethod: 'عمومی', categories: ['foreign-policy'], topic: 'هند و جهان',
  },
  {
    name: 'دان (Dawn — پاکستان، تجمیعی)', platform: 'rss', identifier: GB('dawn.com', '3d', 'en', 'PK', 'PK:en'), url: 'https://www.dawn.com',
    language: 'en', region: 'پاکستان', entityType: 'رسانه',
    politicalOrientation: 'میانه — روزنامه مرجع پاکستان',
    trustNote: 'روزنامه قدیمی و مرجع پاکستان؛ پوشش داخلی باکیفیت؛ حساسیت نظامی-امنیتی در پوشش دفاعی مشهود است.',
    notes: GN_LIMITS + ' — RSS مستقیم دان با 403 مسدود است.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'پاکستان',
  },
  {
    name: 'طلوع‌نیوز (TOLOnews — افغانستان)', platform: 'rss', identifier: GB('tolonews.com', '7d', 'en', 'US', 'US:en'), url: 'https://tolonews.com',
    language: 'en', region: 'افغانستان', entityType: 'رسانه',
    politicalOrientation: 'میانه مستقل — رسانه خصوصی افغان',
    trustNote: 'شبکه خبری مستقل افغانستان؛ یکی از معدود رسانه‌های فعال داخل کشور پس از ۱۴۰۰.',
    notes: GN_LIMITS, limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'], topic: 'افغانستان',
  },

  // ==================== ورزش ====================
  {
    name: 'BBC Sport', platform: 'rss', identifier: 'https://feeds.bbci.co.uk/sport/rss.xml', url: 'https://www.bbc.com/sport',
    language: 'en', region: 'بریتانیا', entityType: 'رسانه',
    politicalOrientation: 'مرکز — سرویس ورزشی بی‌بی‌سی',
    trustNote: 'پوشش ورزشی مرجع بریتانیا؛ نتیجه‌ها و نقل‌وانتقال‌ها را با منابع رسمی فدراسیون‌ها تطبیق می‌دهد.',
    fetchMethod: 'عمومی', categories: ['sports'], topic: 'ورزش جهان',
  },
  {
    name: 'ESPN (تجمیعی)', platform: 'rss', identifier: GB('espn.com', '2d', 'en', 'US', 'US:en'), url: 'https://www.espn.com',
    language: 'en', region: 'آمریکا', entityType: 'رسانه',
    politicalOrientation: 'مرکز — شبکه ورزشی آمریکا',
    trustNote: 'بزرگ‌ترین رسانه ورزشی آمریکا؛ پوشش NBA/NFL/فوتبال اروپا.',
    notes: GN_LIMITS + ' — RSS مستقیم ESPN با 403 مسدود است.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['sports'], topic: 'ورزش جهان',
  },
  {
    name: 'ورزش۳ (Varzesh3)', platform: 'rss', identifier: GB('varzesh3.com', '3d', 'fa', 'IR', 'IR:fa'), url: 'https://www.varzesh3.com',
    language: 'fa', region: 'ایران', entityType: 'رسانه',
    politicalOrientation: 'میانه — پرتیراژترین سایت ورزشی ایران',
    trustNote: 'مرجع نتایج و اخبار ورزشی ایران؛ عمدتاً بازنشرگر خبرهای آژانس‌های ورزشی.',
    notes: GN_LIMITS + ' — RSS مستقیم در دسترس نیست.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['sports'], topic: 'ورزش ایران',
  },

  // ==================== نهادهای بین‌المللی ====================
  {
    name: 'سازمان جهانی بهداشت (WHO News)', platform: 'rss', identifier: 'https://www.who.int/rss-feeds/news-english.xml', url: 'https://www.who.int/news',
    language: 'en', region: 'سوئیس/جهانی', entityType: 'نهاد رسمی',
    politicalOrientation: 'نهاد بین‌المللی — سازمان ملل',
    trustNote: 'منبع اولیه اعلان‌های رسمی بهداشت جهانی؛ اعلان‌های اضطراری (PHEIC) را اینجا راستی‌آزمایی می‌کنیم.',
    fetchMethod: 'عمومی', categories: ['health'], topic: 'سلامت جهانی',
  },
  {
    name: 'سازمان خواربار و کشاورزی (FAO News)', platform: 'rss', identifier: GB('fao.org', '14d', 'en', 'US', 'US:en'), url: 'https://www.fao.org/newsroom',
    language: 'en', region: 'ایتالیا/جهانی', entityType: 'نهاد رسمی',
    politicalOrientation: 'نهاد بین‌المللی — سازمان ملل',
    trustNote: 'منبع اولیه گزارش‌های امنیت غذایی و شاخص‌های قیمتی FAO.',
    notes: GN_LIMITS + ' — RSS مستقیم FAO در دسترس نیست.', limitsNote: GN_LIMITS,
    fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['agriculture'], topic: 'امنیت غذایی',
  },
];
