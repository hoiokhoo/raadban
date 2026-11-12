/**
 * پیوند کانال خوانش ↔ منبع رسمی — مأموریت ۷ پرامپت سودر
 * هر کانال سنجاق‌شده در «خوانش کانال‌ها» بلافاصله منبع رسمی سامانه هم می‌شود
 * تا در پایش دوره‌ای، خط لوله، خوشه‌بندی و گزارش‌ها حضور داشته باشد.
 */
import { db } from '@/lib/db';

export async function ensureSourceForChannel(input: {
  platform: string; identifier: string; displayName?: string | null; url?: string | null;
}): Promise<{ sourceId: string; created: boolean }> {
  const name = input.displayName || input.identifier;
  const url = input.url
    || (input.platform === 'telegram' ? `https://t.me/${input.identifier}` : null)
    || (input.platform === 'eitaa' ? `https://eitaa.com/${input.identifier}` : null);
  const existing = await db.source.findUnique({
    where: { platform_identifier: { platform: input.platform, identifier: input.identifier } },
  });
  if (existing) {
    // نام نمایشی تازه‌تر را صادقانه به‌روزرسانی کن؛ وضعیت را دست نزن
    if (input.displayName && existing.name !== input.displayName) {
      await db.source.update({ where: { id: existing.id }, data: { name: input.displayName } });
    }
    return { sourceId: existing.id, created: false };
  }
  const src = await db.source.create({
    data: {
      name,
      platform: input.platform,
      identifier: input.identifier,
      url,
      isActive: true,
      status: 'دریافت_موفق',
      statusDetail: 'منبع خودکار از بخش خوانش کانال‌ها — نخستین دریافت پیام موفق بود',
      notes: 'افزوده‌شده خودکار از خوانش کانال‌ها (مأموریت ۷)؛ حذف از خوانش این منبع را حذف نمی‌کند',
      fetchMethod: 'عمومی',
      fetchIntervalMin: 60,
    },
  });
  return { sourceId: src.id, created: true };
}
