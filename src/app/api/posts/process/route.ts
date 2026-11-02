/**
 * پردازش دستی مطالب خام (بدون دریافت جدید)
 */
import { ok, err500 } from '@/lib/api-utils';
import { processPendingPosts } from '@/lib/ingest';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(20, Number(body?.limit) || 10);
    const r = await processPendingPosts(limit);
    return ok({ ...r });
  } catch (e) { return err500(e, 'پردازش مطالب'); }
}
