import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const sources = await db.source.findMany({
    where: { language: { in: ['en', 'ar', 'he'] }, platform: { in: ['rss', 'twitter', 'web'] } },
    select: { name: true, platform: true, status: true, statusDetail: true, isActive: true },
    orderBy: { name: 'asc' },
  });
  for (const s of sources) {
    const detail = (s.statusDetail || '').slice(0, 90).replace(/\n/g, ' ');
    console.log(`[${s.platform}] ${s.name} → ${s.status} | ${detail}`);
  }
  const counts = await db.post.groupBy({ by: ['sourceId'], _count: true }).then(async (rows) => {
    const ids = rows.map((r) => r.sourceId);
    const srcs = await db.source.findMany({ where: { id: { in: ids.filter((x): x is string => !!x) } }, select: { id: true, name: true, platform: true } });
    return rows.map((r) => { const s = srcs.find((x) => x.id === r.sourceId); return `${s?.platform || '?'}:${s?.name || '?'} = ${r._count}`; });
  });
  console.log('--- POST COUNTS (new sources with data) ---');
  console.log(counts.filter((c) => /rss|twitter|web/.test(c)).join('\n'));
  const raw = await db.post.count({ where: { processingStatus: 'خام' } });
  const total = await db.post.count();
  console.log(`TOTAL POSTS=${total} RAW=${raw}`);
}
main().finally(() => db.$disconnect());
