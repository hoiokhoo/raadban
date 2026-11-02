/**
 * کانال‌های سنجاق‌شده خوانش — قابلیت ۱٫۱-الف
 * GET: فهرست با شمار پیام‌ها | POST: افزودن کانال + همگام‌سازی اولیه واقعی
 */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getConnector } from '@/lib/connectors';
import { isLikelyForeign } from '@/lib/translate';

const READER_PLATFORMS = ['telegram', 'eitaa', 'bale'] as const;

const channelCreateSchema = z.object({
  platform: z.enum(READER_PLATFORMS),
  identifier: z.string().min(2).max(120),
});

export async function GET() {
  try {
    const channels = await db.watchedChannel.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
    return ok({ channels: channels.map((c) => ({ ...c, messageCount: c._count.messages })) });
  } catch (e) { return err500(e, 'فهرست کانال‌ها'); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = channelCreateSchema.safeParse(body);
    if (!parsed.success) return fail(`ورودی نامعتبر: ${parsed.error.issues[0]?.message || ''}`, 422);
    const { platform } = parsed.data;
    const identifier = parsed.data.identifier.trim().replace(/^@/, '');

    const connector = getConnector(platform);
    if (!connector || !connector.implemented) {
      return fail(`پلتفرم ${platform} هنوز پیاده‌سازی واقعی نشده است`, 409);
    }
    const normId = connector.normalizeIdentifier(identifier);
    if (!connector.validateIdentifier(normId)) {
      return fail(`شناسه کانال نامعتبر است: ${identifier}`, 422);
    }

    const exists = await db.watchedChannel.findUnique({ where: { platform_identifier: { platform, identifier: normId } } });
    if (exists) return fail('این کانال قبلاً اضافه شده است', 409);

    // همگام‌سازی اولیه واقعی برای اطمینان از دسترسی — کانال بدون دسترسی ثبت نمی‌شود
    const fetchRes = await connector.fetchRecent(normId, { maxItems: 30 });
    if (!fetchRes.ok) {
      return fail(`دریافت پیام‌های کانال ناموفق بود: ${fetchRes.error}`, 502, { limits: fetchRes.limits });
    }

    const channel = await db.watchedChannel.create({
      data: {
        platform,
        identifier: normId,
        displayName: normId,
        url: platform === 'telegram' ? `https://t.me/${normId}` : platform === 'eitaa' ? `https://eitaa.com/${normId}` : null,
        limitsNote: fetchRes.limits,
        lastSyncAt: new Date(),
      },
    });

    // عضویت خودکار در فهرست منابع — قابلیت درخواستی: هر کانال خوانش‌شده = یک منبع ثبت‌شده
    const platformFa = platform === 'telegram' ? 'تلگرام' : platform === 'eitaa' ? 'ایتا' : 'بله';
    await db.source.upsert({
      where: { platform_identifier: { platform, identifier: normId } },
      create: {
        name: normId,
        platform,
        identifier: normId,
        url: platform === 'telegram' ? `https://t.me/${normId}` : platform === 'eitaa' ? `https://eitaa.com/${normId}` : null,
        status: 'دریافت_موفق',
        statusDetail: `ثبت خودکار از خوانش کانال‌ها — ${fetchRes.posts.length} پیام اولیه دریافت شد`,
        fetchMethod: 'خوانش کانال',
        limitsNote: fetchRes.limits,
        isActive: true,
      },
      update: {
        status: 'دریافت_موفق',
        statusDetail: `به‌روزرسانی از خوانش کانال‌ها — ${fetchRes.posts.length} پیام`,
        lastError: null,
        lastErrorAt: null,
        isActive: true,
      },
    });

    // ذخیره پیام‌های اولیه
    for (const p of fetchRes.posts) {
      await db.channelMessage.upsert({
        where: { channelId_externalId: { channelId: channel.id, externalId: p.externalId } },
        create: {
          channelId: channel.id,
          externalId: p.externalId,
          content: p.content,
          url: p.url,
          publishedAt: p.publishedAt,
          isForwarded: p.isForwarded || false,
          metadata: p.metadata ? JSON.stringify(p.metadata).slice(0, 2000) : null,
          language: isLikelyForeign(p.content) ? 'en' : 'fa',
        },
        update: {},
      });
    }

    return ok({
      channelId: channel.id,
      messageCount: fetchRes.posts.length,
      coverageNote: fetchRes.coverageNote,
      limits: fetchRes.limits,
      autoRegisteredSource: true,
      sourceNote: `کانال به فهرست منابع اضافه شد (${platformFa}: ${normId})`,
    }, 201);
  } catch (e) { return err500(e, 'افزودن کانال'); }
}
