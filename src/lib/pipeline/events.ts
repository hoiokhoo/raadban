/**
 * رویدادهای یکتا — تشخیص بازنشر و ادغام مطالب یک خبر (فصل ۶ بند ۷ و فصل ۸)
 * - کلید یکتایی رویداد: شباهت معنایی ساده + کلیدواژه‌های محوری
 * - منشأ اولیه: قدیمی‌ترین انتشار + ثبت وابستگی احتمالی منابع
 * - بازنشر هرگز شواهد مستقل حساب نمی‌شود
 */
import { db } from '@/lib/db';
import { jaccardSimilarity } from './normalize';

/** کلیدواژه‌های محوری یک متن (حذف ایست‌واژه‌های فارسی رایج) */
const STOPWORDS = new Set([
  'از', 'به', 'با', 'در', 'که', 'این', 'آن', 'را', 'و', 'برای', 'است', 'بود', 'شده', 'شد',
  'های', 'ها', 'یک', 'تا', 'بر', 'هم', 'می', 'نیز', 'اما', 'یا', 'هر', 'بین', 'روی',
  'کند', 'کرد', 'کردند', 'دارد', 'داشت', 'دهد', 'دهد', 'خواهد', 'بوده', 'شود', 'دو',
  'بهتر', 'بیشتر', 'طی', 'طبق', 'طرف', 'گزارش', 'خبر', 'اخبار', 'روز', 'امروز', 'دیروز',
]);

export function keywords(text: string, max = 8): string[] {
  const words = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\u0600-\u06FF\w\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  // فراوانی
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w);
}

export function eventDedupKey(text: string): string {
  const kw = keywords(text, 6).sort().join('|');
  return kw || 'empty';
}

/**
 * یافتن رویداد موجود مرتبط یا ساخت رویداد جدید برای مطلب
 * @returns شناسه رویداد و اینکه آیا مطلب بازنشر بود
 */
export async function assignEventToPost(postId: string): Promise<{
  eventId: string; isNew: boolean; isRepost: boolean; repostOfPostId?: string;
}> {
  const post = await db.post.findUnique({ where: { id: postId }, include: { source: true } });
  if (!post) throw new Error('مطلب یافت نشد');
  const text = post.normalized || post.content;
  const kw = keywords(text, 6);

  // نامزدها: رویدادهای ۱۴ روز اخیر
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const candidates = await db.event.findMany({
    where: { lastSeenAt: { gte: since } },
    include: { posts: { include: { post: true } } },
    take: 120,
    orderBy: { lastSeenAt: 'desc' },
  });

  let best: { event: (typeof candidates)[0]; score: number } | null = null;
  for (const cand of candidates) {
    // امتیاز ترکیبی: اشتراک کلیدواژه + شباهت جاکارد با اولین مطلب رویداد
    const candKw = new Set(cand.dedupKey.split('|').filter(Boolean));
    const kwOverlap = kw.filter((w) => candKw.has(w)).length;
    const firstPost = cand.posts.find((p) => p.post.content)?.post;
    const sim = firstPost ? jaccardSimilarity(text, firstPost.content) : 0;
    const score = kwOverlap / Math.max(1, Math.min(6, kw.length)) * 0.5 + sim * 0.5;
    if (score >= 0.45 && (!best || score > best.score)) best = { event: cand, score };
  }

  // تشخیص بازنشر: آیا همین مطلب قبلاً (با هش مشابه یا شباهت بالا) از منبع دیگر ثبت شده؟
  let isRepost = false;
  let repostOfPostId: string | undefined;
  if (best) {
    for (const ep of best.event.posts) {
      if (ep.postId === postId) continue;
      if (jaccardSimilarity(text, ep.post.content) >= 0.55) {
        isRepost = true;
        repostOfPostId = ep.postId;
        break;
      }
    }
  }

  if (best) {
    // پیوند مطلب به رویداد موجود + به‌روزرسانی lastSeenAt
    await db.eventPost.upsert({
      where: { eventId_postId: { eventId: best.event.id, postId } },
      create: { eventId: best.event.id, postId },
      update: {},
    });
    await db.event.update({
      where: { id: best.event.id },
      data: {
        lastSeenAt: new Date(),
        importance: Math.max(best.event.importance, post.importanceScore || 0),
        urgency: Math.max(best.event.urgency, post.urgencyScore || 0),
      },
    });
    // ثبت منشأ اولیه: اگر این مطلب قدیمی‌تر از منشأ ثبت‌شده است
    const evt = await db.event.findUnique({ where: { id: best.event.id }, include: { posts: { include: { post: { include: { source: { select: { name: true } } } } } } } });
    if (evt) {
      const earliest = evt.posts
        .map((ep) => ep.post)
        .filter((p) => p.publishedAt)
        .sort((a, b) => (a.publishedAt?.getTime() || 0) - (b.publishedAt?.getTime() || 0))[0];
      if (earliest && earliest.sourceId && evt.originSourceId !== earliest.sourceId) {
        await db.event.update({
          where: { id: evt.id },
          data: {
            originSourceId: earliest.sourceId,
            originNote: `قدیمی‌ترین انتشار شناسایی‌شده در این سامانه از «${earliest.source?.name || 'منبع ناشناس'}». سایر منابع ممکن است وابسته (بازنشر) باشند.`,
          },
        });
      }
    }
    return { eventId: best.event.id, isNew: false, isRepost, repostOfPostId };
  }

  // ساخت رویداد جدید
  const title = text.trim().slice(0, 120);
  const evt = await db.event.create({
    data: {
      dedupKey: eventDedupKey(text) + '_' + Date.now().toString(36),
      title,
      summary: text.slice(0, 800),
      originSourceId: post.sourceId,
      originNote: post.source ? `اولین مشاهده در سامانه از «${post.source.name}».` : 'اولین مشاهده در سامانه.',
      importance: post.importanceScore || 0,
      urgency: post.urgencyScore || 0,
    },
  });
  await db.eventPost.create({ data: { eventId: evt.id, postId } });
  return { eventId: evt.id, isNew: true, isRepost: false };
}
