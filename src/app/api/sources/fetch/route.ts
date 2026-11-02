/**
 * دریافت دستی از یک منبع یا همه منابع + پردازش
 */
import { ok, err500 } from '@/lib/api-utils';
import { ingestSource, ingestAll, processPendingPosts } from '@/lib/ingest';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sourceId = body.sourceId as string | undefined;
    if (sourceId) {
      const r = await ingestSource(sourceId);
      return ok({ results: [r] });
    }
    const results = await ingestAll();
    const pipeline = await processPendingPosts(8);
    return ok({ results, pipeline });
  } catch (e) { return err500(e, 'دریافت مطالب'); }
}
