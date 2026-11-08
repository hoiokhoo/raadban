/**
 * خلاصه و تحلیل هوشمند هر خبر — قابلیت ۱۰ (خواستهٔ صریح کاربر ۸ نوامبر ۲۰۲۶)
 * «بخش تحلیل اخبار کار نمی‌کنه — با API رایگان یا API خودت خلاصه و تحلیل اخبار را درست کن»
 *
 * برای هر خبر (فارسی یا خارجی) دو خروجی فارسی تولید می‌شود:
 *   ۱) خلاصهٔ روان ۲-۳ جمله‌ای
 *   ۲) تحلیل واقعی: زمینه، اهمیت، بازیگران، پیامدهای محتمل — نه بازگویی دوبارهٔ متن
 *
 * زنجیرهٔ مدل: استخر جمینی (۵ کلید — چرخش خودکار روی ۴۲۹/سهمیه) → GLM داخلی → Pollinations → ...
 * اصل صراحت: اگر همهٔ مدل‌ها شکست خوردند خطای شفاف برمی‌گردد؛ هیچ‌گاه تحلیل ساختگی ساخته نمی‌شود.
 */
import { db } from '@/lib/db';
import { aiCall, extractJson } from '@/lib/ai/client';
import { shieldUntrustedContent } from '@/lib/security/guard';

export const SYSTEM_SUMMARY_ANALYSIS = `
شما تحلیلگر خبری حرفه‌ای هستید. متن یک خبر به شما داده می‌شود و باید دو کار انجام دهید:

۱) «summary»: خلاصهٔ روان فارسی در ۲ تا ۳ جمله — فقط آنچه در خبر آمده است، بدون افزودن.
۲) «analysis»: تحلیل واقعی فارسی در ۳ تا ۵ جمله شامل:
   - زمینه: این خبر در چه بستری رخ داده (تاریخی/منطقه‌ای/سیاسی)
   - اهمیت: چرا مهم است، چه منافع و بازیگرانی درگیرند
   - پیامد: ادامهٔ محتمل ماجرا و آنچه باید رصد شود
   اگر داده‌ای برای تحلیل در متن نیست، صادقانه بگویید «بر اساس این متن قابل تحلیل نیست» — حدس نزنید.
۳) «importance»: عدد ۰ تا ۵ برای اهمیت خبر (۵ = بسیار مهم جهانی، ۰ = بی‌اهمیت)

خروجی فقط JSON بدون هیچ متن اضافه:
{"summary":"...","analysis":"...","importance":3}
`.trim();

export interface SummaryAnalysisResult {
  summary: string;
  analysis: string;
  importance: number;
}

/** اعتبارسنج خالص خروجی مدل — برای extractJson و تست */
export function validateSummaryPayload(x: unknown): SummaryAnalysisResult | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  const summary = typeof o.summary === 'string' ? o.summary.trim().slice(0, 2000) : '';
  const analysis = typeof o.analysis === 'string' ? o.analysis.trim().slice(0, 4000) : '';
  const impRaw = o.importance;
  const importance = typeof impRaw === 'number' && Number.isFinite(impRaw)
    ? Math.min(5, Math.max(0, Math.round(impRaw)))
    : null;
  if (summary.length < 20 || analysis.length < 20) return null;
  return { summary, analysis, importance: importance ?? 2 };
}

/** ساخت پرامپت کاربر — تابع خالص تست‌پذیر؛ متن خبر با سپر ضدتزریق محصور می‌شود */
export function buildSummaryUserPrompt(content: string, sourceName?: string | null, language?: string | null): string {
  const langNote = language && language !== 'fa'
    ? `\n(زبان اصلی خبر: ${language} — خلاصه و تحلیل باید فارسی روان باشد)`
    : '';
  const srcNote = sourceName ? `\nمنبع: ${sourceName}` : '';
  const shielded = shieldUntrustedContent(content, 'متن خبر').wrapped.slice(0, 12000);
  return `متن خبر:${langNote}${srcNote}\n${shielded}`;
}

export interface SummarizeOutcome {
  ok: boolean;
  postId: string;
  summary?: string;
  analysis?: string;
  importance?: number;
  model?: string;
  error?: string;
  skipped?: string;
}

/** خلاصه و تحلیل یک خبر — ذخیره در Post.summaryFa/analysisFa/analyzedAt */
export async function summarizePost(postId: string, opts: { force?: boolean } = {}): Promise<SummarizeOutcome> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, content: true, normalized: true, language: true, summaryFa: true, analysisFa: true, source: { select: { name: true } } },
  });
  if (!post) return { ok: false, postId, error: 'خبر یافت نشد' };
  if (!opts.force && post.summaryFa && post.analysisFa) {
    return { ok: true, postId, summary: post.summaryFa, analysis: post.analysisFa, skipped: 'قبلاً تحلیل شده', model: 'cache' };
  }
  const text = (post.normalized && post.normalized.length > 40 ? post.normalized : post.content).trim();
  if (text.length < 40) return { ok: false, postId, error: 'متن خبر برای تحلیل بسیار کوتاه است' };

  const r = await aiCall({
    purpose: 'خلاصه_و_تحلیل',
    systemPrompt: SYSTEM_SUMMARY_ANALYSIS,
    userContent: buildSummaryUserPrompt(text, post.source?.name, post.language),
    maxChars: 12000,
    maxTokens: 1200,
    priority: 'interactive', // درخواست مستقیم کاربر — پشت خط تولید پس‌زمینه قفل نمی‌ماند
  });
  if (!r.ok) return { ok: false, postId, error: r.error || 'خطای زنجیرهٔ مدل' };

  const parsed = extractJson<SummaryAnalysisResult>(r.content || '', validateSummaryPayload);
  if (!parsed) {
    return { ok: false, postId, error: 'خروجی مدل قابل اعتبارسنجی نبود (JSON نامعتبر)', model: r.model };
  }
  await db.post.update({
    where: { id: postId },
    data: { summaryFa: parsed.summary, analysisFa: parsed.analysis, analyzedAt: new Date() },
  });
  return { ok: true, postId, summary: parsed.summary, analysis: parsed.analysis, importance: parsed.importance, model: r.model };
}

export interface BatchSummaryResult {
  targeted: number;
  summarized: number;
  failed: number;
  remaining: number;
  errors: Array<{ postId: string; error: string }>;
  results: SummarizeOutcome[];
}

/** دسته‌جمعی: تازه‌ترین خبرهای بدون خلاصه */
export async function summarizePendingPosts({ limit = 10 } = {}): Promise<BatchSummaryResult> {
  const take = Math.min(50, Math.max(1, Math.round(limit)));
  const targets = await db.post.findMany({
    where: { summaryFa: null, processingStatus: { notIn: ['نامرتبط', 'حذف_تبلیغات'] } },
    orderBy: { publishedAt: 'desc' },
    take,
    select: { id: true },
  });
  const results: SummarizeOutcome[] = [];
  const errors: Array<{ postId: string; error: string }> = [];
  for (const t of targets) {
    const r = await summarizePost(t.id);
    results.push(r);
    if (!r.ok) errors.push({ postId: t.id, error: (r.error || 'خطای ناشناخته').slice(0, 200) });
  }
  const remaining = await db.post.count({
    where: { summaryFa: null, processingStatus: { notIn: ['نامرتبط', 'حذف_تبلیغات'] } },
  });
  return {
    targeted: targets.length,
    summarized: results.filter((r) => r.ok && !r.skipped).length,
    failed: errors.length,
    remaining,
    errors,
    results,
  };
}
