/**
 * مطالب: فهرست با فیلتر دسته/تاریخ/وضعیت
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const take = Math.min(60, Number(sp.get('take') || 30));
    const categoryId = sp.get('categoryId');
    const date = sp.get('date');
    const status = sp.get('status');
    const posts = await db.post.findMany({
      where: {
        ...(categoryId ? { categories: { some: { categoryId } } } : {}),
        ...(date ? { publishedDateOnly: date } : {}),
        ...(status ? { processingStatus: status } : {}),
      },
      include: { source: true, categories: { include: { category: true } }, _count: { select: { claims: true } } },
      orderBy: [{ publishedAt: 'desc' }],
      take,
    });
    return ok({ posts });
  } catch (e) { return err500(e, 'فهرست مطالب'); }
}
