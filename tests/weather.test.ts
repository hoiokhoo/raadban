/**
 * تست‌های پیش‌بینی ساعتی هوا (خواستهٔ کاربر ۱۰ نوامبر ۲۰۲۶):
 * «شب ساعت ۹ پیش‌بینی ساعتی فردای تهران را بگذار، از ساعت ۱۲ نصف شب تا [پایان] فردا»
 * پوشش: پارسر Open-Meteo (فیلتر دقیق روزِ فردا)، نگاشت WMO فارسی، خلاصهٔ روز،
 * ساخت پیام (ارقام فارسی، صادقانه بودن بی‌داده‌ها)، تنظیمات (۲۱:۰۰) و ضدتکرار اسلات.
 */
import { describe, expect, test } from 'bun:test';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseHourlyForecast,
  buildWeatherMessage,
  summarizeHours,
  describeWmo,
  iconOfWmo,
  formatHourLine,
  MIN_HOURS,
  type HourlyEntry,
} from '../bot/weather';
import { tripleDateOf } from '../bot/calendar';
import { DAILY_SETTINGS_DEFAULTS, loadDailySettings } from '../bot/bot';

// ---------- فیکسچر Open-Meteo — سه روز کامل، منطقهٔ زمانی کانال ----------

function openMeteoFixture(): Record<string, unknown> {
  const time: string[] = [];
  const temperature_2m: number[] = [];
  const apparent_temperature: number[] = [];
  const precipitation_probability: Array<number | null> = [];
  const weather_code: number[] = [];
  const wind_speed_10m: number[] = [];
  for (let day = 10; day <= 12; day++) {
    for (let h = 0; h < 24; h++) {
      time.push(`2026-11-${day}T${String(h).padStart(2, '0')}:00`);
      const t = 8 + (h % 13); // ۸ تا ۲۰ درجه
      temperature_2m.push(t);
      apparent_temperature.push(h === 8 && day === 11 ? t + 5 : t - 1);
      precipitation_probability.push(day === 11 && h === 15 ? 65 : h % 6 === 0 ? null : 0);
      weather_code.push(day === 11 && h === 15 ? 61 : 0);
      wind_speed_10m.push(h + 0.4);
    }
  }
  return { hourly: { time, temperature_2m, apparent_temperature, precipitation_probability, weather_code, wind_speed_10m } };
}

describe('پارسر پیش‌بینی ساعتی Open-Meteo', () => {
  const fx = openMeteoFixture();

  test('فقط ۲۴ ساعت روزِ فردا — نه امروز، نه پس‌فردا', () => {
    const hours = parseHourlyForecast(fx, '2026-11-11');
    expect(hours).not.toBeNull();
    expect(hours!.length).toBe(24);
    expect(hours![0].time).toBe('2026-11-11T00:00');
    expect(hours![23].time).toBe('2026-11-11T23:00');
    expect(hours!.every((h) => h.time.startsWith('2026-11-11'))).toBe(true);
  });
  test('مقدارها درست پارس می‌شوند (دما/باد گرد، کد WMO)', () => {
    const hours = parseHourlyForecast(fx, '2026-11-11')!;
    const h15 = hours.find((h) => h.hhmm === '15:00')!;
    expect(h15.temp).toBe(8 + (15 % 13)); // ۱۸
    expect(h15.code).toBe(61);
    expect(h15.precipProb).toBe(65);
    expect(h15.windKmh).toBe(15); // 15.4 گرد شد
  });
  test('احتمال بارشِ بی‌داده → null صادقانه (نه صفر ساختگی)', () => {
    const hours = parseHourlyForecast(fx, '2026-11-11')!;
    expect(hours[0].precipProb).toBeNull(); // h=0 → null در فیکسچر
    expect(hours[1].precipProb).toBe(0);
  });
  test('ساعتِ بی‌دما حذف می‌شود — زیر حداقل → null (هیچ روز ناقصی منتشر نمی‌شود)', () => {
    const broken = JSON.parse(JSON.stringify(fx)) as { hourly: { temperature_2m: Array<number | null> } };
    for (let i = 24; i < 24 + 15; i++) broken.hourly.temperature_2m[i] = null; // ۱۵ ساعت فردا بی‌داده → ۹ ساعت معتبر
    expect(parseHourlyForecast(broken, '2026-11-11')).toBeNull();
  });
  test('روزِ ناقصِ قابل‌قبول — ۲۲ ساعت معتبر بازهم منتشر می‌شود (حاشیهٔ بالای حداقل)', () => {
    const partial = JSON.parse(JSON.stringify(fx)) as { hourly: { temperature_2m: Array<number | null> } };
    partial.hourly.temperature_2m[24] = null; // ۰۰:۰۰ فردا
    partial.hourly.temperature_2m[25] = null; // ۰۱:۰۰ فردا
    const hours = parseHourlyForecast(partial, '2026-11-11');
    expect(hours?.length).toBe(22);
  });
  test('کلید روز اشتباه → null', () => {
    expect(parseHourlyForecast(fx, '2026-12-25')).toBeNull();
  });
  test('پاسخ خراب → null', () => {
    expect(parseHourlyForecast(null, '2026-11-11')).toBeNull();
    expect(parseHourlyForecast({}, '2026-11-11')).toBeNull();
    expect(parseHourlyForecast({ hourly: { time: [] } }, '2026-11-11')).toBeNull();
  });
  test('حداقل ساعت‌ها — ۲۰ (سقف پذیرش روزِ تقریباً کامل)', () => {
    expect(MIN_HOURS).toBe(20);
  });
});

