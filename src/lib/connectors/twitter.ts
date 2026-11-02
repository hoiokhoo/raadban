/**
 * اتصال‌دهنده توییتر/ایکس — خط زمانی عمومی از سرویس سندیکاسیون رسمی ایکس
 * محدودیت‌ها (صریح — هرگز داده ساختگی تولید نمی‌شود):
 *  - فقط پست‌های عمومی؛ ریپلای‌ها و پست‌های محدودشده دریافت نمی‌شوند
 *  - ایکس درخواست‌های مکرر از یک IP (به‌ویژه دیتاسنتر) را با HTTP 429 محدود می‌کند؛
 *    در آن حالت خطا صادقانه ثبت می‌شود و در تیک بعدی دوباره تلاش می‌شود
 *  - از API پولی ایکس استفاده نمی‌کنیم؛ پوشش تابع دسترس‌پذیری صفحه عمومی است
 *  - ویدیو/تصویر به‌صورت متن نیامده و فقط در پیوند پست قابل مشاهده است
 */
import type { Connector, ConnectorResult, PostInput } from './types';
import { safeFetch } from '../security/ssrf';
import { withRetry } from './types';

const SYNDICATION_BASE = 'https://syndication.twitter.com/srv/timeline-profile/screen-name';

export interface SyndicationTweet {
  id_str?: string;
  full_text?: string;
  text?: string;
  created_at?: string;
  user?: { screen_name?: string; name?: string };
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/https:\/\/t\.co\/\w+/g, '')
    .trim();
}

/** پیاده‌سازی tolerant: همه آبجکت‌های شبه‌توییت را از JSON تو در تو جمع می‌کند */
function walk(obj: unknown, out: SyndicationTweet[], depth = 0): void {
  if (depth > 12 || !obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) walk(item, out, depth + 1);
    return;
  }
  const rec = obj as Record<string, unknown>;
  const hasId = typeof rec.id_str === 'string' && rec.id_str.length >= 5;
  const hasText = typeof rec.full_text === 'string' || typeof rec.text === 'string';
  if (hasId && hasText && rec.created_at) {
    out.push(rec as unknown as SyndicationTweet);
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === 'object') walk(v, out, depth + 1);
  }
}

interface TweetLike { tweet: SyndicationTweet; isQuoteNested: boolean }

/** استخراج ساختاریافته: فقط توییت‌های «بیرونی» خط زمانی (نه نقل‌قول‌های تو در تو) */
function extractTimelineEntries(data: unknown): TweetLike[] {
  const out: TweetLike[] = [];
  const pageProps = (data as Record<string, unknown>)?.props as Record<string, unknown> | undefined;
  const pagePropsInner = pageProps?.pageProps as Record<string, unknown> | undefined;
  const timeline = pagePropsInner?.timeline as Record<string, unknown> | undefined;
  const entries = timeline?.entries as unknown[] | undefined;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const content = (entry as Record<string, unknown>)?.content as Record<string, unknown> | undefined;
    const tweet = content?.tweet as Record<string, unknown> | undefined;
    if (tweet && typeof tweet.id_str === 'string' && (typeof tweet.full_text === 'string' || typeof tweet.text === 'string')) {
      out.push({ tweet: tweet as unknown as SyndicationTweet, isQuoteNested: false });
    }
  }
  return out;
}

function tweetToPost(t: SyndicationTweet, handle: string): PostInput | null {
  const id = t.id_str;
  const rawText = t.full_text || t.text || '';
  if (!id || !rawText) return null;
  const text = unescapeText(rawText);
  if (!text) return null;
  const user = t.user?.screen_name || handle;
  const publishedAt = t.created_at ? new Date(t.created_at) : undefined;
  return {
    externalId: `${user}-${id}`,
    content: text,
    url: `https://x.com/${user}/status/${id}`,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    isForwarded: /^RT @/.test(rawText),
    metadata: { platform: 'twitter', author: user, isProfileSource: user.toLowerCase() === handle.toLowerCase() },
  };
}

