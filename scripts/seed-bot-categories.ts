/**
 * بذر دسته‌های پیش‌فرض ربات ۲۴ ساعته — خواستهٔ کاربر: بخش‌های سیاسی/ورزشی/ایران/انرژی/...
 * اجرا: bun scripts/seed-bot-categories.ts (idempotent)
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const DEFAULTS: Array<{ slug: string; title: string; sortOrder: number }> = [
  { slug: 'politics', title: 'سیاسی', sortOrder: 1 },
  { slug: 'iran', title: 'ایران', sortOrder: 2 },
  { slug: 'sports', title: 'ورزشی', sortOrder: 3 },
  { slug: 'energy', title: 'انرژی', sortOrder: 4 },
  { slug: 'economy', title: 'اقتصاد', sortOrder: 5 },
  { slug: 'world', title: 'جهان', sortOrder: 6 },
  { slug: 'tech', title: 'فناوری', sortOrder: 7 },
  { slug: 'general', title: 'عمومی (مقصد پیش‌فرض)', sortOrder: 8 },
];

async function main(): Promise<void> {
  for (const d of DEFAULTS) {
    await db.botCategory.upsert({
      where: { slug: d.slug },
      create: d,
      update: { title: d.title, sortOrder: d.sortOrder },
    });
  }
  const n = await db.botCategory.count();
  console.log(`دسته‌های ربات آماده است: ${n}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
