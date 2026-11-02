/**
 * ورود دستی مطلب — مسیر مجاز و صادقانه وقتی دسترسی خودکار به یک منبع ممکن نیست
 * (فصل ۵ سند: «از مسیر مجاز جایگزین استفاده کن؛ نه اینکه وانمود کن تمام اخبار دریافت شده»)
 * این قابلیت یک اتصال‌دهنده نیست؛ صراحتاً «ورود دستی» ثبت و نمایش داده می‌شود.
 */
import { db } from '@/lib/db';
import { ok, fail, err500, manualPostSchema } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { normalizePersian, contentHash, assessContentQuality, detectLanguage } from '@/lib/pipeline/normalize';
import { extractDates, isoDateInTz, SYSTEM_TIMEZONE } from '@/lib/persian';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = manualPostSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || 'ورودی نامعتبر', 422);
    }
    const { content, title, url, sourceId } = parsed.data;

    // اگر منبع انتخاب شده، باید واقعاً موجود باشد
    let sourceName: string | null = null;
    if (sourceId) {
      const src = await db.source.findUnique({ where: { id: sourceId } });
      if (!src) return fail('منبع انتخاب‌شده یافت نشد', 422);
      sourceName = src.name;
    }

    const now = new Date();
    const normalized = normalizePersian(content);
    const hash = contentHash(content);

    // جلوگیری از ثبت دوباره همان متن دستی
    const dup = await db.post.findFirst({ where: { contentHash: hash } });
    if (dup) {
      return fail('این مطلب قبلاً ثبت شده است (تکراری)', 409, { existingId: dup.id });
    }

    const quality = assessContentQuality(content);
    const dates = extractDates(content, now);

    const post = await db.post.create({
      data: {
        sourceId: sourceId || null,
        externalId: `manual-${randomUUID()}`,
        content: title ? `${title}\n${content}`.slice(0, 20000) : content.slice(0, 20000),
        normalized,
        url: url || null,
        publishedAt: now,
        publishedDateOnly: isoDateInTz(now, SYSTEM_TIMEZONE),
        fetchedAt: now,
        metadata: JSON.stringify({
          manual: true,
          enteredAt: now.toISOString(),
          linkedSource: sourceName,
          detectedDates: dates.map((d) => ({ raw: d.raw, iso: d.iso, kind: d.kind })),
        }),
        language: detectLanguage(content),
        contentHash: hash,
        processingStatus: quality.isAd ? 'حذف_تبلیغات' : (quality.isTruncated ? 'ناقص' : 'خام'),
        processingError: quality.isTruncated ? quality.qualityNote : null,
      },
    });

    return ok({ postId: post.id, note: 'مطلب دستی ثبت شد و وارد خط لوله پردازش می‌شود (برچسب: ورود دستی، نه دریافت خودکار).' });
  } catch (e) {
    return err500(e, 'ورود دستی مطلب');
  }
}