/** استخراج پست‌ها از HTML سندیکاسیون ایکس (پارسر خالص — قابل تست واحد) */
export function extractTweetsFromHtml(html: string, handle: string, maxItems = 30): PostInput[] {
  const posts: PostInput[] = [];
  if (!html) return posts;
  const seen = new Set<string>();
  const push = (p: PostInput | null) => {
    if (!p) return;
    if (seen.has(p.externalId)) return;
    seen.add(p.externalId);
    posts.push(p);
  };
  // مسیر ۱: بلوک __NEXT_DATA__ (JSON کامل خط زمانی)
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (m) {
    try {
      const data = JSON.parse(m[1]) as unknown;
      // ۱-الف: ساختار رسمی entries (فقط توییت‌های بیرونی — نقل‌قول‌های تو در تو جدا ثبت نمی‌شوند)
      const entries = extractTimelineEntries(data);
      for (const e of entries) push(tweetToPost(e.tweet, handle));
      // ۱-ب: پشتیبان — جمع tolerant، اما فقط پست‌هایی که نویسنده‌شان همان حساب است
      // (تا نقل‌قول حساب‌های دیگر به‌عنوان پست مستقل این منبع ثبت نشود)
      if (posts.length === 0) {
        const tweets: SyndicationTweet[] = [];
        walk(data, tweets);
        for (const t of tweets) {
          const author = (t.user?.screen_name || '').toLowerCase();
          if (author && author === handle.toLowerCase()) push(tweetToPost(t, handle));
        }
      }
    } catch {
      // JSON نامعتبر — به مسیر ۲ می‌رویم
    }
  }
  // مسیر ۲ (پشتیبان): بلوک‌های توییت-گانه در HTML
  if (posts.length === 0) {
    const blocks = html.split(/class="tweet[^"]*"/i).slice(1);
    for (let i = 0; i < blocks.length && posts.length < maxItems; i++) {
      const b = blocks[i];
      const id = b.match(/data-tweet-id="(\d+)"/)?.[1] || b.match(/status\/(\d+)/)?.[1];
      const text = b.match(/class="tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]
        ?.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
      const timeStr = b.match(/data-time="(\d+)"/)?.[1];
      if (id && text && text.length >= 20 && !seen.has(`${handle}-${id}`)) {
        const publishedAt = timeStr ? new Date(Number(timeStr) * 1000) : undefined;
        push({
          externalId: `${handle}-${id}`,
          content: text,
          url: `https://x.com/${handle}/status/${id}`,
          publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
          isForwarded: /^RT @/.test(text),
          metadata: { platform: 'twitter', author: handle },
        });
      }
    }
  }
  return posts.slice(0, maxItems);
}

/** استخراج نشانی عکس پروفایل صاحب حساب از HTML سندیکاسیون — خواستهٔ کاربر: توییت با عکس صاحب اکانت.
 *  تابع خالص تست‌پذیر؛ نسخهٔ بزرگ‌تر (_400x400) ترجیح داده می‌شود. */
export function extractAvatarUrl(html: string): string | undefined {
  if (!html) return undefined;
  const m = html.match(/https:\/\/pbs\.twimg\.com\/profile_images\/[A-Za-z0-9_\-./]+/);
  if (!m) return undefined;
  return m[0]
    .replace(/_normal(\.\w+)$/, '_400x400$1')
    .replace(/_bigger(\.\w+)$/, '_400x400$1')
    .replace(/[)\]"',]+$/, '');
}

export const twitterConnector: Connector = {
  key: 'twitter',
  label: 'توییتر/ایکس',
  implemented: true,
  limitsDescription:
    'فقط خط زمانی عمومی حساب‌ها از سرویس سندیکاسیون ایکس؛ ریپلای‌ها حذف می‌شوند؛ عکس پروفایل صاحب حساب به پست‌ها افزوده می‌شود. ایکس از IP دیتاسنتر با سهمیهٔ بسیار تنگ برخورد می‌کند (۴۲۹) — مدارشکن: یک حساب در هر پنجرهٔ ۹۰ ثانیه‌ای و خنکی ۲۰ تا ۹۰ دقیقه‌ای پس از ۴۲۹.',
  authDescription:
    'بدون احراز هویت (مسیر عمومی). API رسمی پولی ایکس در دسترس نیست؛ در صورت نیاز به پوشش تضمینی، کلید رسمی لازم است.',

  validateIdentifier: (id) => /^[A-Za-z0-9_]{2,15}$/.test(id),
  normalizeIdentifier: (raw) => {
    let s = raw.trim();
    try {
      const u = new URL(s);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length) s = parts[0];
    } catch { /* URL نیست */ }
    return s.replace(/^@/, '').split('/')[0];
  },

  async fetchRecent(identifier, opts): Promise<ConnectorResult> {
    const limits = this.limitsDescription;
    const handle = this.normalizeIdentifier(identifier);
    if (!this.validateIdentifier(handle)) {
      return { ok: false, error: `شناسه حساب ایکس نامعتبر است: ${identifier}`, limits };
    }
    const url = `${SYNDICATION_BASE}/${handle}?showReplies=false`;
    let res;
    try {
      // retries: صفر — هر فراخوانی ایکس از بودجهٔ نوبتی مصرف می‌کند؛ تلاش دوبارهٔ فوری IP را داغ می‌کند
      res = await withRetry(
        () => safeFetch(url, {
          timeoutMs: 20000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
          },
        }),
        { retries: 0 },
      );
    } catch {
      return { ok: false, error: 'دریافت خط زمانی ایکس ناموفق بود (خطای شبکه یا محدودیت نرخ)', limits };
    }
    if (res.status === 429) {
      return { ok: false, error: 'ایکس این نشانی IP را موقتاً محدود کرده است (HTTP 429) — اتصال‌دهنده واقعی است و از IP خانگی/متفاوت کار می‌کند؛ در تیک بعدی تلاش مجدد می‌شود', limits };
    }
    if (!res.ok || !res.text) {
      return { ok: false, error: `دریافت خط زمانی ایکس ناموفق بود (وضعیت ${res.status || 'شبکه'}): ${res.error || ''}`, limits };
    }
    const avatar = extractAvatarUrl(res.text);
    const posts = extractTweetsFromHtml(res.text, handle, opts.maxItems || 20)
      .map((p) => ({
        ...p,
        imageUrl: avatar,
        metadata: { ...(p.metadata || {}), avatarUrl: avatar },
      }));
    if (posts.length === 0) {
      return { ok: false, error: 'پستی از خط زمانی عمومی استخراج نشد — حساب ممکن است خصوصی/محافظت‌شده باشد یا ساختار صفحه تغییر کرده باشد', limits };
    }
    return { ok: true, posts, coverageNote: `دریافت ${posts.length} پست عمومی از @${handle}${avatar ? ' + عکس پروفایل' : ' (بدون عکس پروفایل)'} — ریپلای‌ها حذف شده‌اند`, limits };
  },
};
