/** بازرسی داده‌ها: شناسایی منابع/پست‌های نمونه و فیک + توزیع پست‌ها */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const sources = await db.source.findMany({
    select: { id: true, name: true, platform: true, region: true, status: true },
    orderBy: { createdAt: 'asc' },
  });
  const counts = await db.post.groupBy({ by: ['sourceId'], _count: true });
  const cmap = new Map(counts.map((c) => [c.sourceId, c._count]));

  console.log(`=== منابع (${sources.length}) ===`);
  for (const s of sources) {
    const demo = /نمونه|sample|fake|فیک|ساختگی/i.test(s.name) ? ' ⚠️نمونه' : '';
    console.log(`${s.name} [${s.platform}] (${s.region}) پست:${cmap.get(s.id) ?? 0} وضعیت:${s.status}${demo}`);
  }

  const noSrc = await db.post.count({ where: { sourceId: null } });
  console.log(`\nپست‌های بدون منبع: ${noSrc}`);
  const noSrcSample = await db.post.findMany({
    where: { sourceId: null }, take: 6, select: { id: true, content: true, publishedAt: true, createdAt: true },
  });
  for (const p of noSrcSample) {
    console.log(`NOSRC ${p.createdAt.toISOString()} | ${p.content.slice(0, 100).replace(/\n/g, ' ')}`);
  }

  // دسته fvvc و محتوای آن
  const fvvc = await db.category.findUnique({
    where: { slug: 'fvvc' },
    include: { _count: { select: { posts: true, sources: true, events: true, reports: true, predictions: true } } },
  });
  console.log('\n=== دسته fvvc ===', fvvc ? `name="${fvvc.name}" posts:${fvvc._count.posts} sources:${fvvc._count.sources} events:${fvvc._count.events} reports:${fvvc._count.reports}` : 'یافت نشد');
  if (fvvc) {
    const fp = await db.postCategory.findMany({
      where: { categoryId: fvvc.id }, take: 8,
      include: { post: { select: { content: true, createdAt: true, sourceId: true } } },
    });
    for (const pc of fp) {
      console.log(`FVVC-POST src:${pc.post.sourceId ? pc.post.sourceId.slice(-6) : 'NULL'} ${pc.post.createdAt.toISOString()} | ${pc.post.content.slice(0, 90).replace(/\n/g, ' ')}`);
    }
  }

  // رویدادهای بدون پست
  const totalEvents = await db.event.count();
  const linked = await db.eventPost.groupBy({ by: ['eventId'], _count: true });
  console.log(`\nرویدادها: ${totalEvents} | دارای پیوند پست: ${linked.length}`);
}

main().finally(() => db.$disconnect());
