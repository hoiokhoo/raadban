/**
 * خطاها و وضعیت سرویس‌ها — فصل ۱۲: گزارش خطاها و وضعیت سرویس‌ها
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';

export async function GET() {
  try {
    const failedJobs = await db.jobRun.findMany({
      where: { status: { in: ['ناموفق', 'ناقص'] } },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });
    const running = await db.jobRun.findMany({ where: { status: 'در_حال_اجرا' }, orderBy: { startedAt: 'desc' }, take: 10 });
    const sources = await db.source.findMany({
      where: { status: { in: ['خطای_اتصال', 'نیازمند_احراز', 'محدود_دسترسی', 'پشتیبانی‌نشده'] } },
      select: { id: true, name: true, platform: true, status: true, statusDetail: true, lastErrorAt: true },
    });
    const aiFailures = await db.aiUsage.findMany({
      where: { status: { in: ['ناموفق', 'سقف_هزینه'] } },
      orderBy: { createdAt: 'desc' }, take: 15,
    });
    const connectorCatalog = (await import('@/lib/connectors')).platformCatalog;
    return ok({ failedJobs, running, errorSources: sources, aiFailures, connectorCatalog });
  } catch (e) { return err500(e, 'خطاها'); }
}
