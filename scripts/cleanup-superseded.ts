/** حذف منابع قدیمی بازنشسته (نسخه‌های شکسته RSS که جایگزین تجمیعی دارند) */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const SUPERSEDED = [
  'https://www.radiofarda.com/api/zrqiteukiq',
  'https://radiozamaneh.com/feed',
  'https://www.politico.com/rss/politicopicks.xml',
  'https://www.aa.com.tr/en/rss/default?cat=1',
  'https://www.timesofisrael.com/feed/',
  'https://dawn.com/feeds/home',
  'https://www.espn.com/espn/rss/news',
];

async function main() {
  let n = 0;
  for (const id of SUPERSEDED) {
    const s = await db.source.findUnique({ where: { platform_identifier: { platform: 'rss', identifier: id } }, include: { _count: { select: { posts: true } } } });
    if (s) {
      console.log(`حذف: ${s.name} (پست: ${s._count.posts})`);
      await db.source.delete({ where: { id: s.id } });
      n++;
    }
  }
  // نسخه قدیمی TRT (شناسه گوگل‌نیوز با زیرمسیر /persian)
  const trtOld = await db.source.findFirst({
    where: { platform: 'rss', identifier: { contains: 'site:trt.net.tr/persian' } },
  });
  if (trtOld) {
    console.log(`حذف: ${trtOld.name} (شناسه قدیمی TRT)`);
    await db.source.delete({ where: { id: trtOld.id } });
    n++;
  }
  const total = await db.source.count();
  const dupNames = await db.source.groupBy({ by: ['name'], _count: true, having: { name: { _count: { gte: 2 } } } });
  console.log(`\nحذف‌شده: ${n} | مجموع فعلی: ${total} | نام‌های دوبله: ${dupNames.length}`);
  if (dupNames.length) console.log(dupNames.map((d) => d.name).join(' | '));
}

main().finally(() => db.$disconnect());
