// بررسی وضعیت خط خبری (خوشه‌ها) در بانک — پیکربندی واقعی
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const totalPosts = await db.post.count();
  const withDate = await db.post.count({ where: { publishedAt: { not: null } } });
  const clusters = await db.newsCluster.count();
  const members = await db.clusterMember.count();
  const big = await db.newsCluster.count({ where: { memberCount: { gte: 3 } } });
  const recent = await db.newsCluster.findMany({
    orderBy: { firstPublishedAt: 'desc' },
    take: 8,
    select: { title: true, firstSourceName: true, firstPublishedAt: true, memberCount: true },
  });
  const lastBuild = await db.jobRun.findFirst({ where: { jobType: { contains: 'cluster' } }, orderBy: { startedAt: 'desc' } });
  const posts7d = await db.post.count({
    where: { publishedAt: { gte: new Date(Date.now() - 7 * 864e5) } },
  });
  // تنوع منبع در بازه هفت روز — چند رسانه همزمان فعالیم؟
  const bySource = await db.post.groupBy({
    by: ['sourceId'],
    where: { publishedAt: { gte: new Date(Date.now() - 7 * 864e5) } },
    _count: { sourceId: true },
  });
  const srcIds = bySource.map((s) => s.sourceId).filter(Boolean) as string[];
  const srcs = await db.source.findMany({ where: { id: { in: srcIds } }, select: { id: true, name: true, platform: true } });
  const srcMap = new Map(srcs.map((s) => [s.id, s]));
  const topSources = bySource
    .map((s) => ({ name: srcMap.get(s.sourceId!)?.name || '؟', platform: srcMap.get(s.sourceId!)?.platform || '؟', count: s._count.sourceId }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  console.log(JSON.stringify({ totalPosts, withDate, posts7d, clusters, members, big, lastBuild, recent, topSources }, null, 2));
}
main().finally(() => db.$disconnect());
