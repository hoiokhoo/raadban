/**
 * فهرست رفرنس‌های تحلیل‌شده — T9
 * GET ?page=1&take=20 → با مشخصات پست و منبع
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const take = Math.min(50, Number(sp.get('take')) || 20);

    const [total, byVerdict, refs] = await Promise.all([
      db.postReference.count(),
      db.postReference.groupBy({ by: ['verdict'], _count: { verdict: true } }),
      db.postReference.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: {
          post: {
            select: {
              id: true, content: true, translationFa: true, url: true, publishedAt: true,
              source: { select: { name: true, platform: true } },
            },
          },
        },
      }),
    ]);

    return ok({
      total,
      byVerdict: byVerdict.map((v) => ({ verdict: v.verdict, count: v._count.verdict })),
      references: refs.map((r) => ({
        id: r.id,
        postId: r.postId,
        refKind: r.refKind,
        refText: r.refText,
        refDescription: r.refDescription,
        matchedTitle: r.matchedTitle,
        similarity: r.similarity,
        verdict: r.verdict,
        analysis: r.analysis,
        model: r.model,
        createdAt: r.createdAt,
        post: {
          snippet: ((r.post.translationFa || r.post.content || '') as string).replace(/\s+/g, ' ').slice(0, 200),
          url: r.post.url,
          publishedAt: r.post.publishedAt,
          sourceName: r.post.source?.name || '—',
          platform: r.post.source?.platform || '—',
        },
      })),
    });
  } catch (e) { return err500(e, 'فهرست رفرنس‌ها'); }
}
