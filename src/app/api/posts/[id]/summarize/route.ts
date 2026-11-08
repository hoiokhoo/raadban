/**
 * خلاصه و تحلیل یک خبر — قابلیت ۱۰
 * POST /api/posts/[id]/summarize  {force?: boolean}
 */
import { ok, fail, err500 } from '@/lib/api-utils';
import { summarizePost } from '@/lib/pipeline/summary';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return fail('شناسه خبر لازم است', 422);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const r = await summarizePost(id, { force: Boolean(body?.force) });
    if (!r.ok) return fail(r.error || 'تحلیل ناموفق بود', 502);
    return ok(r);
  } catch (e) { return err500(e, 'خلاصه و تحلیل خبر'); }
}
