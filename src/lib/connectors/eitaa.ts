/**
 * اتصال‌دهنده ایتا — صفحات عمومی eitaa.com/{channel}
 * ساختار واقعی صفحه (تأییدشده با تحلیل زنده HTML):
 *   <div class="etme_widget_message_wrap js-widget_message_wrap" id="792">
 *     ... data-post="channel/792" ...
 *     <time datetime="2026-03-08T22:28:33+00:00" class="time">
 *     <div class="etme_widget_message_text ...">متن پیام</div>
 * محدودیت‌ها (صریح):
 *  - فقط کانال‌های عمومی دارای صفحه وب عمومی.
 *  - API عمومی مستند برای دریافت تاریخچه کامل ندارد؛ سابقه محدود به نمایش صفحه عمومی است.
 *  - آمار اعضا/بازدید در صفحه عمودی قابل اتکا نیست → «نامعلوم» ثبت می‌شود.
 */
import type { Connector, ConnectorResult, PostInput } from './types';
import { safeFetch } from '../security/ssrf';
import { withRetry } from './types';

function decodeHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

interface ParsedMessage {
  dataPost: string;
  timeISO?: string;
  text: string;
  isForwarded: boolean;
}

function parseEitaaPage(html: string): ParsedMessage[] {
  const out: ParsedMessage[] = [];
  // بلوک‌های پیام بر اساس data-post (شناسه پایدار کانال/شناسه پیام)
  const blocks = html.split(/class="etme_widget_message_wrap/).slice(1);
  for (const b of blocks) {
    const dataPost = b.match(/data-post="([^"]+)"/)?.[1];
    const timeISO = b.match(/<time[^>]*datetime="([^"]+)"/)?.[1];
    const textMatch = b.match(/class="etme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const text = textMatch ? decodeHtml(textMatch[1]) : '';
    const isForwarded = /etme_widget_message_forwarded_from/.test(b);
    if (dataPost && text) {
      out.push({ dataPost, timeISO, text, isForwarded });
    }
  }
  return out;
}

export const eitaaConnector: Connector = {
  key: 'eitaa',
  label: 'ایتا',
  implemented: true,
  limitsDescription:
    'فقط کانال‌های عمومی با صفحه وب eitaa.com/{channel}. API عمومی مستندی برای تاریخچه کامل وجود ندارد؛ سابقه محدود به نمایش صفحه عمومی است. آمار اعضا و بازدید دقیق نامعلوم است.',
  authDescription: 'بدون احراز هویت برای کانال‌های عمومی؛ قابلیت توکن‌دار هنوز پیاده‌سازی نشده است.',

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
      return { ok: false, error: `شناسه کانال ایتا نامعتبر است: ${identifier}`, limits };
    }
    const res = await withRetry(() => safeFetch(`https://eitaa.com/${identifier}`, { timeoutMs: 15000 }));
    if (!res.ok || !res.text) {
      return { ok: false, error: `دریافت صفحه ایتا ناموفق بود (وضعیت ${res.status || 'شبکه'}): ${res.error || ''}`, limits };
    }
    // تشخیص صفحه «یافت نشد»
    if (/channel_not_found|کانال یافت نشد/i.test(res.text) && !res.text.includes('etme_widget_message_text')) {
      return { ok: false, error: 'کانال ایتا یافت نشد یا صفحه عمومی ندارد', limits };
    }
    const parsed = parseEitaaPage(res.text);
    const posts: PostInput[] = parsed.map((m) => ({
      externalId: m.dataPost,
      content: m.text,
      url: `https://eitaa.com/${m.dataPost}`,
      publishedAt: m.timeISO ? new Date(m.timeISO) : undefined,
      metadata: { platform: 'eitaa', channel: identifier, source: 'صفحه عمومی ایتا' },
      isForwarded: m.isForwarded,
    }));
    if (posts.length === 0) {
      return { ok: false, error: 'پیام متنی‌ای از صفحه عمومی ایتا استخراج نشد — کانال خصوصی است یا فقط رسانه منتشر می‌کند یا ساختار صفحه تغییر کرده', limits };
    }
    return {
      ok: true,
      posts: posts.slice(0, opts.maxItems || 30),
      coverageNote: `دریافت از صفحه عمومی ایتا — ${posts.length} پیام متنی. سابقه کامل و آمار اعضا نامعلوم.`,
      limits,
    };
  },
};
