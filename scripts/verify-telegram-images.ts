// بررسی E2E تصویر تلگرام — پوشش فعلی + دریافت واقعی یک منبع فعال و شمارش مجدد
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const byPlatform = await db.post.groupBy({
    by: ['sourceId'],
    where: { source: { platform: 'telegram' } },
    _count: { sourceId: true, imageUrl: true },
  });
  const tgSources = await db.source.findMany({
    where: { platform: 'telegram', isActive: true },
    select: { id: true, name: true, identifier: true, lastFetchAt: true, status: true },
  });
  const imgByPlatform = await db.$queryRawUnsafe<Array<{ platform: string; total: number; withImg: number }>>(
    `SELECT s.platform, COUNT(*) as total, COUNT(p.imageUrl) as withImg
     FROM Post p JOIN Source s ON s.id = p.sourceId
     GROUP BY s.platform`
  );
  console.log('پوشش تصویر به تفکیک پلتفرم:', imgByPlatform);
  console.log('منابع تلگرام فعال:', tgSources.map((s) => `${s.name} (${s.identifier}) — وضعیت: ${s.status}, آخرین دریافت: ${s.lastFetchAt?.toISOString() || 'هرگز'}`));

  // دریافت واقعی یک منبع تلگرام
  if (tgSources.length) {
    const target = tgSources[0];
    console.log(`\nدریافت واقعی: ${target.name} (${target.identifier}) ...`);
    const { ingestSource } = await import('../src/lib/ingest');
    const out = await ingestSource(target.id);
    console.log('نتیجه:', { ok: out.ok, inserted: out.inserted, duplicates: out.duplicates, error: out.error || null });
    if (out.ok) {
      const recent = await db.post.findMany({
        where: { sourceId: target.id },
        orderBy: { publishedAt: 'desc' },
        take: 12,
        select: { content: true, imageUrl: true, publishedAt: true },
      });
      const withImg = recent.filter((p) => p.imageUrl);
      console.log(`۱۲ پست اخیر: ${recent.length} — دارای تصویر: ${withImg.length}`);
      for (const p of withImg.slice(0, 4)) {
        console.log('  🖼', (p.imageUrl || '').slice(0, 80), '| متن:', p.content.slice(0, 40).replace(/\n/g, ' '));
      }
    }
  }
}
main().finally(() => db.$disconnect());
