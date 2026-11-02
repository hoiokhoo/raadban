/**
 * گزارش‌های روزانه: فهرست/مشاهده یک گزارش
 */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const id = sp.get('id');
    if (id) {
      const report = await db.dailyReport.findUnique({ where: { id }, include: { category: true } });
      if (!report) return fail('گزارش یافت نشد', 404);
      return ok({ report, content: JSON.parse(report.content) });
    }
    const date = sp.get('date');
    const categoryId = sp.get('categoryId');
    const take = Math.min(60, Number(sp.get('take') || 30));
    const reports = await db.dailyReport.findMany({
      where: {
        ...(date ? { reportDate: date } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: true },
      orderBy: { reportDate: 'desc' },
      take,
    });
    return ok({ reports });
  } catch (e) { return err500(e, 'گزارش‌ها'); }
}
