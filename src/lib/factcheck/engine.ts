/**
 * موتور راستی‌آزمایی — فصل ۷ سند
 * - ارزیابی در سطح ادعا با ۸ وضعیت استاندارد
 * - مدل فقط بر شواهد ارائه‌شده حکم می‌دهد؛ نه دانش داخلی
 * - جست‌وجوی شواهد در محیط محدود ممکن است ناموفق باشد → صادقانه «تأییدنشده»
 * - بازنشرها شواهد مستقل حساب نمی‌شوند
 */
import { db } from '@/lib/db';
import { aiCall, extractJson } from '../ai/client';
import { SYSTEM_FACTCHECK } from '../ai/prompts';
import { shieldUntrustedContent } from '../security/guard';
import { safeFetch } from '../security/ssrf';
import { jaccardSimilarity } from '../pipeline/normalize';

export const CLAIM_STATUSES = [
  'تأییدشده_با_شواهد_کافی',
  'عمدتاً_تأییدشده',
  'تأییدنشده',
  'مورد_اختلاف',
  'گمراه‌کننده',
  'ردشده_با_شواهد_کافی',
  'منسوخ_یا_اصلاح‌شده',
  'در_انتظار_بررسی',
] as const;

export const CONFIDENCES = ['بالا', 'متوسط', 'پایین', 'نامعلوم'] as const;

interface EvidenceItem { url?: string; title?: string; snippet?: string; sourceName?: string; }

/** رمزگشایی لینک ریدایرکت بینگ وب: «...u=a1<base64url>» → URL واقعی — تابع خالص تست‌پذیر */
export function decodeBingRedirect(href: string): string {
  const m = href.match(/[?&]u=a1([A-Za-z0-9_-]+)/);
  if (!m) return href;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const dec = Buffer.from(b64, 'base64').toString('utf8');
    return /^https?:\/\//.test(dec) ? dec : href;
  } catch {
    return href;
  }
}

/** استخراج URL واقعی از لینک ریدایرکت Bing News (پارامتر url= کدگذاری‌شده) — تابع خالص تست‌پذیر */
export function decodeBingNewsUrl(href: string): string {
  const m = href.match(/[?&]url=([^&]+)/);
  if (!m) return href;
  try {
    const dec = decodeURIComponent(m[1]);
    return /^https?:\/\//.test(dec) ? dec : href;
  } catch {
    return href;
  }
}

function xmlTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
}

/** پارس فید RSS جست‌وجوی خبری بینگ — تابع خالص تست‌پذیر */
export function parseBingNewsRss(xml: string, max = 6): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  const blocks = xml.split('<item>').slice(1);
  for (const b of blocks) {
    const title = stripHtml(xmlTag(b, 'title'));
    const linkRaw = xmlTag(b, 'link').replace(/&amp;/g, '&');
    const desc = stripHtml(xmlTag(b, 'description'));
    if (!title || title.length < 10 || !linkRaw) continue;
    const url = decodeBingNewsUrl(linkRaw);
    if (!/^https?:\/\//.test(url) || url.includes('bing.com/news/apiclick')) continue;
    out.push({ url, title: title.slice(0, 200), snippet: desc ? desc.slice(0, 300) : undefined });
    if (out.length >= max) break;
  }
  return out;
}

// ---------- فیلتر تناظر واژگان — سپر در برابر نتایج بی‌ربط موتورهای جست‌وجو ----------

const SEARCH_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'was', 'were', 'are', 'not',
  'his', 'her', 'its', 'their', 'about', 'after', 'before', 'over', 'into', 'says', 'said', 'news',
  'در', 'از', 'به', 'با', 'که', 'این', 'را', 'برای', 'است', 'بود', 'شد', 'های', 'می', 'بر', 'یک',
  'تا', 'هم', 'آن', 'کرد', 'شود', 'گوید', 'درباره', 'براساس', 'طبق', 'خبر', 'گزارش', 'شورای',
]);

