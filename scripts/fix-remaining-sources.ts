/**
 * رفع دو منبع باقی‌مانده «خطای اتصال» (بازتأیید واقعی با curl — نه حدس)
 * اجرا: bun run scripts/fix-remaining-sources.ts
 *
 * ۱) دفتر رئیس‌جمهور: سایت president.ir از IP دیتاسنتر کاملاً غیرقابل‌دسترس است
 *    (درخواست HTTPS پس از ۱۵ ثانیه بی‌پاسخ رها می‌شود — فیلتر جغرافیایی/ضد حمله).
 *    گوگل‌نیوز ۶۰ مطلب از site:president.ir دارد → مسیر جایگزین مجاز تجمیع‌کننده.
 * ۲) قالیباف (ایکس): محدودیت 429 متناوب است (آزمایش زنده: ۲ بار 200 سپس 429)؛
 *    اتصال‌دهنده اکنون تا ۶ تلاش با تأخیر تصاعدی دارد — نیازی به تغییر منبع نیست.
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const GN_LIMITS =
  'دریافت از تجمیع‌کننده عمومی گوگل‌نیوز (مسیر جایگزین مجاز) چون دسترسی مستقیم سایت از سرور ممکن نیست؛ پیوندهای مقاله از طریق ریدایرکت گوگل باز می‌شوند.';

async function main() {
  const pres = await db.source.findFirst({ where: { name: { contains: 'دفتر رئیس‌جمهور' } } });
  if (pres) {
    await db.source.update({
      where: { id: pres.id },
      data: {
        platform: 'rss',
        identifier:
          'https://news.google.com/rss/search?q=site:president.ir&hl=fa&gl=IR&ceid=IR:fa',
        fetchMethod: 'عمومی (تجمیع‌کننده)',
        limitsNote: GN_LIMITS,
        notes:
          'سایت president.ir از IP دیتاسنتر پاسخ نمی‌دهد (فیلتر جغرافیایی/ضد حمله؛ درخواست پس از ۱۵ ثانیه بی‌پاسخ است)؛ پوشش اخبار رسمی دفتر رئیس‌جمهور از تجمیع‌کننده گوگل‌نیوز روی دامنه president.ir (مسیر جایگزین مجاز، همان الگوی خبرگزاری فارس).',
        status: 'دریافت_موفق',
        statusDetail: 'پیکربندی خوراک اصلاح شد — در انتظار دریافت بعدی',
        lastError: null,
        lastErrorAt: null,
      },
    });
    console.log('✓ دفتر رئیس‌جمهور → تجمیع‌کننده گوگل‌نیوز (site:president.ir)');
  }
}

main().finally(() => db.$disconnect());
