/**
 * دسته‌بندی موضوعی همه اخبار — قابلیت T9
 * - طبقه ثابت فارسی (۱۲ موضوع) — هیچ دسته خودسرانه‌ای از مدل پذیرفته نمی‌شود
 * - دسته‌ای: هر فراخوانی حداکثر ۲۵ پست؛ خروجی JSON اعتبارسنجی‌شده
 * - دسته‌ها با slug ثابت «topic-*» خودکار ساخته می‌شوند (idempotent)
 * - صداقت: خطای مدل → پست همان بی‌دسته می‌ماند و خطا شمرده می‌شود
 */
import { db } from '@/lib/db';
import { aiCall, extractJson } from '@/lib/ai/client';

export interface TopicSpec { name: string; slug: string }

/** طبقه ثابت موضوعی سامانه — ترتیب ثابت برای نمایش */
export const TOPICS: TopicSpec[] = [
  { name: 'سیاسی', slug: 'politics' },
  { name: 'اقتصادی', slug: 'economy' },
  { name: 'نظامی-امنیتی', slug: 'military-security' },
  { name: 'بین‌الملل', slug: 'international' },
  { name: 'اجتماعی', slug: 'social' },
  { name: 'فرهنگی-هنری', slug: 'culture-arts' },
  { name: 'ورزشی', slug: 'sports' },
  { name: 'علم و فناوری', slug: 'science-tech' },
  { name: 'سلامت و بهداشت', slug: 'health' },
  { name: 'محیط‌زیست و انرژی', slug: 'environment' },
  { name: 'حوادث و ایمنی', slug: 'incidents' },
  { name: 'سایر/نامشخص', slug: 'other' },
];

export const TOPIC_NAMES = TOPICS.map((t) => t.name);
const FALLBACK = 'سایر/نامشخص';

export const SYSTEM_TOPIC_CLASSIFY = `
شما طبقه‌بند موضوعی اخبار فارسی و چندزبانه هستید.
برای هر خبر شماره‌دار، دقیقاً یکی از موضوع‌های فهرست زیر را برگزینید:
${TOPIC_NAMES.map((n) => `- ${n}`).join('\n')}
قواعد:
- فقط از همین نام‌ها استفاده کنید؛ هیچ موضوع دیگری مجاز نیست.
- «بین‌الملل» برای خبرهای خارج از ایران/منطقه و روابط بین‌کشوری است؛ اخبار داخلی سیاسی «سیاسی» است.
- اخبار نظامی/تروریستی/امنیتی/جنگ «نظامی-امنیتی» است حتی اگر بازیگر خارجی داشته باشد؛ اگر صرفاً دیپلماسی خارجی است «بین‌الملل».
- اگر واقعاً نامشخص است «سایر/نامشخص».
خروجی فقط JSON:
{"items":[{"i":1,"topic":"سیاسی"},{"i":2,"topic":"اقتصادی"}]}
`.trim();

/** ساخت/یافتن دسته‌های موضوعی و برگرداندن نقشه name→categoryId (idempotent) */
export async function ensureTopicCategories(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const t of TOPICS) {
    const cat = await db.category.upsert({
      where: { slug: `topic-${t.slug}` },
      create: {
        slug: `topic-${t.slug}`,
        name: t.name,
        description: `دسته موضوعی خودکار سامانه برای اخبار ${t.name}`,
      },
      update: { name: t.name },
    });
    map.set(t.name, cat.id);
  }
  return map;
}

interface BatchItem { i: number; topic: string }

/** اعتبارسنجی خروجی مدل — صادرشده برای تست؛ نامعتبر → «سایر/نامشخص» */
export function validateTopicBatch(x: unknown): { items: BatchItem[] } | null {
  if (typeof x !== 'object' || x === null) return null;
  const items = (x as Record<string, unknown>).items;
  if (!Array.isArray(items)) return null;
  const out: BatchItem[] = [];
  for (const it of items) {
    if (typeof it !== 'object' || it === null) continue;
    const o = it as Record<string, unknown>;
    const i = Number(o.i);
    const topic = typeof o.topic === 'string' ? o.topic.trim() : '';
    if (!Number.isInteger(i) || i < 1) continue;
    out.push({ i, topic: TOPIC_NAMES.includes(topic) ? topic : FALLBACK });
  }
  return out.length ? { items: out } : null;
}

