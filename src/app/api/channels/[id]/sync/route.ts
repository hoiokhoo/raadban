/** همگام‌سازی دستی کانال — دریافت پیام‌های جدید از اتصال‌دهنده واقعی */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { getConnector } from '@/lib/connectors';
import { isLikelyForeign } from '@/lib/translate';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const channel = await db.watchedChannel.findUnique({ where: { id } });
    if (!channel) return fail('کانال یافت نشد', 404);

    const connector = getConnector(channel.platform);
    if (!connector) return fail(`اتصال‌دهنده ${channel.platform} در دسترس نیست`, 409);

    const fetchRes = await connector.fetchRecent(channel.identifier, { maxItems: 30 });
    if (!fetchRes.ok) {
      await db.watchedChannel.update({
        where: { id },
        data: { lastSyncError: fetchRes.error.slice(0, 500) },
      });
      return fail(`همگام‌سازی ناموفق: ${fetchRes.error}`, 502);
    }

    let added = 0;
    for (const p of fetchRes.posts) {
      const r = await db.channelMessage.upsert({
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
      // upsert هیچ نشانی از ایجاد نمی‌دهد؛ با شمارش فاصله زمانی جدید تخمین می‌زنیم
      if (r.fetchedAt && Date.now() - r.fetchedAt.getTime() < 2000) added++;
    }

    await db.watchedChannel.update({
      where: { id },
      data: { lastSyncAt: new Date(), lastSyncError: null, limitsNote: fetchRes.limits },
    });

    return ok({ added, total: fetchRes.posts.length, coverageNote: fetchRes.coverageNote });
  } catch (e) { return err500(e, 'همگام‌سازی کانال'); }
}
