/**
 * پیش‌نمایش/ارسال آزمایشی پیام‌های روزانه — خواستهٔ کاربر (۱۰ نوامبر ۲۰۲۶):
 * «ارسال آزمایشی پیام صبحگاهی/شبانگاهی… اجرای دستی و آزمایشی نباید باعث ثبت اشتباه یک
 * پیام به‌عنوان پیام روزانهٔ واقعی یا مصرف ناخواستهٔ حدیث روز بعد شود.»
 *
 * POST { kind: 'morning'|'evening'|'weather', send?: boolean }
 *   - همیشه: ساخت واقعی پیام (حدیثِ بعدی، تاریخ سه‌گانه، مناسبت‌ها، اوقات شرعی، تصویر ویکی‌مدیا
 *     یا پیش‌بینی ساعتی فردا از Open-Meteo) بدون هیچ تغییری در state و بدون مصرف حدیث.
 *   - send=true: ارسال آزمایشی به چت مدیر بله (نه کانال) با توکن اپلیکیشن — فقط پیش‌نمایش.
 *   - send=true و کلید محیط: ارسال «دستور اجرای واقعی» به workflow (dispatch) — برای اجرای
 *     دستی واقعی مدیر؛ slotKey همان نوبت روزانه را مصرف می‌کند (عمداً — اجرای واقعی).
 *
 * صراحت: کلید بات فقط از DB/محیط؛ شکست ارسال شفاف برمی‌گردد؛ هیچ متن ساختگی.
 */
