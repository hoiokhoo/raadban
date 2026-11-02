/**
 * ترجمه دسته‌جمعی اخبار خارجی — قابلیت T9 (فارسی روان)
 * POST {limit=25} → ترجمه پست‌های غیرفارسی بدون ترجمه؛ خطاها صادقانه جمع می‌شود
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';
import { translatePost, isLikelyForeign } from '@/lib/translate';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(60, Math.max(1, Number(body?.limit) || 25));

    // استخر بزرگ‌تر: در انتهای پایگاه، اخبار خارجی میان انبوه اخبار فارسی پخش‌اند
    const pending = await db.post.findMany({
      where: { translationFa: null },
      orderBy: { publishedAt: 'desc' },
      take: Math.min(1500, Math.max(400, limit * 30)),
      select: { id: true, content: true, language: true },
    });

    const targets = pending
      .filter((p) => (p.language && p.language !== 'fa') || isLikelyForeign(p.content))
      .slice(0, limit);

    let translated = 0;
    let skippedFa = 0;
    const errors: Array<{ postId: string; error: string }> = [];
    for (const p of targets) {
      try {
        const r = await translatePost(p.id);
        if (r.ok) translated++;
        else if (r.error?.includes('فارسی است')) skippedFa++;
        else errors.push({ postId: p.id, error: (r.error || 'خطای ناشناخته').slice(0, 200) });
      } catch (e) {
        errors.push({ postId: p.id, error: e instanceof Error ? e.message : 'خطای ناشناخته' });
      }
    }

    // شمار باقی‌مانده پس از این دور (نمونه ۵۰۰ تایی اخیر — برآورد صادقانه)
    const remainingSample = await db.post.findMany({
      where: { translationFa: null },
      take: 500,
      select: { content: true, language: true },
    });
    const remaining = remainingSample.filter((p) => (p.language && p.language !== 'fa') || isLikelyForeign(p.content)).length;

    return ok({
      targeted: targets.length,
      translated,
      skippedFa,
      failed: errors.length,
      errors: errors.slice(0, 8),
      remaining,
    });
  } catch (e) { return err500(e, 'ترجمه دسته‌جمعی'); }
}
