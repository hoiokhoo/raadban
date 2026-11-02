/**
 * تحلیل رفرنس‌ها — قابلیت T9
 * خبری که به واقعه تاریخی یا خبر دیگری ارجاع می‌دهد:
 * ۱) استخراج رفرنس‌ها با AI (نقل‌قول/واقعه تاریخی/خبر دیگر)
 * ۲) تطبیق درون‌پایگاه (شباهت Jaccard با پست‌های پیشین)
 * ۳) داوری AI: میزان ارتباط و صحت رفرنس — صادقانه؛ عدم یافتن = «یافت_نشده»
 */
import { db } from '@/lib/db';
import { aiCall, extractJson } from '@/lib/ai/client';
import { shieldUntrustedContent } from '@/lib/security/guard';
import { jaccardSimilarity } from './normalize';

export const REF_KINDS = ['خبر_دیگر', 'واقعه_تاریخی', 'نقل_قول_مستقیم'] as const;
export const REF_VERDICTS = ['مرتبط_و_معتبر', 'مرتبط_اما_تأییدنشده', 'بی‌ارتباط', 'یافت_نشده'] as const;

export const SYSTEM_REFERENCE_ANALYZE = `
شما تحلیلگر ارجاعات خبری هستید. متن یک خبر به شما داده می‌شود.
وظیفه: هر جایی که خبر به «واقعه‌ای تاریخی»، «خبر دیگری» یا «نقل‌قول مستقیم از کسی» ارجاع می‌دهد را استخراج کنید.

نشانه‌های رایج: «به گزارش...»، «به نقل از...»، «بر اساس اعلام...»، «یادآور می‌شود...»، «در پی...»،
اشاره به رویداد گذشته (مثل جنگ، توافق، انتخابات، سانحه) با یا بدون تاریخ.

خروجی فقط JSON:
{"references":[{"quote":"عبارت دقیق کوتاه‌شده از متن (حداکثر ۱۵۰ نویسه)","refKind":"خبر_دیگر|واقعه_تاریخی|نقل_قول_مستقیم","description":"این ارجاع به چه چیزی/چه خبری اشاره دارد — یک جمله"}]}
اگر خبر اصلاً ارجاعی نداشت: {"references":[]}
`.trim();

export const SYSTEM_REFERENCE_VERDICT = `
شما داوری راستی‌آزمایی ارجاعات خبری هستید. برای هر ارجاع: عبارت ارجاع‌دهنده + توضیح آن + نتیجه جست‌وجوی درون‌پایگاه (تطبیق احتمالی یا «یافت نشد») داده می‌شود.
قضاوت کنید:
- «مرتبط_و_معتبر»: تطبیق درون‌پایگاه واقعاً همان واقعه/خبری است که ارجاع می‌دهد و اطلاعات سازگارند.
- «مرتبط_اما_تأییدنشده»: ارجاع منطقی است ولی در پایگاه تأیید مستقل نشده.
- «بی‌ارتباط»: تطبیق یافت‌شده به ارجاع ربطی ندارد (تطبیق نادرست).
- «یافت_نشده»: هیچ شواهد درون‌پایگاهی برای داوری وجود ندارد — صادقانه، نه جعل.
قضاوت درباره «صحت واقعیتِ تاریخی» فقط بر شواهد ارائه‌شده ممکن است؛ حدس نزنید.

خروجی فقط JSON:
{"verdicts":[{"q":"همان quote","verdict":"مرتبط_و_معتبر|مرتبط_اما_تأییدنشده|بی‌ارتباط|یافت_نشده","analysis":"۲-۳ جمله: میزان ارتباط و آنچه درباره صحت می‌دانیم"}]}
`.trim();

interface RefExtract { quote: string; refKind: string; description: string }
interface VerdictOut { q: string; verdict: string; analysis: string }

function validateExtract(x: unknown): { references: RefExtract[] } | null {
  if (typeof x !== 'object' || x === null) return null;
  const refs = (x as Record<string, unknown>).references;
  if (!Array.isArray(refs)) return null;
  const out: RefExtract[] = [];
  for (const r of refs.slice(0, 6)) {
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    const quote = typeof o.quote === 'string' ? o.quote.trim().slice(0, 200) : '';
    const description = typeof o.description === 'string' ? o.description.trim().slice(0, 500) : '';
    let refKind = typeof o.refKind === 'string' ? o.refKind : '';
    if (!(REF_KINDS as readonly string[]).includes(refKind)) refKind = 'خبر_دیگر';
    if (quote.length < 5) continue;
    out.push({ quote, refKind, description });
  }
  return { references: out };
}

