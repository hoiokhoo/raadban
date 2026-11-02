/**
 * اتصال‌دهنده تلگرام — روش مجاز عمومی: صفحات وب t.me/s/{channel}
 * محدودیت‌ها (صریح):
 *  - فقط کانال‌های عمومی با فعال‌بودن پیش‌نمایش وب قابل دریافت‌اند.
 *  - پیام‌های خصوصی/گروه‌ها بدون Bot API و توکن قابل دریافت نیستند.
 *  - سابقه محدود به تعداد پیام‌های نمایش‌داده‌شده در صفحات وب است.
 *  - در صورت نیاز به سابقه کامل، Bot API با توکن کاربر توصیه می‌شود.
 */
import type { Connector, ConnectorResult, PostInput } from './types';
import { safeFetch } from '../security/ssrf';
import { withRetry } from './types';

interface TelegramMessage {
  id?: number;
  date?: string;
  text?: string;
  message?: string;
  post?: string;
  forward_from?: unknown;
  forward_from_message_id?: number;
}

/** فقط نشانی‌های واقعی عکس — ایموجی/استیکر/آواتار تلگرام حذف می‌شوند */
function isRealImageUrl(u: string): boolean {
  return /^https?:\/\//.test(u) && !/telegram\.org|\/img\/emoji\//i.test(u);
}

function unescapeUrl(u: string): string {
  return u.replace(/&amp;/g, '&');
}

/**
 * استخراج نشانی عکس از بلوک پیام t.me/s — تابع خالص تست‌پذیر:
 * ۱) wrap عکس (پس‌زمینهٔ CSS با نشانی CDN) — مطمئن‌ترین مسیر
 * ۲) نخستین <img> خارج از ایموجی/استیکر (پشتیبان)
 * خروجی null یعنی پیام بدون عکس
 */
export function extractMessageImage(block: string): string | null {
  const wrap = block.match(/tgme_widget_message_photo_wrap[^>]*?background-image:url\('([^']+)'\)/)?.[1];
  if (wrap && isRealImageUrl(wrap)) return unescapeUrl(wrap);
  // آواتار کانال (tgme_widget_message_user_photo) درون هر بلوک هست و نباید عکسِ خبر شود
  const cleaned = block.replace(/<i class="tgme_widget_message_user_photo[\s\S]*?<\/i>/g, '');
  const imgTags = cleaned.match(/<img[^>]+?src="([^"]+)"/g) || [];
  for (const tag of imgTags) {
    const src = tag.match(/src="([^"]+)"/)?.[1];
    if (src && isRealImageUrl(src)) return unescapeUrl(src);
  }
  return null;
}

function parseTelegramPage(html: string): { posts: PostInput[]; channelName: string | null } {
  const posts: PostInput[] = [];
  const channelName = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || null;

  // بلوک‌های پیام: <div class="tgme_widget_message ..." data-post="channel/123" ...>
  const blocks = html.split(/<div class="tgme_widget_message /).slice(1);
  for (const b of blocks) {
    const dataPost = b.match(/data-post="([^"]+)"/)?.[1];
    const timeAttr = b.match(/<time datetime="([^"]+)"/)?.[1];
    // متن پیام: div.tgme_widget_message_text ...
    const textMatch = b.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    let text = '';
    if (textMatch) {
      text = textMatch[1]
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
    const isForwarded = /tgme_widget_message_forwarded_from/.test(b);
    const imageUrl = extractMessageImage(b);
    if (dataPost && text) {
      posts.push({
        externalId: dataPost,
        content: text,
        url: `https://t.me/${dataPost}`,
        publishedAt: timeAttr ? new Date(timeAttr) : undefined,
        imageUrl: imageUrl || undefined,
        metadata: { channel: dataPost.split('/')[0], source: 't.me/s پیش‌نمایش وب' },
        isForwarded,
      });
    }
  }
  return { posts, channelName };
}

export const telegramConnector: Connector = {
  key: 'telegram',
  label: 'تلگرام',
  implemented: true,
  limitsDescription:
    'فقط کانال‌های عمومی با پیش‌نمایش وب فعال (t.me/s). پیام‌های خصوصی و گروه‌ها نیاز به Bot API و توکن دارند. سابقه محدود به صفحات پیش‌نمایش وب است.',
  authDescription: 'بدون احراز هویت برای کانال‌های عمومی؛ برای سابقه کامل Bot API (توکن) لازم است.',

  validateIdentifier: (id) => /^[A-Za-z0-9_]{3,64}$/.test(id),
  normalizeIdentifier: (raw) => {
    let s = raw.trim();
    try {
      const u = new URL(s);
      const parts = u.pathname.split('/').filter(Boolean).filter((p) => p !== 's');
      if (parts.length) s = parts[0];
      else s = u.hostname.split('.')[0];
    } catch { /* URL نیست */ }
    return s.replace(/^@/, '').split('/').filter((p) => p !== 's')[0] || '';
  },

  async fetchRecent(identifier, opts): Promise<ConnectorResult> {
    const limits = this.limitsDescription;
    if (!this.validateIdentifier(identifier)) {
      return { ok: false, error: `شناسه کانال نامعتبر است: ${identifier}`, limits };
    }
    // دریافت ۱ تا ۲ صفحه پیش‌نمایش وب (هر صفحه ~۲۰ پیام)
    const pages = Math.min(2, Math.ceil((opts.maxItems || 30) / 20));
    const posts: PostInput[] = [];
    for (let p = 1; p <= pages; p++) {
      const url = p === 1 ? `https://t.me/s/${identifier}` : `https://t.me/s/${identifier}?before=${posts[posts.length - 1]?.externalId.split('/')[1]}`;
      const res = await withRetry(() => safeFetch(url, { timeoutMs: 15000 }));
      if (!res.ok || !res.text) {
        if (res.status === 404) {
          return { ok: false, error: 'کانال یافت نشد یا پیش‌نمایش وب آن غیرفعال است', limits, needsAuth: false };
        }
        if (posts.length === 0) {
          return { ok: false, error: `دریافت ناموفق (وضعیت ${res.status || 'شبکه'}): ${res.error || ''}`, limits };
        }
        break; // صفحه اول موفق بوده؛ با همین ادامه بده
      }
      const parsed = parseTelegramPage(res.text);
      if (parsed.posts.length === 0) break;
      posts.push(...parsed.posts);
    }
    if (posts.length === 0) {
      return { ok: false, error: 'هیچ پیام متنی‌ای در پیش‌نمایش وب یافت نشد (کانال فقط رسانه منتشر می‌کند؟)', limits };
    }
    return {
      ok: true,
      posts: posts.slice(0, opts.maxItems || 30),
      coverageNote: `دریافت از پیش‌نمایش وب t.me/s — ${posts.length} پیام متنی. سابقه قبل از نمایش‌داده‌شده در دسترس نیست.`,
      limits,
    };
  },
};
