/**
 * جبران عقب‌ماندگی تحلیل — خواستهٔ کاربر ۹ نوامبر ۲۰۲۶ («بخش تحلیل اخبار کار نمی‌کند»)
 *
 * کل خط تحلیل را روی پس‌ماند بانک اجرا می‌کند تا بخش «تحلیل پیشرفته» پر شود:
 *   ۱) پردازش مطالب خام (نرمال‌سازی + تشخیص تکرار + دسته‌بندی AI + رویداد + استخراج ادعا)
 *   ۲) دسته‌بندی موضوعی دسته‌جمعی باقی‌مانده‌ها
 *   ۳) ترجمهٔ دسته‌جمعی اخبار خارجی (فارسی روان + خلاصه + نتیجه‌گیری)
 *   ۴) خوشه‌سازی خط خبری (چه رسانه‌ای اول گفت)
 *
 * اجرا در پس‌زمینه:  nohup bun scripts/analysis-catchup.ts > /tmp/catchup.log 2>&1 &
 * قابل توقف:          touch /tmp/catchup-stop
 */
import { db } from '../src/lib/db';
import { processPendingPosts } from '../src/lib/ingest';
import { categorizePendingPosts } from '../src/lib/pipeline/topics';
import { translatePost } from '../src/lib/translate';
import { rebuildClusters } from '../src/lib/pipeline/clustering-run';

const MAX_MINUTES = Number(process.env.CATCHUP_MAX_MIN || 75);
const started = Date.now();
const budget = () => Date.now() - started < MAX_MINUTES * 60_000;

async function phase(name: string, fn: () => Promise<void>): Promise<void> {
  const t = Date.now();
  try {
    await fn();
    console.log(`✔ ${name} — ${Math.round((Date.now() - t) / 1000)}s`);
  } catch (e) {
    console.log(`✘ ${name}:`, e instanceof Error ? e.message.slice(0, 200) : e);
  }
}

console.log('=== جبران تحلیل — شروع ===');

void (async () => {
  // ۱) پردازش مطالب خام — تا خالی شدن صف یا اتمام بودجهٔ زمانی
  await phase('پردازش مطالب خام', async () => {
    for (let round = 0; round < 400 && budget(); round++) {
      const raw = await db.post.count({ where: { processingStatus: 'خام' } });
      if (raw === 0) break;
      const r = await processPendingPosts(15);
      console.log(`  صف خام: ${raw} → پردازش این دور: ${r.processed}، پرش: ${r.skipped}`);
      if (r.processed === 0 && r.skipped === 0) break;
    }
  });

  // ۲) دسته‌بندی موضوعی دسته‌جمعی
  await phase('دسته‌بندی موضوعی', async () => {
    for (let round = 0; round < 40 && budget(); round++) {
      const r = await categorizePendingPosts({ limit: 120 });
      console.log(`  دسته‌بندی دور ${round + 1}: ${r.categorized} (fallback: ${r.fallback}، خطا: ${r.aiErrors?.length || 0})`);
      if (!r.categorized) break;
    }
  });

  // ۳) ترجمهٔ اخبار خارجی
  await phase('ترجمهٔ خارجی‌ها', async () => {
    for (let round = 0; round < 400 && budget(); round++) {
      const pending = await db.post.findMany({
        where: { translationFa: null, isIrrelevant: false },
        orderBy: { publishedAt: 'desc' },
        take: 40,
        select: { id: true, content: true, language: true },
      });
      const targets = pending.filter((p) => p.language && p.language !== 'fa');
      if (targets.length === 0) { console.log('  صف ترجمه خالی شد'); break; }
      for (const t of targets.slice(0, 10)) {
        if (!budget()) break;
        const res = await translatePost(t.id);
        if (!res.ok) console.log(`  ترجمه ناموفق (${t.id}):`, (res.error || '').slice(0, 120));
      }
      console.log(`  دور ${round + 1}: تا ۱۰ ترجمه انجام شد`);
    }
  });

  // ۴) خوشه‌سازی نهایی
  await phase('خوشه‌سازی خط خبری', async () => {
    const r = await rebuildClusters(7, 2500);
    console.log(`  خوشه‌ها: ${r.clustersCreated} جدید (اسکن ${r.scannedPosts})`);
  });

  const [raw, untr, posts, clusters] = await Promise.all([
    db.post.count({ where: { processingStatus: 'خام' } }),
    db.post.count({ where: { translationFa: null, language: { not: 'fa' } } }).catch(() => -1),
    db.post.count(),
    db.newsCluster.count(),
  ]);
  console.log(`=== پایان — کل: ${posts} | خام مانده: ${raw} | ترجمه‌نشدهٔ خارجی: ${untr} | خوشه: ${clusters} ===`);
  await db.$disconnect();
  process.exit(0);
})();
