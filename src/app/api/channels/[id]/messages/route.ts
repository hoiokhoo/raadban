/** پیام‌های کانال — صفحه‌بندی مثل پیام‌رسان (جدیدترین در پایین، بارگذاری رو به عقب) */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sp = new URL(req.url).searchParams;
    const take = Math.min(80, Math.max(1, Number(sp.get('take') || 40)));
    // before = شناسه پیام مرجع برای دریافت قدیمی‌ترها
    const before = sp.get('before');

    const channel = await db.watchedChannel.findUnique({ where: { id } });
    if (!channel) return fail('کانال یافت نشد', 404);

    let beforeMsg: { publishedAt: Date | null; fetchedAt: Date; externalId: string } | null = null;
    if (before) {
      const bm = await db.channelMessage.findFirst({
        where: { channelId: id, OR: [{ externalId: before }, { id: before }] },
        select: { publishedAt: true, fetchedAt: true, externalId: true },
      });
      beforeMsg = bm;
    }

    // ترتیب: قدیمی‌ترین بالا مثل پیام‌رسان — یعنی جدیدترین‌ها را می‌گیریم و برمی‌گردانیم
    const where = beforeMsg
      ? {
          channelId: id,
          OR: [
            { publishedAt: beforeMsg.publishedAt ? { lt: beforeMsg.publishedAt } : undefined },
            beforeMsg.publishedAt ? { publishedAt: null, fetchedAt: { lt: beforeMsg.fetchedAt } } : { publishedAt: null },
          ],
        }
      : { channelId: id };

    const messages = await db.channelMessage.findMany({
      where,
      include: {
        factcheck: {
          select: {
            id: true, status: true, segmentsJson: true, overallVerdict: true,
            summary: true, conclusion: true, evidenceNotes: true,
            injectionWarnings: true, model: true, error: true, createdAt: true, updatedAt: true,
          },
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { fetchedAt: 'desc' }],
      take,
    });

    const sorted = [...messages].reverse(); // قدیمی‌ترین → جدیدترین برای نمایش
    const oldestExternalId = sorted[0]?.externalId || null;
    const total = await db.channelMessage.count({ where: { channelId: id } });

    return ok({
      channel: {
        id: channel.id, platform: channel.platform, identifier: channel.identifier,
        displayName: channel.displayName, url: channel.url, lastSyncAt: channel.lastSyncAt,
        lastSyncError: channel.lastSyncError, limitsNote: channel.limitsNote,
      },
      messages: sorted,
      total,
      oldestExternalId,
      hasMore: messages.length === take,
    });
  } catch (e) { return err500(e, 'پیام‌های کانال'); }
}
