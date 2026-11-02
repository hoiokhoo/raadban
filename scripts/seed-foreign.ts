/**
 * Seed منابع خارجی و شخصیت‌های اثرگذار — اجرا: bun run scripts/seed-foreign.ts
 * اصل: «گرایش سیاسی ثبت‌شده» توصیف مستند و شناخته‌شده رسانه‌هاست (همچون مراجع سوگیری رسانه)
 * و برای پوشش متوازن ثبت می‌شود؛ قضاوت درباره خبرها همچنان با راستی‌آزمایی چندمنبعی انجام می‌شود.
 * مسیرهای جایگزین (گوگل‌نیوز/بایگانی عمومی) صریحاً در notes و limitsNote اعلام می‌شوند.
 * هیچ نام یا آمار ساختگی تولید نمی‌شود؛ منابعی که از این سرور مسدودند با وضعیت خطای صادقانه اضافه می‌شوند.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

interface ForeignSource {
  name: string; platform: string; identifier: string; url: string;
  language: string; trustNote: string; notes?: string; limitsNote?: string;
  fetchMethod?: string; fetchIntervalMin?: number; maxItemsPerFetch?: number;
  categories: string[]; topic?: string;
}

const GB_GOOGLE = (site: string, when: string, hl: string, gl: string, ceid: string) =>
  `https://news.google.com/rss/search?q=site:${site}+when:${when}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

const GN_LIMITS = 'دریافت از تجمیع‌کننده عمومی گوگل‌نیوز (مسیر جایگزین مجاز) چون دسترسی مستقیم مسدود است؛ پیوندهای مقاله از طریق ریدایرکت گوگل باز می‌شوند؛ پوشش تابع فهرست گوگل‌نیوز است.';

const SOURCES: ForeignSource[] = [
  // ---------- خبرگزاری‌ها و رسانه‌های خارجی ----------
  {
    name: 'بی‌بی‌سی — بین‌الملل (BBC World)', platform: 'rss',
    identifier: 'https://feeds.bbci.co.uk/news/world/rss.xml', url: 'https://www.bbc.com/news/world',
    language: 'en', topic: 'سیاست بین‌الملل',
    trustNote: 'گرایش سیاسی ثبت‌شده: مرکز — رسانه عمومی بریتانیا با تأمین مالی از محل مجوز دولتی؛ استقلال تحریریه قانوناً تضمین شده اما از هر دو جناح بریتانیا و دولت‌ها انتقاد پوششی شده است.',
    notes: 'ادعاهای سیاسی این رسانه باید با منابع با گرایش متفاوت مقایسه شود.', fetchMethod: 'عمومی',
    categories: ['foreign-policy'],
  },
  {
    name: 'بی‌بی‌سی فارسی', platform: 'rss',
    identifier: 'https://feeds.bbci.co.uk/persian/rss.xml', url: 'https://www.bbc.com/persian',
    language: 'fa', topic: 'ایران و جهان',
    trustNote: 'گرایش ثبت‌شده: مرکز با چارچوب رسانه‌ای بریتانیا — سرویس فارسی بی‌بی‌سی؛ منتقد حاکمیت ایران؛ پوشش‌ها از دید حقوق بشر نیز ارزیابی می‌شود.',
    notes: 'برای پوشش متوازن با منابع داخلی و بین‌المللی دیگر مقایسه شود.', fetchMethod: 'عمومی',
    categories: ['foreign-policy'],
  },
  {
    name: 'سی‌ان‌ان (CNN World)', platform: 'rss',
    identifier: 'http://rss.cnn.com/rss/edition_world.rss', url: 'https://edition.cnn.com/world',
    language: 'en', topic: 'سیاست بین‌الملل',
    trustNote: 'گرایش سیاسی ثبت‌شده: میانه‌چپ/لیبرال — رسانه آمریکا؛ طبق ارزیابی مراجع سوگیری رسانه، پوشش‌های سیاسی‌اش تمایل به دموکرات‌ها دارد.',
    notes: 'برای پوشش متوازن با فاکس‌نیوز و رویترز مقایسه شود.', fetchMethod: 'عمومی',
    categories: ['foreign-policy'],
  },
  {
    name: 'فاکس‌نیوز (Fox News World)', platform: 'rss',
    identifier: 'https://feeds.foxnews.com/foxnews/world', url: 'https://www.foxnews.com/world',
    language: 'en', topic: 'سیاست بین‌الملل',
    trustNote: 'گرایش سیاسی ثبت‌شده: محافظه‌کار/راست — رسانه آمریکا؛ نزدیک به جمهوری‌خواهان؛ بخش خبری و برنامه‌های نظری تفاوت قابل توجهی دارند.',
    notes: 'برای پوشش متوازن با CNN و MSNBC مقایسه شود.', fetchMethod: 'عمومی',
    categories: ['foreign-policy'],
  },
  {
    name: 'ام‌اس‌ان‌بی‌سی (MSNBC — مسیر جایگزین)', platform: 'rss',
    identifier: GB_GOOGLE('msnbc.com', '7d', 'en', 'US', 'US:en'), url: 'https://www.msnbc.com',
    language: 'en', topic: 'سیاست آمریکا',
    trustNote: 'گرایش سیاسی ثبت‌شده: لیبرال/میانه‌چپ — ترکیب خبر و اظهارنظر با سهم بالای برنامه‌های نظری نزدیک به دموکرات‌ها (گروه NBCUniversal).',
    notes: 'خوراک رسمی MSNBC بازنشسته شده است؛ ' + GN_LIMITS, limitsNote: GN_LIMITS, fetchMethod: 'عمومی (تجمیع‌کننده)',
    categories: ['foreign-policy'],
  },
  {
    name: 'رویترز (Reuters — مسیر جایگزین)', platform: 'rss',
    identifier: GB_GOOGLE('reuters.com', '1d', 'en', 'US', 'US:en'), url: 'https://www.reuters.com',
    language: 'en', topic: 'سیاست و اقتصاد بین‌الملل',
    trustNote: 'گرایش ثبت‌شده: مرکز — بزرگ‌ترین آژانس بین‌المللی با رویه منبع‌محوری نسبتاً استاندارد؛ دسترسی مستقیم RSS از سال‌های پیش تعطیل شده است.',
    notes: GN_LIMITS, limitsNote: GN_LIMITS, fetchMethod: 'عمومی (تجمیع‌کننده)',
    categories: ['foreign-policy', 'economy'],
  },
  {
    name: 'الجزیره انگلیسی (Al Jazeera English)', platform: 'rss',
    identifier: 'https://www.aljazeera.com/xml/rss/all.xml', url: 'https://www.aljazeera.com',
    language: 'en', topic: 'خاورمیانه',
    trustNote: 'گرایش ثبت‌شده: هم‌راستا با حاکمیت قطر (مالکیت دولتی قطر)؛ در پوشش خاورمیانه منتقد سیاست‌های آمریکا و اسرائیل؛ نسخه عربی و انگلیسی گاه پوشش متفاوتی دارند.',
    notes: 'برای پوشش متوازن با العربیه و رسانه‌های اسرائیلی مقایسه شود.', fetchMethod: 'عمومی',
    categories: ['foreign-policy'],
  },
  {
    name: 'الجزیره عربی (الجزيرة نت)', platform: 'rss',
    identifier: 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b1f0-c3e0a0a1e579',
    url: 'https://www.aljazeera.net', language: 'ar', topic: 'خاورمیانه',
    trustNote: 'گرایش ثبت‌شده: هم‌راستا با حاکمیت قطر — نسخه عربی الجزیره؛ پوشش جنبش‌های مقاومت و مخالفان نظام‌های عربی.',
    fetchMethod: 'عمومی', categories: ['foreign-policy'],
  },
  {
    name: 'العربیه (Al Arabiya — مسیر جایگزین)', platform: 'rss',
    identifier: GB_GOOGLE('alarabiya.net', '1d', 'ar', 'SA', 'SA:ar'), url: 'https://www.alarabiya.net',
    language: 'ar', topic: 'خاورمیانه',
    trustNote: 'گرایش ثبت‌شده: هم‌راستا با حاکمیت عربستان سعودی (متعلق به گروه MBC)؛ در تقابل رسانه‌ای با قطر و محور مقاومت.',
    notes: `${GN_LIMITS} — سایت اصلی ال‌عربیه درخواست‌های این سرور را مسدود کرده (403).`,
    limitsNote: GN_LIMITS, fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'],
  },
  {
    name: 'اسکای‌نیوز (Sky News World)', platform: 'rss',
    identifier: 'https://feeds.skynews.com/feeds/rss/world.xml', url: 'https://news.sky.com/world',
    language: 'en', topic: 'سیاست بین‌الملل',
    trustNote: 'گرایش ثبت‌شده: مرکز — رسانه بریتانیایی متعلق به گروه کامکست؛ پوشش خبری نسبتاً متوازن با چارچوب بریتانیایی.',
    fetchMethod: 'عمومی', categories: ['foreign-policy'],
  },
  {
    name: 'المیادین (Al Mayadeen — مسیر جایگزین)', platform: 'rss',
    identifier: GB_GOOGLE('almayadeen.net', '2d', 'ar', 'LB', 'LB:ar'), url: 'https://www.almayadeen.net',
    language: 'ar', topic: 'خاورمیانه',
    trustNote: 'گرایش ثبت‌شده: هم‌سو با محور مقاومت — شبکه عرب‌زبان مستقر در بیروت با نزدیکی به جریان مقاومت.',
    notes: `${GN_LIMITS} — سایت اصلی المیادین درخواست‌های این سرور را مسدود کرده (403).`,
    limitsNote: GN_LIMITS, fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'],
  },
  {
    name: 'المسیره (Al Masirah — مسیر جایگزین)', platform: 'rss',
    identifier: GB_GOOGLE('almasirah.net', '30d', 'ar', 'YE', 'YE:ar'), url: 'https://almasirah.net',
    language: 'ar', topic: 'یمن',
    trustNote: 'گرایش ثبت‌شده: وابسته به انصارالله (حوثی‌ها) یمن — شبکه رسمی‌گرای این جریان؛ بیانیه‌ها و آمار آن را مستقلی تأیید نکرده است.',
    notes: `${GN_LIMITS} — سایت اصلی المسیره درخواست‌های این سرور را مسدود کرده (403).`,
    limitsNote: GN_LIMITS, fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'],
  },
  {
    name: 'شبکه ۱۲ اسرائیل (کانال ۱۲ — مسیر جایگزین)', platform: 'rss',
    identifier: GB_GOOGLE('mako.co.il', '7d', 'he', 'IL', 'IL:he'), url: 'https://www.mako.co.il/news',
    language: 'he', topic: 'اسرائیل',
    trustNote: 'گرایش ثبت‌شده: رسانه اصلی و پرتیراژ اسرائیل — چارچوب امنیت ملی اسرائیل در پوشش‌ها مشهود است اما نسبت به حزب حاکم وابستگی سازمانی ندارد.',
    notes: `${GN_LIMITS} — سایت اصلی (ماکو) درخواست‌های این سرور را مسدود کرده (403). محتوا عبری است و در گزارش به فارسی ترجمه خلاصه می‌شود.`,
    limitsNote: GN_LIMITS, fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'],
  },
  {
    name: 'شبکه ۱۴ اسرائیل (NOW14 — مسیر جایگزین)', platform: 'rss',
    identifier: GB_GOOGLE('now14.co.il', '7d', 'he', 'IL', 'IL:he'), url: 'https://www.now14.co.il',
    language: 'he', topic: 'اسرائیل',
    trustNote: 'گرایش ثبت‌شده: راست اسرائیل و نزدیک به نتانیاهو — پوشش منتقدانه از اپوزیسیون و رسانه‌های رقیب؛ ادعاهای آن با منابع مستقل اسرائیلی مقایسه شود.',
    notes: `${GN_LIMITS} — سایت اصلی درخواست‌های این سرور را مسدود کرده (403). محتوا عبری است.`,
    limitsNote: GN_LIMITS, fetchMethod: 'عمومی (تجمیع‌کننده)', categories: ['foreign-policy'],
  },
  {
    name: 'اخبار ملی اسرائیل (Israel National News — جایگزین قابل‌دسترس)', platform: 'rss',
    identifier: GB_GOOGLE('israelnationalnews.com', '1d', 'en', 'US', 'US:en'), url: 'https://www.israelnationalnews.com',
    language: 'en', topic: 'اسرائیل',
    trustNote: 'گرایش ثبت‌شده: راست اسرائیل (آروتز شووا) — به‌عنوان منبع اسرائیلی قابل‌دسترس از این سرور اضافه شد؛ ادعاهای آن با منابع دیگر مقایسه شود.',
    notes: 'سایت‌های کانال ۱۲ و ۱۴ از این سرور مسدودند؛ مسیر RSS رسمی این سایت نیز صفحه HTML برمی‌گرداند؛ ' + GN_LIMITS, limitsNote: GN_LIMITS, fetchMethod: 'عمومی (تجمیع‌کننده)',
    categories: ['foreign-policy'],
  },

  // ---------- شخصیت‌های اثرگذار (منبع اولیه مواضع — اثبات ادعا نیست) ----------
  {
    name: 'دفتر مقام معظم رهبری (leader.ir)', platform: 'rss',
    identifier: 'https://www.leader.ir/fa/rss', url: 'https://www.leader.ir/fa',
    language: 'fa', topic: 'مواضع رسمی ایران',
    trustNote: 'منبع اولیه رسمی — بیانیه‌ها و مواضع رسمی رهبر جمهوری اسلامی ایران؛ نقل‌قول‌های ثالث از ایشان باید با متن رسمی اینجا مقایسه شود.',
    fetchMethod: 'عمومی', fetchIntervalMin: 90, categories: ['foreign-policy'],
  },
  {
    name: 'دفتر رئیس‌جمهور — پزشکیان (president.ir)', platform: 'web',
    identifier: 'https://president.ir/fa', url: 'https://president.ir/fa',
    language: 'fa', topic: 'مواضع رسمی ایران',
    trustNote: 'منبع اولیه رسمی مواضع رئیس‌جمهور ایران (مسعود پزشکیان).',
    notes: 'سایت president.ir از این سرور در دسترس نیست (پاسخ ندادن شبکه)؛ خطا صادقانه نمایش داده می‌شود و پوشش مواضع ایشان فعلاً از خبرگزاری مهر و تسنیم (منابع فعلی سامانه) تأمین می‌شود.',
    fetchMethod: 'عمومی', fetchIntervalMin: 180, categories: ['foreign-policy'],
  },
  {
    name: 'دونالد ترامپ — تروث سوشال (بایگانی عمومی)', platform: 'rss',
    identifier: 'https://www.trumpstruth.org/feed', url: 'https://www.trumpstruth.org',
    language: 'en', topic: 'مواضع رئیس‌جمهور آمریکا',
    trustNote: 'بایگانی عمومی پست‌های تروث سوشال دونالد ترامپ (رئیس‌جمهور آمریکا) — مسیر جایگزین مجاز چون API رسمی تروث سوشال درخواست این سرور را مسدود کرده؛ منبع اولیه برای مواضع شخصی اوست و صحت ادعاهای مطرح‌شده در پست‌ها راستی‌آزمایی مستقل لازم دارد.',
    notes: 'ادعاهای عددی/رویدادی این حساب در موتور راستی‌آزمایی سامانه به‌طور خودکار وضعیت‌سنجی می‌شوند.', fetchMethod: 'عمومی (بایگانی)',
    fetchIntervalMin: 90, categories: ['foreign-policy', 'economy'],
  },
  {
    name: 'دونالد ترامپ — ایکس (@realDonaldTrump)', platform: 'twitter',
    identifier: 'realDonaldTrump', url: 'https://x.com/realDonaldTrump',
    language: 'en', topic: 'مواضع رئیس‌جمهور آمریکا',
    trustNote: 'منبع اولیه مواضع شخصی ترامپ در ایکس — اغراق و ابهام در پست‌های او شایع است؛ هر ادعا جداگانه راستی‌آزمایی می‌شود. ممکن است ایکس محدودیت نرخ IP اعمال کند.',
    fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 120, categories: ['foreign-policy', 'economy'],
  },
  {
    name: 'ایلان ماسک — ایکس (@elonmusk)', platform: 'twitter',
    identifier: 'elonmusk', url: 'https://x.com/elonmusk',
    language: 'en', topic: 'فناوری و سیاست',
    trustNote: 'حساب با حجم پست بسیار بالا — اظهارنظر فردی است، نه اعلام رسمی شرکت‌ها؛ ادعاهای فنی/مالی جداگانه راستی‌آزمایی می‌شود.',
    fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 120, categories: ['tech', 'foreign-policy'],
  },
  {
    name: 'باراک اوباما — ایکس (@BarackObama)', platform: 'twitter',
    identifier: 'BarackObama', url: 'https://x.com/BarackObama',
    language: 'en', topic: 'سیاست آمریکا',
    trustNote: 'حساب رسمی رئیس‌جمهور پیشین آمریکا — کم‌فعال و اغلب بیانیه‌های تیمی؛ برای پوشش نگاه دموکرات‌ها.',
    fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 240, categories: ['foreign-policy'],
  },
  {
    name: 'بنیامین نتانیاهو — ایکس (@netanyahu)', platform: 'twitter',
    identifier: 'netanyahu', url: 'https://x.com/netanyahu',
    language: 'en', topic: 'مواضع اسرائیل',
    trustNote: 'مواضع رسمی نخست‌وزیر اسرائیل — منبع اولیه برای مواضع دولت اسرائیل؛ ادعاهای جنگی/عددی آن راست‌آزمایی مستقل لازم دارد.',
    fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 120, categories: ['foreign-policy'],
  },
  {
    name: 'رضا پهلوی — ایکس (@PahlaviReza)', platform: 'twitter',
    identifier: 'PahlaviReza', url: 'https://x.com/PahlaviReza',
    language: 'fa', topic: 'اپوزیسیون ایران',
    trustNote: 'چهره اپوزیسیون خارج از کشور — مواضع سیاسی شخصی؛ ادعاهای مطرح‌شده (پیوندها، آمار، وعده‌ها) راستی‌آزمایی مستقل لازم دارد.',
    fetchMethod: 'عمومی (سندیکاسیون)', fetchIntervalMin: 120, categories: ['foreign-policy'],
  },
];

async function main() {
  console.log('=== افزودن منابع خارجی و شخصیت‌های اثرگذار ===');
  let created = 0, updated = 0;

  for (const s of SOURCES) {
    const existing = await db.source.findUnique({
      where: { platform_identifier: { platform: s.platform, identifier: s.identifier } },
    });
    const cats = (await db.category.findMany({ where: { slug: { in: s.categories } } }))
      .map((c) => ({ categoryId: c.id }));

    if (existing) {
      await db.source.update({
        where: { id: existing.id },
        data: { trustNote: s.trustNote, notes: s.notes, limitsNote: s.limitsNote, url: s.url, topic: s.topic },
      });
      await db.sourceCategory.deleteMany({ where: { sourceId: existing.id } });
      if (cats.length) await db.sourceCategory.createMany({ data: cats.map((c) => ({ sourceId: existing.id, ...c })) });
      updated++;
      console.log(`↺ به‌روزرسانی شد: ${s.name}`);
    } else {
      const src = await db.source.create({
        data: {
          name: s.name, platform: s.platform, identifier: s.identifier, url: s.url,
          isActive: true, status: 'غیرفعال', statusDetail: 'در انتظار اولین دریافت',
          priority: 'عادی', language: s.language, region: 'جهانی', topic: s.topic,
          trustNote: s.trustNote, notes: s.notes, limitsNote: s.limitsNote,
          fetchIntervalMin: s.fetchIntervalMin ?? 60, maxItemsPerFetch: s.maxItemsPerFetch ?? 20,
          fetchMethod: s.fetchMethod ?? 'عمومی',
          ...(cats.length ? { categories: { create: cats.map((c) => ({ ...c })) } } : {}),
        },
      });
      created++;
      console.log(`✓ افزوده شد: ${s.name} [${s.platform}] → src:${src.id.slice(-6)}`);
    }
  }

  const total = await db.source.count();
  const byPlatform = await db.source.groupBy({ by: ['platform'], _count: true });
  console.log(`\nجمع: ${created} منبع جدید، ${updated} به‌روزرسانی — مجموع منابع: ${total}`);
  console.log(byPlatform.map((p) => `${p.platform}:${p._count}`).join(' | '));
  console.log('\nنکته: دریافت اولیه توسط زمان‌بند خودکار (تیک هر دقیقه) یا فراخوانی /api/sources/fetch انجام می‌شود.');
  console.log('منابع مسدود از این سرور (president.ir، حساب‌های ایکس در صورت 429) وضعیت خطای صادقانه خواهند داشت.');
}

main().finally(() => db.$disconnect());
