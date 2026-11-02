/**
 * استخراج ادعاها و دسته‌بندی با مدل — مراحل ۸-۱۰ خط لوله
 * خروجی مدل پیش از ذخیره اعتبارسنجی می‌شود (خروجی ساختاریافته).
 */
import { db } from '@/lib/db';
import { aiCall, extractJson, PROMPT_VERSION } from '../ai/client';
import { SYSTEM_CLAIMS_EXTRACT, SYSTEM_CATEGORY_ASSIGN } from '../ai/prompts';
import { shieldUntrustedContent } from '../security/guard';
import { normalizePersian } from './normalize';

export interface ExtractedClaim {
  text: string;
  kind: string;
  actors: string[];
  eventDateISO?: string | null;
  dateNote?: string;
}

const VALID_KINDS = ['عدد', 'نقل_قول', 'آمار', 'اطلاعیه', 'رویداد', 'ادعای_خبری'];

export async function extractClaimsFromPost(postId: string): Promise<{
  ok: boolean; claims?: ExtractedClaim[]; summary?: string; error?: string;
}> {
  const post = await db.post.findUnique({ where: { id: postId }, include: { source: true } });
  if (!post) return { ok: false, error: 'مطلب یافت نشد' };
  const text = post.normalized || post.content;
  const shielded = shieldUntrustedContent(text, 'متن مطلب');
  const pubISO = post.publishedAt ? post.publishedAt.toISOString() : new Date().toISOString();

  const res = await aiCall({
    purpose: 'استخراج_ادعا',
    systemPrompt: SYSTEM_CLAIMS_EXTRACT,
    userContent: [
      `تاریخ انتشار مطلب: ${pubISO}`,
      `نام منبع منتشرکننده: ${post.source?.name || 'نامشخص'}`,
      shielded.wrapped,
    ].join('\n\n'),
    maxChars: 12000,
  });

  const steps = JSON.parse(post.processingSteps || '[]') as Array<Record<string, unknown>>;

  if (!res.ok || !res.content) {
    steps.push({ step: 'استخراج_ادعا', ok: false, error: res.error, at: new Date().toISOString() });
    await db.post.update({ where: { id: postId }, data: { processingSteps: JSON.stringify(steps) } });
    return { ok: false, error: res.error };
  }

  const parsed = extractJson<{ claims: unknown[]; summary?: unknown; injectionWarnings?: unknown }>(
    res.content,
    (x): { claims: unknown[]; summary?: unknown; injectionWarnings?: unknown } | null =>
      typeof x === 'object' && x !== null && 'claims' in x ? (x as never) : null
  );
  if (!parsed) {
    steps.push({ step: 'استخراج_ادعا', ok: false, error: 'پاسخ مدل قابل تحلیل به JSON نبود', at: new Date().toISOString() });
    await db.post.update({ where: { id: postId }, data: { processingSteps: JSON.stringify(steps) } });
    return { ok: false, error: 'خروجی مدل معتبر نبود' };
  }

  // اعتبارسنجی سخت‌گیرانه ادعاها
  const claims: ExtractedClaim[] = [];
  for (const c of parsed.claims || []) {
    if (typeof c !== 'object' || c === null) continue;
    const obj = c as Record<string, unknown>;
    const text = typeof obj.text === 'string' ? normalizePersian(obj.text).slice(0, 1200) : '';
    if (text.length < 15) continue; // ادعای بی‌معنا را دور بریز
    const kind = typeof obj.kind === 'string' && VALID_KINDS.includes(obj.kind) ? obj.kind : 'ادعای_خبری';
    const actors = Array.isArray(obj.actors) ? obj.actors.filter((a): a is string => typeof a === 'string').slice(0, 10) : [];
    const eventDateISO = typeof obj.eventDateISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.eventDateISO) ? obj.eventDateISO : null;
    claims.push({ text, kind, actors, eventDateISO, dateNote: typeof obj.dateNote === 'string' ? obj.dateNote : undefined });
  }

  steps.push({ step: 'استخراج_ادعا', ok: true, claimsCount: claims.length, model: res.model, promptVersion: res.promptVersion, at: new Date().toISOString() });
  await db.post.update({
    where: { id: postId },
    data: {
      processingSteps: JSON.stringify(steps),
      processingStatus: 'پردازش‌شده',
    },
  });

  // ذخیره ادعاها
  for (const c of claims) {
    await db.claim.create({
      data: {
        postId,
        text: c.text,
        kind: c.kind,
        claimedActors: JSON.stringify(c.actors),
        publisherName: post.source?.name || 'نامشخص',
        publishedAt: post.publishedAt,
        eventDate: c.eventDateISO ? new Date(c.eventDateISO + 'T12:00:00Z') : null,
        model: res.model,
        promptVersion: res.promptVersion,
        status: 'در_انتظار_بررسی',
      },
    });
  }

  return { ok: true, claims, summary: typeof parsed.summary === 'string' ? parsed.summary : undefined };
}

/** دسته‌بندی و ارزیابی اهمیت */
export async function categorizeAndRatePost(postId: string): Promise<{ ok: boolean; error?: string }> {
  const post = await db.post.findUnique({ where: { id: postId }, include: { source: true } });
  if (!post) return { ok: false, error: 'مطلب یافت نشد' };
  const categories = await db.category.findMany({ where: { isActive: true } });
  if (categories.length === 0) return { ok: false, error: 'دسته‌بندی‌ای تعریف نشده است' };

  const catNames = categories.map((c) => `${c.name} (${c.slug})`).join('، ');
  const text = post.normalized || post.content;
  const shielded = shieldUntrustedContent(text, 'متن مطلب');

  const res = await aiCall({
    purpose: 'تحلیل',
    systemPrompt: SYSTEM_CATEGORY_ASSIGN,
    userContent: `دسته‌های موجود: ${catNames}\n\n${shielded.wrapped}`,
    maxChars: 6000,
  });
  if (!res.ok || !res.content) return { ok: false, error: res.error };

  const parsed = extractJson<{ mainCategory: string; relatedCategories?: string[]; importance?: number; urgency?: number; reason?: string }>(
    res.content,
    (x) => (typeof x === 'object' && x !== null && 'mainCategory' in x ? (x as never) : null)
  );
  if (!parsed) return { ok: false, error: 'خروجی دسته‌بندی معتبر نبود' };

  const byName = new Map(categories.map((c) => [c.name, c]));
  const main = byName.get(parsed.mainCategory);
  const data: Record<string, unknown> = {
    importanceScore: clamp05(parsed.importance),
    urgencyScore: clamp05(parsed.urgency),
  };

  if (main) {
    data.categories = {
      deleteMany: {}, // بازتخصیص کامل
      create: [
        { categoryId: main.id, isMain: true, confidence: 0.8 },
        ...(parsed.relatedCategories || [])
          .map((n) => byName.get(n))
          .filter((c): c is (typeof categories)[0] => Boolean(c))
          .filter((c) => c.id !== main.id)
          .slice(0, 2)
          .map((c) => ({ categoryId: c.id, isMain: false, confidence: 0.5 })),
      ],
    };
  } else {
    // دسته نامشخص — بدون تخصیص
    data.categories = { deleteMany: {} };
  }
  await db.post.update({ where: { id: postId }, data: data as never });
  return { ok: true };
}

function clamp05(n: unknown): number {
  const v = typeof n === 'number' ? Math.round(n) : 0;
  return Math.max(0, Math.min(5, Number.isNaN(v) ? 0 : v));
}
