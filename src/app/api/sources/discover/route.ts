/**
 * کشف خودکار منابع با هوش مصنوعی — فصل ۴ سند
 * نتایج همیشه «در انتظار تأیید» ثبت می‌شوند؛ فعال‌سازی خودکار فقط با اجازه صریح کاربر.
 * آمار ساختگی تولید نمی‌شود: membersInfo/activityInfo به‌صورت «نامعلوم» ثبت می‌شوند مگر شواهد موجود باشد.
 */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { aiCall, extractJson } from '@/lib/ai/client';
import { SYSTEM_SOURCE_DISCOVERY } from '@/lib/ai/prompts';
import { safeFetch } from '@/lib/security/ssrf';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const topic = String(body.topic || '').trim().slice(0, 120);
    const categoryId = body.categoryId ? String(body.categoryId) : null;
    const platform = body.platform ? String(body.platform) : null;
    if (topic.length < 3) return fail('موضوع جست‌وجو را بنویسید (حداقل ۳ نویسه)', 422);

    // ۱) جست‌وجوی وب با اتصال‌دهنده‌های جست‌وجوی عمومی (چند‌بُعدی)
    const searchQueries = [
      `${topic} کانال تلگرام`,
      `${topic} telegram channel`,
      `${topic} news feed rss`,
      `${topic} خبر تحلیل کانال`,
    ];
    const searchEvidence: string[] = [];
    const candidates: Array<{ name: string; identifier: string; platform: string; url: string; evidence: string }> = [];
    let searchStatus = '';

    for (const q of searchQueries) {
      const res = await safeFetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, { timeoutMs: 12000 });
      if (!res.ok) continue;
      const links = [...res.text.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{5,300}?)<\/a>/g)];
      for (const l of links.slice(0, 10)) {
        const url = l[1];
        const title = l[2].replace(/<[^>]+>/g, '').trim();
        if (title.length < 8) continue;
        if (/duckduckgo\.com/.test(url)) continue;
        searchEvidence.push(`- «${title.slice(0, 120)}» ${url}`);
        // حدس پلتفرم از دامنه
        const guessPlatform = /eitaa\.com/.test(url) ? 'eitaa' : /bale\.ai/.test(url) ? 'bale'
          : /t\.me/.test(url) ? 'telegram' : /feed|rss/.test(url) ? 'rss' : 'web';
        const identifier = url.includes('t.me/') ? url.split('t.me/')[1].split('/')[0].replace(/^s\//, '')
          : url.includes('eitaa.com/') ? url.split('eitaa.com/')[1].split('/')[0].replace(/^@/, '')
          : url.includes('bale.ai/') ? url.split('bale.ai/')[1].split('/')[0].replace(/^@/, '')
          : url;
        if (identifier && !candidates.some((c) => c.identifier === identifier && c.platform === guessPlatform)) {
          candidates.push({ name: title.slice(0, 100), identifier, platform: guessPlatform, url, evidence: `یافته‌شده در جست‌وجوی «${q}» با عنوان «${title.slice(0, 80)}»` });
        }
      }
    }

    if (searchEvidence.length === 0) {
      searchStatus = 'جست‌وجوی وب در این محیط پاسخ نداد (شبکه محدود). هیچ منبعی ساختگی پیشنهاد نمی‌شود.';
    }

    // ۲-۶) ارزیابی/امتیازدهی با مدل فقط بر شواهد جست‌وجو
    let modelSuggestions: Array<Record<string, unknown>> = [];
    if (searchEvidence.length > 0) {
      const res = await aiCall({
        purpose: 'کشف_منبع',
        systemPrompt: SYSTEM_SOURCE_DISCOVERY,
        userContent: [
          `موضوع درخواستی کاربر: ${topic}`,
          platform ? `پلتفرم مورد علاقه: ${platform}` : '',
          `نتایج جست‌وجوی وب:\n${searchEvidence.slice(0, 40).join('\n')}`,
          'بر اساس «فقط این نتایج»، تا ۶ منبع نامزد معتبر استخراج و امتیازدهی کنید. آمار ناموجود را «نامعلوم» بگذارید.',
        ].filter(Boolean).join('\n\n'),
        maxChars: 10000,
        thinking: true,
        priority: 'interactive',
      });
      if (res.ok && res.content) {
        const parsed = extractJson<{ suggestions: unknown[] }>(res.content, (x) =>
          typeof x === 'object' && x !== null && Array.isArray((x as Record<string, unknown>).suggestions) ? (x as never) : null);
        if (parsed) modelSuggestions = parsed.suggestions.filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null).slice(0, 8);
      }
    }

    // ۷) ذخیره پیشنهادها با وضعیت «در انتظار تأیید» + حذف موارد موجود
    const created: Record<string, unknown>[] = [];
    for (const s of modelSuggestions) {
      const name = String(s.name || '').slice(0, 100);
      const platformKey = ['telegram', 'eitaa', 'bale', 'rss', 'web'].includes(String(s.platform)) ? String(s.platform) : 'web';
      const identifier = String(s.identifier || '').slice(0, 200);
      if (!name || !identifier) continue;
      const exists = await db.source.findUnique({ where: { platform_identifier: { platform: platformKey, identifier } } });
      const alreadySuggested = await db.sourceSuggestion.findUnique({ where: { platform_identifier: { platform: platformKey, identifier } } });
      if (exists || alreadySuggested) continue;
      const sug = await db.sourceSuggestion.create({
        data: {
          name, platform: platformKey, identifier,
          url: String(s.url || '').slice(0, 400) || null,
          reason: String(s.reason || '').slice(0, 800) || null,
          evidence: [String(s.evidence || '').slice(0, 800), searchStatus].filter(Boolean).join(' | ') || null,
          membersInfo: 'نامعلوم', // هرگز ساختگی نمی‌شود
          activityInfo: String(s.activityInfo || 'نامعلوم').slice(0, 200) || 'نامعلوم',
          confidence: ['بالا', 'متوسط', 'پایین'].includes(String(s.confidence)) ? String(s.confidence) : 'پایین',
          score: typeof s.score === 'number' ? s.score : null,
          scoreBreakdown: String(s.scoreBreakdown || '').slice(0, 500) || null,
          status: 'در_انتظار_تأیید',
          categoryId,
          evaluatedAt: new Date(),
        },
      });
      created.push({ id: sug.id, name: sug.name, confidence: sug.confidence, score: sug.score });
    }

    return ok({
      created: created.length,
      suggestions: created,
      searchStatus: searchStatus || `${searchEvidence.length} نتیجه جست‌وجو تحلیل شد`,
      note: 'همه پیشنهادها در وضعیت «در انتظار تأیید» ثبت شدند؛ تا تأیید شما دریافت نمی‌شوند.',
    });
  } catch (e) { return err500(e, 'کشف منبع'); }
}
