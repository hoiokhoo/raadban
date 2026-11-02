/** حذف کانال سنجاق‌شده (پیام‌ها هم با Cascade حذف می‌شوند) */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.watchedChannel.findUnique({ where: { id } });
    if (!existing) return fail('کانال یافت نشد', 404);
    await db.watchedChannel.delete({ where: { id } });
    return ok({ deleted: id });
  } catch (e) { return err500(e, 'حذف کانال'); }
}
