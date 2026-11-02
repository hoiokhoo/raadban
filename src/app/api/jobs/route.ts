/**
 * سوابق اجرای وظایف
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';

export async function GET() {
  try {
    const jobs = await db.jobRun.findMany({ orderBy: { startedAt: 'desc' }, take: 40 });
    return ok({ jobs });
  } catch (e) { return err500(e, 'سوابق وظایف'); }
}