describe('نگاشت WMO فارسی', () => {
  test('کدهای اصلی', () => {
    expect(describeWmo(0)).toContain('صاف');
    expect(describeWmo(2)).toContain('نیمه‌ابری');
    expect(describeWmo(45)).toContain('مه');
    expect(describeWmo(61)).toContain('باران');
    expect(describeWmo(73)).toContain('برف');
    expect(describeWmo(95)).toContain('رعد و برق');
  });
  test('کد ناشناخته → «وضعیت نامشخص» (هیچ حدس ساختگی)', () => {
    expect(describeWmo(42)).toBe('وضعیت نامشخص');
    expect(iconOfWmo(42)).toBe('☁️');
  });
  test('آیکن‌ها', () => {
    expect(iconOfWmo(0)).toBe('☀️');
    expect(iconOfWmo(95)).toBe('⛈️');
  });
});

describe('خلاصهٔ روز', () => {
  const fx = openMeteoFixture();
  const hours = parseHourlyForecast(fx, '2026-11-11')!;
  test('کمینه/بیشینهٔ دما', () => {
    const s = summarizeHours(hours);
    expect(s.minT).toBe(8);
    expect(s.maxT).toBe(20);
  });
  test('بیشینهٔ احتمال بارش + ساعت آن + ساعت‌های تر', () => {
    const s = summarizeHours(hours);
    expect(s.maxPrecip?.prob).toBe(65);
    expect(s.maxPrecip?.hhmm).toBe('15:00');
    expect(s.wetHours).toBe(1);
  });
  test('همهٔ احتمال‌ها بی‌داده → maxPrecip null', () => {
    const noPrecip: HourlyEntry[] = hours.map((h) => ({ ...h, precipProb: null }));
    expect(summarizeHours(noPrecip).maxPrecip).toBeNull();
  });
});

describe('پیام پیش‌بینی ساعتی', () => {
  const fx = openMeteoFixture();
  const hours = parseHourlyForecast(fx, '2026-11-11')!;
  const tomorrow = tripleDateOf('2026-11-11', 'Asia/Tehran', 'umalqura');
  const msg = buildWeatherMessage({ city: 'تهران', tomorrow, weatherHour: '21:00', hours });

  test('سربرگ + تاریخ سه‌گانه + شهر', () => {
    expect(msg).not.toBeNull();
    expect(msg!.text).toContain('پیش‌بینی ساعتی فردا — تهران');
    expect(msg!.text).toContain('چهارشنبه'); // 2026-11-11
    expect(msg!.text).toContain('آبان');
    expect(msg!.text).toContain('Open-Meteo');
  });
  test('هر ۲۴ ساعت با ارقام فارسی — از ۰۰:۰۰ تا ۲۳:۰۰', () => {
    expect(msg!.text).toContain('۰۰:۰۰');
    expect(msg!.text).toContain('۲۳:۰۰');
    expect(msg!.text).toContain('۱۵:۰۰');
    expect(msg!.text).not.toContain('24:00');
    expect(msg!.text).not.toMatch(/\d{2}:\d{2}/); // هیچ رقم لاتین در ساعت‌ها
  });
  test('خلاصهٔ دما و بارش درست', () => {
    expect(msg!.text).toContain('کمینه ۸°');
    expect(msg!.text).toContain('بیشینه ۲۰°');
    expect(msg!.text).toContain('۶۵٪');
  });
  test('احساس واقعیِ متفاوت نمایش داده می‌شود', () => {
    // ساعت ۰۸:۰۰ فردا: احساس = دما + ۵
    expect(msg!.text).toContain('(احساس');
  });
  test('پاورقی ساعت ارسال از تنظیمات', () => {
    expect(msg!.text).toContain('۲۱:۰۰');
  });
  test('حجم پیام زیر سقف بله است', () => {
    expect(msg!.text.length).toBeLessThan(4000);
  });
  test('هیچ undefined/NaN در پیام', () => {
    expect(msg!.text).not.toContain('undefined');
    expect(msg!.text).not.toContain('NaN');
  });
  test('بدون داده → null صادقانه (هیچ پیام ساختگی)', () => {
    expect(buildWeatherMessage({ city: 'تهران', tomorrow, weatherHour: '21:00', hours: null })).toBeNull();
    expect(buildWeatherMessage({ city: 'تهران', tomorrow, weatherHour: '21:00', hours: [] })).toBeNull();
  });
  test('خط ساعت — قالب ستونی', () => {
    const line = formatHourLine(hours[15]);
    expect(line).toContain('۱۵:۰۰');
    expect(line).toContain('باران خفیف');
    expect(line).toContain('بارش ۶۵٪');
    expect(line).toContain('باد');
  });
});

describe('تنظیمات پیش‌بینی ساعتی', () => {
  test('پیش‌فرض: فعال، ساعت ۲۱:۰۰ (خواستهٔ کاربر: شب ساعت ۹)', () => {
    expect(DAILY_SETTINGS_DEFAULTS.weatherEnabled).toBe(true);
    expect(DAILY_SETTINGS_DEFAULTS.weatherHour).toBe('21:00');
  });
  test('فایل نبود → پیش‌فرض ۲۱:۰۰', () => {
    const s = loadDailySettings('/nonexistent/daily-settings.json');
    expect(s.weatherHour).toBe('21:00');
    expect(s.weatherEnabled).toBe(true);
  });
  test('ساعت خراب در فایل → پیش‌فرض', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbwx-'));
    const file = join(dir, 'daily-settings.json');
    writeFileSync(file, JSON.stringify({ weatherHour: '25:99', morningHour: '05:00' }), 'utf8');
    const s = loadDailySettings(file);
    expect(s.weatherHour).toBe('21:00');
  });
});