/** واژگان معنادار متن — نیم‌فاصله (ZWNJ) جزء واژه حفظ می‌شود («آتش‌بس» یک توکن) — تابع خالص تست‌پذیر */
export function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\u200c]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !SEARCH_STOPWORDS.has(t));
}

/** آیا نتیجهٔ جست‌وجو دست‌کم یک واژهٔ معنادار از ادعا را دارد؟ — تابع خالص تست‌پذیر */
export function isRelevantResult(query: string, item: { title?: string; snippet?: string }): boolean {
  const qt = significantTokens(query);
  if (qt.length === 0) return true;
  const it = new Set(significantTokens(`${item.title || ''} ${item.snippet || ''}`));
  return qt.some((t) => it.has(t));
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** پارس نتایج HTML بینگ — تابع خالص تست‌پذیر */
export function parseBingResults(html: string, max = 6): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  const blocks = html.split('<li class="b_algo').slice(1);
  for (const b of blocks) {
    const h2 = b.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!h2) continue;
    const url = decodeBingRedirect(h2[1].replace(/&amp;/g, '&'));
    const title = stripHtml(h2[2]);
    if (!title || title.length < 10) continue;
    if (!/^https?:\/\//.test(url) || url.includes('bing.com/ck/a')) continue;
    const p = b.match(/<div class="b_caption"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i) || b.match(/<p[^>]*>([\s\S]{30,400}?)<\/p>/i);
    const snippet = p ? stripHtml(p[1]).slice(0, 300) : undefined;
    out.push({ url, title: title.slice(0, 200), snippet });
    if (out.length >= max) break;
  }
  return out;
}

/** پارس نتایج داک‌داک‌گو لایت (موتور جایگزین) — تابع خالص تست‌پذیر */
export function parseDuckResults(html: string, max = 6): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  const links = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{5,200}?)<\/a>/g)];
  for (const l of links) {
    const target = l[1];
    const title = l[2].replace(/<[^>]+>/g, '').trim();
    if (title.length < 10 || target.includes('duckduckgo.com')) continue;
    out.push({ url: target, title });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * جست‌وجوی شواهد آزاد وب — چندموتوری با سپر تناظر واژگان:
 *   ۱) فید RSS جست‌وجوی خبری بینگ (پاسخ‌گو و مطابق برای فارسی و انگلیسی)
 *   ۲) بینگ وب HTML (فقط با فیلتر تناظر — بدون کوکی ممکن است نتایج بی‌ربط بدهد)
 *   ۳) داک‌داک‌گو لایت (در برخی محیط‌ها ۲۰۲ ضدبات)
 * همهٔ نتایج با فیلتر تناظر واژگان پالایش می‌شوند؛ نتیجهٔ بی‌ربط هرگز شاهد حساب نمی‌شود.
 * در محیط بدون دسترسی اینترنت ناموفق است و صادقانه ثبت می‌شود (هرگز شواهد ساختگی ساخته نمی‌شود).
 */
