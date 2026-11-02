/**
 * تحلیل کامل هوش مصنوعی رویداد — توضیح + اهمیت + مقایسه سناریوهای پایان ممکن
 * خروجی همیشه با برچسب «تحلیل AI — جدا از خبر قطعی» نمایش داده می‌شود.
 */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { aiCall, extractJson } from '@/lib/ai/client';
import { SYSTEM_EVENT_ANALYSIS } from '@/lib/ai/prompts';

interface EventAnalysis {
  explanation: string;
  whyImportant: string;
  scenarios: Array<{ title: string; detail: string; likelihood: string; condition?: string }>;
  whatToWatch: string[];
  dataGaps?: string[];
}

function validateAnalysis(x: unknown): EventAnalysis | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.explanation !== 'string' || typeof o.whyImportant !== 'string' || !Array.isArray(o.scenarios)) return null;
  const LIKELIHOODS = ['محتمل‌تر', 'محتمل', 'کمتر محتمل', 'نامطمئن'];
  const scenarios = (o.scenarios as Array<Record<string, unknown>>)
    .filter((s) => typeof s === 'object' && s !== null && typeof s.title === 'string')
    .map((s) => ({
      title: String(s.title).slice(0, 200),
      detail: typeof s.detail === 'string' ? s.detail.slice(0, 900) : '',
      likelihood: LIKELIHOODS.includes(String(s.likelihood)) ? String(s.likelihood) : 'نامطمئن',
      condition: typeof s.condition === 'string' ? s.condition.slice(0, 300) : undefined,
    }));
  if (scenarios.length === 0) return null;
  return {
    explanation: o.explanation.slice(0, 3000),
    whyImportant: o.whyImportant.slice(0, 3000),
    scenarios: scenarios.slice(0, 6),
    whatToWatch: Array.isArray(o.whatToWatch) ? (o.whatToWatch as unknown[]).filter((w): w is string => typeof w === 'string').slice(0, 8) : [],
    dataGaps: Array.isArray(o.dataGaps) ? (o.dataGaps as unknown[]).filter((w): w is string => typeof w === 'string').slice(0, 6) : [],
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ev = await db.majorEvent.findUnique({ where: { id } });
    if (!ev) return fail('رویداد یافت نشد', 404);

    // اخبار درون‌سامانه‌ای مرتبط (تطبیق ساده واژه‌ای با پست‌های اخیر)
    const keywords = ev.title.split(/\s+/).filter((w) => w.length > 3).slice(0, 4);
    const relatedPosts = keywords.length
      ? await db.post.findMany({
          where: {
            OR: keywords.map((k) => ({ content: { contains: k } })),
          },
          include: { source: { select: { name: true } } },
          orderBy: { fetchedAt: 'desc' },
          take: 6,
        })
      : [];

    const polls = ev.pollsJson ? JSON.parse(ev.pollsJson) : [];
    const contextParts = [
      `عنوان رویداد: ${ev.title}`,
      `قلمرو: ${ev.scope} — نوع: ${ev.category}`,
      ev.eventDateISO ? `تاریخ قطعی: ${ev.eventDateISO}${ev.eventDateEndISO ? ' تا ' + ev.eventDateEndISO : ''}` : `تاریخ: ${ev.dateNote || 'نامشخص'} (قطعیت: ${ev.dateCertainty})`,
      `توضیح ثبت‌شده: ${ev.description}`,
      polls.length ? `داده نظرسنجی مستند:\n${JSON.stringify(polls).slice(0, 1500)}` : 'داده نظرسنجی ثبت‌شده‌ای نیست.',
      relatedPosts.length
        ? `اخبار درون‌سامانه‌ای مرتبط:\n${relatedPosts.map((p) => `- [${p.source?.name || 'منبع'}، ${p.publishedAt?.toISOString().slice(0, 10) || 'بی‌تاریخ'}] ${p.content.slice(0, 200).replace(/\s+/g, ' ')}`).join('\n')}`
        : 'هیچ پست درون‌سامانه‌ای مرتبطی یافت نشد.',
    ].join('\n\n');

    const res = await aiCall({
      purpose: 'تحلیل_رویداد',
      systemPrompt: SYSTEM_EVENT_ANALYSIS,
      userContent: contextParts,
      maxChars: 12000,
      thinking: true,
      priority: 'interactive',
    });
    if (!res.ok || !res.content) return fail(res.error || 'تولید تحلیل ناموفق بود', 502);

    const parsed = extractJson<EventAnalysis>(res.content, validateAnalysis);
    if (!parsed) return fail('پاسخ مدل قابل تجزیه به ساختار تحلیل نبود — دوباره تلاش کنید', 502);

    const analysisJson = JSON.stringify({
      ...parsed,
      model: res.model,
      generatedAt: new Date().toISOString(),
      disclaimer: 'تحلیل تولیدی هوش مصنوعی است، جدا از خبر قطعی، و ممکن است نادرست باشد. سناریوها احتمال‌گذاری متنی دارند نه عددی.',
    });

    await db.majorEvent.update({
      where: { id },
      data: { analysisJson, analysisGeneratedAt: new Date() },
    });

    return ok({ generated: true });
  } catch (e) { return err500(e, 'تحلیل رویداد'); }
}
