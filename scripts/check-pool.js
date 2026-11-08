/* بررسی استخر کلیدهای جمینی و توکن گیت‌هاب ذخیره‌شده در بانک */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

(async () => {
  const poolRow = await db.setting.findUnique({ where: { key: 'gemini_api_keys' } });
  if (!poolRow || !poolRow.value) {
    console.log('POOL EMPTY');
  } else {
    const pool = JSON.parse(poolRow.value);
    console.log('pool size:', pool.length);
    pool.forEach((e, i) => console.log(' ', i, e.masked, e.label || '-', e.addedAt));
  }
  const pat = await db.setting.findUnique({ where: { key: 'github_pat' } });
  console.log('github_pat set:', Boolean(pat && pat.value));
  const orKeys = await db.setting.findUnique({ where: { key: 'ai_provider_keys' } });
  if (orKeys && orKeys.value) {
    const parsed = JSON.parse(orKeys.value);
    console.log('ai_provider_keys providers:', Object.keys(parsed).join(','));
  } else {
    console.log('ai_provider_keys: empty');
  }
  await db.$disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
