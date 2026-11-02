/**
 * تولید دستی گزارش (فوراً) — با محافظت ضدتکرار
 */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { generateDailyReport } from '@/lib/reports';
import { isoDateInTz } from '@/lib/persian';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const date = body.date ? String(body.date).slice(0, 10) : isoDateInTz(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('قالب تاریخ باید yyyy-mm-dd میلادی باشد', 422);
    const categoryId = body.categoryId ? String(body.categoryId) : null;
    const r = await generateDailyReport(date, categoryId, { force: Boolean(body.force) });
    return ok(r);
  } catch (e) { return err500(e, 'تولید گزارش'); }
}
