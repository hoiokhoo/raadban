/**
 * دسته‌بندی موضوعی دسته‌جمعی — T9
 * POST {limit} → طبقه‌بندی هوشمند پست‌های بدون موضوع (قدیمی‌ترین اول)
 */
import { ok, err500 } from '@/lib/api-utils';
import { categorizePendingPosts } from '@/lib/pipeline/topics';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const r = await categorizePendingPosts({ limit: Number(body?.limit) || 100 });
    return ok(r);
  } catch (e) { return err500(e, 'دسته‌بندی موضوعی'); }
}
