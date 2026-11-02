/**
 * داده اشخاص اثرگذار — حساب‌های رسمی به‌عنوان «منبع اولیه مواضع»
 * اصل: مواضع شخصی ≠ اثبات ادعا؛ هر ادعای عددی/رویدادی جداگانه راستی‌آزمایی می‌شود.
 * نکته صادقانه: شی جین‌پینگ و محمد بن سلمان حساب شخصی عمومی ندارند — پوشش مواضعشان
 * از رسانه‌های رسمی کشورشان (شینهوا/People's Daily، الشرق‌الاوسط/العربیه) انجام می‌شود
 * و به‌جای حساب ساختگی، این محدودیت صریحاً ثبت می‌شود.
 */
import type { GlobalSource } from './global-sources';

const TW_LIMITS =
  'ایکس از IPهای دیتاسنتر با HTTP 429 محدودیت نرخ اعمال می‌کند؛ در آن حالت خطا صادقانه ثبت و در تیک بعدی تلاش می‌شود.';

export const PEOPLE_SOURCES: GlobalSource[] = [
  // ---------- ایالات متحده ----------
  {
    name: 'دونالد ترامپ — ایکس (@realDonaldTrump)', platform: 'twitter', identifier: 'realDonaldTrump', url: 'https://x.com/realDonaldTrump',
    language: 'en', region: 'آمریکا', entityType: 'شخصیت',
    politicalOrientation: 'جمهوری‌خواه/محافظه‌کار — رئیس‌جمهور آمریکا',
    trustNote: 'منبع اولیه مواضع شخصی ترامپ؛ اغراق و ابهام در پست‌هایش شایع است؛ هر ادعا جداگانه راستی‌آزمایی می‌شود.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy', 'economy'], topic: 'مواضع رئیس‌جمهور آمریکا',
  },
  {
    name: 'جی‌دی ونس — ایکس (@JDVance)', platform: 'twitter', identifier: 'JDVance', url: 'https://x.com/JDVance',
    language: 'en', region: 'آمریکا', entityType: 'شخصیت',
    politicalOrientation: 'جمهوری‌خواه/راست پوپولیست — معاون رئیس‌جمهور',
    trustNote: 'حساب رسمی معاون رئیس‌جمهور آمریکا؛ مواضع دولت را بازتاب می‌دهد؛ ادعاهای سیاسی راست‌آزمایی لازم دارد.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'مواضع آمریکا',
  },
  {
    name: 'مارکو روبیو — ایکس (@marcorubio)', platform: 'twitter', identifier: 'marcorubio', url: 'https://x.com/marcorubio',
    language: 'en', region: 'آمریکا', entityType: 'شخصیت',
    politicalOrientation: 'جمهوری‌خواه شاهین — وزیر امور خارجه',
    trustNote: 'وزیر خارجه آمریکا؛ مواضع دیپلماسی رسمی آمریکا را اعلام می‌کند؛ اظهاراتش درباره ایران/چین/کوبا پرتنش است.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'دیپلماسی آمریکا',
  },
  {
    name: 'باراک اوباما — ایکس (@BarackObama)', platform: 'twitter', identifier: 'BarackObama', url: 'https://x.com/BarackObama',
    language: 'en', region: 'آمریکا', entityType: 'شخصیت',
    politicalOrientation: 'دموکرات/میانه‌چپ — رئیس‌جمهور پیشین',
    trustNote: 'حساب رسمی اوباما؛ کم‌فعال و اغلب بیانیه‌های تیمی؛ مرجع مواضع جریان دموکرات.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'مواضع دموکرات‌ها',
  },
  {
    name: 'جو بایدن — ایکس (@JoeBiden)', platform: 'twitter', identifier: 'JoeBiden', url: 'https://x.com/JoeBiden',
    language: 'en', region: 'آمریکا', entityType: 'شخصیت',
    politicalOrientation: 'دموکرات/میانه‌چپ — رئیس‌جمهور پیشین',
    trustNote: 'حساب رسمی بایدن؛ پس از پایان ریاست‌جمهوری عمدتاً بازتاب مواضع دموکرات‌ها.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'مواضع دموکرات‌ها',
  },
  {
    name: 'هیلاری کلینتون — ایکس (@HillaryClinton)', platform: 'twitter', identifier: 'HillaryClinton', url: 'https://x.com/HillaryClinton',
    language: 'en', region: 'آمریکا', entityType: 'شخصیت',
    politicalOrientation: 'دموکرات/میانه‌چپ — وزیر خارجه پیشین',
    trustNote: 'چهره اثرگذار دموکرات؛ اظهارنظرهای مکرر درباره ایران، روسیه و خاورمیانه.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'مواضع دموکرات‌ها',
  },
  {
    name: 'مایک پمپئو — ایکس (@mikepompeo)', platform: 'twitter', identifier: 'mikepompeo', url: 'https://x.com/mikepompeo',
    language: 'en', region: 'آمریکا', entityType: 'شخصیت',
    politicalOrientation: 'جمهوری‌خواه شاهین — وزیر خارجه پیشین',
    trustNote: 'مواضع حداکثری ضدایران (خط فشار حداکثری)؛ اظهارنظر فردی است نه موضع رسمی دولت فعلی.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'خط فشار علیه ایران',
  },
  {
    name: 'جان بولتون — ایکس (@AmbJohnBolton)', platform: 'twitter', identifier: 'AmbJohnBolton', url: 'https://x.com/AmbJohnBolton',
    language: 'en', region: 'آمریکا', entityType: 'شخصیت',
    politicalOrientation: 'جمهوری‌خواه شاهین — مشاور امنیت ملی پیشین',
    trustNote: 'مدافع تغییر رژیم از بیرون؛ مواضع نظامی‌گرایانه درباره ایران و کره شمالی؛ اظهارنظر فردی.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy', 'military'], topic: 'خط شاهین آمریکا',
  },
  {
    name: 'برنی سندرز — ایکس (@SenSanders)', platform: 'twitter', identifier: 'SenSanders', url: 'https://x.com/SenSanders',
    language: 'en', region: 'آمریکا', entityType: 'شخصیت',
    politicalOrientation: 'چپ‌گرا/پیشرو — سناتور ورمانت',
    trustNote: 'چهره شاخص چپ پیشروی آمریکا؛ مواضع ضدجنگ و ضدمتعارف؛ مرجع پوشش طیف چپ.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'چپ آمریکا',
  },
  {
    name: 'تاکر کارلسون — ایکس (@TuckerCarlson)', platform: 'twitter', identifier: 'TuckerCarlson', url: 'https://x.com/TuckerCarlson',
    language: 'en', region: 'آمریکا', entityType: 'شخصیت',
    politicalOrientation: 'راست پوپولیست/آیزولیشنیست — مفسر اثرگذار',
    trustNote: 'مفسر بسیار اثرگذار راست آمریکا؛ اظهارنظر نظری است نه خبر؛ در جنگ‌ها مواضع ضدمداخله دارد.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'نظریه راست آمریکا',
  },

  // ---------- ایران ----------
  {
    name: 'محمدجواد ظریف — ایکس (@JZarif)', platform: 'twitter', identifier: 'JZarif', url: 'https://x.com/JZarif',
    language: 'fa', region: 'ایران', entityType: 'شخصیت',
    politicalOrientation: 'اصلاح‌طلب — وزیر خارجه پیشین و معاون راهبردی رئیس‌جمهور',
    trustNote: 'چهره دیپلماسی ایران در برجام؛ مواضع رسمی-نیمه‌رسمی دیپلماسی ایران؛ بیانیه‌هایش را با اعلام رسمی وزارت خارجه تطبیق بده.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'دیپلماسی ایران',
  },
  {
    name: 'محمدباقر قالیباف — ایکس (@Qalibaf)', platform: 'twitter', identifier: 'Qalibaf', url: 'https://x.com/Qalibaf',
    language: 'fa', region: 'ایران', entityType: 'شخصیت',
    politicalOrientation: 'اصولگرا — رئیس مجلس شورای اسلامی',
    trustNote: 'رئیس قوه مقننه ایران؛ مواضع رسمی مجلس؛ بیانیه‌هایش را با صورت‌جلسه مجلس تطبیق بده.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['domestic-politics', 'foreign-policy'], topic: 'مواضع مجلس',
  },
  {
    name: 'رضا پهلوی — ایکس (@PahlaviReza)', platform: 'twitter', identifier: 'PahlaviReza', url: 'https://x.com/PahlaviReza',
    language: 'fa', region: 'آمریکا/اپوزیسیون', entityType: 'شخصیت',
    politicalOrientation: 'اپوزیسیون سکولار — ولیعهد پیشین و چهره اپوزیسیون خارج از کشور',
    trustNote: 'چهره اپوزیسیون خارج از کشور؛ مواضع سیاسی شخصی؛ ادعاهای مطرح‌شده (پیوندها، آمار، وعده‌ها) راستی‌آزمایی مستقل لازم دارد.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'اپوزیسیون ایران',
  },
  {
    name: 'مسیح علی‌نژاد — ایکس (@AlinejadMasih)', platform: 'twitter', identifier: 'AlinejadMasih', url: 'https://x.com/AlinejadMasih',
    language: 'fa', region: 'آمریکا/اپوزیسیون', entityType: 'شخصیت',
    politicalOrientation: 'اپوزیسیون — فعال حقوق زنان',
    trustNote: 'فعال حقوق زنان ایران؛ پوشش میدان‌های اعتراضی؛ ادعاهای میدانی را با منابع مستقل سنج.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy', 'culture'], topic: 'حقوق زنان ایران',
  },
  {
    name: 'حمید اسماعیلیون — ایکس (@esmaeilion)', platform: 'twitter', identifier: 'esmaeilion', url: 'https://x.com/esmaeilion',
    language: 'fa', region: 'کانادا/اپوزیسیون', entityType: 'شخصیت',
    politicalOrientation: 'اپوزیسیون — سخنگوی پیشین انجمن خانواده‌های قربانی پرواز ۷۵۲',
    trustNote: 'چهره اپوزیسیون؛ فعال در پیگیری پرواز ۷۵۲ و اعتراضات؛ ادعاهای مستندشده را با سند اصلی تطبیق بده.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'اپوزیسیون ایران',
  },

  // ---------- اروپا ----------
  {
    name: 'امانوئل مکرون — ایکس (@EmmanuelMacron)', platform: 'twitter', identifier: 'EmmanuelMacron', url: 'https://x.com/EmmanuelMacron',
    language: 'en', region: 'فرانسه', entityType: 'شخصیت',
    politicalOrientation: 'میانه/لیبرال — رئیس‌جمهور فرانسه',
    trustNote: 'حساب رسمی رئیس‌جمهور فرانسه؛ مواضع رسمی پاریس در اوکراین و خاورمیانه.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'مواضع فرانسه',
  },
  {
    name: 'کیر استارمر — ایکس (@Keir_Starmer)', platform: 'twitter', identifier: 'Keir_Starmer', url: 'https://x.com/Keir_Starmer',
    language: 'en', region: 'بریتانیا', entityType: 'شخصیت',
    politicalOrientation: 'کارگری/میانه‌چپ — نخست‌وزیر بریتانیا',
    trustNote: 'حساب رسمی نخست‌وزیر بریتانیا؛ مواضع رسمی لندن.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'مواضع بریتانیا',
  },

  // ---------- روسیه/اوکراین ----------
  {
    name: 'ولودیمیر زلنسکی — ایکس (@ZelenskyyUa)', platform: 'twitter', identifier: 'ZelenskyyUa', url: 'https://x.com/ZelenskyyUa',
    language: 'en', region: 'اوکراین', entityType: 'شخصیت',
    politicalOrientation: 'میانه — رئیس‌جمهور اوکراین (در جنگ)',
    trustNote: 'منبع اولیه مواضع و بیانیه‌های رسمی اوکراین در جنگ؛ ادعاهای میدانی جنگ را با منابع مستقل سنج.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy', 'military'], topic: 'مواضع اوکراین',
  },
  {
    name: 'ولادیمیر پوتین — کرملین (kremlin.ru)', platform: 'web', identifier: 'http://en.kremlin.ru/events', url: 'http://en.kremlin.ru/events',
    language: 'en', region: 'روسیه', entityType: 'نهاد رسمی',
    politicalOrientation: 'رسمی/دولتی — رئیس‌جمهور روسیه (پوتین حساب شخصی اجتماعی ندارد)',
    trustNote: 'منبع اولیه بیانیه‌ها و فرمان‌های رسمی پوتین؛ پوشش از سایت رسمی کرملین چون حساب شبکه اجتماعی شخصی وجود ندارد.',
    notes: 'سایت کرملین از این سرور ممکن است در دسترس نباشد — خطا صادقانه ثبت می‌شود؛ پوشش جایگزین: TASS و RT.',
    fetchMethod: 'عمومی', fetchIntervalMin: 240, categories: ['foreign-policy', 'military'], topic: 'مواضع روسیه',
  },

  // ---------- خاورمیانه/آسیا ----------
  {
    name: 'بنیامین نتانیاهو — ایکس (@netanyahu)', platform: 'twitter', identifier: 'netanyahu', url: 'https://x.com/netanyahu',
    language: 'en', region: 'اسرائیل', entityType: 'شخصیت',
    politicalOrientation: 'راست اسرائیل — نخست‌وزیر اسرائیل',
    trustNote: 'منبع اولیه مواضع رسمی دولت اسرائیل؛ ادعاهای جنگی/عددی راست‌آزمایی مستقل لازم دارد.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy', 'military'], topic: 'مواضع اسرائیل',
  },
  {
    name: 'یائیر لاپید — ایکس (@yairlapid)', platform: 'twitter', identifier: 'yairlapid', url: 'https://x.com/yairlapid',
    language: 'en', region: 'اسرائیل', entityType: 'شخصیت',
    politicalOrientation: 'میانه اسرائیل — نخست‌وزیر پیشین و رهبر اپوزیسیون',
    trustNote: 'رهبر اپوزیسیون اسرائیل؛ مواضع جریان میانه ضدنتانیاهو.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'اپوزیسیون اسرائیل',
  },
  {
    name: 'ایتامار بن گویر — ایکس (@ItamarBenGvir)', platform: 'twitter', identifier: 'ItamarBenGvir', url: 'https://x.com/ItamarBenGvir',
    language: 'en', region: 'اسرائیل', entityType: 'شخصیت',
    politicalOrientation: 'راست افراطی اسرائیل — وزیر امنیت ملی پیشین',
    trustNote: 'چهره شاخص راست افراطی اسرائیل؛ اظهارات پرتنش درباره فلسطین؛ اظهارنظر فردی/حزبی است.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'راست اسرائیل',
  },
  {
    name: 'بنی گانتز — ایکس (@gantzbe)', platform: 'twitter', identifier: 'gantzbe', url: 'https://x.com/gantzbe',
    language: 'en', region: 'اسرائیل', entityType: 'شخصیت',
    politicalOrientation: 'میانه اسرائیل — وزیر دفاع پیشین و رئیس حزب دولتی ملی',
    trustNote: 'چهره نظامی-سیاسی میانه اسرائیل؛ مواضع محفلی امنیتی.',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy', 'military'], topic: 'میانه اسرائیل',
  },
  {
    name: 'رجب طیب اردوغان — ایکس (@RTErdogan)', platform: 'twitter', identifier: 'RTErdogan', url: 'https://x.com/RTErdogan',
    language: 'tr', region: 'ترکیه', entityType: 'شخصیت',
    politicalOrientation: 'محافظه‌کار ملی‌گرا — رئیس‌جمهور ترکیه',
    trustNote: 'حساب رسمی اردوغان؛ مواضع رسمی آنکارا در خاورمیانه (حمایت از اخوان/حماس، روابط با روسیه).',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'], topic: 'مواضع ترکیه',
  },
  {
    name: 'نرندرا مودی — ایکس (@narendramodi)', platform: 'twitter', identifier: 'narendramodi', url: 'https://x.com/narendramodi',
    language: 'en', region: 'هند', entityType: 'شخصیت',
    politicalOrientation: 'ناسیونالیست هندو (BJP) — نخست‌وزیر هند',
    trustNote: 'حساب رسمی مودی؛ مواضع رسمی دهلی‌نو؛ بسیار پرفعال (بیش از ۱۰۰ میلیون فالوور).',
    notes: TW_LIMITS, fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy', 'economy'], topic: 'مواضع هند',
  },
];
