/** رویدادهای مهم پیش رو — فهرست مرتب بر نزدیکی تاریخ (قابلیت ۱٫۱-د) */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const status = sp.get('status');
    const events = await db.majorEvent.findMany({
      where: status ? { status } : {},
      orderBy: [{ createdAt: 'asc' }],
    });
    // مرتب‌سازی: رویدادهای تاریخ‌دار به ترتیب نزدیکی، بعد رویدادهای بدون تاریخ قطعی
    events.sort((a, b) => (a.eventDateISO || '9999-12-31').localeCompare(b.eventDateISO || '9999-12-31'));
    // اخبار مرتبط درون‌سامانه‌ای: تطبیق واژه‌های کلیدی عنوان/توضیح با پست‌های اخیر
    const todayISO = new Date().toISOString().slice(0, 10);
    const eventsWithMeta = events.map((ev) => {
      let daysUntil: number | null = null;
      if (ev.eventDateISO) {
        const diff = Math.round((new Date(ev.eventDateISO + 'T00:00:00Z').getTime() - new Date(todayISO + 'T00:00:00Z').getTime()) / 86400000);
        daysUntil = diff;
      }
      return { ...ev, daysUntil };
    });
    return ok({ events: eventsWithMeta, today: todayISO });
  } catch (e) { return err500(e, 'فهرست رویدادها'); }
}