export interface CategorizeOutcome {
  processed: number;
  categorized: number;
  fallback: number;
  aiErrors: string[];
}

/**
 * دسته‌بندی پست‌های بدون دسته موضوعی — قدیمی‌ترین اول
 * (فقط پست‌هایی که هیچ پیوند topic-* ندارند)
 */
export async function categorizePendingPosts(opts: { limit?: number; batchSize?: number } = {}): Promise<CategorizeOutcome> {
  const limit = Math.min(300, Math.max(1, opts.limit ?? 100));
  // دسته کوچک: مدل رایگان (GPT-OSS 20B) سقف خروجی محدود دارد — ۱۰ آیتم با متن کوتاه
  const batchSize = Math.min(12, Math.max(4, opts.batchSize ?? 10));
  const catMap = await ensureTopicCategories();
  const topicSlugs = TOPICS.map((t) => `topic-${t.slug}`);

  const pending = await db.post.findMany({
    where: { categories: { none: { category: { slug: { in: topicSlugs } } } } },
    orderBy: { publishedAt: 'asc' },
    take: limit,
    select: { id: true, content: true, translationFa: true },
  });

  const outcome: CategorizeOutcome = { processed: 0, categorized: 0, fallback: 0, aiErrors: [] };

  for (let start = 0; start < pending.length; start += batchSize) {
    const batch = pending.slice(start, start + batchSize);
    if (!batch.length) break;
    const listing = batch
      .map((p, idx) => `${idx + 1}. ${(p.translationFa || p.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 250)}`)
      .join('\n');

    const res = await aiCall({
      purpose: 'طبقه‌بندی_موضوعی',
      systemPrompt: SYSTEM_TOPIC_CLASSIFY,
      userContent: `خبرهای شماره‌دار:\n${listing}`,
      maxChars: 11000,
      temperature: 0,
    });

    if (!res.ok || !res.content) {
      outcome.aiErrors.push(res.error || 'پاسخ خالی مدل');
      continue; // این دسته بی‌دسته می‌ماند — صادقانه
    }
    const parsed = extractJson<{ items: BatchItem[] }>(res.content, validateTopicBatch);
    if (!parsed) {
      outcome.aiErrors.push('خروجی مدل قابل تجزیه به ساختار طبقه‌بندی نبود');
      continue;
    }

    for (const item of parsed.items) {
      const idx = item.i - 1;
      if (idx < 0 || idx >= batch.length) continue;
      const post = batch[idx];
      const categoryId = catMap.get(item.topic) || catMap.get(FALLBACK)!;
      try {
        await db.postCategory.upsert({
          where: { postId_categoryId: { postId: post.id, categoryId } },
          create: { postId: post.id, categoryId, isMain: true, confidence: item.topic === FALLBACK ? 0.2 : 0.8 },
          update: { isMain: true },
        });
        outcome.categorized++;
        if (item.topic === FALLBACK) outcome.fallback++;
      } catch {
        // پیوند تکراری — بی‌اثر
      }
    }
    outcome.processed += batch.length;
  }

  return outcome;
}

/** آمار موضوعی فعلی — شمارش پست در هر دسته topic-* */
export async function topicStats(): Promise<Array<{ name: string; slug: string; categoryId: string | null; count: number }>> {
  const topicCats = await db.category.findMany({
    where: { slug: { startsWith: 'topic-' } },
    include: { _count: { select: { posts: true } } },
  });
  const bySlug = new Map(topicCats.map((c) => [c.slug, c]));
  return TOPICS.map((t) => {
    const cat = bySlug.get(`topic-${t.slug}`);
    return { name: t.name, slug: t.slug, categoryId: cat?.id || null, count: cat ? cat._count.posts : 0 };
  });
}

/** تعداد پست‌های هنوز بی‌موضوع */
export async function uncategorizedCount(): Promise<number> {
  const topicSlugs = TOPICS.map((t) => `topic-${t.slug}`);
  return db.post.count({ where: { categories: { none: { category: { slug: { in: topicSlugs } } } } } });
}
