/**
 * ثبت منبع بایگانی عمومی تروث سوشال (trumpstruth.org/feed) — مسیر جایگزین مجاز.
 * واقعیت: API رسمی تروث‌سوشال از IP دیتاسنتر با Cloudflare 403 مسدود است؛
 * بایگانی عمومی پست‌های ترامپ خوراک RSS پایدار دارد و همین مسیر ورودی واقعی می‌دهد.
 * اجرا: bun scripts/add-truthsocial-archive.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const IDENT = 'https://www.trumpstruth.org/feed';

const existing = await db.source.findUnique({
  where: { platform_identifier: { platform: 'rss', identifier: IDENT } },
}).catch(() => null);

if (existing) {
  console.log('منبع از قبل ثبت شده است:', existing.id, existing.name);
  if (!existing.isActive) {
    await db.source.update({ where: { id: existing.id }, data: { isActive: true, status: 'فعال' } });
    console.log('→ فعال شد.');
  }
} else {
  const src = await db.source.create({
    data: {
      name: 'تروث سوشال — دونالد ترامپ (بایگانی عمومی)',
      platform: 'rss',
      identifier: IDENT,
      url: 'https://www.trumpstruth.org',
      isActive: true,
      status: 'فعال',
      statusDetail: 'بایگانی عمومی پست‌های تروث سوشال ترامپ؛ مسیر جایگزین مجاز چون API رسمی از IP دیتاسنتر با Cloudflare 403 مسدود است',
      priority: 'بالا',
      language: 'en',
      region: 'آمریکا',
      topic: 'سیاست خارجی آمریکا',
      entityType: 'شخصیت',
      politicalOrientation: null,
      trustNote: 'بایگانی مستقل که پست‌های عمومی حساب رسمی @realDonaldTrump را بازنشر می‌کند؛ پیوند اصل هر پست (truth:originalUrl) حفظ می‌شود',
      notes: 'ثبت‌شده در ۲ نوامبر ۲۰۲۶ بنا بر خواستهٔ کاربر برای ورودی تروث سوشال',
      fetchIntervalMin: 60,
      maxItemsPerFetch: 30,
      fetchMethod: 'عمومی',
      limitsNote: 'فقط حساب ترامپ در این بایگانی موجود است؛ سایر حساب‌های تروث‌سوشال از IP دیتاسنتر در دسترس نیستند (403)',
    },
  });
  console.log('منبع ساخته شد:', src.id, src.name);
}

await db.$disconnect();
