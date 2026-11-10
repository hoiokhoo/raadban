/**
 * پیش‌بینی ساعتی هوا — خواستهٔ کاربر (۱۰ نوامبر ۲۰۲۶):
 * «شب ساعت ۹ پیش‌بینی ساعتی فردای تهران را بگذار، از ساعت ۱۲ نصف شب تا [پایان] فردا»
 * — پیام مستقل ساعت ۲۱ به وقت کانال با پیش‌بینی ساعتی ۲۴ ساعتهٔ روز بعد.
 *
 * مبنا: Open-Meteo — سرویس آزاد و بی‌کلیدِ تجمیع مدل‌های عددی جوّ (ECMWF/GFS/ICON و…)
 * با منطقهٔ زمانی صریح کانال (Asia/Tehran) تا «فردا» هرگز با خطای تقویم/منطقه جابه‌جا نشود.
 *
 * صراحت: هر ساعت بدون دادهٔ معتبر حذف می‌شود؛ احتمال بارشِ بی‌داده «—» می‌خورد (نه صفرِ ساختگی)؛
 * کمتر از ۲۰ ساعت معتبر برای روز بعد → هیچ پیامی منتشر نمی‌شود و خطا شفاف ثبت می‌گردد.
 */
import { faDigits } from './daily';
import { type TripleDate } from './calendar';

// ---------- نگاشت کد هواشناسی WMO → فارسی (استاندارد جهانی Open-Meteo) ----------

/** شرح فارسی کد WMO — کد ناشناخته → «وضعیت نامشخص» (هیچ حدس ساختگی) */
export function describeWmo(code: number): string {
  const d = WMO_FA[code];
  return d || 'وضعیت نامشخص';
}

/** آیکن کوتاه هر وضعیت — برای اسکن‌پذیری فهرست ساعتی */
export function iconOfWmo(code: number): string {
  const i = WMO_ICON[code];
  return i || '☁️';
}

const WMO_FA: Record<number, string> = {
  0: 'آسمان صاف',
  1: 'عمدتاً صاف',
  2: 'نیمه‌ابری',
  3: 'ابری',
  45: 'مه‌آلود',
  48: 'مه یخ‌زده',
  51: 'نم‌نم باران خفیف',
  53: 'نم‌نم باران',
  55: 'نم‌نم باران شدید',
  56: 'نم‌نم باران یخ‌زده',
  57: 'نم‌نم باران یخ‌زدهٔ شدید',
  61: 'باران خفیف',
  63: 'باران',
  65: 'باران شدید',
  66: 'باران یخ‌زده',
  67: 'باران یخ‌زدهٔ شدید',
  71: 'بارش خفیف برف',
  73: 'بارش برف',
  75: 'بارش سنگین برف',
  77: 'دانه‌های برف',
  80: 'رگبار خفیف باران',
  81: 'رگبار باران',
  82: 'رگبار شدید باران',
  85: 'رگبار خفیف برف',
  86: 'رگبار سنگین برف',
  95: 'رعد و برق',
  96: 'رعد و برق با تگرگ',
  99: 'رعد و برق شدید با تگرگ',
};

const WMO_ICON: Record<number, string> = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  56: '🌧️',
  57: '🌧️',
  61: '🌦️',
  63: '🌧️',
  65: '🌧️',
  66: '🌧️',
  67: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '❄️',
  77: '🌨️',
  80: '🌦️',
  81: '🌧️',
  82: '🌧️',
  85: '🌨️',
  86: '🌨️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️',
};

// ---------- پارس پاسخ Open-Meteo — تابع خالص و تست‌پذیر ----------

export interface HourlyEntry {
  /** زمان محلی با منطقهٔ زمانی کانال — «2026-11-11T14:00» */
  time: string;
  /** ساعت «HH:MM» */
  hhmm: string;
  temp: number;
  feels: number;
  /** درصد احتمال بارش — بی‌داده → null (صادقانه «—»، نه صفر ساختگی) */
  precipProb: number | null;
  windKmh: number;
  code: number;
}

