/**
 * اتصال‌دهنده RSS — استاندارد Atom/RSS
 * محدودیت‌ها: پوشش تابع خوراک ارائه‌شده توسط سایت است.
 */
import type { Connector, ConnectorResult, PostInput } from './types';
import { safeFetch } from '../security/ssrf';
import { withRetry } from './types';

function tagXml(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return undefined;
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

/** استخراج تصویر شاخص از آیتم خوراک — ترتیب اولویت:
 *  media:content → media:thumbnail → enclosure تصویری → link rel=enclosure (اتم) → اولین <img> در توضیحات.
 *  URL نسبی/پروتکلی به https تبدیل می‌شود؛ بدون عکس، undefined. تابع خالص تست‌پذیر. */
export function extractItemImage(block: string): string | undefined {
  const candidates: Array<string | undefined> = [];
  const attr = (tagRe: RegExp): string | undefined => {
    const m = block.match(tagRe);
    return m?.[1]?.trim() || undefined;
  };
  candidates.push(attr(/<media:content[^>]*\burl="([^"]+)"[^>]*>/i));
  if (!candidates[0]) candidates.push(attr(/<media:content[^>]*\burl='([^']+)'[^>]*>/i));
  candidates.push(attr(/<media:thumbnail[^>]*\burl="([^"]+)"/i));
  candidates.push(attr(/<enclosure[^>]*\burl="([^"]+)"[^>]*type="image\/[^"]*"/i));
  candidates.push(attr(/<enclosure[^>]*\btype="image\/[^"]*"[^>]*\burl="([^"]+)"/i));
  candidates.push(attr(/<enclosure[^>]*\burl="([^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/i));
  candidates.push(attr(/<link[^>]*\brel="enclosure"[^>]*\btype="image\/[^"]*"[^>]*\bhref="([^"]+)"/i));
  // اولین تصویر داخل HTML توضیحات
  const imgTag = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgTag) candidates.push(imgTag[1].trim());
  for (let raw of candidates) {
    if (!raw) continue;
    raw = raw.replace(/&amp;/g, '&').trim();
    if (raw.startsWith('//')) raw = `https:${raw}`;
    if (!/^https?:\/\/.+/i.test(raw)) continue;
    if (/\.(svg)(\?|$)/i.test(raw)) continue;
    return raw;
  }
  return undefined;
}

export const rssConnector: Connector = {
  key: 'rss',
  label: 'خوراک RSS',
  implemented: true,
  limitsDescription: 'پوشش دقیقاً برابر خوراک ارائه‌شده توسط سایت است؛ بعضی سایت‌ها فقط چند مطلب آخر را می‌دهند.',
  authDescription: 'بدون احراز هویت. اگر خوراک پشت احراز هویت باشد، دریافت ناموفق ثبت می‌شود.',

  validateIdentifier: (id) => /^https?:\/\/.+/i.test(id),
  normalizeIdentifier: (raw) => raw.trim(),

  async fetchRecent(identifier, opts): Promise<ConnectorResult> {
    const limits = this.limitsDescription;
    const res = await withRetry(() => safeFetch(identifier, { timeoutMs: 20000 }));
    if (!res.ok || !res.text) {
      return { ok: false, error: `دریافت خوراک ناموفق بود (وضعیت ${res.status || 'شبکه'}): ${res.error || ''}`, limits };
    }
    const posts: PostInput[] = [];
    const isAtom = /<feed[\s>]/i.test(res.text);
    const items = isAtom
      ? res.text.split(/<entry[\s>]/i).slice(1)
      : res.text.split(/<item[\s>]/i).slice(1);
    for (const item of items.slice(0, opts.maxItems || 30)) {
      const title = tagXml(item, 'title') || '';
      const link = isAtom
        ? item.match(/<link[^>]*href="([^"]+)"/i)?.[1] || tagXml(item, 'link')
        : tagXml(item, 'link');
      const desc = tagXml(item, 'description') || tagXml(item, 'summary') || tagXml(item, 'content') || '';
      const dateStr = tagXml(item, 'pubDate') || tagXml(item, 'published') || tagXml(item, 'updated') ||
        tagXml(item, 'dc:date');
      const guid = tagXml(item, 'guid') || link;
      const content = title && desc && desc !== title ? `${title}\n${desc}` : (title || desc);
      if (!content || !guid) continue;
      const publishedAt = dateStr ? new Date(dateStr) : undefined;
      const imageUrl = extractItemImage(item);
      posts.push({
        externalId: guid,
        content,
        url: link,
        imageUrl,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
        metadata: { feedTitle: tagXml(res.text, 'title') },
      });
    }
    if (posts.length === 0) {
      // تشخیص صادقانه: اگر پاسخ HTML بود (نه XML خوراک)، محافظت/صفحهٔ خطا علت واقعی است
      const head = res.text.slice(0, 600).toLowerCase();
      if (/<!doctype html|<html[\s>]/.test(head)) {
        const isCloudflare = /cloudflare|sign in|چالش|challenge|cf-browser|just a moment/i.test(res.text.slice(0, 3000));
        return {
          ok: false,
          error: isCloudflare
            ? 'سایت این منبع پشت محافظ Cloudflare/ورود است و خوراک RSS از این سرور در دسترس نیست (پاسخ HTML به‌جای XML) — نشانی خوراک جایگزین لازم است'
            : 'پاسخ HTML دریافت شد نه خوراک XML — نشانی واردشده خوراک RSS/Atom نیست یا صفحهٔ خطاست',
          limits,
        };
      }
      return { ok: false, error: 'خوراک دریافت شد اما مطلبی در آن یافت نشد (فرمت نامعتبر یا خوراک خالی)', limits };
    }
    return { ok: true, posts, coverageNote: `دریافت ${posts.length} مطلب از خوراک RSS. پوشش تابع خوراک سایت است.`, limits };
  },
};
