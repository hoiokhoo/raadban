/**
 * فهرست خط خبری (خوشه‌های خبری) با اعضا — تایم‌لاین گره‌دار (T9)
 * GET ?page=1&take=15&sort=outlets|recent
 *  - outlets (پیش‌فرض): خوشه‌های با بیشترین «رسانهٔ متمایز» اول — همان چیزی که ردیابی منشأ خبر می‌خواهد
 *    (بازنشرهای زنجیره‌ایِ یک منبعِ واحد دیگر صدر فهرست را نمی‌بندد)
 *  - recent: تازه‌ترین اولین‌انتشارها
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const take = Math.min(40, Number(sp.get('take')) || 15);
    const sort = sp.get('sort') === 'recent' ? 'recent' : 'outlets';

    const include = {
      members: {
        orderBy: { publishedAt: 'asc' as const },
        include: {
          post: {
            select: { url: true, content: true, translationFa: true },
          },
        },
      },
    };

    const total = await db.newsCluster.count();

    let clusters;
    if (sort === 'recent') {
      clusters = await db.newsCluster.findMany({
        orderBy: { firstPublishedAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include,
      });
    } else {
      // استخر بزرگ‌ترین خوشه‌ها → مرتب بر تعداد رسانهٔ متمایز (شمارش در حافظه، ارزان)
      const pool = await db.newsCluster.findMany({
        orderBy: { memberCount: 'desc' },
        take: 120,
        include,
      });
      const outlets = (c: (typeof pool)[number]) => new Set(c.members.map((m) => m.sourceName)).size;
      pool.sort((a, b) => outlets(b) - outlets(a) || b.memberCount - a.memberCount);
      clusters = pool.slice((page - 1) * take, (page - 1) * take + take);
    }

    return ok({
      total,
      page,
      sort,
      clusters: clusters.map((c) => {
        const outletsCount = new Set(c.members.map((m) => m.sourceName)).size;
        // تیتر فارسی خوشه: برای خوشه‌های غیرفارسی، ترجمهٔ نخستین عضوِ ترجمه‌شده (به ترتیب انتشار)
        const titleFa = c.language === 'fa'
          ? c.title
          : (c.members.find((m) => (m.post?.translationFa || '').trim())?.post?.translationFa || '').trim().slice(0, 200) || c.title;
        return {
          id: c.id,
          title: titleFa,
          firstSourceName: c.firstSourceName,
          firstPublishedAt: c.firstPublishedAt,
          memberCount: c.memberCount,
          outletsCount,
          language: c.language,
          titleOriginal: c.title,
          members: c.members.map((m) => ({
            postId: m.postId,
            isFirst: m.isFirst,
            publishedAt: m.publishedAt,
            similarity: m.similarity,
            sourceName: m.sourceName,
            sourcePlatform: m.sourcePlatform,
            minutesAfterFirst: Math.round((m.publishedAt.getTime() - c.firstPublishedAt.getTime()) / 60000),
            url: m.post?.url || null,
            snippet: ((m.post?.translationFa || m.post?.content || '') as string)
              .replace(/<[^>]+>/g, ' ')
              .replace(/&[a-z#0-9]+;/gi, ' ')
              .replace(/\s+/g, ' ')
              .slice(0, 220),
          })),
        };
      }),
    });
  } catch (e) { return err500(e, 'فهرست خوشه‌ها'); }
}
