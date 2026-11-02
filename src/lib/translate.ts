/**
 * خط لوله ترجمه فارسی روان — قابلیت ۱٫۱-ب
 * - فقط سمت سرور، از aiCall (AiUsage + سقف بودجه)
 * - خروجی JSON اعتبارسنجی‌شده: ترجمه + خلاصه + نتیجه‌گیری
 * - هیچ تفسیری اضافه نمی‌شود؛ مطلب اصلی دست‌نخورده می‌ماند
 */
import { db } from '@/lib/db';
import { aiCall, extractJson } from '@/lib/ai/client';
import { SYSTEM_TRANSLATE } from '@/lib/ai/prompts';
import { shieldUntrustedContent } from '@/lib/security/guard';

export interface TranslationResult {
  translation: string;
  summary: string;
  conclusion: string;
  sourceLanguage?: string;
}

function validateTranslation(x: unknown): TranslationResult | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.translation !== 'string' || o.translation.trim().length < 2) return null;
  return {
    translation: o.translation.trim(),
    summary: typeof o.summary === 'string' ? o.summary.trim() : '',
    conclusion: typeof o.conclusion === 'string' ? o.conclusion.trim() : '',
    sourceLanguage: typeof o.sourceLanguage === 'string' ? o.sourceLanguage : undefined,
  };
}

/** ترجمه یک متن خام (بدون ذخیره) — برای پیش‌نمایش */
export async function translateText(content: string): Promise<{ ok: boolean; data?: TranslationResult; error?: string }> {
  const shielded = shieldUntrustedContent(content, 'مطلب ورودی');
  const res = await aiCall({
    purpose: 'ترجمه',
    systemPrompt: SYSTEM_TRANSLATE,
    userContent: shielded.wrapped,
    maxChars: 9000,
  });
  if (!res.ok || !res.content) return { ok: false, error: res.error };
  const parsed = extractJson<TranslationResult>(res.content, validateTranslation);
  if (!parsed) return { ok: false, error: 'پاسخ مدل قابل تجزیه به ساختار ترجمه نبود' };
  return { ok: true, data: parsed };
}

/** ترجمه یک پست خبری و ذخیره در فیلدهای مدل Post */
export async function translatePost(postId: string): Promise<{ ok: boolean; error?: string }> {
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post) return { ok: false, error: 'پست یافت نشد' };
  if (post.language === 'fa') return { ok: false, error: 'این پست فارسی است و نیازی به ترجمه ندارد' };

  const r = await translateText(post.content);
  if (!r.ok || !r.data) return { ok: false, error: r.error };

  await db.post.update({
    where: { id: postId },
    data: {
      translationFa: r.data.translation,
      translationSummary: r.data.summary || null,
      translationConclusion: r.data.conclusion || null,
      translatedAt: new Date(),
    },
  });
  return { ok: true };
}

/** ترجمه یک پیام کانال سنجاق‌شده و ذخیره در ChannelMessage */
export async function translateChannelMessage(messageId: string): Promise<{ ok: boolean; error?: string }> {
  const msg = await db.channelMessage.findUnique({ where: { id: messageId } });
  if (!msg) return { ok: false, error: 'پیام یافت نشد' };

  const r = await translateText(msg.content);
  if (!r.ok || !r.data) return { ok: false, error: r.error };

  await db.channelMessage.update({
    where: { id: messageId },
    data: { translationFa: r.data.translation, translatedAt: new Date() },
  });
  return { ok: true };
}

/** تشخیص ساده غیرفارسی‌بودن متن (سهم نویسه‌های فارسی/عربی کمتر از ۱۵٪) */
export function isLikelyForeign(text: string): boolean {
  const faChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const letters = (text.match(/[A-Za-z\u0600-\u06FF\u4e00-\u9fff]/g) || []).length;
  if (letters === 0) return false;
  return faChars / letters < 0.15;
}
