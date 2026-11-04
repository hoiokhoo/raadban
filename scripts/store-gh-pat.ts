/**
 * ذخیرهٔ امن توکن گیت‌هاب در بانک اپلیکیشن (Setting «github_pat» — رمزنگاری‌شده)
 * تا همگام‌سازی ربات از اپلیکیشن بلافاصله کار کند. توکن از آرگومان خط فرمان می‌آید و چاپ نمی‌شود.
 */
import { PrismaClient } from '@prisma/client';
import { encrypt } from '../src/lib/security/crypto';

const db = new PrismaClient();
const pat = process.argv[2] || '';
if (pat.length < 20) { console.error('usage: bun scripts/store-gh-pat.ts <token>'); process.exit(1); }

await db.setting.upsert({
  where: { key: 'github_pat' },
  create: { key: 'github_pat', value: encrypt(pat) },
  update: { key: 'github_pat', value: encrypt(pat) },
});
console.log('github_pat stored (encrypted)');
await db.$disconnect();