export async function searchEvidenceWeb(claimText: string): Promise<{
  ok: boolean; items: EvidenceItem[]; error?: string; enginesTried: string[];
}> {
  const enginesTried: string[] = [];
  const q = encodeURIComponent(claimText.slice(0, 200));
  const items: EvidenceItem[] = [];
  const push = (found: EvidenceItem[]) => {
    for (const it of found) {
      if (!isRelevantResult(claimText, it)) continue;
      if (items.some((x) => x.url === it.url)) continue;
      items.push(it);
      if (items.length >= 6) return;
    }
  };

  // موتور ۱: RSS خبری بینگ — نتایج خبری واقعی با عنوان/خلاصه، بدون چالش ضدبات
  try {
    enginesTried.push('bing-news-rss');
    const res = await safeFetch(`https://www.bing.com/news/search?q=${q}&format=RSS`, { timeoutMs: 12000 });
    if (res.ok && res.text.includes('<item>')) {
      push(parseBingNewsRss(res.text));
    }
  } catch { /* موتور بعدی */ }

  // موتور ۲: بینگ وب HTML — فقط با فیلتر تناظر (بدون کوکی ممکن است نتایج بی‌ربط بدهد)
  if (items.length < 3) {
    try {
      enginesTried.push('bing.com');
      const res = await safeFetch(`https://www.bing.com/search?q=${q}&count=10`, { timeoutMs: 12000 });
      if (res.ok && res.text.includes('b_algo')) {
        push(parseBingResults(res.text));
      }
    } catch { /* موتور بعدی */ }
  }

  // موتور ۳: داک‌داک‌گو لایت — در برخی محیط‌ها پاسخ ۲۰۲ ضدبات می‌دهد؛ تلاش بی‌ضرر
  if (items.length < 3) {
    try {
      enginesTried.push('lite.duckduckgo.com');
      const res = await safeFetch(`https://lite.duckduckgo.com/lite/?q=${q}`, { timeoutMs: 12000 });
      if (res.ok) push(parseDuckResults(res.text));
    } catch { /* پایان */ }
  }

  return {
    ok: items.length > 0,
    items: items.slice(0, 6),
    enginesTried,
    error: items.length ? undefined : 'هیچ موتور جست‌وجویی نتیجهٔ مرتبط نداد — دسترسی وب محدود است',
  };
}

