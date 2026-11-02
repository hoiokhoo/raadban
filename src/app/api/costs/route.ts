/**
 * هزینه و مصرف — فصل ۱۱: نمایش میزان مصرف و برآورد
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';

export async function GET() {
  try {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const today = await db.aiUsage.aggregate({
      _sum: { estTokens: true, inputChars: true, outputChars: true },
      _count: true,
      where: { createdAt: { gte: startOfDay } },
    });
    const month = await db.aiUsage.aggregate({
      _sum: { estTokens: true },
      where: { createdAt: { gte: startOfMonth } },
    });
    const byPurpose = await db.aiUsage.groupBy({
      by: ['purpose', 'status'],
      _sum: { estTokens: true },
      _count: true,
      where: { createdAt: { gte: startOfMonth } },
    });
    const recent = await db.aiUsage.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    const budgetRow = await db.setting.findUnique({ where: { key: 'ai_budget' } });
    const budget = budgetRow ? JSON.parse(budgetRow.value) : { dailyTokenLimit: 200000 };

    return ok({
      today: { estTokens: today._sum.estTokens || 0, calls: today._count, inputChars: today._sum.inputChars || 0, outputChars: today._sum.outputChars || 0 },
      month: { estTokens: month._sum.estTokens || 0 },
      budget,
      byPurpose,
      recent,
      note: 'برآورد مصرف بر مبنای ~۳٫۲ کاراکتر به‌ازای هر توکن فارسی است؛ اعداد تقریبی‌اند و به‌عنوان «برآورد» نمایش داده می‌شوند، نه صورت‌حساب دقیق سرویس.',
    });
  } catch (e) { return err500(e, 'هزینه و مصرف'); }
}
