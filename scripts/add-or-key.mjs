import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
const ALGO = 'aes-256-gcm';
function getSecretKey() {
  const secret = process.env.SECRET_KEY || process.env.NEXTAUTH_SECRET || 'khabar-rasi-default-dev-secret-change-me';
  return crypto.scryptSync(secret, 'khabar-rasi-salt-v1', 32);
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGO, getSecretKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv.toString('hex'), c.getAuthTag().toString('hex'), enc.toString('hex')].join(':');
}
const db = new PrismaClient();
const row = await db.setting.findUnique({ where: { key: 'ai_provider_keys' } });
// کلید فقط از محیط خوانده می‌شود — هرگز در کد یا تاریخچه گیت هاردکد نشود
const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error('OPENROUTER_API_KEY در محیط تنظیم نشده — کاری انجام نشد');
  process.exit(1);
}
const obj = row ? JSON.parse(row.value) : {};
obj.openrouter = encrypt(key);
await db.setting.upsert({
  where: { key: 'ai_provider_keys' },
  create: { key: 'ai_provider_keys', value: JSON.stringify(obj) },
  update: { key: 'ai_provider_keys', value: JSON.stringify(obj) },
});
console.log('ai_provider_keys providers:', Object.keys(obj).join(', '));
await db.$disconnect();
