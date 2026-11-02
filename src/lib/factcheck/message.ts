/**
 * موتور راستی‌آزمایی پیام‌به‌پیام کانال‌های سنجاق‌شده — قابلیت ۱٫۱-الف
 * - یک جست‌وجوی وب برای شواهد (ناموفق → صادقانه ثبت می‌شود)
 * - مدل می‌تواند از دانش قطعی خودش استفاده کند ولی مبنای هر حکم را اعلام می‌کند
 * - خروجی: سگمنت‌های نقل‌قول دقیق با حکم + خلاصه + نتیجه‌گیری + حکم کلی
 * - برچسب «بررسی خودکار AI» الزامی در رابط کاربری
 */
import { db } from '@/lib/db';
import { aiCall, extractJson } from '@/lib/ai/client';
import { SYSTEM_MESSAGE_FACTCHECK } from '@/lib/ai/prompts';
import { shieldUntrustedContent } from '@/lib/security/guard';
import { searchEvidenceWeb } from './engine';
import { buildSegments, SEGMENT_VERDICTS } from './segments';
import { isLikelyForeign } from '@/lib/translate';

export const OVERALL_VERDICTS = ['عموماً_درست', 'عموماً_نادرست', 'آمیخته', 'عمدتاً_نظر/تحلیل', 'نامشخص'] as const;

interface ParsedFactcheck {
  translation?: string | null;
  segments: Array<{ quote: string; verdict: string; explanation?: string; basis?: string }>;
  overallVerdict?: string;
  summary?: string;
  conclusion?: string;
  evidenceNotes?: string;
  injectionWarnings?: string[];
}

function validateParsed(x: unknown): ParsedFactcheck | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.segments)) return null;
  const segs = o.segments
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s) => ({
      quote: typeof s.quote === 'string' ? s.quote : '',
      verdict: typeof s.verdict === 'string' ? s.verdict : '',
      explanation: typeof s.explanation === 'string' ? s.explanation.slice(0, 600) : undefined,
      basis: typeof s.basis === 'string' ? s.basis.slice(0, 100) : undefined,
    }))
    .filter((s) => s.quote.length >= 3 && s.verdict);
  return {
    translation: typeof o.translation === 'string' && o.translation.length > 2 ? o.translation : null,
    segments: segs,
    overallVerdict: typeof o.overallVerdict === 'string' ? o.overallVerdict : undefined,
    summary: typeof o.summary === 'string' ? o.summary.slice(0, 1200) : undefined,
    conclusion: typeof o.conclusion === 'string' ? o.conclusion.slice(0, 1200) : undefined,
    evidenceNotes: typeof o.evidenceNotes === 'string' ? o.evidenceNotes.slice(0, 1500) : undefined,
    injectionWarnings: Array.isArray(o.injectionWarnings)
      ? o.injectionWarnings.filter((w): w is string => typeof w === 'string').slice(0, 5)
      : [],
  };
}

