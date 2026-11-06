import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const settings = await db.setting.findMany();
for (const s of settings) {
  let v = s.value;
  if (v && v.length > 90) v = v.slice(0, 90) + `…(${v.length})`;
  console.log(`SETTING ${s.key} = ${JSON.stringify(v)}`);
}
const counts = {
  posts: await db.post.count(),
  postsFa: await db.post.count({ where: { language: 'fa' } }),
  postsUntranslated: await db.post.count({ where: { translationFa: null, NOT: { language: 'fa' } } }),
  sources: await db.source.count(),
  sourcesActive: await db.source.count({ where: { isActive: true } }),
  claims: await db.claim.count(),
  references: await db.postReference.count(),
  clusters: await db.newsCluster.count(),
  aiUsageToday: await db.aiUsage.count({ where: { createdAt: { gte: new Date(Date.now()-24*3600*1000) } } }),
  aiFail: await db.aiUsage.count({ where: { status: { not: 'موفق' }, createdAt: { gte: new Date(Date.now()-48*3600*1000) } } }),
};
console.log('COUNTS', JSON.stringify(counts, null, 1));
const faSrcs = await db.source.findMany({ where: { OR: [{ language: 'fa' }, { region: { contains: 'ایران' } }] }, select: { name: true, language: true, region: true, isActive: true, platform: true } });
console.log('FA SOURCES:', JSON.stringify(faSrcs, null, 1));
const fail = await db.aiUsage.findMany({ where: { status: { not: 'موفق' } }, orderBy: { createdAt: 'desc' }, take: 8, select: { purpose: true, model: true, error: true, createdAt: true } });
console.log('RECENT AI FAILURES:', JSON.stringify(fail, null, 1));
await db.$disconnect();
