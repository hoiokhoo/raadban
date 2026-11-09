/**
 * اوقات شرعی رصدبان — خواستهٔ کاربر (۱۰ نوامبر ۲۰۲۶): «اوقات شرعی روز آینده برای موقعیت
 * جغرافیایی تنظیم‌شدهٔ کانال… از سرویس معتبر اوقات شرعی یا کتابخانهٔ محاسبات نجومی معتبر
 * استفاده شود… روش محاسبه و تنظیمات فقهی قابل پیکربندی باشند… زمان‌ها به وقت محلی همان
 * شهر و با ارقام فارسی نمایش داده شوند… اگر سرویس در دسترس نبود، زمان اشتباه یا حدسی منتشر نشود.»
 *
 * مبنا: کتابخانهٔ «adhan» (محاسبات نجومی استاندارد شناخته‌شده — MIT) + روش ژئوفیزیک دانشگاه
 * تهران (زاویهٔ فجر ۱۷٫۷°، عشا ۱۴°) که مبنای تقویم رسمی ایران است. اذان مغرب = غروب +
 * دقیقه‌های قابل‌تنظیم (پیش‌فرض ۱۵ دقیقه، مطابق رسم رایج ایران). نیمه‌شب شرعی = میانهٔ
 * (مغربِ فردا تا فجرِ روز پس‌فردا). هر خروجی پیش از بازگشت اعتبارسنجی ترتیب می‌شود؛
 * نامعتبر → null و پیام صادقانه «محاسبه نشد» — هیچ زمان ساختگی.
 */
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan';

export type PrayerMethod = 'tehran' | 'mwl' | 'custom';

export interface PrayerSettings {
  lat: number;
  lon: number;
  method: PrayerMethod;
  fajrAngle: number;
  ishaAngle: number;
  maghribMinutes: number;
  tz: string;
}