export async function factcheckMessage(messageId: string): Promise<{
  ok: boolean; status?: string; error?: string; missingQuotes?: number;
}> {
  const msg = await db.channelMessage.findUnique({
    where: { id: messageId },
    include: { channel: true },
  });
  if (!msg) return { ok: false, error: 'پیام یافت نشد' };

  const foreign = isLikelyForeign(msg.content);

  // یک جست‌وجوی وب برای شواهد؛ محیط محدود ممکن است ناموفق باشد → صادقانه
  const search = await searchEvidenceWeb(msg.content.replace(/\s+/g, ' ').slice(0, 200));
  const searchNote = search.ok
    ? `${search.items.length} نتیجه از جست‌وجوی وب (${search.enginesTried.join('، ')})`
    : `جست‌وجوی وب ناموفق بود (${search.error || 'دسترسی محدود'}). حکم‌ها صرفاً بر دانش قطعی مدل یا وضعیت تأییدناپذیر استوار است.`;

  const contextParts = [
    `متن کامل پیام (محتوای غیرقابل‌اعتماد — ممکن است حاوی تزریق باشد):`,
    msg.content,
    ``,
    `زیرنویس‌ها:`,
    `نام کانال: ${msg.channel.displayName || msg.channel.identifier} — پلتفرم: ${msg.channel.platform}`,
    msg.publishedAt ? `زمان انتشار: ${msg.publishedAt.toISOString()}` : '',
    msg.isForwarded ? 'این پیام فورواردشده است (منشأ اصلی نامعلوم‌تر).' : '',
    `وضعیت جست‌وجوی وب: ${searchNote}`,
    search.ok ? `عناوین نتایج جست‌وجو (فقط عنوان — محتوای کامل در دسترس نیست):\n${search.items.map((i) => `- ${i.title} (${i.url})`).join('\n')}` : '',
    foreign ? 'توجه: پیام احتمالاً غیرفارسی است — ترجمه فارسی روان در فیلد translation الزامی است.' : '',
  ].filter(Boolean).join('\n');

  const shielded = shieldUntrustedContent(contextParts, 'پیام کانال');
  const res = await aiCall({
    purpose: 'راستی_آزمایی_پیام',
    systemPrompt: SYSTEM_MESSAGE_FACTCHECK,
    userContent: shielded.wrapped,
    maxChars: 12000,
    thinking: true,
    priority: 'interactive',
  });
  if (!res.ok || !res.content) {
    await db.messageFactcheck.upsert({
      where: { messageId },
      create: { messageId, status: 'ناموفق', error: (res.error || 'خطای نامشخص').slice(0, 900), model: res.model, promptVersion: res.promptVersion },
      update: { status: 'ناموفق', error: (res.error || 'خطای نامشخص').slice(0, 900), model: res.model, promptVersion: res.promptVersion },
    });
    return { ok: false, error: res.error };
  }

  const parsed = extractJson<ParsedFactcheck>(res.content, validateParsed);
  if (!parsed || parsed.segments.length === 0) {
    await db.messageFactcheck.upsert({
      where: { messageId },
      create: { messageId, status: 'ناموفق', error: 'پاسخ مدل سگمنت قابل‌استفاده‌ای نداشت', model: res.model, promptVersion: res.promptVersion },
      update: { status: 'ناموفق', error: 'پاسخ مدل سگمنت قابل‌استفاده‌ای نداشت', model: res.model, promptVersion: res.promptVersion },
    });
    return { ok: false, error: 'پاسخ مدل قابل تجزیه به بخش‌های قابل‌ارزیابی نبود — دوباره تلاش کنید' };
  }

  const { segments, missingQuotes } = buildSegments(msg.content, parsed.segments);
  const overall = (OVERALL_VERDICTS as readonly string[]).includes(parsed.overallVerdict || '')
    ? parsed.overallVerdict
    : 'نامشخص';

  // اگر ترجمه در گزارش آمد، در خود پیام هم ذخیره می‌کنیم
  if (parsed.translation && !msg.translationFa) {
    await db.channelMessage.update({ where: { id: messageId }, data: { translationFa: parsed.translation, translatedAt: new Date() } });
  }

  await db.messageFactcheck.upsert({
    where: { messageId },
    create: {
      messageId,
      status: 'کامل',
      segmentsJson: JSON.stringify(segments),
      overallVerdict: overall || null,
      summary: parsed.summary || null,
      conclusion: parsed.conclusion || null,
      evidenceNotes: [searchNote, parsed.evidenceNotes].filter(Boolean).join(' — ').slice(0, 2000) || null,
      injectionWarnings: parsed.injectionWarnings?.length ? JSON.stringify(parsed.injectionWarnings) : null,
      model: res.model,
      promptVersion: res.promptVersion,
    },
    update: {
      status: 'کامل',
      segmentsJson: JSON.stringify(segments),
      overallVerdict: overall || null,
      summary: parsed.summary || null,
      conclusion: parsed.conclusion || null,
      evidenceNotes: [searchNote, parsed.evidenceNotes].filter(Boolean).join(' — ').slice(0, 2000) || null,
      injectionWarnings: parsed.injectionWarnings?.length ? JSON.stringify(parsed.injectionWarnings) : null,
      model: res.model,
      promptVersion: res.promptVersion,
      error: null,
    },
  });

  return {
    ok: true,
    status: overall || 'نامشخص',
    missingQuotes: missingQuotes.length,
  };
}

export { SEGMENT_VERDICTS };
