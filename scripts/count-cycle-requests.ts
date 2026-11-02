/**
 * شمارش دقیق درخواست‌های مدل در پنجرهٔ چرخهٔ بله — اثبات حالت یک‌درخواستی
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  // چرخهٔ دستی آخر: manual:bale-digest در 20:22:25 و 20:24:55 UTC
  const since = new Date('2026-10-31T20:21:00Z');
  const rows = await db.aiUsage.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, purpose: true, model: true, status: true },
  });
  console.log(`=== AiUsage از ${since.toISOString()} (${rows.length} رکورد) ===`);
  const byPurpose = new Map<string, { total: number; ok: number }>();
  for (const r of rows) {
    const t = new Date(r.createdAt.getTime() + 3.5 * 3600_000).toISOString().slice(11, 19);
    console.log(`- ${t} | ${r.purpose} | ${r.model} | ${r.status}`);
    const k = r.purpose;
    const v = byPurpose.get(k) || { total: 0, ok: 0 };
    v.total++;
    if (r.status === 'موفق') v.ok++;
    byPurpose.set(k, v);
  }
  console.log('=== خلاصه به تفکیک purpose ===');
  for (const [k, v] of byPurpose) console.log(`- ${k}: ${v.total} فراخوانی (${v.ok} موفق)`);
}

main().finally(() => db.$disconnect());
