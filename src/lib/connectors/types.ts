/**
 * رابط استاندارد اتصال‌دهنده‌ها (فصل ۵ سند مأموریت)
 * هر اتصال‌دهنده باید:
 *  - اعتبارسنجی تنظیمات و دسترسی
 *  - دریافت مطالب جدید / سابقه قابل دسترس
 *  - تبدیل به قالب مشترک (PostInput)
 *  - استخراج شناسه پایدار و زمان انتشار
 *  - ثبت خطا و وضعیت همگام‌سازی
 *  - مدیریت محدودیت درخواست و تلاش مجدد
 *  - اعلام صریح محدودیت‌های پوشش و دسترسی
 */

export interface PostInput {
  /** شناسه پایدار مطلب در پلتفرم مقصد (مثل شناسه پیام تلگرام) */
  externalId: string;
  content: string;
  url?: string;
  /** تصویر شاخص مطلب در صورت وجود (برای ارسال عکس بالای خبر در بله) */
  imageUrl?: string;
  publishedAt?: Date;
  metadata?: Record<string, unknown>;
  isForwarded?: boolean;
}

export type ConnectorResult =
  | { ok: true; posts: PostInput[]; coverageNote: string; limits: string }
  | { ok: false; error: string; limits: string; needsAuth?: boolean };

export interface Connector {
  /** کلید پلتفرم */
  key: string;
  /** نام فارسی پلتفرم */
  label: string;
  /** آیا پیاده‌سازی واقعی شده است؟ (اتصال نمایشی ممنوع) */
  implemented: boolean;
  /** محدودیت‌های شناخته‌شده پوشش و دسترسی — در رابط کاربری صریحاً نشان داده می‌شود */
  limitsDescription: string;
  /** نیازمندی احراز هویت */
  authDescription: string;
  validateIdentifier(identifier: string): boolean;
  /** شناسه پایدار منبع برای ذخیره (مثل نام کانال بدون @) */
  normalizeIdentifier(raw: string): string;
  fetchRecent(identifier: string, opts: { maxItems?: number; sinceId?: string; sinceDate?: Date }): Promise<ConnectorResult>;
}

/** تلاش مجدد با تأخیر افزایشی (فصل ۱۱: retry با backoff) */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const base = opts.baseDelayMs ?? 800;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, base * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

/** حدس نام کانال از ورودی آزاد کاربر: URL یا @name یا نام ساده */
export function extractChannelName(raw: string): string {
  let s = raw.trim();
  try {
    const u = new URL(s);
    if (u.hostname) {
      const parts = u.pathname.split('/').filter(Boolean).filter((p) => p !== 's');
      if (parts.length) return parts[0].replace(/^@/, '');
      const host = u.hostname.split('.')[0];
      if (host && host !== 'www' && host !== 't' && host !== 'web') return host;
    }
  } catch {
    // URL نیست
  }
  s = s.replace(/^@/, '').replace(/^https?:\/\//, '');
  return s.split('/')[0].split('?')[0].trim();
}
