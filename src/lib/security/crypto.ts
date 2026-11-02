/**
 * رمزنگاری AES-256-GCM برای ذخیره امن کلیدهای API سمت سرور
 * کلید رمزنگاری از متغیر محیطی SECRET_KEY مشتق می‌شود؛
 * هرگز کلید API به مرورگر یا لاگ ارسال نمی‌شود.
 */
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getSecretKey(): Buffer {
  const secret = process.env.SECRET_KEY || process.env.NEXTAUTH_SECRET ||
    'khabar-rasi-default-dev-secret-change-me';
  // مشتق‌سازی کلید ۳۲ بایتی از راز با scrypt
  return crypto.scryptSync(secret, 'khabar-rasi-salt-v1', 32);
}

/** رمزنگاری متن -> "iv:tag:cipher" (hex) */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getSecretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

/** رمزگشایی "iv:tag:cipher" -> متن؛ در خطا null */
export function decrypt(payload: string): string | null {
  try {
    const [ivHex, tagHex, dataHex] = payload.split(':');
    if (!ivHex || !tagHex || !dataHex) return null;
    const decipher = crypto.createDecipheriv(ALGO, getSecretKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** ماسک کردن کلید برای نمایش امن در رابط کاربری: sk-a•••••xyz */
export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 10) return '•'.repeat(key.length);
  return key.slice(0, 4) + '•'.repeat(Math.min(12, key.length - 8)) + key.slice(-4);
}