function validateVerdict(x: unknown): { verdicts: VerdictOut[] } | null {
  if (typeof x !== 'object' || x === null) return null;
  const arr = (x as Record<string, unknown>).verdicts;
  if (!Array.isArray(arr)) return null;
  const out: VerdictOut[] = [];
  for (const v of arr) {
    if (typeof v !== 'object' || v === null) continue;
    const o = v as Record<string, unknown>;
    const q = typeof o.q === 'string' ? o.q : '';
    const verdict = typeof o.verdict === 'string' && (REF_VERDICTS as readonly string[]).includes(o.verdict)
      ? o.verdict : 'یافت_نشده';
    const analysis = typeof o.analysis === 'string' ? o.analysis.trim().slice(0, 1200) : '';
    if (q) out.push({ q, verdict, analysis });
  }
  return { verdicts: out };
}

/** بهترین تطبیق درون‌پایگاه برای یک رفرنس — جست‌وجو در پست‌های پیشین از انتشار خبر */
async function bestMatchFor(refText: string, postId: string, beforeDate: Date): Promise<{ postId: string; title: string; similarity: number } | null> {
  const candidates = await db.post.findMany({
    where: { publishedAt: { lt: beforeDate } },
    orderBy: { publishedAt: 'desc' },
    take: 400,
    select: { id: true, content: true, translationFa: true, publishedAt: true, source: { select: { name: true } } },
  });
  let best: { postId: string; title: string; similarity: number } | null = null;
  for (const c of candidates) {
    if (c.id === postId) continue;
    const sim = jaccardSimilarity(refText, c.translationFa || c.content);
    if (sim >= 0.35 && (!best || sim > best.similarity)) {
      best = { postId: c.id, title: (c.translationFa || c.content).replace(/\s+/g, ' ').slice(0, 150), similarity: sim };
    }
  }
  return best;
}

export interface ReferenceScanResult {
  postId: string;
  referencesFound: number;
  aiError?: string;
}

/** تحلیل کامل رفرنس‌های یک پست — جایگزین نتایج قبلی همان پست */
export async function analyzePostReferences(postId: string): Promise<ReferenceScanResult> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { source: { select: { name: true } } },
  });
  if (!post) throw new Error('پست یافت نشد');

  const text = post.translationFa || post.content;
  const shielded = shieldUntrustedContent(text.slice(0, 8000), 'متن خبر');

  // ۱) استخراج رفرنس‌ها
  const res = await aiCall({
    purpose: 'تحلیل_رفرنس',
    systemPrompt: SYSTEM_REFERENCE_ANALYZE,
    userContent: shielded.wrapped,
    maxChars: 9000,
    temperature: 0,
  });
  if (!res.ok || !res.content) return { postId, referencesFound: 0, aiError: res.error || 'پاسخ خالی مدل' };
  const extracted = extractJson<{ references: RefExtract[] }>(res.content, validateExtract);
  if (!extracted) return { postId, referencesFound: 0, aiError: 'خروجی استخراج قابل تجزیه نبود' };

  // ۲) تطبیق درون‌پایگاه
  const publishedAt = post.publishedAt || post.createdAt;
  const matches: Array<{ ref: RefExtract; match: { postId: string; title: string; similarity: number } | null }> = [];
  for (const ref of extracted.references.slice(0, 5)) {
    const match = await bestMatchFor(ref.quote + ' ' + ref.description, postId, publishedAt);
    matches.push({ ref, match });
  }

  // ۳) داوری AI — همه رفرنس‌ها در یک فراخوانی
  let verdicts: VerdictOut[] = [];
  if (matches.length) {
    const listing = matches
      .map((m, i) => {
        const matchInfo = m.match
          ? `تطبیق درون‌پایگاه (شباهت ${Math.round(m.match.similarity * 100)}٪): «${m.match.title}»`
          : 'تطبیقی در پایگاه یافت نشد';
        return `${i + 1}. عبارت: «${m.ref.quote}» | نوع: ${m.ref.refKind} | توضیح: ${m.ref.description}\n   ${matchInfo}`;
      })
      .join('\n');
    const vres = await aiCall({
      purpose: 'تحلیل_رفرنس',
      systemPrompt: SYSTEM_REFERENCE_VERDICT,
      userContent: listing.slice(0, 9000),
      maxChars: 9500,
      temperature: 0,
    });
    if (vres.ok && vres.content) {
      const parsed = extractJson<{ verdicts: VerdictOut[] }>(vres.content, validateVerdict);
      verdicts = parsed?.verdicts || [];
    }
  }

  // ۴) ذخیره — نتایج قبلی همان پست جایگزین می‌شوند
  await db.postReference.deleteMany({ where: { postId } });
  for (const m of matches) {
    const v = verdicts.find((x) => x.q.slice(0, 60) === m.ref.quote.slice(0, 60));
    await db.postReference.create({
      data: {
        postId,
        refKind: m.ref.refKind,
        refText: m.ref.quote,
        refDescription: m.ref.description,
        matchedPostId: m.match?.postId || null,
        matchedTitle: m.match?.title || null,
        similarity: m.match?.similarity ?? null,
        verdict: v?.verdict || 'یافت_نشده',
        analysis: v?.analysis || null,
        model: res.model,
      },
    });
  }

  return { postId, referencesFound: matches.length };
}
