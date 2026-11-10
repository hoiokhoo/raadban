/**
 * تنظیمات پیام‌های روزانهٔ رصدبان — خواستهٔ کاربر (۱۰ نوامبر ۲۰۲۶):
 * «فعال/غیرفعال کردن صبحگاهی و شبانگاهی، تغییر ساعت، انتخاب منطقهٔ زمانی، انتخاب شهر و
 * مختصات، تنظیم روش محاسبهٔ اوقات شرعی…»
 *
 * PUT — اعتبارسنجی کامل + نوشتن bot/daily-settings.json (محلی + ریپو با PAT) + آینه به DB.
 * ربات در چرخهٔ بعدی (~۱۰ دقیقه) همین فایل را می‌خواند — بدون ری‌استارت.
 * صراحت: ساعت‌ها HH:mm، مختصات معتبر، روش از فهرست مجاز — هر مغایرت رد می‌شود.
 */
import { fail, ok, err500 } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { readRepoFileWithFallback, putRepoFile } from '@/lib/gh-sync';
import { writeFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { DAILY_SETTINGS_DEFAULTS, type DailySettingsFile } from '../../../../../bot/bot';

const CITY_PRESETS: Record<string, { lat: number; lon: number }> = {
  'تهران': { lat: 35.6892, lon: 51.389 },
  'مشهد': { lat: 36.2972, lon: 59.6067 },
  'اصفهان': { lat: 32.6546, lon: 51.668 },
  'شیراز': { lat: 29.5918, lon: 52.5837 },
  'تبریز': { lat: 38.0962, lon: 46.2738 },
  'قم': { lat: 34.6416, lon: 50.8746 },
  'کرج': { lat: 35.8355, lon: 50.9915 },
  'اهواز': { lat: 31.3183, lon: 48.6706 },
  'کرمانشاه': { lat: 34.3277, lon: 47.0778 },
  'ارومیه': { lat: 37.5527, lon: 45.0761 },
  'رشت': { lat: 37.2808, lon: 49.5838 },
  'زاهدان': { lat: 29.4916, lon: 60.8629 },
  'بندرعباس': { lat: 27.1865, lon: 56.2808 },
  'نجف‌آباد': { lat: 32.6343, lon: 51.3661 },
};

const settingsSchema = z.object({
  morningEnabled: z.boolean().optional(),
  eveningEnabled: z.boolean().optional(),
  morningHour: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ساعت باید HH:mm باشد').optional(),
  eveningHour: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ساعت باید HH:mm باشد').optional(),
  weatherEnabled: z.boolean().optional(),
  weatherHour: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ساعت باید HH:mm باشد').optional(),
  timezone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_+0-9\-]+$/, 'منطقهٔ زمانی معتبر نیست (نمونه: Asia/Tehran)').optional(),
  city: z.string().min(2).max(60).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  prayerMethod: z.enum(['tehran', 'mwl', 'custom']).optional(),
  fajrAngle: z.number().min(10).max(25).optional(),
  ishaAngle: z.number().min(7).max(25).optional(),
  maghribMinutes: z.number().int().min(0).max(60).optional(),
  qamariBasis: z.enum(['umalqura', 'civil']).optional(),
});

export async function GET() {
  try {
    const curRaw = await readRepoFileWithFallback('bot/daily-settings.json');
    let cur: DailySettingsFile = { ...DAILY_SETTINGS_DEFAULTS };
    try {
      if (curRaw?.content) cur = { ...DAILY_SETTINGS_DEFAULTS, ...(JSON.parse(curRaw.content) as Partial<DailySettingsFile>) };
    } catch { /* پیش‌فرض */ }
    return ok({ settings: cur, source: curRaw?.source || 'default' });
  } catch (e) {
    return err500(e, 'تنظیمات پیام‌های روزانه');
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return fail(`تنظیمات نامعتبر: ${parsed.error.issues[0]?.message || 'ناشناخته'}`, 400);
    }
    const patch = parsed.data;
    const curRaw = await readRepoFileWithFallback('bot/daily-settings.json');
    let cur: DailySettingsFile = { ...DAILY_SETTINGS_DEFAULTS };
    try {
      if (curRaw?.content) cur = { ...DAILY_SETTINGS_DEFAULTS, ...(JSON.parse(curRaw.content) as Partial<DailySettingsFile>) };
    } catch { /* فایل خراب → پیش‌فرض */ }

    const next: DailySettingsFile = { ...cur, ...patch };
    // پیش‌فرض مختصات شهرهای شناخته‌شده — وقتی شهر عوض شد و مختصات نیامده
    if (patch.city && CITY_PRESETS[patch.city] && patch.lat === undefined && patch.lon === undefined) {
      next.lat = CITY_PRESETS[patch.city].lat;
      next.lon = CITY_PRESETS[patch.city].lon;
    }
    const content = `${JSON.stringify(next, null, 2)}\n`;

    // ۱) فایل محلی (محیط توسعه) — ۲) ریپو (محیط عملیاتی — ربات GH از همین می‌خواند)
    let repoWritten = false;
    let repoError: string | null = null;
    try {
      writeFileSync('bot/daily-settings.json', content, 'utf8');
    } catch { /* محیط فقط-ریپو */ }
    try {
      const r = await putRepoFile('bot/daily-settings.json', content, 'تنظیمات پیام‌های روزانه از اپلیکیشن');
      repoWritten = r.ok;
      if (!r.ok) repoError = r.error || 'ناشناخته';
    } catch (e) {
      repoError = e instanceof Error ? e.message : 'خطای ناشناخته';
    }

    // آینه به DB
    try {
      await db.dailySettings.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', ...next },
        update: { ...next },
      });
    } catch { /* DB در دسترس نیست — فایل مرجع است */ }

    return ok({
      settings: next,
      repoWritten,
      repoError,
      note: repoWritten ? 'فایل ریپو به‌روزرسانی شد — ربات در چرخهٔ بعدی (~۱۰ دقیقه) اعمال می‌کند' : `فایل محلی نوشته شد${repoError ? `؛ نوشتن ریپو ناموفق: ${repoError}` : ' (بدون PAT)'}`,
    });
  } catch (e) {
    return err500(e, 'ذخیرهٔ تنظیمات پیام‌های روزانه');
  }
}
