/**
 * داده نمونه واقع‌گرایانه فارسی برای راه‌اندازی سامانه
 * - دسته‌های نمونه، منابع واقعی عمومی، مطالب نمونه با تاریخ‌های اخیر
 * - مطالب نمونه عمداً شامل: خبر اصلی + بازنشر آن، ادعای عددی، تاریخ وقوع، تبلیغ
 * اجرا: bun run scripts/seed.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function normalizePersian(text: string): string {
  return text.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
function contentHash(text: string): string {
  const norm = normalizePersian(text).toLowerCase().replace(/https?:\/\/\S+/g, '')
    .replace(/[^\u0600-\u06FF\w\s]/g, '').replace(/\s+/g, ' ').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) { h ^= norm.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0') + '_' + norm.length.toString(16);
}

function iso(daysAgo: number, hour = 10): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 30, 0, 0);
  return d;
}

function dateOnly(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
  return p.format(d);
}

async function main() {
  console.log('— شروع داده نمونه —');

  const cats = [
    { slug: 'economy', name: 'اقتصاد', description: 'بازار ارز، سکه، بورس، قیمت‌گذاری و بودجه', color: '#0f766e',
      promptTemplate: 'در تحلیل اقتصادی: تغییرات نرخ ارز را با روند روزهای قبل مقایسه کن؛ برای هر عدد، مرجع رسمی (بانک مرکزی/مرکز آمار) را از بازنشرهای رسانه‌ای تفکیک کن. نتیجه‌گیری سیاستی نکن.' },
    { slug: 'foreign-policy', name: 'سیاست خارجی', description: 'دیپلماسی، مذاکرات، روابط دوجانبه', color: '#7c3aed',
      promptTemplate: 'در تحلیل سیاست خارجی: اظهارات رسمی (وزارت امور خارجه) را از «منابع نزدیک به...» جدا کن؛ ادعاهای رسانه‌های خارجی بدون منبع مستقل را تأییدنشده گزارش کن.' },
    { slug: 'tech', name: 'فناوری', description: 'هوش مصنوعی، استارتاپ‌ها، اینترنت و پلتفرم‌ها', color: '#0284c7' },
    { slug: 'energy', name: 'انرژی', description: 'نفت و گاز، برق، پتروشیمی', color: '#b45309' },
  ];
  const catMap: Record<string, string> = {};
  for (const c of cats) {
    const cat = await db.category.upsert({ where: { slug: c.slug }, create: c, update: {} });
    catMap[c.slug] = cat.id;
  }

  const sources = [
    { name: 'خبرگزاری رسمی نمونه — اقتصادی', platform: 'rss', identifier: 'https://www.irna.ir/rss', categories: ['economy', 'energy'], trustNote: 'خبرگزاری رسمی دولتی — برای آمار رسمی مرجع است ولی چارچوب تحریریه دولتی دارد' },
    { name: 'کانال تحلیل اقتصادی A (نمونه)', platform: 'telegram', identifier: 'ecodaily_sample', categories: ['economy'], trustNote: 'تحلیل شخصی — سابقه خطای عددی؛ منبع مستقل حساب نمی‌شود' },
    { name: 'کانال خبری فوری B (نمونه)', platform: 'telegram', identifier: 'newsflash_sample', categories: ['foreign-policy', 'economy'], trustNote: 'بازنشرگر — معمولاً از کانال‌های دیگر نقل می‌کند' },
    { name: 'کانال ایتا تحلیل فناوری (نمونه)', platform: 'eitaa', identifier: 'techpulse_sample', categories: ['tech'] },
  ];
  for (const s of sources) {
    const { categories, ...rest } = s;
    await db.source.upsert({
      where: { platform_identifier: { platform: s.platform, identifier: s.identifier } },
      create: { ...rest, categories: { create: categories.map((slug) => ({ categoryId: catMap[slug] })) } },
      update: {},
    });
  }

  const posts: Array<{
    src: string; ext: string; text: string; daysAgo: number; hour?: number; url?: string;
    importance?: number; urgency?: number; mainCat?: string; isAd?: boolean;
  }> = [
    {
      src: 'خبرگزاری رسمی نمونه — اقتصادی', ext: 'irna-101', daysAgo: 0, hour: 9, url: 'https://www.irna.ir/sample-101',
      text: 'بانک مرکزی امروز اعلام کرد نرخ دلار در بازار آزاد به ۵۸ هزار و ۲۰۰ تومان رسید. این نرخ در مقایسه با روز گذشته ۳/۴ درصد کاهش نشان می‌دهد. رئیس بانک مرکزی گفت: «عرضه ارز مسافرتی از هفته آینده با سهمیه جدید آغاز می‌شود.»',
      importance: 4, urgency: 3, mainCat: 'economy',
    },
    {
      src: 'کانال تحلیل اقتصادی A (نمونه)', ext: 'tg-eco-55', daysAgo: 0, hour: 10, url: 'https://t.me/ecodaily_sample/55',
      text: 'بر اساس گزارش‌ها نرخ دلار به ۵۸ هزار و ۲۰۰ تومان رسید. انتظار می‌رود در صورت ادامه عرضه مسافرتی، فشار قیمتی در هفته جاری کاهش یابد. البته این تحلیل است و نیازمند پیگیری داده‌های عرضه است.',
      importance: 3, urgency: 2, mainCat: 'economy',
    },
    {
      src: 'کانال خبری فوری B (نمونه)', ext: 'tg-news-231', daysAgo: 0, hour: 11, url: 'https://t.me/newsflash_sample/231',
      text: 'بانک مرکزی اعلام کرد نرخ دلار در بازار آزاد به ۵۸ هزار و ۲۰۰ تومان رسید — ۳/۴ درصد کمتر از دیروز. عرضه ارز مسافرتی از هفته آینده با سهمیه جدید شروع می‌شود.',
      importance: 3, urgency: 3, mainCat: 'economy',
    },
    {
      src: 'کانال خبری فوری B (نمونه)', ext: 'tg-news-232', daysAgo: 0, hour: 12,
      text: '🔥🔥 فروش ویژه دوره‌های ارزی! فقط تا آخر هفته ۳۰٪ تخفیف. برای ثبت نام به آدمین پیام بده @admin. کانال ما را به دوستانت معرفی کن',
      isAd: true, mainCat: 'economy',
    },
    {
      src: 'کانال ایتا تحلیل فناوری (نمونه)', ext: 'eitaa-tp-77', daysAgo: 0, hour: 8, url: 'https://eitaa.com/techpulse_sample/77',
      text: 'یک شرکت فناوری داخلی امروز از عرضه دستیار هوش مصنوعی فارسی‌زبان جدید خبر داد. طبق اطلاعیه رسمی این شرکت، مدل جدید روی ۱۲ هزار قطعه سخت‌افزار داخلی آموزش دیده و از ۲۰ آبان ۱۴۰۴ در دسترس عمومی قرار می‌گیرد.',
      importance: 3, urgency: 2, mainCat: 'tech',
    },
    {
      src: 'خبرگزاری رسمی نمونه — اقتصادی', ext: 'irna-98', daysAgo: 1, hour: 14, url: 'https://www.irna.ir/sample-98',
      text: 'دیروز (۹ آبان ۱۴۰۴) میانگین نرخ دلار در بازار آزاد ۶۰ هزار و ۳۰۰ تومان بود. مصوبه جدید شورای پول و اعتبار درباره سقف تسهیلات خرد از ابتدای ماه آینده اجرایی می‌شود.',
      importance: 3, urgency: 2, mainCat: 'economy',
    },
    {
      src: 'کانال خبری فوری B (نمونه)', ext: 'tg-news-215', daysAgo: 1, hour: 15,
      text: 'گزارشی از نشست دیپلمات‌های منطقه: یک دیپلمات ارشد گفته مذاکرات بعدی تا پایان ماه برگزار می‌شود. منبع مستقیم منتشر نشده — در انتظار تأیید رسمی.',
      importance: 4, urgency: 3, mainCat: 'foreign-policy',
    },
  ];

  for (const p of posts) {
    const source = await db.source.findFirst({ where: { name: p.src } });
    const publishedAt = iso(p.daysAgo, p.hour);
    const status = p.isAd ? 'حذف_تبلیغات' : 'پردازش‌شده';
    const where = { sourceId_externalId: { sourceId: source?.id || '', externalId: p.ext } };
    const existing = await db.post.findUnique({ where });
    if (!existing) {
      await db.post.create({
        data: {
          sourceId: source?.id, externalId: p.ext, content: p.text, normalized: normalizePersian(p.text),
          url: p.url, publishedAt, publishedDateOnly: dateOnly(publishedAt), fetchedAt: publishedAt,
          language: 'fa', contentHash: contentHash(p.text), processingStatus: status,
          isAd: Boolean(p.isAd), importanceScore: p.importance || 0, urgencyScore: p.urgency || 0,
          metadata: JSON.stringify({ seeded: true }),
          processingSteps: JSON.stringify([{ step: 'نرمال‌سازی', ok: true }, { step: 'داده_نمونه', ok: true }]),
          categories: p.mainCat && !p.isAd ? { create: [{ categoryId: catMap[p.mainCat], isMain: true, confidence: 0.9 }] } : undefined,
        },
      });
    }
  }

  const claimData = [
    { ext: 'irna-101', text: 'نرخ دلار در بازار آزاد به ۵۸ هزار و ۲۰۰ تومان رسید', status: 'عمدتاً_تأییدشده', conf: 'متوسط', note: 'دو پوشش مستقل درون‌سامانه‌ای (خبرگزاری رسمی + تحلیل‌گر) با عدد یکسان؛ ولی هر دو به یک اطلاعیه رسمی ارجاع دارند — وابستگی احتمالی.' },
    { ext: 'tg-news-231', text: 'عرضه ارز مسافرتی از هفته آینده با سهمیه جدید آغاز می‌شود', status: 'تأییدنشده', conf: 'پایین', note: 'فقط نقل‌قول از رئیس بانک مرکزی در خبر؛ سند رسمی جداگانه در دسترس نیست — امکان تأیید مستقل فراهم نشد.' },
  ];
  for (const c of claimData) {
    const post = await db.post.findFirst({ where: { externalId: c.ext } });
    if (!post) continue;
    const exists = await db.claim.findFirst({ where: { postId: post.id, text: c.text } });
    if (!exists) {
      await db.claim.create({
        data: {
          postId: post.id, text: c.text, kind: 'عدد', publisherName: post.source?.name,
          publishedAt: post.publishedAt, status: c.status, confidence: c.conf, confidenceNote: c.note,
          evidenceSearchedAt: new Date(),
        },
      });
    }
  }

  const dollarPosts = await db.post.findMany({ where: { externalId: { in: ['irna-101', 'tg-eco-55', 'tg-news-231'] } } });
  if (dollarPosts.length >= 2) {
    const dedupKey = 'دلار|نرخ|بازار|تومان|بانک_مرکزی';
    let evt = await db.event.findFirst({ where: { dedupKey } });
    if (!evt) {
      evt = await db.event.create({
        data: {
          dedupKey, title: 'اعلام نرخ دلار ۵۸٬۲۰۰ تومان توسط بانک مرکزی',
          summary: 'بانک مرکزی نرخ دلار بازار آزاد را ۵۸٬۲۰۰ تومان اعلام کرد — ۳/۴٪ کمتر از روز قبل.',
          categoryId: catMap['economy'], importance: 4, urgency: 3,
          originSourceId: dollarPosts.find((p) => p.externalId === 'irna-101')?.sourceId,
          originNote: 'قدیمی‌ترین انتشار شناسایی‌شده در این سامانه از «خبرگزاری رسمی نمونه — اقتصادی». سایر پوشش‌ها احتمالاً بازنشر همان اطلاعیه‌اند.',
        },
      });
    }
    for (const p of dollarPosts) {
      await db.eventPost.upsert({
        where: { eventId_postId: { eventId: evt.id, postId: p.id } },
        create: { eventId: evt.id, postId: p.id }, update: {},
      });
    }
  }

  await db.setting.upsert({
    where: { key: 'schedule' },
    create: { key: 'schedule', value: JSON.stringify({ enabled: true, reportTime: '22:30', activeDays: [0, 1, 2, 3, 4, 5, 6], catchUp: true, autoFactcheck: true, timezone: 'Asia/Tehran' }) },
    update: {},
  });
  await db.setting.upsert({
    where: { key: 'ai_budget' },
    create: { key: 'ai_budget', value: JSON.stringify({ dailyTokenLimit: 200000 }) },
    update: {},
  });
  await db.setting.upsert({
    where: { key: 'ai_model' },
    create: { key: 'ai_model', value: 'glm-4.5-air' },
    update: {},
  });

  console.log('— داده نمونه ثبت شد —');
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
