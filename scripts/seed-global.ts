/**
 * Seed جهانی — اجرا: bun run scripts/seed-global.ts
 * ۱) ۱۲ دسته موضوعی با کمیته کارشناسی (ارتقای موجودها به v2 + ۷ دسته جدید v1)
 * ۲) ~۵۳ رسانه/نهاد جهانی + ~۲۶ شخصیت/نهاد رسمی با برچسب گرایی سیاسی
 * اصول: upsert بر کلید پایدار؛ هیچ داده ساختگی؛ گرایش = توصیف مستند مالکیت/خط تحریریه.
 */
import { PrismaClient } from '@prisma/client';
import { CATEGORIES } from './global-cats';
import { MEDIA_SOURCES, type GlobalSource } from './global-sources';
import { PEOPLE_SOURCES } from './global-people';

const db = new PrismaClient();

async function seedCategories(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const cat = await db.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, description: c.description, color: c.color, promptTemplate: c.prompt },
      // نام و توضیح به‌روزرسانی می‌شود؛ پرامپت فعلی کاربر را بازنویسی می‌کنیم چون نسخه رسمی جدید است
      update: { name: c.name, description: c.description, color: c.color, promptTemplate: c.prompt },
    });
    map[c.slug] = cat.id;
    await db.promptVersion.upsert({
      where: { name_version: { name: `category:${c.slug}`, version: c.version } },
      create: { name: `category:${c.slug}`, version: c.version, content: c.prompt, isActive: true, notes: 'کمیته کارشناسی چندنفره — نسخه seed جهانی' },
      update: { content: c.prompt, isActive: true },
    });
    console.log(`✓ دسته: ${c.name} (${c.slug}) — پرامپت ${c.version} طول ${c.prompt.length}`);
  }
  return map;
}

async function seedSources(catMap: Record<string, string>) {
  let created = 0, updated = 0;
  const all: GlobalSource[] = [...MEDIA_SOURCES, ...PEOPLE_SOURCES];
  for (const s of all) {
    const existing = await db.source.findUnique({
      where: { platform_identifier: { platform: s.platform, identifier: s.identifier } },
    });
    const catIds = s.categories.map((slug) => catMap[slug]).filter(Boolean);
    const data = {
      name: s.name, url: s.url, language: s.language, region: s.region, topic: s.topic,
      entityType: s.entityType, politicalOrientation: s.politicalOrientation,
      trustNote: s.trustNote, notes: s.notes ?? null, limitsNote: s.limitsNote ?? null,
      fetchMethod: s.fetchMethod ?? 'عمومی',
      fetchIntervalMin: s.fetchIntervalMin ?? 60,
      maxItemsPerFetch: s.maxItemsPerFetch ?? 20,
      isActive: true,
    };
    if (existing) {
      await db.source.update({ where: { id: existing.id }, data: { ...data, identifier: s.identifier } });
      await db.sourceCategory.deleteMany({ where: { sourceId: existing.id } });
      if (catIds.length) await db.sourceCategory.createMany({ data: catIds.map((categoryId) => ({ sourceId: existing.id, categoryId })) });
      updated++;
      console.log(`↺ به‌روزرسانی: ${s.name}`);
    } else {
      const src = await db.source.create({
        data: {
          ...data,
          platform: s.platform, identifier: s.identifier,
          status: 'غیرفعال', statusDetail: 'در انتظار اولین دریافت دوره‌ای',
          ...(catIds.length ? { categories: { create: catIds.map((categoryId) => ({ categoryId })) } } : {}),
        },
      });
      created++;
      console.log(`✓ افزوده شد: ${s.name} [${s.platform}] → src:${src.id.slice(-6)}`);
    }
  }
  console.log(`\nجمع منابع: ${created} جدید، ${updated} به‌روزرسانی`);
}

async function main() {
  console.log('=== Seed جهانی رصدبان ===');
  const catMap = await seedCategories();
  await seedSources(catMap);
  const total = await db.source.count();
  const cats = await db.category.count();
  const noOrientation = await db.source.count({ where: { platform: { in: ['rss', 'twitter', 'truthsocial'] }, politicalOrientation: null } });
  console.log(`\nمجموع: ${total} منبع | ${cats} دسته | منابع RSS/ایکس بدون گرایش: ${noOrientation}`);
}

main().finally(() => db.$disconnect());
