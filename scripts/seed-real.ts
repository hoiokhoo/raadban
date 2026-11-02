/**
 * Seed واقعی — جایگزینی منابع ساختگی با منابع واقعی تأییدشده + ثبت پرامپت‌های تخصصی
 * اجرا: bun run scripts/seed-real.ts
 * الزام سند: هیچ نام کانال، آمار یا منبع ساختگی تولید نمی‌شود.
 * همه منابع زیر به‌صورت زنده از این محیط آزمایش شده‌اند (تاریخ: 2026-10-30).
 */
import { PrismaClient } from '@prisma/client';
import { CAR_PROMPT, ECONOMY_PROMPT, FOREIGN_POLICY_PROMPT, TECH_PROMPT, ENERGY_PROMPT } from './seed-prompts';

const db = new PrismaClient();

const PROMPT_VERSION_TAG = 'v1';

async function setCategoryPrompt(slug: string, prompt: string) {
  const cat = await db.category.findUnique({ where: { slug } });
  if (!cat) {
    console.log(`⚠ دسته ${slug} یافت نشد`);
    return;
  }
  await db.category.update({ where: { slug }, data: { promptTemplate: prompt } });
  await db.promptVersion.upsert({
    where: { name_version: { name: `category:${slug}`, version: PROMPT_VERSION_TAG } },
    create: { name: `category:${slug}`, version: PROMPT_VERSION_TAG, content: prompt, isActive: true, notes: 'Seed اولیه (خودرو: عیناً از سند کاربر؛ سایر: نگاشت هم‌سطح)' },
    update: { content: prompt, isActive: true },
  });
  console.log(`✓ پرامپت دسته «${cat.name}» ثبت شد (${prompt.length} نویسه)`);
}

async function deleteFakeSources() {
  const fakes = await db.source.findMany({ where: { OR: [{ name: { contains: 'نمونه' } }, { name: { contains: 'تست یکپارچه' } }] } });
  for (const s of fakes) {
    const removedPosts = await db.post.deleteMany({ where: { sourceId: s.id } });
    await db.source.delete({ where: { id: s.id } });
    console.log(`✗ منبع ساختگی حذف شد: «${s.name}» (${removedPosts.count} مطلب وابسته به آن حذف شد)`);
  }
  if (!fakes.length) console.log('• منبع ساختگی‌ای باقی نمانده بود');
}

interface RealSource {
  name: string; platform: string; identifier: string; url?: string;
  cats: string[]; limits: string; trustNote: string;
}

const REAL_SOURCES: RealSource[] = [
  {
    name: 'خبرگزاری مهر (RSS)', platform: 'rss', identifier: 'https://www.mehrnews.com/rss',
    url: 'https://www.mehrnews.com/', cats: ['khodro', 'economy'],
    limits: 'پوشش برابر آخرین اقلام خوراک است (حدود ۳۰ مطلب). متن کامل مقاله در خوراک خلاصه‌شده است.',
    trustNote: 'خبرگزاری عمومی شناخته‌شده. تصمیم نهایی اعتماد با کاربر است.',
  },
  {
    name: 'خبرآنلاین (RSS)', platform: 'rss', identifier: 'https://www.khabaronline.ir/rss',
    url: 'https://www.khabaronline.ir/', cats: ['khodro', 'economy', 'foreign-policy'],
    limits: 'پوشش برابر آخرین اقلام خوراک است.',
    trustNote: 'خبرگزاری عمومی شناخته‌شده. تصمیم نهایی اعتماد با کاربر است.',
  },
  {
    name: 'دنیای اقتصاد (RSS)', platform: 'rss', identifier: 'https://www.donya-e-eqtesad.com/rss',
    url: 'https://www.donya-e-eqtesad.com/', cats: ['economy', 'khodro'],
    limits: 'پوشش برابر آخرین اقلام خوراک است.',
    trustNote: 'روزنامه اقتصادی شناخته‌شده. تصمیم نهایی اعتماد با کاربر است.',
  },
  {
    name: 'مشرق نیوز (RSS)', platform: 'rss', identifier: 'https://www.mashreghnews.ir/rss',
    url: 'https://www.mashreghnews.ir/', cats: ['foreign-policy'],
    limits: 'پوشش برابر آخرین اقلام خوراک است.',
    trustNote: 'سایت خبری شناخته‌شده با گرایش مشخص؛ ارزیابی سوگیری با کاربر و تحلیل سامانه.',
  },
  {
    name: 'اقتصادآنلاین (RSS)', platform: 'rss', identifier: 'https://www.eghtesadonline.com/rss',
    url: 'https://www.eghtesadonline.com/', cats: ['economy', 'khodro'],
    limits: 'پوشش برابر آخرین اقلام خوراک است (تا ۱۰۰ قلم).',
    trustNote: 'پایگاه خبری اقتصادی شناخته‌شده. تصمیم نهایی اعتماد با کاربر است.',
  },
  {
    name: 'خبرگزاری تسنیم (کانال تلگرام)', platform: 'telegram', identifier: 'TasnimNews_Agency',
    url: 'https://t.me/TasnimNews_Agency', cats: ['foreign-policy', 'economy'],
    limits: 'فقط کانال‌های عمومی با پیش‌نمایش وب فعال (t.me/s). پیام‌های فقط‌رسانه‌ای (عکس/ویدیو بدون متن) دریافت نمی‌شوند. سابقه محدود به صفحات پیش‌نمایش.',
    trustNote: 'کانال رسمی شناخته‌شده یک خبرگزاری. آمار اعضا در این روش قابل استخراج نیست — نامعلوم.',
  },
  {
    name: 'کانال خبر ایتا', platform: 'eitaa', identifier: 'khabar',
    url: 'https://eitaa.com/khabar', cats: ['foreign-policy', 'tech'],
    limits: 'فقط کانال‌های عمومی با صفحه وب ایتا. API عمومی مستند برای تاریخچه کامل وجود ندارد. آمار اعضا نامعلوم.',
    trustNote: 'کانال عمومی خبری در ایتا؛ مالکیت رسمی از طریق صفحه عمومی قابل راستی‌آزمایی نیست — کاربر باید تأیید کند.',
  },
];

