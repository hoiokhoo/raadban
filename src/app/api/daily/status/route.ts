/**
 * وضعیت پیام‌های روزانهٔ رصدبان — پانل «پیام‌های روزانه» (خواستهٔ کاربر ۱۰ نوامبر ۲۰۲۶)
 *
 * GET — تنظیمات + وضعیت بانک احادیث + حدیث بعدی (پیش‌نمایش بدون مصرف) + سوابق انتشار
 *       + تصاویر استفاده‌شده + صف بست + وضعیت زمان‌بندی.
 *       دفتر کل واقعی = bot/state.json و bot/daily-settings.json (در ریپو کامیت می‌شود —
 *       پس از ری‌استارت ربات/سرور می‌ماند). این مسیر همان‌ها را به جدول‌های Prisma آینه می‌کند
 *       (DailySettings / DailyRunLog / HadithUsage / DailyImageUsage) برای پانل و جست‌وجو.
 *
 * صراحت: هیچ دادهٔ ساختگی؛ توکن‌ها هرگز بازنمی‌گردند.
 */
import { ok, err500 } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { readRepoFileWithFallback } from '@/lib/gh-sync';
import {
  DAILY_SETTINGS_DEFAULTS,
  type DailySettingsFile,
  type DailyRunEntry,
} from '../../../../../bot/bot';
import { bankStatus, pickHadith, type HadithUsage } from '../../../../../bot/daily';
import { dateKeyOf } from '../../../../../bot/calendar';

interface StateDailyShape {
  lastMorningKey?: string;
  lastEveningKey?: string;
  lastWeatherKey?: string;
  usedHadiths?: Record<string, HadithUsage>;
  infallibleCursor?: number;
  usedImages?: Record<string, { dateKey: string; kind: string }>;
  runs?: DailyRunEntry[];
}

function parseJsonFile<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const settingsRaw = await readRepoFileWithFallback('bot/daily-settings.json');
    const settings = parseJsonFile<DailySettingsFile>(settingsRaw?.content) || { ...DAILY_SETTINGS_DEFAULTS };
    const stateRaw = await readRepoFileWithFallback('bot/state.json');
    const state = parseJsonFile<{ daily?: StateDailyShape; lastBundleAt?: string; bundleQueue?: unknown[]; carStore?: Record<string, unknown>; saleAlertIds?: Record<string, number> }>(stateRaw?.content);
    const daily: StateDailyShape = state?.daily || {};
    const usedHadiths = daily.usedHadiths || {};

    // پیش‌نمایش حدیث بعدی — روی نسخهٔ موقت؛ هیچ مصرفی ثبت نمی‌شود
    const tz = settings.timezone || DAILY_SETTINGS_DEFAULTS.timezone;
    const todayKey = dateKeyOf(Date.now(), tz);
    const nextMorning = pickHadith({ kind: 'morning', dateKey: todayKey, usedHadithIds: usedHadiths, infallibleCursor: Number(daily.infallibleCursor) || 0 });
    const nextEvening = pickHadith({ kind: 'evening', dateKey: todayKey, usedHadithIds: usedHadiths, infallibleCursor: Number(daily.infallibleCursor) || 0 });

    const runs = Array.isArray(daily.runs) ? daily.runs.slice(-40).reverse() : [];
    const images = Object.entries(daily.usedImages || {}).slice(-40).reverse();
    const errors = runs.filter((r) => r.status === 'failed').slice(0, 10);

    // ── آینه‌سازی به بانک اطلاعاتی اپلیکیشن (خواستهٔ کاربر: ذخیرهٔ دائمی در دیتابیس) ──
    let dbMirror = 'ناموفق';
    try {
      await db.dailySettings.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          morningEnabled: settings.morningEnabled ?? true,
          eveningEnabled: settings.eveningEnabled ?? true,
          morningHour: settings.morningHour || '05:00',
          eveningHour: settings.eveningHour || '20:00',
          weatherEnabled: settings.weatherEnabled ?? true,
          weatherHour: settings.weatherHour || '21:00',
          timezone: tz,
          city: settings.city || 'تهران',
          lat: settings.lat ?? 35.6892,
          lon: settings.lon ?? 51.389,
          prayerMethod: settings.prayerMethod || 'tehran',
          fajrAngle: settings.fajrAngle ?? 17.7,
          ishaAngle: settings.ishaAngle ?? 14,
          maghribMinutes: settings.maghribMinutes ?? 15,
          qamariBasis: settings.qamariBasis || 'umalqura',
        },
        update: {},
      });
      for (const r of runs) {
        await db.dailyRunLog.upsert({
          where: { dateKey_kind_slotKey_status_isTest: { dateKey: r.dateKey, kind: r.kind, slotKey: r.slotKey, status: r.status, isTest: Boolean(r.isTest) } },
          create: { dateKey: r.dateKey, kind: r.kind, slotKey: r.slotKey, status: r.status, isTest: Boolean(r.isTest), hadithId: r.hadithId || null, imageUrl: r.imageUrl || null, error: r.error || null },
          update: {},
        }).catch(() => { /* سوابق تکراری قابل‌چشم‌پوشی */ });
      }
      for (const [id, u] of Object.entries(usedHadiths)) {
        await db.hadithUsage.upsert({ where: { hadithId: id }, create: { hadithId: id, kind: u.kind, dateKey: u.dateKey }, update: {} }).catch(() => {});
      }
      for (const [key, u] of Object.entries(daily.usedImages || {})) {
        await db.dailyImageUsage.upsert({
          where: { imageKey: key },
          create: { imageKey: key, title: key.split('/').pop() || key, pageUrl: key, kind: u.kind, dateKey: u.dateKey },
          update: {},
        }).catch(() => {});
      }
      dbMirror = 'موفق';
    } catch (e) {
      dbMirror = e instanceof Error ? `خطا: ${e.message.slice(0, 120)}` : 'خطای ناشناخته';
    }

    return ok({
      settings,
      settingsSource: settingsRaw?.source || 'default',
      bank: bankStatus(usedHadiths),
      nextMorning: nextMorning ? { id: nextMorning.hadith.id, narrator: nextMorning.hadith.narrator, arabic: nextMorning.hadith.arabic, persian: nextMorning.hadith.persian, source: nextMorning.hadith.source } : null,
      nextEvening: nextEvening ? { id: nextEvening.hadith.id, narrator: nextEvening.hadith.narrator, arabic: nextEvening.hadith.arabic, persian: nextEvening.hadith.persian, source: nextEvening.hadith.source } : null,
      runs,
      images,
      errors,
      lastMorningKey: daily.lastMorningKey || null,
      lastEveningKey: daily.lastEveningKey || null,
      lastWeatherKey: daily.lastWeatherKey || null,
      lastBundleAt: state?.lastBundleAt || null,
      bundleQueueSize: Array.isArray(state?.bundleQueue) ? state.bundleQueue.length : 0,
      carStoreSize: state?.carStore ? Object.keys(state.carStore).length : 0,
      saleAlertsSeen: state?.saleAlertIds ? Object.keys(state.saleAlertIds).length : 0,
      dateKey: todayKey,
      dbMirror,
    });
  } catch (e) {
    return err500(e, 'وضعیت پیام‌های روزانه');
  }
}
