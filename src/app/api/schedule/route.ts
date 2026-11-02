/**
 * تنظیم زمان‌بندی گزارش شبانه (ساعت، روزها، جبران، مدل)
 */
import { db } from '@/lib/db';
import { ok, fail, err500, settingsSchema } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET() {
  try {
    const row = await db.setting.findUnique({ where: { key: 'schedule' } });
    return ok({ schedule: row ? JSON.parse(row.value) : { enabled: true, reportTime: '22:30', activeDays: [0, 1, 2, 3, 4, 5, 6], catchUp: true, autoFactcheck: true, timezone: 'Asia/Tehran' } });
  } catch (e) { return err500(e, 'زمان‌بندی'); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = settingsSchema.shape.schedule.safeParse(body);
    if (!parsed.success) return fail(parsed.error?.issues[0]?.message || 'تنظیمات نامعتبر', 422);
    if (!parsed.data) return fail('تنظیمات نامعتبر', 422);
    const d = parsed.data;
    const value = {
      enabled: d.enabled ?? true,
      reportTime: d.reportTime,
      activeDays: d.activeDays,
      catchUp: d.catchUp ?? true,
      autoFactcheck: d.autoFactcheck ?? true,
      timezone: d.timezone || 'Asia/Tehran',
    };
    await db.setting.upsert({
      where: { key: 'schedule' },
      create: { key: 'schedule', value: JSON.stringify(value) },
      update: { key: 'schedule', value: JSON.stringify(value) },
    });
    return ok({ schedule: value });
  } catch (e) { return err500(e, 'ذخیره زمان‌بندی'); }
}
