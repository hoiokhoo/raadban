/**
 * اجرای زندهٔ یک چرخهٔ گزارش بله (نیروی اضطراری) — برای اثبات نسخهٔ ۴ در کانال
 * اجرا: bun scripts/run-digest-now.ts
 */
import { runBaleDigest } from '../src/lib/bale-digest';

const r = await runBaleDigest({ force: true });
console.log(JSON.stringify(r, null, 2));
process.exit(0);
