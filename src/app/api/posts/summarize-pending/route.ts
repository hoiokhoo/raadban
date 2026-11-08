/**
 * خلاصه و تحلیل دسته‌جمعی — قابلیت ۱۰
 * POST {limit=10} → تازه‌ترین خبرهای بدون خلاصه؛ خطاها صادقانه جمع می‌شود
 */
import { ok, err500 } from '@/lib/api-utils';
import { summarizePendingPosts } from '@/lib/pipeline/summary';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const r = await summarizePendingPosts({ limit: Number(body?.limit) || 10 });
    return ok(r);
  } catch (e) { return err500(e, 'خلاصه و تحلیل دسته‌جمعی'); }
}
