/**
 * اتصال‌دهنده وب (صفحه خبر عمومی) — استخراج ساده متن صفحه
 * محدودیت‌ها: جاوااسکریپت اجرا نمی‌شود؛ صفحات SPA ممکن است خالی دریافت شوند.
 */
import type { Connector, ConnectorResult, PostInput } from './types';
import { safeFetch } from '../security/ssrf';
import { withRetry } from './types';

/** شمارش کلمات طبیعی (فارسی/عربی/لاتین با حداقل ۳ نویسه) برای تشخیص استخراج بی‌معنا */
function naturalWords(s: string): number {
  return (s.match(/[\u0600-\u06FF\w]{3,}/g) || []).length;
}

export const webConnector: Connector = {
  key: 'web',
  label: 'وب‌سایت',
  implemented: true,
  limitsDescription:
    'استخراج از HTML ایستا؛ صفحات مبتنی بر جاوااسکریپت سنگین ممکن است به‌درستی استخراج نشوند. برای پوشش پایدار RSS توصیه می‌شود.',
  authDescription: 'بدون احراز هویت.',

  validateIdentifier: (id) => /^https?:\/\/.+/i.test(id),
  normalizeIdentifier: (raw) => raw.trim(),

  async fetchRecent(identifier, opts): Promise<ConnectorResult> {
    const limits = this.limitsDescription;
    const res = await withRetry(() => safeFetch(identifier, { timeoutMs: 20000 }));
    if (!res.ok || !res.text) {
      return { ok: false, error: `دریافت صفحه ناموفق بود (وضعیت ${res.status || 'شبکه'}): ${res.error || ''}`, limits };
    }
    const title =
      res.text.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ||
      res.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || identifier;
    // استخراج متن اصلی از تگ‌های محتوا
    const bodyMatch =
      res.text.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
      res.text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
      res.text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const text = (bodyMatch?.[1] || '')
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    if (text.length < 50 || naturalWords(text) < 60) {
      return { ok: false, error: 'استخراج محتوای معنادار ممکن نشد — صفحه جاوااسکریپتی است یا فقط ناوبری/بازارکیابی دارد (متن متنی کافی ندارد)', limits };
    }
    const posts: PostInput[] = [{
      externalId: identifier,
      content: `${title}\n${text.slice(0, 8000)}`,
      url: identifier,
      metadata: { extractedAt: new Date().toISOString(), platform: 'web' },
    }];
    if (posts.length > (opts.maxItems || 30)) posts.length = opts.maxItems || 30;
    return {
      ok: true,
      posts,
      coverageNote: 'یک اسنپ‌شات متن صفحه دریافت شد. این روش فقط وضعیت فعلی صفحه را می‌گیرد، نه فهرست مطالب جدید.',
      limits,
    };
  },
};