async function upsertRealSources() {
  for (const s of REAL_SOURCES) {
    const existing = await db.source.findUnique({
      where: { platform_identifier: { platform: s.platform, identifier: s.identifier } },
    });
    const source = await db.source.upsert({
      where: { platform_identifier: { platform: s.platform, identifier: s.identifier } },
      create: {
        name: s.name, platform: s.platform, identifier: s.identifier, url: s.url,
        status: 'غیرفعال', statusDetail: 'هنوز دریافت اولیه انجام نشده است',
        trustNote: s.trustNote, limitsNote: s.limits, fetchIntervalMin: 60, maxItemsPerFetch: 30,
      },
      update: { name: s.name, url: s.url, trustNote: s.trustNote, limitsNote: s.limits },
    });
    for (const slug of s.cats) {
      const cat = await db.category.findUnique({ where: { slug } });
      if (!cat) { console.log(`⚠ دسته ${slug} برای پیوند منبع یافت نشد`); continue; }
      await db.sourceCategory.upsert({
        where: { sourceId_categoryId: { sourceId: source.id, categoryId: cat.id } },
        create: { sourceId: source.id, categoryId: cat.id },
        update: {},
      });
    }
    console.log(`✓ منبع واقعی ثبت شد: ${s.name} → [${s.cats.join(', ')}]`);
  }
}

async function createKhodroCategory() {
  const cat = await db.category.upsert({
    where: { slug: 'khodro' },
    create: {
      slug: 'khodro',
      name: 'خودرو، بازار خودرو و صنعت حمل‌ونقل',
      description: 'قیمت و معاملات، تولید و تیراژ، واردات و تعرفه، قطعات و زنجیره تأمین، خودروهای برقی و فناوری خودرو در ایران و جهان',
      color: '#0f766e',
      isActive: true,
      promptTemplate: CAR_PROMPT,
    },
    update: { promptTemplate: CAR_PROMPT, isActive: true },
  });
  await db.promptVersion.upsert({
    where: { name_version: { name: 'category:khodro', version: PROMPT_VERSION_TAG } },
    create: { name: 'category:khodro', version: PROMPT_VERSION_TAG, content: CAR_PROMPT, isActive: true, notes: 'عیناً از پرامپت تخصصی سند کاربر' },
    update: { content: CAR_PROMPT, isActive: true },
  });
  console.log(`✓ دسته خودرو آماده شد: ${cat.name}`);
}

async function main() {
  console.log('=== Seed واقعی سامانه رصد‌بان ===');
  await createKhodroCategory();
  await setCategoryPrompt('economy', ECONOMY_PROMPT);
  await setCategoryPrompt('foreign-policy', FOREIGN_POLICY_PROMPT);
  await setCategoryPrompt('tech', TECH_PROMPT);
  await setCategoryPrompt('energy', ENERGY_PROMPT);
  await deleteFakeSources();
  await upsertRealSources();
  const [cats, srcs] = await Promise.all([db.category.count(), db.source.count()]);
  console.log(`=== پایان Seed — دسته‌ها: ${cats}، منابع: ${srcs} ===`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
