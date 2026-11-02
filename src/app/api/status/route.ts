/**
 * داشبورد وضعیت امروز — فصل ۱۲
 * چند منبع فعال، چند مطلب، چند رویداد یکتا، چند ادعا، منابع با خطا، وضعیت زمان‌بند
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';
import { isoDateInTz, SYSTEM_TIMEZONE } from '@/lib/persian';
import { schedulerInfo } from '@/lib/scheduler';

export async function GET() {
  try {
    const today = isoDateInTz(new Date(), SYSTEM_TIMEZONE);
    const dayStart = new Date(today + 'T00:00:00Z');
    const now = new Date();

    const [activeSources, totalSources, errorSources, todayPosts, totalEvents, todayClaims,
      todayEvents, reportsToday, scheduleRow] = await Promise.all([
      db.source.count({ where: { isActive: true } }),
      db.source.count(),
      db.source.count({ where: { status: { in: ['خطای_اتصال', 'نیازمند_احراز', 'محدود_دسترسی'] }, lastErrorAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
      db.post.count({ where: { fetchedAt: { gte: dayStart } } }),
      db.event.count(),
      db.claim.count({ where: { createdAt: { gte: dayStart } } }),
      db.event.count({ where: { firstSeenAt: { gte: dayStart } } }),
      db.dailyReport.findMany({ where: { reportDate: today }, include: { category: true } }),
      db.setting.findUnique({ where: { key: 'schedule' } }),
    ]);

    const claimsByStatus = await db.claim.groupBy({ by: ['status'], _count: true });

    const upcomingFetches = await db.source.findMany({
      where: { isActive: true },
      orderBy: { lastFetchAt: 'asc' },
      take: 5,
      select: { id: true, name: true, platform: true, lastFetchAt: true, fetchIntervalMin: true, status: true },
    });

    return ok({
      today,
      sources: { active: activeSources, total: totalSources, withRecentErrors: errorSources },
      todayPosts,
      todayEvents,
      totalEvents,
      todayClaims,
      claimsByStatus,
      reportsToday: reportsToday.map((r) => ({ id: r.id, status: r.status, category: r.category?.name || 'جامع', jDate: r.jDate, generatedAt: r.generatedAt })),
      scheduler: schedulerInfo(),
      schedule: scheduleRow ? JSON.parse(scheduleRow.value) : { reportTime: '22:30', catchUp: true },
      upcomingFetches,
      serverTime: now.toISOString(),
      timezone: SYSTEM_TIMEZONE,
    });
  } catch (e) { return err500(e, 'داشبورد'); }
}
