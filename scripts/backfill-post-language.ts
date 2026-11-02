/**
 * بازپُری زبان پست‌های موجود با detectLanguage اصلاح‌شده — پس از ریست یا تغییر الگوریتم
 * اجرا: bun scripts/backfill-post-language.ts
 */
import { PrismaClient } from '@prisma/client';
import { detectLanguage } from '../src/lib/pipeline/normalize';

const db = new PrismaClient();

let fixed = 0, checked = 0;
for (let skip = 0; ; skip += 500) {
  const posts = await db.post.findMany({
    select: { id: true, content: true, normalized: true, language: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
    skip,
  });
  if (posts.length === 0) break;
  for (const p of posts) {
    checked++;
    const lang = detectLanguage(p.normalized || p.content);
    if (lang !== 'other' && lang !== p.language) {
      await db.post.update({ where: { id: p.id }, data: { language: lang } });
      fixed++;
    }
  }
  if (skip > 20000) break; // سقف امن
}
console.log(`بررسی‌شده: ${checked} — اصلاح‌شده: ${fixed}`);
process.exit(0);