import { fail, ok, err500 } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { readRepoFileWithFallback } from '@/lib/gh-sync';
import { getBaleToken, ensureBaleChatId, sendBaleMessage, sendBalePhoto } from '@/lib/bale-bot';
import { DAILY_SETTINGS_DEFAULTS, type DailySettingsFile } from '../../../../../bot/bot';
import { pickHadith, fetchNatureImage, buildDailyMessage, type HadithUsage } from '../../../../../bot/daily';
import { fetchDayHistory, dayHistoryFromCache, type DayHistoryCacheEntry } from '../../../../../bot/day-history';
import { dateKeyOf, shiftDateKey, tripleDateOf } from '../../../../../bot/calendar';
import { fetchHourlyForecast, buildWeatherMessage } from '../../../../../bot/weather';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { kind?: string; send?: boolean };
    const kind = body.kind === 'evening' ? 'evening' : body.kind === 'morning' ? 'morning' : body.kind === 'weather' ? 'weather' : null;
    if (!kind) return fail("kind باید 'morning'، 'evening' یا 'weather' باشد", 400);

    const settingsRaw = await readRepoFileWithFallback('bot/daily-settings.json');
    let settings: DailySettingsFile = { ...DAILY_SETTINGS_DEFAULTS };
    try {
      if (settingsRaw?.content) settings = { ...DAILY_SETTINGS_DEFAULTS, ...(JSON.parse(settingsRaw.content) as Partial<DailySettingsFile>) };
    } catch { /* پیش‌فرض */ }

    const tz = settings.timezone || DAILY_SETTINGS_DEFAULTS.timezone;
    const todayKey = dateKeyOf(Date.now(), tz);

    // ---------- پیش‌بینی ساعتی فردا (بدون حدیث/تصویر — هیچ تغییری در state) ----------
    if (kind === 'weather') {
      const tomorrowKey = shiftDateKey(todayKey, 1);
      const hours = await fetchHourlyForecast(settings.lat ?? 35.6892, settings.lon ?? 51.389, tz, tomorrowKey).catch(() => null);
      let sent: { ok: boolean; error?: string; to?: string } = { ok: false, error: 'ارسال درخواست نشد' };
      if (!hours) {
        return ok({ kind, dateKey: todayKey, hadith: null, consumed: false, preview: null, sent, note: 'دادهٔ پیش‌بینی معتبر دریافت نشد — پیام ساختگی ساخته نمی‌شود (صادقانه)' });
      }
      const tomorrow = tripleDateOf(tomorrowKey, tz, settings.qamariBasis || 'umalqura');
      const msg = buildWeatherMessage({ city: settings.city || 'تهران', tomorrow, weatherHour: settings.weatherHour || '21:00', hours });
      if (!msg) {
        return ok({ kind, dateKey: todayKey, hadith: null, consumed: false, preview: null, sent, note: 'پارس پیش‌بینی ناقص بود — پیام منتشر نمی‌شود (صادقانه)' });
      }
      if (body.send) {
        const token = await getBaleToken();
        if (!token) {
          sent = { ok: false, error: 'توکن بات بله در اپلیکیشن تنظیم نشده — پیش‌نمایش متن بالا واقعی است' };
        } else {
          const chat = await ensureBaleChatId();
          if (!chat.ok || !chat.chatId) {
            sent = { ok: false, error: chat.error || 'شناسهٔ چت مدیر یافت نشد — در بله به بات Start بدهید' };
          } else {
            const s = await sendBaleMessage(chat.chatId, msg.text);
            sent = { ok: s.ok, error: s.ok ? undefined : s.error, to: chat.chatId };
            await db.dailyRunLog.create({
              data: { dateKey: todayKey, kind: 'weather', slotKey: `${todayKey}Tpreview`, status: s.ok ? 'preview' : 'failed', isTest: true, error: s.ok ? null : (s.error || null) },
            }).catch(() => {});
          }
        }
      }
      return ok({
        kind,
        dateKey: todayKey,
        preview: { text: msg.text, photoUrl: null, photoCaption: null },
        hadith: null,
        consumed: false,
        hoursCount: hours.length,
        sent,
      });
    }

    // ---------- صبحگاهی/شبانگاهی ----------
    // state واقعی — فقط خواندنی؛ حدیثِ بعدی بدون مصرف
    const stateRaw = await readRepoFileWithFallback('bot/state.json');
    let usedHadiths: Record<string, HadithUsage> = {};
    let cursor = 0;
    let histCache: Record<string, DayHistoryCacheEntry> = {};
    try {
      const st = JSON.parse(stateRaw?.content || '{}') as { daily?: { usedHadiths?: Record<string, HadithUsage>; infallibleCursor?: number; dayHistoryCache?: Record<string, DayHistoryCacheEntry> } };
      usedHadiths = st.daily?.usedHadiths || {};
      cursor = Number(st.daily?.infallibleCursor) || 0;
      histCache = st.daily?.dayHistoryCache || {};
    } catch { /* state نبود → بانک کامل */ }

    const pick = pickHadith({ kind, dateKey: todayKey, usedHadithIds: usedHadiths, infallibleCursor: cursor });
    if (!pick) {
      return ok({ hadithExhausted: true, note: 'بانک احادیث به پایان رسیده — پیام ساخته نمی‌شود (هیچ ساختگی)' });
    }
    const image = await fetchNatureImage(kind, todayKey, {}).catch(() => null);
    // وقایع روز در تاریخ (ویکی‌پدیا) — صبح: امروز، شب: فردا؛ اول حافظهٔ همان روز، نبود → واکشی؛
    // شکست → بخش حذف می‌شود (صادقانه). پیش‌نمایش هیچ چیزی در state نمی‌نویسد.
    const histDayKey = kind === 'morning' ? todayKey : shiftDateKey(todayKey, 1);
    const hist = dayHistoryFromCache(histCache, histDayKey) ?? (await fetchDayHistory(tripleDateOf(histDayKey, tz, settings.qamariBasis || 'umalqura').keys.j).catch(() => null));
    const msg = await buildDailyMessage({
      kind,
      dateKey: todayKey,
      tz,
      qamariBasis: settings.qamariBasis || 'umalqura',
      city: settings.city || 'تهران',
      prayer: {
        lat: settings.lat ?? 35.6892,
        lon: settings.lon ?? 51.389,
        method: settings.prayerMethod || 'tehran',
        fajrAngle: settings.fajrAngle ?? 17.7,
        ishaAngle: settings.ishaAngle ?? 14,
        maghribMinutes: settings.maghribMinutes ?? 15,
        tz,
      },
      hadith: pick.hadith,
      image,
      dayHistory: hist?.entries ?? null,
    });

    let sent: { ok: boolean; error?: string; to?: string } = { ok: false, error: 'ارسال درخواست نشد' };
    if (body.send) {
      const token = await getBaleToken();
      if (!token) {
        sent = { ok: false, error: 'توکن بات بله در اپلیکیشن تنظیم نشده — پیش‌نمایش متن بالا واقعی است' };
      } else {
        const chat = await ensureBaleChatId();
        if (!chat.ok || !chat.chatId) {
          sent = { ok: false, error: chat.error || 'شناسهٔ چت مدیر یافت نشد — در بله به بات Start بدهید' };
        } else {
          const s = await sendBaleMessage(chat.chatId, msg.text);
          let photoErr: string | null = null;
          if (s.ok && msg.photoUrl) {
            const ph = await sendBalePhoto(chat.chatId, msg.photoUrl, msg.photoCaption);
            if (!ph.ok) photoErr = ph.error || 'ارسال عکس ناموفق بود';
          }
          sent = { ok: s.ok, error: s.ok ? (photoErr || undefined) : s.error, to: chat.chatId };
          // ثبت آزمایش در بانک — isTest=true؛ هیچ مصرفی و slotKeyای ثبت نمی‌شود
          await db.dailyRunLog.create({
            data: { dateKey: todayKey, kind, slotKey: `${todayKey}Tpreview`, status: s.ok ? 'preview' : 'failed', isTest: true, hadithId: pick.hadith.id, imageUrl: image?.imageKey || null, error: s.ok ? photoErr : (s.error || null) },
          }).catch(() => {});
        }
      }
    }

    return ok({
      kind,
      dateKey: todayKey,
      preview: { text: msg.text, photoUrl: msg.photoUrl || null, photoCaption: msg.photoCaption || null },
      hadith: { id: pick.hadith.id, narrator: pick.hadith.narrator, source: pick.hadith.source },
      consumed: false,
      sent,
    });
  } catch (e) {
    return err500(e, 'پیش‌نمایش پیام روزانه');
  }
}