/** ارزیابی یک ادعا بر اساس شواهد موجود (بدون جست‌وجوی تازه) */
export async function evaluateClaim(
  claimId: string,
  opts: { searchWeb?: boolean } = {}
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const claim = await db.claim.findUnique({
    where: { id: claimId },
    include: {
      post: { include: { source: true } },
      event: { include: { posts: { include: { post: { include: { source: true } } } } } },
    },
  });
  if (!claim) return { ok: false, error: 'ادعا یافت نشد' };

  const existingEvidence = await db.evidence.findMany({ where: { claimId } });

  let webEvidence: EvidenceItem[] = [];
  let searchNote = 'جست‌وجوی وب انجام نشد — ارزیابی صرفاً بر شواهد درون‌سامانه‌ای.';
  if (opts.searchWeb) {
    const s = await searchEvidenceWeb(claim.text);
    webEvidence = s.items;
    searchNote = s.ok
      ? `${s.items.length} نتیجه از جست‌وجوی وب (${s.enginesTried.join('، ')})`
      : `جست‌وجوی وب ناموفق بود (${s.error}).`;
    for (const item of webEvidence) {
      await db.evidence.create({
        data: {
          claimId,
          url: item.url,
          title: item.title?.slice(0, 300),
          snippet: item.snippet?.slice(0, 1000),
          stance: 'بی‌طرف',
          sourceType: 'ثانویه',
        },
      });
    }
  }

  // شواهد درون‌سامانه‌ای: سایر مطالب مرتبط با رویداد + تشخیص وابستگی
  const sameEventPosts = claim.event?.posts.filter((ep) => ep.postId !== claim.postId) || [];
  const relatedLines: string[] = [];
  for (const ep of sameEventPosts) {
    const sim = jaccardSimilarity(claim.text, ep.post.content);
    if (sim >= 0.45) {
      relatedLines.push(
        `- «${ep.post.source?.name || 'منبع ناشناس'}» (${ep.post.publishedAt?.toISOString().slice(0, 10) || 'تاریخ نامشخص'}) شباهت ${Math.round(sim * 100)}٪ — ${sim >= 0.55 ? 'احتمالاً بازنشر همان خبر' : 'بازگویی مشابه'}`
      );
      await db.evidence.create({
        data: {
          claimId,
          url: ep.post.url,
          title: `پوشش توسط ${ep.post.source?.name || 'منبع'}`,
          snippet: ep.post.content.slice(0, 400),
          stance: 'بی‌طرف',
          sourceType: 'بازنشر',
        },
      });
    }
  }

  let dependencyNote = '';
  if (relatedLines.length > 0) {
    dependencyNote = `${relatedLines.length} پوشش مشابه درون‌سامانه‌ای یافت شد. این موارد احتمالاً وابسته‌اند (بازنشر/بازگویی یک خبر) و به‌عنوان منبع مستقل شمرده نمی‌شوند:\n${relatedLines.join('\n')}`;
  }

  const evidenceSummary = [
    ...existingEvidence.filter((e) => e.sourceType !== 'بازنشر').map((e) => ({ stance: e.stance, sourceType: e.sourceType, title: e.title || '', url: e.url || '' })),
    ...webEvidence.map((e) => ({ stance: 'بی‌طرف', sourceType: 'ثانویه', title: e.title || '', url: e.url || '' })),
  ];

  const contextParts = [
    `ادعا: ${claim.text}`,
    `منبع منتشرکننده: ${claim.publisherName || claim.post?.source?.name || 'نامشخص'}`,
    `زمان انتشار: ${claim.publishedAt?.toISOString() || 'نامشخص'}`,
    `زمان وقوع ادعاشده: ${claim.eventDate?.toISOString().slice(0, 10) || 'نامشخص'}`,
    `جست‌وجوی وب: ${searchNote}`,
    evidenceSummary.length
      ? `شواهد یافت‌شده (فقط عنوان/پیوند؛ محتوای کامل در دسترس نیست):\n${evidenceSummary.map((e) => `- [${e.sourceType}/${e.stance}] ${e.title}`).join('\n')}`
      : 'هیچ شواهد بیرونی‌ای یافت نشد.',
    dependencyNote ? `هشدار وابستگی منابع:\n${dependencyNote}` : '',
  ].filter(Boolean).join('\n\n');

  const shielded = shieldUntrustedContent(contextParts, 'زمینه ارزیابی');
  const res = await aiCall({
    purpose: 'راستی_آزمایی',
    systemPrompt: SYSTEM_FACTCHECK,
    userContent: shielded.wrapped,
    maxChars: 10000,
    thinking: true,
    priority: 'interactive',
  });
  if (!res.ok || !res.content) return { ok: false, error: res.error };

  const parsed = extractJson<{
    status: string; confidence: string; confidenceNote?: string;
    supportingEvidenceNotes?: string; contradictingEvidenceNotes?: string;
    primarySourcesNotes?: string; dependencyNote?: string; notVerifiableNote?: string; analysis?: string;
  }>(res.content, (x) => {
    if (typeof x !== 'object' || x === null || typeof (x as Record<string, unknown>).status !== 'string') return null;
    return x as never;
  });
  if (!parsed || !(CLAIM_STATUSES as readonly string[]).includes(parsed.status)) {
    return { ok: false, error: 'وضعیت برمی‌گردانده‌شده در فهرست مجاز نبود' };
  }

  const conf = (CONFIDENCES as readonly string[]).includes(parsed.confidence) ? parsed.confidence : 'نامعلوم';
  const notVerifiable =
    parsed.status === 'تأییدنشده' && (!evidenceSummary.length || searchNote.includes('ناموفق'))
      ? (parsed.notVerifiableNote || 'امکان تأیید مستقل فراهم نشد — هیچ شواهد بیرونی مستقلی در دسترس نبود.')
      : parsed.notVerifiableNote || '';

  await db.claim.update({
    where: { id: claimId },
    data: {
      status: parsed.status,
      confidence: conf,
      confidenceNote: parsed.confidenceNote?.slice(0, 1000),
      supportingEvidenceNotes: parsed.supportingEvidenceNotes?.slice(0, 2000) || null,
      contradictingEvidenceNotes: parsed.contradictingEvidenceNotes?.slice(0, 2000) || null,
      primarySourcesNotes: parsed.primarySourcesNotes?.slice(0, 2000) || null,
      dependencyNote: dependencyNote || parsed.dependencyNote || null,
      notVerifiableNote: notVerifiable || null,
      evidenceSearchedAt: new Date(),
    },
  });

  await db.factcheckReport.create({
    data: {
      claimId,
      content: parsed.analysis?.slice(0, 4000) || res.content.slice(0, 4000),
      model: res.model,
      promptVersion: res.promptVersion,
    },
  });

  return { ok: true, status: parsed.status };
}
