import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const au = await db.aiUsage.findMany({ orderBy: { createdAt: 'desc' }, take: 8 });
for (const a of au) console.log(a.createdAt.toISOString(), a.purpose, a.model, a.status, (a.error||'').slice(0,60));
await db.$disconnect();
