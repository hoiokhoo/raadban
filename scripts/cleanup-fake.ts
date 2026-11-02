/**
 * پاک‌سازی داده فیک/نمونه/آزمون — بند ۶ مشخصات
 * حذف:
 *  ۱) پست‌های آزمون بدون منبع (متن حاوی «آزمون یکپارچگی» یا «بازارسنجی-»)
 *  ۲) دسته خراب fvvc (نام «باا») و گزارش وابسته به آن
 *  ۳) رویدادهای بدون هیچ پیوند پست (بی‌فرزند)
 *  ۴) اصلاح وضعیت منابع ایکس از «پشتیبانی‌نشده» به «غیرفعال» (اتصال‌دهنده واقعی پیاده‌سازی شده — دریافت مجدد لازم است)
 * خروجی: گزارش شمارشی دقیق. هیچ حذف فراتر از محدوده تعریف‌شده انجام نمی‌شود.
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const report: Record<string, number | string[]> = {};

async function main() {
  // ۱) پست‌های آزمون فیک (بدون منبع + الگوی آزمون)
  const fakePosts = await db.post.findMany({
    where: {
      sourceId: null,
      OR: [
        { content: { contains: 'آزمون یکپارچگی' } },
        { content: { contains: 'بازارسنجی-' } },
        { metadata: { contains: 'test-fixture' } },
      ],
    },
    select: { id: true, content: true },
  });
  report['پست_آزمون_شناسایی_شده'] = fakePosts.length;
  if (fakePosts.length) {
    const ids = fakePosts.map((p) => p.id);
    // پاک‌سازی وابستگی‌ها (Claim → postId SetNull می‌شود؛ رویداد بی‌فرزند در گام ۳ حذف می‌شود)
    await db.post.deleteMany({ where: { id: { in: ids } } });
    report['پست_آزمون_حذف_شده'] = ids.length;
    report['نمونه_محتوای_حذف_شده'] = fakePosts.slice(0, 3).map((p) => p.content.slice(0, 60).replace(/\n/g, ' '));
  }

  // ۲) دسته خراب fvvc
  const fvvc = await db.category.findUnique({ where: { slug: 'fvvc' } });
  if (fvvc) {
    const repCount = await db.dailyReport.count({ where: { categoryId: fvvc.id } });
    await db.category.delete({ where: { id: fvvc.id } }); // روابط Cascade هستند
    report['دسته_خراب_حذف_شده'] = `fvvc («${fvvc.name}») + ${repCount} گزارش وابسته`;
  } else {
    report['دسته_خراب_حذف_شده'] = 'یافت نشد (قبلاً حذف شده)';
  }

  // ۳) رویدادهای بی‌فرزند
  const linked = await db.eventPost.groupBy({ by: ['eventId'] });
  const linkedIds = new Set(linked.map((l) => l.eventId));
  const allEvents = await db.event.findMany({ select: { id: true } });
  const orphanIds = allEvents.filter((e) => !linkedIds.has(e.id)).map((e) => e.id);
  // رویداد بی‌فرزند با ادعای پیوندخورده؟ ادعاهای رویداد بی‌فرزند را بی‌رویداد می‌کنیم نه حذف
  if (orphanIds.length) {
    const claimCount = await db.claim.count({ where: { eventId: { in: orphanIds } } });
    await db.claim.updateMany({ where: { eventId: { in: orphanIds } }, data: { eventId: null } });
    await db.event.deleteMany({ where: { id: { in: orphanIds } } });
    report['رویداد_بی_فرزند_حذف_شده'] = orphanIds.length;
    report['ادعای_رویداد_بی_فرزند_نگهداری_شده'] = claimCount;
  } else {
    report['رویداد_بی_فرزند_حذف_شده'] = 0;
  }

  // ۴) اصلاح وضعیت منابع ایکس
  const twFixed = await db.source.updateMany({
    where: { platform: 'twitter', status: 'پشتیبانی‌نشده' },
    data: { status: 'غیرفعال', statusDetail: 'اتصال‌دهنده ایکس پیاده‌سازی شده — در انتظار دریافت مجدد دوره‌ای', lastError: null, lastErrorAt: null },
  });
  report['منبع_ایکس_اصلاح_وضعیت'] = twFixed.count;

  // خلاصه نهایی پس از پاک‌سازی
  const posts = await db.post.count();
  const events = await db.event.count();
  const claims = await db.claim.count();
  const cats = await db.category.count();
  report['_شمارش_پس_از_پاکسازی'] = `پست:${posts} رویداد:${events} ادعا:${claims} دسته:${cats}`;
  console.log(JSON.stringify(report, null, 2));
}

main().finally(() => db.$disconnect());
