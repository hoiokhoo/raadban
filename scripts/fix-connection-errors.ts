/**
 * رفع منابع با «خطای اتصال» — بازتأیید واقعی هر آدرس با curl (مهر ۱۴۰۵)
 * اجرا: bun run scripts/fix-connection-errors.ts
 *
 * علت ریشه‌ای هر خطا (آزمایش مستقیم HTTP، نه حدس):
 *  ۱) فارس: سایت جدید (از بهمن ۱۴۰۲) خوراک RSS ندارد؛ /rss از آن زمان 404 است.
 *  ۲) یوجی‌سی: آدرس /rss وجود ندارد (404)؛ خوراک عمومی درست: /fa/rss/2
 *  ۳) صداوسیما: آدرس /rss وجود ندارد (404)؛ خوراک درست: /fa/rss/allnews
 *  ۴) تجارت‌نیوز: گوگل‌نیوز برای site:tejaratnews.com صفر نتیجه می‌دهد (اندیس ضعیف)؛
 *     خوراک مستقیم وردپرس /feed سالم است (۱۰۰ مطلب).
 *  ۵) المسیره: دامنه قدیمی almasirah.net عملاً مرده است (پاسخ ۲۸ بایتی)؛
 *     دامنه جدید masirahtv.net دسترسی دیتاسنتر را با چالش Cloudflare می‌بندد (403)؛
 *     پرس‌وجوی ترکیبی گوگل‌نیوز (almasirah.net OR masirahtv.net) سالم است.
 *  ۶) NOW14: پنجره when:7d صفر نتیجه می‌دهد؛ بدون محدودیت زمانی ۱۰۰ نتیجه.
 *  ۷) فرانس۲۴ فارسی: فرانس ۲۴ اصلاً نسخه فارسی ندارد (فقط FR/EN/AR/ES)؛
 *     جایگزین صادقانه: سرویس فارسی RFI از همان گروه فرانسه‌مدیاس (خوراک رسمی).
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const GN_LIMITS =
  'دریافت از تجمیع‌کننده عمومی گوگل‌نیوز (مسیر جایگزین مجاز) چون خوراک مستقیم سایت در دسترس نیست؛ پیوندهای مقاله از طریق ریدایرکت گوگل باز می‌شوند.';

async function main() {
  // ۱) خبرگزاری فارس — RSS رسمی حذف شده → تجمیع‌کننده گوگل‌نیوز (۷۳ مطلب در آزمایش)
  const fars = await db.source.findFirst({ where: { name: { contains: 'خبرگزاری فارس' } } });
  if (fars) {
    await db.source.update({
      where: { id: fars.id },
      data: {
        identifier: 'https://news.google.com/rss/search?q=site:farsnews.ir&hl=fa&gl=IR&ceid=IR:fa',
        fetchMethod: 'عمومی (تجمیع‌کننده)',
        limitsNote: GN_LIMITS,
        notes:
          'سایت جدید فارس از بهمن ۱۴۰۲ خوراک RSS ندارد (آدرس /rss پیوسته 404 می‌دهد)؛ دریافت از تجمیع‌کننده گوگل‌نیوز به‌عنوان مسیر جایگزین مجاز.',
        status: 'دریافت_موفق',
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
        lastError: null,
        lastErrorAt: null,
      },
    });
    console.log('✓ خبرگزاری فارس → تجمیع‌کننده گوگل‌نیوز');
  }

  // ۲) باشگاه خبرنگاران جوان — آدرس درست /fa/rss/2 (۲۰ مطلب در آزمایش)
  const yjc = await db.source.findFirst({ where: { name: { contains: 'باشگاه خبرنگاران جوان' } } });
  if (yjc) {
    await db.source.update({
      where: { id: yjc.id },
      data: {
        identifier: 'https://www.yjc.ir/fa/rss/2',
        notes:
          'آدرس درست خوراک عمومی «آخرین اخبار ایران و جهان» YJC: /fa/rss/2؛ آدرس /rss وجود ندارد (404).',
        status: 'دریافت_موفق',
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
        lastError: null,
        lastErrorAt: null,
      },
    });
    console.log('✓ یوجی‌سی → yjc.ir/fa/rss/2');
  }

  // ۳) خبرگزاری صدا و سیما — آدرس درست /fa/rss/allnews (۱۰۰ مطلب در آزمایش)
  const irib = await db.source.findFirst({ where: { name: { contains: 'صدا و سیما' } } });
  if (irib) {
    await db.source.update({
      where: { id: irib.id },
      data: {
        identifier: 'https://www.iribnews.ir/fa/rss/allnews',
        notes:
          'آدرس درست خوراک «همه اخبار» صداوسیما: /fa/rss/allnews؛ آدرس /rss وجود ندارد (404).',
        status: 'دریافت_موفق',
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
        lastError: null,
        lastErrorAt: null,
      },
    });
    console.log('✓ صداوسیما → iribnews.ir/fa/rss/allnews');
  }

  // ۴) تجارت‌نیوز — خوراک مستقیم وردپرس /feed (۱۰۰ مطلب در آزمایش)
  const tejarat = await db.source.findFirst({ where: { name: { contains: 'تجارت نیوز' } } });
  if (tejarat) {
    await db.source.update({
      where: { id: tejarat.id },
      data: {
        identifier: 'https://tejaratnews.com/feed',
        fetchMethod: 'عمومی',
        limitsNote: null,
        notes:
          'خوراک مستقیم وردپرس تجارت‌نیوز؛ پرس‌وجوی گوگل‌نیوز برای site:tejaratnews.com صفر نتیجه می‌دهد (اندیس ضعیف) و کنار گذاشته شد.',
        status: 'دریافت_موفق',
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
        lastError: null,
        lastErrorAt: null,
      },
    });
    console.log('✓ تجارت‌نیوز → tejaratnews.com/feed');
  }

  // ۵) المسیره — پرس‌وجوی ترکیبی دو دامنه (۱۰۰ مطلب در آزمایش)
  const masirah = await db.source.findFirst({ where: { name: { contains: 'المسیره' } } });
  if (masirah) {
    await db.source.update({
      where: { id: masirah.id },
      data: {
        identifier:
          'https://news.google.com/rss/search?q=site:almasirah.net+OR+site:masirahtv.net&hl=ar&gl=YE&ceid=YE:ar',
        limitsNote: GN_LIMITS,
        notes:
          'دامنه قدیمی almasirah.net عملاً از کار افتاده (پاسخ ۲۸ بایتی)؛ دامنه فعلی masirahtv.net دسترسی دیتاسنتر را با چالش Cloudflare می‌بندد؛ پوشش از پرس‌وجوی ترکیبی تجمیع‌کننده گوگل‌نیوز.',
        status: 'دریافت_موفق',
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
        lastError: null,
        lastErrorAt: null,
      },
    });
    console.log('✓ المسیره → پرس‌وجوی ترکیبی almasirah.net OR masirahtv.net');
  }

  // ۶) شبکه ۱۴ اسرائیل (NOW14) — حذف when:7d (در آزمایش: ۰ نتیجه → ۱۰۰ نتیجه)
  const now14 = await db.source.findFirst({ where: { name: { contains: 'NOW14' } } });
  if (now14) {
    await db.source.update({
      where: { id: now14.id },
      data: {
        identifier: 'https://news.google.com/rss/search?q=site:now14.co.il&hl=he&gl=IL&ceid=IL:he',
        notes:
          'پنجره زمانی when:7d در گوگل‌نیوز برای این دامنه صفر نتیجه می‌داد؛ پرس‌وجوی بدون محدودیت زمانی تنظیم شد.',
        status: 'دریافت_موفق',
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
        lastError: null,
        lastErrorAt: null,
      },
    });
    console.log('✓ NOW14 → پرس‌وجوی بدون محدودیت when');
  }

  // ۷) فرانس ۲۴ فارسی → RFI فارسی (فرانس ۲۴ نسخه فارسی ندارد — صادقانه جایگزین شد)
  const f24 = await db.source.findFirst({ where: { name: { contains: 'فرانس ۲۴' } } });
  if (f24) {
    await db.source.update({
      where: { id: f24.id },
      data: {
        name: 'رادیو فرانس اینترناسیونال فارسی (RFI فارسی)',
        url: 'https://www.rfi.fr/fa/',
        identifier: 'https://www.rfi.fr/fa/rss',
        fetchMethod: 'عمومی',
        limitsNote: null,
        notes:
          'فرانس ۲۴ هیچ نسخه فارسی ندارد (فقط فرانسوی/انگلیسی/عربی/اسپانیایی) و آدرس قبلی /fa/rss هرگز وجود نداشت؛ به سرویس فارسی رسمی RFI از همان گروه دولتی فرانسه‌مدیاس جایگزین شد تا پوشش رسانه فرانسوی به فارسی حفظ شود.',
        status: 'دریافت_موفق',
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
        lastError: null,
        lastErrorAt: null,
      },
    });
    console.log('✓ فرانس ۲۴ فارسی → RFI فارسی (خوراک رسمی /fa/rss)');
  }
}

main().finally(() => db.$disconnect());
