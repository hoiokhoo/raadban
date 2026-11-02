/**
 * جست‌وجوی خبر و ادعا (فصل ۱۲) — ترکیبی: متن + کلیدواژه + وضعیت
 */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { normalizePersian } from '@/lib/pipeline/normalize';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const q = normalizePersian(String(sp.get('q') || '').trim());
    const type = sp.get('type'); // posts | claims | all
    if (q.length < 2) return fail('عبارت جست‌وجو حداقل ۲ نویسه', 422);
    const terms = q.split(/\s+/).filter((t) => t.length > 1).slice(0, 6);

    const posts = type !== 'claims' ? await db.post.findMany({
      where: {
        OR: terms.flatMap((t) => [{ content: { contains: t } }]),
      },
      include: { source: true },
      orderBy: { publishedAt: 'desc' },
      take: 25,
    }) : [];

    const claims = type !== 'posts' ? await db.claim.findMany({
      where: { OR: terms.flatMap((t) => [{ text: { contains: t } }]) },
      include: { post: { include: { source: true } }, evidence: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }) : [];

    return ok({ posts, claims });
  } catch (e) { return err500(e, 'جست‌وجو'); }
}
