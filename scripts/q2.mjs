import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const s = await db.setting.findMany({ where: { key: { in: ['bale_daily_last_date', 'bale_daily_last_try', 'bale_digest'] } } });
for (const x of s) console.log(x.key, '=>', x.value.slice(0, 120));
const au = await db.aiUsage.findMany({ orderBy: { createdAt: 'desc' }, take: 6 });
for (const a of au) console.log(a.createdAt.toISOString(), a.purpose, a.model, a.status);
await db.$disconnect();
