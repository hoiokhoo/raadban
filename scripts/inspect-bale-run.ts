/**
 * بازرسی پایگاه داده — آخرین JobRun/AiUsage بله (ابزار تشخیصی، خروجی در ترمینال)
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const jobs = await db.jobRun.findMany({
    where: { targetId: { contains: 'bale' } },
    orderBy: { startedAt: 'desc' },
    take: 5,
    select: { startedAt: true, finishedAt: true, status: true, targetId: true, error: true },
  });
  console.log('=== JobRun (bale) ===');
  for (const j of jobs) {
    console.log(`- ${j.startedAt.toISOString()} [${j.status}] ${j.targetId}${j.error ? ` — ${j.error.slice(0, 160)}` : ''}`);
  }

  const usage = await db.aiUsage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { createdAt: true, purpose: true, model: true, status: true, error: true, inputChars: true, outputChars: true },
  });
  console.log('=== AiUsage (10 آخرین) ===');
  for (const u of usage) {
    const t = new Date(u.createdAt.getTime() + 3.5 * 3600_000).toISOString().slice(11, 16);
    console.log(`- ${t} تهران | ${u.purpose} | ${u.model} | ${u.status}${u.error ? ` — ${u.error.slice(0, 100)}` : ''} (ورودی ${u.inputChars}، خروجی ${u.outputChars})`);
  }

  const settings = await db.setting.findMany({
    where: { key: { in: ['bale_digest_last_at', 'bale_digest_last_try', 'pipeline_last_at', 'factcheck_last_at'] } },
  });
  console.log('=== Setting ===');
  for (const s of settings) console.log(`- ${s.key} = ${s.value}`);
}

main().finally(() => db.$disconnect());
