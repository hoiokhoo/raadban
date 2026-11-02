/**
 * بازسازی منابع دیتابیس از bot/sources.json (بعد از ریست محیط)
 * اجرا: bun scripts/restore-sources-from-bot.ts
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const db = new PrismaClient();
const sources = JSON.parse(readFileSync(new URL('../bot/sources.json', import.meta.url), 'utf8')) as Array<{
  name: string; platform: string; identifier: string; url?: string;
  language: string; region: string; priority: string;
}>;

let added = 0, skipped = 0;
for (const s of sources) {
  const exists = await db.source.findFirst({ where: { platform: s.platform, identifier: s.identifier } });
  if (exists) { skipped++; continue; }
  await db.source.create({
    data: {
      name: s.name,
      platform: s.platform,
      identifier: s.identifier,
      url: s.url ?? null,
      language: s.language,
      region: s.region,
      priority: s.priority,
      isActive: true,
      status: 'فعال',
    },
  });
  added++;
}
console.log(`منابع افزوده‌شده: ${added} | از قبل موجود: ${skipped} | کل فعلی: ${await db.source.count()}`);
process.exit(0);
