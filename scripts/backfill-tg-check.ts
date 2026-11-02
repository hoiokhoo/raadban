import { db } from '../src/lib/db';
const src = await db.source.findFirst({ where: { platform: 'telegram', identifier: 'presstv' } });
if (!src) { console.log('presstv یافت نشد'); process.exit(0); }
const before = await db.post.count({ where: { sourceId: src.id, imageUrl: { not: null } } });
const { ingestSource } = await import('../src/lib/ingest');
const out = await ingestSource(src.id);
const after = await db.post.count({ where: { sourceId: src.id, imageUrl: { not: null } } });
console.log(`presstv: ok=${out.ok} inserted=${out.inserted} dupSkipped=${out.duplicatesSkipped} | پست با تصویر: قبل=${before} بعد=${after}`);
await db.$disconnect();
