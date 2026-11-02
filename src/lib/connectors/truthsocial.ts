/**
 * اتصال‌دهنده تروث سوشال — API عمومی وضعیت‌های حساب
 * محدودیت‌ها (صریح):
 *  - API عمومی بدون احراز هویت است اما پشت Cloudflare است؛ از برخی IPها
 *    (به‌ویژه دیتاسنتر) با HTTP 403 مسدود می‌شود — خطا صادقانه ثبت می‌شود
 *  - مسیر جایگزین مجاز برای حساب‌های خاص (مثل بایگانی عمومی trumpstruth.org)
 *    به‌صورت منبع RSS جداگانه ثبت می‌شود و در رابط کاربری شفاف است
 */
import type { Connector, ConnectorResult, PostInput } from './types';
import { safeFetch } from '../security/ssrf';
import { withRetry } from './types';

const API_BASE = 'https://truthsocial.com/api/accounts';

export interface TruthStatus {
  id?: string | number;
  text?: string;
  content?: string;
  created_at?: string;
  url?: string;
  account?: { acct?: string; username?: string };
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** پارسر خالص پاسخ JSON تروث سوشال — قابل تست واحد */
export function extractTruthsFromJson(raw: string, handle: string, maxItems = 20): PostInput[] {
  const posts: PostInput[] = [];
  if (!raw) return posts;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return posts;
  }
  if (!Array.isArray(data)) return posts;
  for (const item of data.slice(0, maxItems * 2)) {
    if (!item || typeof item !== 'object') continue;
    const st = item as TruthStatus;
    const id = st.id !== undefined ? String(st.id) : undefined;
    const text = st.text || (st.content ? stripHtml(st.content) : '');
    if (!id || !text || text.length < 10) continue;
    const acct = st.account?.acct || st.account?.username || handle;
    posts.push({
      externalId: `truth-${acct}-${id}`,
      content: text,
      url: st.url || `https://truthsocial.com/@${acct}/posts/${id}`,
      publishedAt: st.created_at ? new Date(st.created_at) : undefined,
      metadata: { platform: 'truthsocial', author: acct },
    });
    if (posts.length >= maxItems) break;
  }
  return posts;
}

export const truthsocialConnector: Connector = {
  key: 'truthsocial',
  label: 'تروث سوشال',
  implemented: true,
  limitsDescription:
    'از API عمومی تروث سوشال استفاده می‌کند؛ Cloudflare از برخی IPهای دیتاسنتر جلوگیری می‌کند (HTTP 403) — در آن حالت خطا صادقانه ثبت می‌شود. مسیر جایگزین مجاز (بایگانی عمومی پست‌ها به‌صورت RSS) به‌صورت منبع جداگانه قابل ثبت است.',
  authDescription: 'بدون احراز هویت (API عمومی). پوشش تابع دسترس‌پذیری از IP محل اجراست.',

  validateIdentifier: (id) => /^[A-Za-z0-9_]{2,30}$/.test(id),
  normalizeIdentifier: (raw) => {
    let s = raw.trim();
    try {
      const u = new URL(s);
      const parts = u.pathname.split('/').filter(Boolean).filter((p) => p !== '@' && p !== 'posts');
      if (parts.length) s = parts[0];
    } catch { /* URL نیست */ }
    return s.replace(/^@/, '').split('/')[0];
  },

  async fetchRecent(identifier, opts): Promise<ConnectorResult> {
    const limits = this.limitsDescription;
    const handle = this.normalizeIdentifier(identifier);
    if (!this.validateIdentifier(handle)) {
      return { ok: false, error: `شناسه حساب تروث سوشال نامعتبر است: ${identifier}`, limits };
    }
    const url = `${API_BASE}/${handle}/statuses?type=TEXT`;
    let res;
    try {
      res = await withRetry(
        () => safeFetch(url, {
          timeoutMs: 20000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            'Accept': 'application/json',
          },
        }),
        { retries: 1, baseDelayMs: 3000 },
      );
    } catch {
      return { ok: false, error: 'دریافت پست‌های تروث سوشال ناموفق بود (خطای شبکه)', limits };
    }
    if (res.status === 403) {
      return { ok: false, error: 'تروث سوشال درخواست از این نشانی IP را مسدود کرده است (Cloudflare 403) — اتصال‌دهنده واقعی است؛ مسیر جایگزین مجاز (بایگانی عمومی RSS) را به‌عنوان منبع جداگانه ثبت کنید', limits };
    }
    if (!res.ok || !res.text) {
      return { ok: false, error: `دریافت پست‌های تروث سوشال ناموفق بود (وضعیت ${res.status || 'شبکه'}): ${res.error || ''}`, limits };
    }
    const posts = extractTruthsFromJson(res.text, handle, opts.maxItems || 20);
    if (posts.length === 0) {
      return { ok: false, error: 'پستی از پاسخ API استخراج نشد — حساب ممکن است خصوصی باشد یا پاسخ تغییر کرده باشد', limits };
    }
    return { ok: true, posts, coverageNote: `دریافت ${posts.length} پست از @${handle} در تروث سوشال`, limits };
  },
};
