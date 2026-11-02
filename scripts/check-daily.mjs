import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const jobs = await db.jobRun.findMany({ where: { targetId: { in: ['bale:daily', 'manual:bale-daily'] } }, orderBy: { startedAt: 'desc' }, take: 2 });
for (const j of jobs) console.log(j.targetId, '|', j.status, '|', j.durationMs, 'ms |', (j.details||'').slice(0,100), '|', (j.error||'').slice(0,200));
await db.$disconnect();
