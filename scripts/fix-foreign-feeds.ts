/**
 * اصلاح منابع با مشکل خوراک + پاکسازی پست بی‌محتوا
 * اجرا: bun run scripts/fix-foreign-feeds.ts
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const GN = (site: string, when: string, hl: string, gl: string, ceid: string) =>
  `https://news.google.com/rss/search?q=site:${site}+when:${when}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

const GN_LIMITS = 'دریافت از تجمیع‌کننده عمومی گوگل‌نیوز (مسیر جایگزین مجاز) چون دسترسی مستقیم خوراک ممکن نیست؛ پیوندهای مقاله از طریق ریدایرکت گوگل باز می‌شوند.';

async function main() {
  // ۱) MSNBC — خوراک رسمی بازنشسته ("method not found") → تجمیع‌کننده گوگل‌نیوز
  const msnbc = await db.source.findFirst({ where: { name: { contains: 'ام‌اس‌ان‌بی‌سی' } } });
  if (msnbc) {
    await db.source.update({
      where: { id: msnbc.id },
      data: {
        identifier: GN('msnbc.com', '7d', 'en', 'US', 'US:en'),
        limitsNote: GN_LIMITS,
        notes: 'خوراک رسمی MSNBC بازنشسته شده است؛ دریافت از تجمیع‌کننده گوگل‌نیوز. گروه رسانه‌ای مادر: NBCUniversal.',
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
      },
    });
    console.log('✓ MSNBC → تجمیع‌کننده گوگل‌نیوز');
  }

  // ۲) Israel National News — مسیر /Rss صفحه HTML است → تجمیع‌کننده
  const inn = await db.source.findFirst({ where: { name: { contains: 'Israel National' } } });
  if (inn) {
    await db.source.update({
      where: { id: inn.id },
      data: {
        identifier: GN('israelnationalnews.com', '1d', 'en', 'US', 'US:en'),
        limitsNote: GN_LIMITS,
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
      },
    });
    console.log('✓ Israel National News → تجمیع‌کننده گوگل‌نیوز');
  }

  // ۳) المسیره — بازه جست‌وجوی طولانی‌تر (این رسانه در گوگل‌نیوز کم‌نمایه است)
  const masirah = await db.source.findFirst({ where: { name: { contains: 'المسیره' } } });
  if (masirah) {
    await db.source.update({
      where: { id: masirah.id },
      data: {
        identifier: GN('almasirah.net', '30d', 'ar', 'YE', 'YE:ar'),
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
      },
    });
    console.log('✓ المسیره → بازه ۳۰ روزه');
  }

  // ۴) حذف پست بی‌محتوای president.ir (اسنپ‌شات ناوبری) — اتصال‌دهنده وب اکنون جلوی این را می‌گیرد
  const pres = await db.source.findFirst({ where: { name: { contains: 'president.ir' } } });
  if (pres) {
    const del = await db.post.deleteMany({ where: { sourceId: pres.id } });
    await db.source.update({
      where: { id: pres.id },
      data: { status: 'غیرفعال', statusDetail: 'استخراج پایدار متن از این سایت ممکن نیست (صفحه جاوااسکریپتی/ناوبری) — پوشش مواضع رئیس‌جمهور از خبرگزاری مهر و تسنیم (منابع فعال سامانه) تأمین می‌شود؛ در صورت انتشار RSS رسمی، منبع فعال می‌شود.' },
    });
    console.log(`✓ president.ir: ${del.count} پست بی‌محتوا حذف و منبع غیرفعال شد (صادقانه)`);
  }

  // ۵) پست‌های تکراری درون‌خوراکی trumpstruth که در اولین دریافت ثبت شدند؟ — هش سراسری جلوی آن را می‌گیرد؛ بررسی:
  const trump = await db.source.findFirst({ where: { name: { contains: 'تروث سوشال' } } });
  if (trump) {
    const c = await db.post.count({ where: { sourceId: trump.id } });
    console.log(`ℹ پست‌های فعلی تروث سوشال ترامپ: ${c}`);
  }
}

main().finally(() => db.$disconnect());
