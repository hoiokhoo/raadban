/**
 * تروث سوشال — خواستهٔ کاربر (۱۶ نوامبر ۲۰۲۶):
 * «توییتها و تروث سوشال ترامپ و قالیباف و سایر مقامات تاثیرگذار رو نمیبینم!»
 *
 * ترامپ اصلی‌ترین سخنانش را در تروث سوشال می‌نویسد (حساب ایکسش کم‌کار است)؛
 * truthsocial.com خودش از نشانی‌های دیتاسنتر (از جمله رانرهای گیت‌هاب اکشنز ممکن است متفاوت باشد)
 * جغرافیایی بسته می‌شود — منبع پایدار و عمومی: آرشیو رسمی‌گونهٔ trumpstruth.org
 * (فید RSS با ۱۰۰ پست آخر دونالد ترامپ، به‌روز تا همین امروز).
 *
 * صادقانه: فقط آرشیو ترامپ را پوشش می‌دهد؛ حساب تروث‌سوشال دیگرانی که آرشیوشان موجود
 * نیست با پیام روشن رد می‌شود (هیچ ساختگی). همهٔ توابع خالصِ پارس جدا و تست‌پذیرند.
 */

export interface TruthPost {
  id: string;
  text: string;
  createdAt: Date | null;
}

const TRUTH_ARCHIVE_FEED = 'https://www.trumpstruth.org/feed';
const TRUTH_UA = 'Mozilla/5.0 (compatible; RaadbanBot/1.0; +https://github.com)';

/** پاک‌سازی متن یک پست تروث‌سوشال از آرشیو — حذف زائدات آرشیو:
 *  «View image»/«View video»، لینک‌های «RT: https://…»، «Quoted <name>»، تگ‌های HTML و CDATA.
 *  خروجی: متن خوانا. تابع خالص تست‌پذیر. */
export function cleanTruthText(raw: string): string {
  let t = (raw || '');
  // CDATA
  t = t.replace(/^\s*<!\[CDATA\[\s*/,'').replace(/\s*\]\]>\s*$/,'');
  // موجودیت‌های رایج RSS
  t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
  // تگ‌های HTML
  t = t.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ');
  // زائدات آرشیو
  t = t.replace(/\bView (image|video)s?\b/gi, ' ');
  t = t.replace(/\bRT:\s*https?:\/\/\S+/gi, ' ');
  t = t.replace(/\bQuoted [A-Za-z .'-]+\b(?=\s|$)/g, ' ');
  // لینک‌های آرشیو وسطشان فاصله افتاده و شکسته‌اند («https://www. wsj.com/…») — حذف کامل برای نمایش تمیز:
  // اول طرح http(s)، بعد دامنه‌های لختِ باقی‌مانده (wsj.com/… ، www.… )
  t = t.replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\b[a-z0-9-]+\.(?:com|org|net|io|gov|co|info|site|ai|news|ir)\b(?:\/\S*)?/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/** واکشی شناسهٔ پست از نشانی آرشیو — /statuses/43600 → «43600»؛ نبود → رشتهٔ خالی */
export function truthIdOf(link: string): string {
  const m = /\/statuses\/(\d+)/.exec(link || '');
  return m ? m[1] : '';
}

/** پارس فید RSS آرشیو تروث‌سوشال — خالص و تست‌پذیر.
 *  پست‌های صرفاً تصویری/ویدیویی (متنِ باقی‌ماندهٔ کوتاه) حذف می‌شوند؛ ضدتکرار با شناسه. */
export function parseTruthFeedXml(xml: string, maxItems = 20): TruthPost[] {
  if (!xml) return [];
  const out: TruthPost[] = [];
  const seen = new Set<string>();
  const items = xml.split(/<item>/i).slice(1);
  for (const it of items) {
    if (out.length >= maxItems) break;
    const link = (it.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
    const id = truthIdOf(link);
    if (!id || seen.has(id)) continue;
    const descRaw = it.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '';
    const text = cleanTruthText(descRaw);
    if (text.length < 25) continue; // پست صرفاً رسانه‌ای/خالی — متنی برای ترجمه ندارد
    const pubRaw = (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '').trim();
    const d = pubRaw ? new Date(pubRaw) : null;
    out.push({ id, text, createdAt: d && !Number.isNaN(d.getTime()) ? d : null });
    seen.add(id);
  }
  return out;
}

/** واکشی پست‌های تازهٔ تروث‌سوشال ترامپ از آرشیو عمومی — شکست → ok:false (صادقانه، هیچ ساختگی). */
export async function fetchTruthSocialArchive(timeoutMs = 20_000, maxItems = 20): Promise<{ ok: boolean; posts: TruthPost[]; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(TRUTH_ARCHIVE_FEED, {
      headers: { 'User-Agent': TRUTH_UA, Accept: 'application/rss+xml,application/xml,text/xml,*/*' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return { ok: false, posts: [], error: `HTTP ${res.status}` };
    const xml = await res.text().catch(() => '');
    if (!xml || xml.length < 500) return { ok: false, posts: [], error: 'پاسخ آرشیو خالی/نامعتبر بود' };
    const posts = parseTruthFeedXml(xml, maxItems);
    if (posts.length === 0) return { ok: false, posts: [], error: 'پست متنی قابل‌استخراج نبود' };
    return { ok: true, posts };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === 'AbortError' ? `timeout پس از ${timeoutMs}ms` : e.message) : 'خطای ناشناخته';
    return { ok: false, posts: [], error: msg };
  } finally {
    clearTimeout(timer);
  }
}
