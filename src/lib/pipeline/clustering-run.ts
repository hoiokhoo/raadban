/**
 * اجرای بازسازی «خط خبری» (T9) — مشترک میان مسیر API دستی و زمان‌بند خودکار
 *
 * تصمیم‌های کلیدی:
 * - اسکن «جدیدترین‌ها اول»: خط خبری باید همیشه تازه‌ترین اخبار را پوشش دهد
 *   (قبلاً قدیمی‌ترین N پستِ بازه اسکن می‌شد و اخبار تازه هرگز خوشه نمی‌شدند!)
 * - پوشش صادقانه: اگر پست‌های بازه بیشتر از سقف اسکن باشد، تعداد واقعی گزارش می‌شود.
 * - تداخل عضویت: قید یکتای postId روی ClusterMember — اعضای هم‌پوشانِ خوشه‌های
 *   قدیمی‌تر از بازه قبل از بازنویسی جداسازی می‌شوند وگرنه خطای یکتایی رخ می‌دهد.
 * - اجرای هم‌زمان دوبل (دستی + خودکار) با قفل promise جهانی ادغام می‌شود.
 */
import { db } from '@/lib/db';
import { buildClusters, clusterTitle } from './clustering';

export interface RebuildResult {
  scannedPosts: number;
  totalInWindow: number;
  clustersFound: number;
  clustersCreated: number;
  windowDays: number;
  topExample: {
    title: string;
    firstSource: string;
    firstAt: Date;
    republishers: string[];
  } | null;
}

const g = globalThis as unknown as { __wireRebuild?: Promise<RebuildResult> };

export async function rebuildClusters(days = 7, limit = 2500): Promise<RebuildResult> {
  if (g.__wireRebuild) return g.__wireRebuild;
  g.__wireRebuild = runRebuild(days, limit).finally(() => { g.__wireRebuild = undefined; });
  return g.__wireRebuild;
}

async function runRebuild(days: number, limit: number): Promise<RebuildResult> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const totalInWindow = await db.post.count({ where: { publishedAt: { gte: since } } });

  const posts = await db.post.findMany({
    where: { publishedAt: { gte: since } },
    orderBy: { publishedAt: 'desc' }, // جدیدترین‌ها اول
    take: limit,
    include: { source: { select: { name: true, platform: true } } },
  });

  const clusters = buildClusters(
    posts.map((p) => ({
      id: p.id,
      content: p.translationFa || p.content, // ترجمهٔ فارسی، مقایسهٔ بین‌زبانی را ممکن می‌کند
      publishedAt: p.publishedAt || p.createdAt,
      sourceName: p.source?.name || 'منبع ناشناس',
      sourcePlatform: p.source?.platform || 'نامشخص',
      language: p.language || 'fa',
    }))
  );

  // ---------- پاک‌سازی ایمن پیش از بازنویسی ----------
  // هر خوشه‌ای که با بازهٔ جدید هم‌پوشانی دارد (اولین‌انتشار درون بازه یا هر عضوی درون بازه)
  // به‌کلی بازسازی می‌شود؛ وگرنه بقایای الگوریتم‌های قدیمی/بازه‌های قبلی به‌عنوان
  // خوشهٔ «کهنه» با اعضای ناسازگار می‌مانند و صدر خط خبری را می‌آلایند.
  const staleIds = new Set<string>();
  const oldByFirst = await db.newsCluster.findMany({
    where: { firstPublishedAt: { gte: since } },
    select: { id: true },
  });
  for (const c of oldByFirst) staleIds.add(c.id);
  const overlapping = await db.clusterMember.findMany({
    where: { publishedAt: { gte: since } },
    select: { clusterId: true },
    distinct: ['clusterId'],
  });
  for (const o of overlapping) staleIds.add(o.clusterId);
  for (const id of staleIds) {
    await db.newsCluster.delete({ where: { id } }); // اعضا Cascade حذف می‌شوند
  }

  // ---------- درج خوشه‌های تازه ----------
  let created = 0;
  for (const cl of clusters) {
    await db.newsCluster.create({
      data: {
        title: clusterTitle(cl.titleSource),
        firstPostId: cl.first.postId,
        firstSourceName: cl.first.sourceName,
        firstPublishedAt: cl.first.publishedAt,
        memberCount: cl.members.length,
        language: cl.language,
        members: {
          create: cl.members.map((m) => ({
            postId: m.postId,
            isFirst: m.isFirst,
            publishedAt: m.publishedAt,
            similarity: m.similarity,
            sourceName: m.sourceName,
            sourcePlatform: m.sourcePlatform,
          })),
        },
      },
    });
    created++;
  }

  return {
    scannedPosts: posts.length,
    totalInWindow,
    clustersFound: clusters.length,
    clustersCreated: created,
    windowDays: days,
    topExample: clusters[0]
      ? {
          title: clusterTitle(clusters[0].titleSource),
          firstSource: clusters[0].first.sourceName,
          firstAt: clusters[0].first.publishedAt,
          republishers: clusters[0].members.slice(1).map((m) => `${m.sourceName} (+${m.minutesAfterFirst} دقیقه)`),
        }
      : null,
  };
}
