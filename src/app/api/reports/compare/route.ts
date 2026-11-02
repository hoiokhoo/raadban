/**
 * مقایسه گزارش‌های دو تاریخ (فصل ۱۲: مقایسه گزارش‌های دو تاریخ)
 */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import type { ReportSection } from '@/lib/reports';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const a = sp.get('a');
    const b = sp.get('b');
    const categoryId = sp.get('categoryId') || null;
    if (!a || !b || !/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) {
      return fail('دو تاریخ میلادی معتبر (a و b) لازم است', 422);
    }
    const ra = await db.dailyReport.findFirst({ where: { reportDate: a, categoryId: categoryId ?? null } });
    const rb = await db.dailyReport.findFirst({ where: { reportDate: b, categoryId: categoryId ?? null } });
    if (!ra || !rb) return fail('گزارش یکی از این دو تاریخ یافت نشد', 404, {
      hasA: Boolean(ra), hasB: Boolean(rb),
    });
    const ca = JSON.parse(ra.content) as ReportSection;
    const cb = JSON.parse(rb.content) as ReportSection;
    const titlesA = new Set(ca.topEvents.map((e) => e.title));
    const titlesB = new Set(cb.topEvents.map((e) => e.title));
    return ok({
      a: { date: a, jDate: ra.jDate, status: ra.status, summary: ca.executiveSummary, events: ca.topEvents.map((e) => e.title), claimsCount: ra.claimsCount, postsCount: ra.postsCount },
      b: { date: b, jDate: rb.jDate, status: rb.status, summary: cb.executiveSummary, events: cb.topEvents.map((e) => e.title), claimsCount: rb.claimsCount, postsCount: rb.postsCount },
      newInB: [...titlesB].filter((t) => !titlesA.has(t)),
      goneInB: [...titlesA].filter((t) => !titlesB.has(t)),
    });
  } catch (e) { return err500(e, 'مقایسه گزارش‌ها'); }
}
