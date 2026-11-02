/**
 * صدور فهرست منابع رصدبان‌بات از دیتابیس سامانه → bot/sources.json
 * فقط پلتفرم‌های قابل دریافت مستقل (rss | telegram) — توییتر (نیازمند احراز و مسدود از IP ابری)،
 * ایتا و وب در نسخهٔ ۱ ربات نیستند؛ این محدودیت صادقانه در sources.json ثبت می‌شود.
 * اجرا: bun scripts/export-bot-sources.ts
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';

const prisma = new PrismaClient();

interface OutSource {
  name: string;
  platform: string;
  identifier: string;
  url?: string;
  language: string;
  region: string;
  priority: string;
}

async function main(): Promise<void> {
  const srcs = await prisma.source.findMany({
    where: { isActive: true, platform: { in: ['rss', 'telegram'] } },
    select: { name: true, platform: true, identifier: true, url: true, language: true, region: true, priority: true },
    orderBy: [{ priority: 'desc' }, { name: 'asc' }],
  });
  const out: OutSource[] = srcs.map((s) => ({
    name: s.name.trim(),
    platform: s.platform,
    identifier: s.identifier.trim(),
    ...(s.url ? { url: s.url } : {}),
    language: (s.language || 'fa').trim(),
    region: (s.region || 'ایران').trim(),
    priority: (s.priority || 'عادی').trim(),
  }));
  writeFileSync('bot/sources.json', JSON.stringify(out, null, 1), 'utf8');
  const byPlat: Record<string, number> = {};
  for (const s of out) byPlat[s.platform] = (byPlat[s.platform] || 0) + 1;
  const foreign = out.filter((s) => s.language !== 'fa' || s.region !== 'ایران').length;
  console.log(`sources.json نوشته شد — مجموع ${out.length} منبع (${JSON.stringify(byPlat)})؛ خارجی: ${foreign}؛ داخلی: ${out.length - foreign}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('خطای صدور منابع:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
