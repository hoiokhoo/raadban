/**
 * پیشنهادهای منابع: فهرست + تأیید/رد
 * تأیید → ساخت منبع واقعی؛ فعال‌سازی خودکار فقط با پارامتر صریح autoActivate
 */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET() {
  try {
    const suggestions = await db.sourceSuggestion.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    return ok({ suggestions });
  } catch (e) { return err500(e, 'فهرست پیشنهادها'); }
}

export async function POST(req: NextRequest) {
  try {
    const { id, action, autoActivate } = await req.json();
    if (!id) return fail('شناسه پیشنهاد الزامی است', 422);
    const sug = await db.sourceSuggestion.findUnique({ where: { id } });
    if (!sug) return fail('پیشنهاد یافت نشد', 404);

    if (action === 'reject') {
      await db.sourceSuggestion.update({ where: { id }, data: { status: 'ردشده' } });
      return ok({ rejected: true });
    }
    if (action === 'approve') {
      if (sug.status === 'تأییدشده') return fail('این پیشنهاد قبلاً تأیید شده است', 409);
      const source = await db.source.create({
        data: {
          name: sug.name,
          platform: sug.platform,
          identifier: sug.identifier,
          url: sug.url,
          isActive: Boolean(autoActivate), // فعال‌سازی خودکار فقط با اجازه کاربر
          status: autoActivate ? 'دریافت_موفق' : 'غیرفعال',
          statusDetail: 'ایجادشده از پیشنهاد هوش مصنوعی — آمار اعضا نامعلوم بود',
          notes: `تأییدشده از پیشنهاد AI. اطمینان: ${sug.confidence}`,
          categories: sug.categoryId ? { create: [{ categoryId: sug.categoryId }] } : undefined,
        },
      });
      await db.sourceSuggestion.update({
        where: { id },
        data: { status: 'تأییدشده', sourceId: source.id },
      });
      return ok({ approved: true, sourceId: source.id, activated: Boolean(autoActivate) });
    }
    return fail('عملیات نامعتبر؛ فقط approve یا reject', 422);
  } catch (e) { return err500(e, 'تأیید پیشنهاد'); }
}
