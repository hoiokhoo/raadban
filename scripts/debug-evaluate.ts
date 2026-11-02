/**
 * عیب‌یابی مستقیم evaluateClaim بدون لایه HTTP
 */
import { db } from '../src/lib/db';
import { evaluateClaim } from '../src/lib/factcheck/engine';

const claimId = process.argv[2] || 'cmvu2724400myrravfaoncr6u';

async function main() {
  console.log('[1] db claim lookup...');
  const claim = await db.claim.findUnique({ where: { id: claimId } });
  console.log('[1] claim found:', claim ? claim.text.slice(0, 40) : 'NOT FOUND');

  console.log('[2] evaluateClaim (searchWeb: false)...');
  const t0 = Date.now();
  const r = await Promise.race([
    evaluateClaim(claimId, { searchWeb: false }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('SCRIPT TIMEOUT 120s')), 120000)),
  ]);
  console.log(`[2] result in ${Math.round((Date.now() - t0) / 1000)}s:`, JSON.stringify(r).slice(0, 300));
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
