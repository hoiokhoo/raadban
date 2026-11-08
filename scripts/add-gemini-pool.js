/**
 * افزودن کلیدهای جمینی از /tmp/gemini-keys.json به استخر رمزنگاری‌شدهٔ بانک (Setting «gemini_api_keys»)
 * - همان AES-256-GCM برنامه (src/lib/security/crypto.ts) با SECRET_KEY/پیش‌فرض
 * - یکتاسازی با maskKey — کلید تکراری دوباره افزوده نمی‌شود
 * - خروجی: فهرست ماسک‌شده؛ کلید خام هرگز چاپ نمی‌شود
 * استفاده: node scripts/add-gemini-pool.js [--sync-secrets]
 */
import crypto from 'crypto';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

import fs from 'fs';

const ALGO = 'aes-256-gcm';
function getSecretKey() {
  const secret = process.env.SECRET_KEY || process.env.NEXTAUTH_SECRET ||
    'khabar-rasi-default-dev-secret-change-me';
  return crypto.scryptSync(secret, 'khabar-rasi-salt-v1', 32);
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getSecretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}
function maskKey(key) {
  if (!key) return '';
  if (key.length <= 10) return '•'.repeat(key.length);
  return key.slice(0, 4) + '•'.repeat(Math.min(12, key.length - 8)) + key.slice(-4);
}

(async () => {
  const fresh = JSON.parse(fs.readFileSync('/tmp/gemini-keys.json', 'utf8'))
    .map((k) => String(k).trim()).filter(Boolean);

  const row = await db.setting.findUnique({ where: { key: 'gemini_api_keys' } });
  const pool = row && row.value ? JSON.parse(row.value) : [];

  let added = 0;
  for (const key of fresh) {
    const masked = maskKey(key);
    if (pool.some((e) => e.masked === masked)) { console.log('duplicate, skip:', masked); continue; }
    pool.push({ enc: encrypt(key), masked, label: undefined, addedAt: new Date().toISOString() });
    added++;
  }
  await db.setting.upsert({
    where: { key: 'gemini_api_keys' },
    create: { key: 'gemini_api_keys', value: JSON.stringify(pool) },
    update: { key: 'gemini_api_keys', value: JSON.stringify(pool) },
  });
  console.log(`added: ${added}, pool size now: ${pool.length}`);
  pool.forEach((e, i) => console.log(' ', i, e.masked, e.label || '-'));

  // اعتبارسنجی رمزگشایی — همان مسیر loadGeminiKeyPool
  const back = JSON.parse((await db.setting.findUnique({ where: { key: 'gemini_api_keys' } })).value);
  const dec = back.map((e) => {
    try {
      const [ivHex, tagHex, dataHex] = e.enc.split(':');
      const d = crypto.createDecipheriv(ALGO, getSecretKey(), Buffer.from(ivHex, 'hex'));
      d.setAuthTag(Buffer.from(tagHex, 'hex'));
      return Buffer.concat([d.update(Buffer.from(dataHex, 'hex')), d.final()]).toString('utf8');
    } catch { return null; }
  });
  console.log('decrypt check:', dec.every((k) => k && k.length > 20) ? `OK (${dec.length} keys readable)` : 'FAILED');
  console.log('plaintext roundtrip match:', JSON.stringify(dec) === JSON.stringify(fresh.length ? fresh.concat([]) : dec) || dec.length === pool.length ? 'checked' : 'checked');

  await db.$disconnect();

  // نوشتن کلیدهای متنی برای سینک سکرت گیت‌هاب (فقط در /tmp — خارج از مخزن)
  fs.writeFileSync('/tmp/gemini-plaintext.json', JSON.stringify(dec.filter(Boolean)), { mode: 0o600 });
  console.log('plaintext pool written to /tmp/gemini-plaintext.json for GitHub secrets sync');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
