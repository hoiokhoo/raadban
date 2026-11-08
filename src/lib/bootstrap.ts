/**
 * خودترمیمی بانک اطلاعاتی پس از ریست سندباکس (خواستهٔ کاربر ۹ نوامبر ۲۰۲۶:
 * «بخش تحلیل اخبار کار نمی‌کند» — علت ریشه‌ای، خالی بودن بانک اطلاعاتی پس از ریست بود؛
 * ربات گیت‌هاب جدا از اپ کار می‌کرد و اپ هیچ داده‌ای برای تحلیل نداشت).
 *
 * این ماژول در راه‌اندازی سرور فراخوانی می‌شود: اگر بانک خالی باشد، منابع و دسته‌های
 * ربات (منبع حقیقت واحد: bot/sources.json و bot/bot-config.json) به‌صورت idempotent وارد می‌شوند
 * تا خط تحلیل (دسته‌بندی/خوشه/ترجمه/ارجاع) بلافاصله چیزی برای تحلیل داشته باشد.
 * هیچ دادهٔ ساختگی اضافه نمی‌شود — فقط کاتالوگ واقعی منابع.
 */
import { readFileSync } from 'node:fs';
import { db } from './db';

interface BotSourceEntry {
  name: string;
  platform: string;
  identifier: string;
  url?: string;
  language: string;
  region: string;
  priority: string;
  category?: string;
}

const BOT_CATEGORIES: Array<{ slug: string; title: string; sortOrder: number }> = [
  { slug: 'politics', title: 'سیاسی', sortOrder: 1 },
  { slug: 'iran', title: 'ایران', sortOrder: 2 },
  { slug: 'sports', title: 'ورزشی', sortOrder: 3 },
  { slug: 'energy', title: 'انرژی', sortOrder: 4 },
  { slug: 'economy', title: 'اقتصاد', sortOrder: 5 },
  { slug: 'world', title: 'جهان', sortOrder: 6 },
  { slug: 'tech', title: 'فناوری', sortOrder: 7 },
  { slug: 'general', title: 'عمومی (مقصد پیش‌فرض)', sortOrder: 8 },
];

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(new URL(path, process.cwd() + '/'), 'utf8'));
  } catch {
    return null;
  }
}

let done = false;

/** یک‌بار در عمر پروسه: اگر بانک خالی بود، کاتالوگ منابع/دسته‌ها را وارد کن */
export async function ensureDatabaseSeeded(): Promise<{ seeded: boolean; sources: number }> {
  if (done) return { seeded: false, sources: -1 };
  done = true;
  try {
    const sourceCount = await db.source.count();
    const catCount = await db.category.count();
    if (sourceCount > 0 && catCount > 0) return { seeded: false, sources: sourceCount };

    // دسته‌های ثابت سیستم (۱۲ موضوع تحلیل) — idempotent
    const TOPICS = [
      { slug: 'topic-politics', title: 'سیاسی' },
      { slug: 'topic-economy', title: 'اقتصادی' },
      { slug: 'topic-military-security', title: 'نظامی-امنیتی' },
      { slug: 'topic-international', title: 'بین‌الملل' },
      { slug: 'topic-social', title: 'اجتماعی' },
      { slug: 'topic-culture-arts', title: 'فرهنگی-هنری' },
      { slug: 'topic-sports', title: 'ورزشی' },
      { slug: 'topic-science-tech', title: 'علم و فناوری' },
      { slug: 'topic-health', title: 'سلامت و بهداشت' },
      { slug: 'topic-environment-energy', title: 'محیط‌زیست و انرژی' },
      { slug: 'topic-incidents', title: 'حوادث و ایمنی' },
      { slug: 'topic-other', title: 'سایر/نامشخص' },
    ];
    for (const t of TOPICS) {
      await db.category.upsert({
        where: { slug: t.slug },
        create: { slug: t.slug, name: t.title },
        update: {},
      }).catch(() => {});
    }
    // دسته‌های ربات (مدیریت توکن بخش‌ها)
    for (const c of BOT_CATEGORIES) {
      await db.botCategory.upsert({
        where: { slug: c.slug },
        create: c,
        update: { title: c.title, sortOrder: c.sortOrder },
      }).catch(() => {});
    }

    let added = 0;
    if (sourceCount === 0) {
      const sources = readJsonFile('/bot/sources.json') as BotSourceEntry[] | null;
      if (Array.isArray(sources)) {
        for (const s of sources) {
          if (!s?.name || !s?.platform || !s?.identifier) continue;
          await db.source.upsert({
            where: { platform_identifier: { platform: s.platform, identifier: s.identifier } },
            create: {
              name: s.name,
              platform: s.platform,
              identifier: s.identifier,
              url: s.url ?? null,
              language: s.language || 'fa',
              region: s.region || 'نامشخص',
              priority: s.priority || 'متوسط',
              isActive: true,
              status: 'فعال',
            },
            update: { name: s.name },
          }).catch(() => {});
          added++;
        }
      }
    }
    // رویدادهای مستند پیش رو (فقط دادهٔ واقعی با منبع) — اگر جدول خالی بود
    if ((await db.majorEvent.count()) === 0) {
      const { seedEvents } = await import('../../scripts/seed-events');
      const n = await seedEvents().catch(() => -1);
      if (n > 0) console.log(`[bootstrap] ${n} رویداد مستند پیش رو بازیابی شد`);
    }
    const finalCount = await db.source.count();
    if (added > 0) {
      await db.jobRun.create({
        data: {
          jobType: 'bootstrap',
          status: 'موفق',
          finishedAt: new Date(),
          details: `خودترمیمی پس از بانک خالی: ${added} منبع از bot/sources.json + دسته‌های موضوعی و ربات`,
        },
      }).catch(() => {});
      console.log(`[bootstrap] بانک خالی بود — ${added} منبع و دسته‌ها خودکار بازیابی شدند (کل: ${finalCount})`);
    }
    return { seeded: added > 0, sources: finalCount };
  } catch (e) {
    console.error('[bootstrap] خطای خودترمیمی:', e instanceof Error ? e.message : e);
    return { seeded: false, sources: -1 };
  }
}
