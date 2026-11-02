import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const rows = await db.setting.findMany();
for (const r of rows) console.log(r.key, '=>', r.value.slice(0, 100).replace(/\n/g, ' '));
console.log('--- recent AiUsage ---');
const au = await db.aiUsage.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
for (const a of au) console.log(a.createdAt.toISOString(), a.purpose, a.model, a.status, (a.error||'').slice(0,70));
await db.$disconnect();
