/**
 * اسکن دسته‌جمعی رفرنس‌ها — T9
 * POST {limit=15, days=14} → تحلیل پست‌های بازه اخیرِ بدون رفرنس‌ثبت‌شده
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';
import { analyzePostReferences } from '@/lib/pipeline/references';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(50, Math.max(1, Number(body?.limit) || 15));
    const days = Math.min(30, Math.max(1, Number(body?.days) || 14));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const posts = await db.post.findMany({
      where: { publishedAt: { gte: since }, references: { none: {} } },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: { id: true },
    });

    const results: Array<{ postId: string; referencesFound: number; aiError?: string }> = [];
    const errors: string[] = [];
    for (const p of posts) {
      try {
        results.push(await analyzePostReferences(p.id));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'خطای ناشناخته');
      }
    }

    return ok({
      scanned: posts.length,
      withReferences: results.filter((r) => r.referencesFound > 0).length,
      aiErrors: results.filter((r) => r.aiError).length,
      hardErrors: errors,
      results,
    });
  } catch (e) { return err500(e, 'اسکن رفرنس‌ها'); }
}