/** سقف منطقی دما — خارج از بازه یعنی دادهٔ خراب (حذف صادقانه) */
const TEMP_MIN = -90;
const TEMP_MAX = 60;
/** کمینهٔ ساعت‌های معتبر برای انتشار — روزِ ناقص هرگز کامل نشان داده نمی‌شود */
export const MIN_HOURS = 20;

interface OpenMeteoHourly {
  time?: unknown;
  temperature_2m?: unknown;
  apparent_temperature?: unknown;
  precipitation_probability?: unknown;
  weather_code?: unknown;
  wind_speed_10m?: unknown;
}

function numAt(arr: unknown, i: number): number | null {
  if (!Array.isArray(arr) || i >= arr.length) return null;
  const raw = arr[i];
  if (raw === null || raw === undefined || raw === '') return null; // Number(null)=0 — دامِ کلاسیک؛ null یعنی بی‌داده
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

/** پارس پاسخ Open-Meteo و استخراج ساعت‌های «فقط روزِ خواسته‌شده» (کلید روز، منطقهٔ زمانی کانال).
 *  روز ناقص/پاسخ خراب → null — هیچ ساعت ساختگی. */
export function parseHourlyForecast(json: unknown, dateKey: string): HourlyEntry[] | null {
  try {
    const hourly = (json as { hourly?: OpenMeteoHourly })?.hourly;
    if (!hourly || !Array.isArray(hourly.time)) return null;
    const times = hourly.time as unknown[];
    const out: HourlyEntry[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < times.length; i++) {
      const time = String(times[i] ?? '');
      if (time.slice(0, 10) !== dateKey) continue; // فقط فردای کانال — نه امروز، نه پس‌فردا
      if (seen.has(time)) continue;
      const temp = numAt(hourly.temperature_2m, i);
      if (temp === null || temp < TEMP_MIN || temp > TEMP_MAX) continue; // ساعت بی‌داده حذف
      const feels = numAt(hourly.apparent_temperature, i) ?? temp;
      const windKmh = numAt(hourly.wind_speed_10m, i);
      if (windKmh === null || windKmh < 0) continue;
      const probRaw = numAt(hourly.precipitation_probability, i);
      const precipProb = probRaw === null ? null : Math.max(0, Math.min(100, Math.round(probRaw)));
      const codeRaw = numAt(hourly.weather_code, i);
      const code = codeRaw === null ? -1 : Math.round(codeRaw);
      out.push({ time, hhmm: time.slice(11, 16) || '00:00', temp: Math.round(temp), feels: Math.round(feels), precipProb, windKmh: Math.round(windKmh), code });
      seen.add(time);
    }
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out.length >= MIN_HOURS ? out : null;
  } catch {
    return null;
  }
}

// ---------- خلاصهٔ روز ----------

export interface DaySummary {
  minT: number;
  maxT: number;
  /** بیشینهٔ احتمال بارش + ساعت آن (نخستین ساعتِ بیشینه) — همهٔ ساعت‌ها بی‌داده → null */
  maxPrecip: { prob: number; hhmm: string } | null;
  /** ساعت‌های با احتمال بارش ≥ ۵۰٪ */
  wetHours: number;
}

export function summarizeHours(hours: HourlyEntry[]): DaySummary {
  let minT = Number.POSITIVE_INFINITY;
  let maxT = Number.NEGATIVE_INFINITY;
  let maxPrecip: DaySummary['maxPrecip'] = null;
  let wetHours = 0;
  for (const h of hours) {
    if (h.temp < minT) minT = h.temp;
    if (h.temp > maxT) maxT = h.temp;
    if (h.precipProb !== null && h.precipProb >= 50) wetHours++;
    if (h.precipProb !== null && (maxPrecip === null || h.precipProb > maxPrecip.prob)) {
      maxPrecip = { prob: h.precipProb, hhmm: h.hhmm };
    }
  }
  return { minT, maxT, maxPrecip, wetHours };
}

// ---------- پیام ----------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** خط یک ساعت — « ⛅ ۱۴:۰۰ · نیمه‌ابری · ۱۶° · بارش ۱۰٪ · باد ۹» */
export function formatHourLine(h: HourlyEntry): string {
  const cond = `${iconOfWmo(h.code)} ${esc(describeWmo(h.code))}`;
  const temp = `${faDigits(String(h.temp))}°`;
  const feels = Math.abs(h.feels - h.temp) >= 3 ? ` (احساس ${faDigits(String(h.feels))}°)` : '';
  const precip = h.precipProb === null ? 'بارش —' : `بارش ${faDigits(String(h.precipProb))}٪`;
  const wind = `باد ${faDigits(String(h.windKmh))}`;
  return `${faDigits(h.hhmm)} · ${cond} · ${temp}${feels} · ${precip} · ${wind}`;
}

/** پیام پیش‌بینی ساعتی فردا — خالی/ناقص → null (هیچ پیام نیمه‌ساختگی) */
export function buildWeatherMessage(input: { city: string; tomorrow: TripleDate; weatherHour: string; hours: HourlyEntry[] | null }): { text: string } | null {
  const { city, tomorrow, weatherHour } = input;
  if (!input.hours || input.hours.length === 0) return null;
  const s = summarizeHours(input.hours);
  const L: string[] = [
    `🌦️ <b>پیش‌بینی ساعتی فردا — ${esc(city)}</b>`,
    // بدون برچسب (خواستهٔ کاربر ۱۰ نوامبر ۲۰۲۶) — ماه‌ها خودْ گویا هستند
    `📅 ${esc(tomorrow.weekdayFa)} — ${esc(tomorrow.shamsi)} • ${esc(tomorrow.miladi)}`,
    '',
    `🌡️ دما: کمینه ${faDigits(String(s.minT))}° / بیشینه ${faDigits(String(s.maxT))}°`,
  ];
  if (s.maxPrecip) {
    L.push(`🌧️ بیشترین احتمال بارش: ${faDigits(String(s.maxPrecip.prob))}٪ حدود ${faDigits(s.maxPrecip.hhmm)}${s.wetHours > 0 ? ` — ${faDigits(String(s.wetHours))} ساعت با احتمال بارش بالای ۵۰٪` : ''}`);
  } else {
    L.push('🌧️ دادهٔ احتمال بارش در دسترس نیست.');
  }
  L.push('', '<i>ستون‌ها: ساعت · وضعیت · دما · احتمال بارش · باد (کیلومتر بر ساعت)</i>', '');
  for (const h of input.hours) L.push(formatHourLine(h));
  L.push(
    '',
    `📡 منبع: Open-Meteo — مدل‌های عددی جوّ (به‌روزرسانی خودکار، منطقهٔ زمانی ${esc(city)})`,
    `— رصدبان | پیش‌بینی ساعتی روز بعد، هر شب ساعت ${faDigits(weatherHour)}`,
  );
  return { text: L.join('\n') };
}

// ---------- واکشی — Open-Meteo بی‌کلید، سه تلاش، شکست → null صادقانه ----------

async function getJson(url: string, timeoutMs = 15_000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RaadbanBot/1.0 (hourly weather forecast; contact via repo)', Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** واکشی پیش‌بینی ساعتی روزِ خواسته‌شده (کلید روز فردا) — ناموفق/ناقص → null */
export async function fetchHourlyForecast(lat: number, lon: number, tz: string, dateKey: string): Promise<HourlyEntry[] | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${Number(lat).toFixed(4)}&longitude=${Number(lon).toFixed(4)}` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m` +
    `&wind_speed_unit=kmh&timezone=${encodeURIComponent(tz)}&forecast_days=3`;
  for (const delay of [0, 3000, 8000]) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const json = await getJson(url);
    if (!json) continue;
    const hours = parseHourlyForecast(json, dateKey);
    if (hours) return hours;
  }
  return null;
}
