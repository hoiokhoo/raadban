/**
 * خوشه‌بندی اخبار مشابه — ساخت (T9)
 * POST {days=7, limit=2500} → بازسازی خط خبری با «اولین منبع» و بازنشرها به‌ترتیب زمان
 * اجرا در JobRun صادقانه ثبت می‌شود (موفق/ناموفق + مدت).
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';
import { rebuildClusters } from '@/lib/pipeline/clustering-run';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const job = await db.jobRun.create({ data: { jobType: 'clusters', targetId: 'manual', status: 'در_حال_اجرا' } });
  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const days = Math.min(30, Math.max(1, Number(body?.days) || 7));
    const limit = Math.min(8000, Math.max(100, Number(body?.limit) || 2500));

    const result = await rebuildClusters(days, limit);

    await db.jobRun.update({
      where: { id: job.id },
      data: {
        status: 'موفق',
        finishedAt: new Date(),
        durationMs: Date.now() - t0,
        details: JSON.stringify(result).slice(0, 1000),
      },
    });
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'خطای ناشناخته';
    await db.jobRun.update({
      where: { id: job.id },
      data: { status: 'ناموفق', finishedAt: new Date(), durationMs: Date.now() - t0, error: msg.slice(0, 800) },
    }).catch(() => {});
    return err500(e, 'خوشه‌بندی اخبار');
  }
}
