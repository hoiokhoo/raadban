/**
 * حافظه تاریخی واقعی — فصل ۸ سند
 * بازیابی ترکیبی: دسته + تاریخ + کلیدواژه + شناسه رویداد + شباهت متنی
 * فقط اطلاعات مرتبط با گزارش جاری وارد زمینه مدل می‌شود (کاهش هزینه و نویز).
 */
import { db } from '@/lib/db';
import { jaccardSimilarity, normalizePersian } from './pipeline/normalize';
import { keywords } from './pipeline/events';

export interface MemoryContext {
  /** خلاصه رویدادهای مرتبط روزهای قبل (۱ تا ۱۴ روز) */
  pastEvents: Array<{
    id: string; title: string; firstSeenAt: string; lastSeenAt: string;
    importance: number; sourceCount: number; note?: string;
  }>;
  /** ادعاهای قبلی مرتبط (برای مقایسه تناقض/تداوم) */
  pastClaims: Array<{ id: string; text: string; status: string; confidence: string; date: string }>;
  /** تناقض‌های ثبت‌شده میان ادعاهای قبلی و جدید */
  contradictions: Array<{ newClaimId: string; oldClaimId: string; note: string }>;
  /** اطلاعات ناقص حافظه — صریحاً اعلام می‌شود */
  gaps: string[];
}

/**
 * بازیافت زمینه تاریخی برای گزارش یک دسته در یک روز مشخص.
 * newsTexts: متن‌های مطالب امروز (برای مقایسه با گذشته)
 */
export async function buildMemoryContext(
  categoryId: string | null,
  beforeISO: string,
  daysBack: number,
  newsTexts: string[]
): Promise<MemoryContext> {
  const gaps: string[] = [];
  const since = new Date(beforeISO + 'T00:00:00Z');
  since.setUTCDate(since.getUTCDate() - daysBack);
  const until = new Date(beforeISO + 'T23:59:59Z');

  // رویدادهای گذشته این دسته
  const pastEventsRaw = await db.event.findMany({
    where: {
      createdAt: { gte: since, lte: until },
      ...(categoryId ? { categoryId } : {}),
    },
    include: { _count: { select: { posts: true } } },
    orderBy: { lastSeenAt: 'desc' },
    take: 40,
  });

  const pastEvents = pastEventsRaw.map((e) => ({
    id: e.id,
    title: e.title.slice(0, 150),
    firstSeenAt: e.firstSeenAt.toISOString().slice(0, 10),
    lastSeenAt: e.lastSeenAt.toISOString().slice(0, 10),
    importance: e.importance,
    sourceCount: e._count.posts,
    note: e.originNote || undefined,
  }));

  // ادعاهای گذشته مرتبط (بر اساس کلیدواژه‌های اخبار امروز)
  const todayKw = new Set<string>();
  for (const t of newsTexts) for (const w of keywords(t, 5)) todayKw.add(w);

  const pastClaimsRaw = await db.claim.findMany({
    where: { createdAt: { gte: since, lte: until }, status: { not: 'در_انتظار_بررسی' } },
    orderBy: { createdAt: 'desc' },
    take: 150,
  });

  const pastClaims = pastClaimsRaw
    .filter((c) => {
      if (!todayKw.size) return false;
      const cKw = keywords(c.text, 5);
      return cKw.some((w) => todayKw.has(w));
    })
    .slice(0, 12)
    .map((c) => ({
      id: c.id,
      text: c.text.slice(0, 300),
      status: c.status,
      confidence: c.confidence,
      date: c.createdAt.toISOString().slice(0, 10),
    }));

  // تناقض‌ها: ادعای امروز متناقض با ادعای گذشته (شباهت بالا اما اعداد/جهت متفاوت)
  const contradictions: MemoryContext['contradictions'] = [];
  const todayClaims = await db.claim.findMany({
    where: { createdAt: { gte: new Date(beforeISO + 'T00:00:00Z') } },
    take: 50,
  });
  for (const tc of todayClaims) {
    for (const pc of pastClaimsRaw.slice(0, 60)) {
      const sim = jaccardSimilarity(tc.text, pc.text);
      const numericMismatch =
        /\d+/.test(tc.text) && /\d+/.test(pc.text) &&
        normalizePersian(tc.text).match(/\d+/g)?.join(',') !== normalizePersian(pc.text).match(/\d+/g)?.join(',');
      if (sim >= 0.35 && sim <= 0.75 && numericMismatch) {
        contradictions.push({
          newClaimId: tc.id,
          oldClaimId: pc.id,
          note: `ادعای امروز از نظر موضوعی به ادعای ${pc.createdAt.toISOString().slice(0, 10)} نزدیک است اما اعداد/جزئیات متفاوت‌اند (شباهت ${Math.round(sim * 100)}٪) — نیازمند مقایسه دقیق.`,
        });
        break;
      }
    }
    if (contradictions.length >= 5) break;
  }

  if (!pastEvents.length) gaps.push('برای این بازه تاریخی رویداد ثبت‌شده‌ای در حافظه نیست — مقایسه تاریخی محدود است.');
  if (!pastClaims.length) gaps.push('ادعای ارزیابی‌شده‌ای از روزهای قبل یافت نشد — پایه مقایسه وضعیت ادعاها محدود است.');
  if (daysBack > 7) gaps.push(`بازه بازیابی ${daysBack} روزه است؛ حافظه بلندمدت‌تر ممکن است ناقص باشد.`);

  return { pastEvents, pastClaims, contradictions, gaps };
}
