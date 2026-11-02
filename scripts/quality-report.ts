/** گزارش وضعیت منابع برای کنترل کیفی */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const byStatus = await db.source.groupBy({ by: ['status'], _count: true });
  console.log('=== وضعیت منابع ===');
  for (const s of byStatus) console.log(`${s.status}: ${s._count}`);

  const sources = await db.source.findMany({
    select: { name: true, status: true, platform: true, region: true, _count: { select: { posts: true } } },
  });
  const withPosts = sources.filter((s) => s._count.posts > 0).length;
  const empty = sources.filter((s) => s._count.posts === 0 && s.isActive);
  console.log(`\nمنابع دارای پست: ${withPosts}/${sources.length}`);
  console.log(`\n=== منابع فعال بدون پست (${empty.length}) ===`);
  for (const s of empty) console.log(`[${s.status}] ${s.name} (${s.platform}) — پست: ${s._count.posts}`);

  const regions = await db.source.groupBy({ by: ['region'], _count: true });
  console.log(`\n=== توزیع جغرافیایی (${regions.length} کشور/قلمرو) ===`);
  console.log(regions.sort((a, b) => b._count - a._count).map((r) => `${r.region}:${r._count}`).join(' | '));

  const types = await db.source.groupBy({ by: ['entityType'], _count: true });
  console.log(`\n=== نوع منبع ===`);
  console.log(types.map((t) => `${t.entityType}: ${t._count}`).join(' | '));

  const posts = await db.post.count();
  const posts24h = await db.post.count({ where: { fetchedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } });
  console.log(`\nپست کل: ${posts} | دریافت ۲۴ ساعت اخیر: ${posts24h}`);
}

main().finally(() => db.$disconnect());
