/**
 * پردازش انبوه مطالب خام — AI‌مستقل (هنگام باز بودن مدار، مراحل AI صف می‌شوند)
 * اجرا: bun run scripts/bulk-process.ts
 */
import { config } from 'dotenv';
config();
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./db/custom.db';

async function main() {
  const { register } = await import('../node_modules/tsx/dist/api.mjs').catch(() => ({ register: null as null }));
  // tsx not available under bun; use direct import via path alias workaround
  // The project's db.ts reads env DATABASE_URL — set it before import
  const { processPendingPosts } = await import('../src/lib/ingest');
  const { db } = await import('../src/lib/db');

  let round = 0, total = 0;
  for (round = 0; round < 40; round++) {
    const remaining = await db.post.count({ where: { processingStatus: 'خام' } });
    if (remaining === 0) break;
    const t0 = Date.now();
    const r = await processPendingPosts(150);
    total += r.processed;
    console.log(`دور ${round + 1}: پردازش‌شده ${r.processed}، ردشده ${r.skipped}، صف‌AI ${r.aiQueued} — باقی‌مانده ${remaining} — ${Date.now() - t0}ms`);
  }
  console.log(`جمع کل پردازش‌شده: ${total}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
