/**
 * اتصال‌دهنده بله — صفحات عمومی bale.ai/{channel}
 * محدودیت‌ها (صریح):
 *  - صفحه وب عمومی بله برای همه کانال‌ها فعال نیست.
 *  - API عمومی مستند برای دریافت تاریخچه کامل ندارد.
 *  - در صورت تغییر ساختار صفحه، خطا صادقانه ثبت می‌شود نه داده ساختگی.
 */
import type { Connector, ConnectorResult, PostInput } from './types';
import { safeFetch } from '../security/ssrf';
import { withRetry } from './types';

function decodeHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

export const baleConnector: Connector = {
  key: 'bale',
  label: 'بله',
  implemented: true,
  limitsDescription:
    'فقط کانال‌های عمومی دارای صفحه وب bale.ai. API عمومی مستند برای تاریخچه کامل وجود ندارد. پوشش محدود به صفحه عمومی است.',
  authDescription: 'بدون احراز هویت برای کانال‌های عمومی؛ روش توکن‌دار در انتظار پیاده‌سازی است.',

  validateIdentifier: (id) => /^[A-Za-z0-9_]{3,64}$/.test(id),
  normalizeIdentifier: (raw) => {
    let s = raw.trim();
    try {
      const u = new URL(s);
      const parts = u.pathname.split('/').filter(Boolean).filter((p) => p !== 's');
      if (parts.length) s = parts[0];
      else s = u.hostname.split('.')[0];
    } catch { /* URL نیست */ }
    return s.replace(/^@/, '').split('/')[0];
  },

  async fetchRecent(identifier, opts): Promise<ConnectorResult> {
    const limits = this.limitsDescription;
    if (!this.validateIdentifier(identifier)) {
      return { ok: false, error: `شناسه کانال بله نامعتبر است: ${identifier}`, limits };
    }
    const res = await withRetry(() => safeFetch(`https://bale.ai/${identifier}`, { timeoutMs: 15000 }));
    if (!res.ok || !res.text) {
      return { ok: false, error: `دریافت صفحه بله ناموفق بود (وضعیت ${res.status || 'شبکه'}): ${res.error || ''}`, limits };
    }
    const posts: PostInput[] = [];
    const blocks = res.text.split(/<(?:div|article)[^>]*class="[^"]*(?:message|post)[^"]*"[^>]*>/i).slice(1);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const text = decodeHtml(b.match(/>([\s\S]{10,}?)<\/(?:div|p)>/)?.[1] || '');
      const timeStr = b.match(/<time[^>]*datetime="([^"]+)"/)?.[1] || b.match(/data-time="(\d+)"/)?.[1];
      const publishedAt = timeStr
        ? (timeStr.length > 10 ? new Date(timeStr) : new Date(Number(timeStr) * 1000))
        : undefined;
      if (text.length >= 15) {
        posts.push({
          externalId: `${identifier}-${publishedAt?.getTime() || Date.now()}-${i}`,
          content: text,
          url: `https://bale.ai/${identifier}`,
          publishedAt,
          metadata: { platform: 'bale' },
        });
      }
      if (posts.length >= (opts.maxItems || 30)) break;
    }
    if (posts.length === 0) {
      return { ok: false, error: 'پیام متنی‌ای از صفحه عمومی بله استخراج نشد — کانال ممکن است خصوصی باشد یا ساختار صفحه تغییر کرده باشد', limits };
    }
    return { ok: true, posts, coverageNote: `دریافت از صفحه عمومی بله — ${posts.length} مطلب. سابقه کامل نامعلوم.`, limits };
  },
};