export interface PrayerTimesDay {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  /** غروب آفتاب (طلوع نیست — مغرب پیش از اذان) */
  sunset: string;
  maghrib: string;
  isha: string;
  midnight: string;
  methodLabel: string;
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** ارقام فارسی HH:MM — «05:23» → «۰۵:۲۳» */
export function faClock(hhmm: string): string {
  return hhmm.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** HH:MM در منطقهٔ زمانی کانال از یک لحظهٔ UTC */
function clockIn(epoch: number, tz: string): string {
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' }).format(epoch);
  return hhmm === '24:00' ? '00:00' : hhmm;
}

/** کلید روز → لحظهٔ میانهٔ روز UTC (برای ورودی محاسبات نجومی) */
function epochOfDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getTime();
}

function methodLabelOf(method: PrayerMethod): string {
  if (method === 'tehran') return 'روش ژئوفیزیک دانشگاه تهران (فجر ۱۷٫۷°، عشا ۱۴°)';
  if (method === 'mwl') return 'روش رابطهٔ جهانی مساجد (MWL)';
  return 'روش سفارشی (زاویه‌های دستی)';
}

function timesFor(dateKey: string, s: PrayerSettings): { pt: PrayerTimes; fajrNext: number } | null {
  try {
    const coords = new Coordinates(s.lat, s.lon);
    let params: ReturnType<typeof CalculationMethod.Other>;
    if (s.method === 'tehran') {
      params = CalculationMethod.Other();
      params.fajrAngle = s.fajrAngle;
      params.ishaAngle = s.ishaAngle;
    } else if (s.method === 'mwl') {
      params = CalculationMethod.MuslimWorldLeague();
    } else {
      params = CalculationMethod.Other();
      params.fajrAngle = s.fajrAngle;
      params.ishaAngle = s.ishaAngle;
    }
    const pt = new PrayerTimes(coords, new Date(epochOfDateKey(dateKey)), params);
    // فجر روز پس‌فردا — برای نیمه‌شب شرعیِ شبِ فردا
    const next = new PrayerTimes(coords, new Date(epochOfDateKey(dateKey) + 24 * 3600_000), params);
    return { pt, fajrNext: next.fajr.getTime() };
  } catch {
    return null;
  }
}

/** محاسبهٔ اوقات شرعی یک کلید روز — نامعتبر → null (هیچ زمان ساختگی) */
export function computePrayerTimes(dateKey: string, s: PrayerSettings): PrayerTimesDay | null {
  try {
    const r = timesFor(dateKey, s);
    if (!r) return null;
    const { pt, fajrNext } = r;
    const sunset = pt.sunset.getTime();
    const maghrib = sunset + Math.max(0, Math.min(60, s.maghribMinutes)) * 60_000;
    const midnight = Math.round((maghrib + fajrNext) / 2);
    // اوقات نجومی باید همهٔ آن‌ها متناهی باشند (مدار قطبی/مختصات نامعتبر → null صادقانه)
    const times = [pt.fajr.getTime(), pt.sunrise.getTime(), pt.dhuhr.getTime(), pt.sunset.getTime(), pt.isha.getTime(), fajrNext, maghrib, midnight];
    if (!times.every(Number.isFinite)) return null;
    const out: PrayerTimesDay = {
      fajr: clockIn(pt.fajr.getTime(), s.tz),
      sunrise: clockIn(pt.sunrise.getTime(), s.tz),
      dhuhr: clockIn(pt.dhuhr.getTime(), s.tz),
      sunset: clockIn(sunset, s.tz),
      maghrib: clockIn(maghrib, s.tz),
      isha: clockIn(pt.isha.getTime(), s.tz),
      midnight: clockIn(midnight, s.tz),
      methodLabel: methodLabelOf(s.method),
    };
    return validatePrayerTimes(out) ? out : null;
  } catch {
    return null;
  }
}

/** اعتبارسنجی ترتیب و بازهٔ اوقات — هر حالت نامعتبر → false (ارسال نمی‌شود) */
export function validatePrayerTimes(p: PrayerTimesDay): boolean {
  if (!/^\d{2}:\d{2}$/.test(p.fajr) || !/^\d{2}:\d{2}$/.test(p.sunrise) || !/^\d{2}:\d{2}$/.test(p.dhuhr) ||
      !/^\d{2}:\d{2}$/.test(p.sunset) || !/^\d{2}:\d{2}$/.test(p.maghrib) || !/^\d{2}:\d{2}$/.test(p.isha) ||
      !/^\d{2}:\d{2}$/.test(p.midnight)) return false;
  const toMin = (t: string): number | null => {
    const m = /^(\d{2}):(\d{2})$/.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const f = toMin(p.fajr), sr = toMin(p.sunrise), dh = toMin(p.dhuhr), ss = toMin(p.sunset), mg = toMin(p.maghrib), is = toMin(p.isha), md = toMin(p.midnight);
  if (f === null || sr === null || dh === null || ss === null || mg === null || is === null || md === null) return false;
  if (!(f < sr && sr < dh && dh < ss && ss < mg && mg < is)) return false;
  if (!(f >= 0 && f <= 12 * 60)) return false; // اذان صبح منطقاً تا ظهر
  // نیمه‌شب شرعی = میانهٔ مغرب تا فجرِ روز بعد — می‌تواند پس از نیمه‌شب ساعتِ بیفتد؛
  // فقط بازهٔ عقلایی کنترل می‌شود (حدوداً بین مغرب و فجرِ پس‌فردا)
  if (!(md >= ss - 30 || md <= f + 30)) return false;
  return true;
}

/** قالب بلوک اوقات شرعی پیام شبانگاهی — ارقام فارسی */
export function formatPrayerBlock(p: PrayerTimesDay, city: string, dateFa: string): string {
  return [
    '🕌 <b>اوقات شرعی فردا</b>',
    `📅 تاریخ: ${dateFa}`,
    `📍 موقعیت: ${city}`,
    '',
    `🌅 اذان صبح: ${faClock(p.fajr)}`,
    `☀️ طلوع آفتاب: ${faClock(p.sunrise)}`,
    `🕛 اذان ظهر: ${faClock(p.dhuhr)}`,
    `🌇 غروب آفتاب: ${faClock(p.sunset)}`,
    `🌙 اذان مغرب: ${faClock(p.maghrib)}`,
    `✨ نیمه‌شب شرعی: ${faClock(p.midnight)}`,
    '',
    `روش محاسبه: ${p.methodLabel} — زمان‌ها به وقت ${city}`,
  ].join('\n');
}
