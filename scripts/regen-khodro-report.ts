/**
 * تولید مجدد گزارش دسته خودرو برای امروز — اجرای مستقیم بدون HTTP timeout
 * اجرا: bun run scripts/regen-khodro-report.ts
 */
import { generateDailyReport, todayISO } from '../src/lib/reports';
import { db } from '../src/lib/db';

async function main() {
  const khodro = await db.category.findUnique({ where: { slug: 'khodro' } });
  if (!khodro) throw new Error('دسته خودرو یافت نشد');
  const date = todayISO();
  console.log('تولید گزارش دسته خودرو برای', date, '...');
  const res = await generateDailyReport(date, khodro.id, { force: true });
  console.log('نتیجه:', JSON.stringify(res));
  if (res.reportId) {
    const r = await db.dailyReport.findUnique({ where: { id: res.reportId } });
    console.log('promptVersion:', r.promptVersion, '| model:', r.model, '| status:', r.status, '| posts:', r.postsCount, '| claims:', r.claimsCount);
    const c = JSON.parse(r.content);
    console.log('\n=== خلاصه اجرایی ===\n', (c.executiveSummary || '').slice(0, 800));
    console.log('\n=== رویدادهای مهم ===\n', JSON.stringify((c.topEvents || []).slice(0, 3).map((e) => ({ title: e.title?.slice(0, 100), refs: e.sourceRefs?.length })), null, 1));
    console.log('\n=== ادعاهای تأییدنشده ===\n', JSON.stringify((c.unverifiedClaims || []).slice(0, 3).map((u) => ({ text: u.text?.slice(0, 100), status: u.status })), null, 1));
    console.log('\n=== تحلیل ===\n', (c.analysis || '').slice(0, 600));
  }
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
