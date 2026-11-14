/**
 * تست‌های چندشهری‌بودن بخش هواشناسی — خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «زیر بخش هواشناسی تهران آب و هوای خوانسار و افجه لواسون رو هم به همین شکل اضافه کن».
 * پوشش: weatherCitiesOf (شهر اصلی اول + شهرهای اضافهٔ معتبر + حذف تکراری/نامعتبر + سقف)،
 * اعتبارسنجی loadDailySettings برای extraWeatherCities، و کارت SVG با فونت نازنین
 * و گزینهٔ پس‌زمینهٔ عکس.
 */
import { describe, expect, test } from 'bun:test';
import {
  weatherCitiesOf,
  loadDailySettings,
  DAILY_SETTINGS_DEFAULTS,
  type DailySettingsFile,
} from '../bot/bot';
import { makeWeatherCardSvg, FONT_FA, type WeatherCardInput } from '../bot/weather-card';
import { tripleDateOf } from '../bot/calendar';
import type { HourlyEntry } from '../bot/weather';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function baseSettings(over: Partial<DailySettingsFile> = {}): DailySettingsFile {
  return { ...DAILY_SETTINGS_DEFAULTS, ...over };
}

describe('weatherCitiesOf — فهرست شهرهای کارت', () => {
  test('پیش‌فرض: تهران اول، سپس خوانسار و افجه لواسان (به همین شکل زیر تهران)', () => {
    const cities = weatherCitiesOf(baseSettings());
    expect(cities.length).toBe(3);
    expect(cities[0].name).toBe('تهران');
    expect(cities[1].name).toBe('خوانسار');
    expect(cities[2].name).toBe('افجه لواسان');
    expect(Math.abs(cities[1].lat - 33.2205)).toBeLessThan(0.01);
    expect(Math.abs(cities[2].lon - 51.6833)).toBeLessThan(0.01);
  });

  test('شهر اصلی از تنظیمات می‌آید — تغییر شهر همهٔ بخش‌ها را جابه‌جا نمی‌کند', () => {
    const cities = weatherCitiesOf(baseSettings({ city: 'مشهد', lat: 36.2972, lon: 59.6067 }));
    expect(cities[0]).toEqual({ name: 'مشهد', lat: 36.2972, lon: 59.6067 });
    expect(cities[1].name).toBe('خوانسار');
  });

  test('مدخل نامعتبر و تکراری حذف می‌شود؛ سقف ۴ شهر اضافه', () => {
    const cities = weatherCitiesOf(baseSettings({
      extraWeatherCities: [
        { name: 'خوانسار', lat: 33.22, lon: 50.31 }, // تکرار نام با پیش‌فرض؟ نه — تکرار با شهر اصلی نیست؛ معتبر
        { name: 'تهران', lat: 35, lon: 51 }, // تکرار با شهر اصلی → حذف
        { name: '', lat: 1, lon: 1 }, // نام خالی → حذف
        { name: 'x', lat: 999, lon: 1 }, // مختصات نامعتبر → حذف
        null as unknown as { name: string; lat: number; lon: number },
        { name: 'شیراز', lat: 29.5918, lon: 52.5837 },
        { name: 'کرج', lat: 35.8355, lon: 50.9915 },
        { name: 'قم', lat: 34.6416, lon: 50.8746 },
        { name: 'رشت', lat: 37.2808, lon: 49.5838 }, // پنجمین معتبر → حذف (سقف ۴)
      ],
    }));
    const names = cities.map((c) => c.name);
    expect(names[0]).toBe('تهران');
    expect(names).not.toContain('تهران'.repeat(2));
    expect(names.filter((n) => n === 'تهران').length).toBe(1); // فقط شهر اصلی
    expect(names).toContain('خوانسار');
    expect(names).toContain('شیراز');
    expect(names).toContain('کرج');
    expect(names).toContain('قم');
    expect(names).not.toContain('رشت'); // سقف ۴ شهر اضافه
    expect(cities.length).toBe(5); // اصلی + ۴
  });

  test('بدون شهر اضافه → فقط شهر اصلی (رفتار تک‌شهری قدیمی)', () => {
    const cities = weatherCitiesOf(baseSettings({ extraWeatherCities: undefined }));
    expect(cities.length).toBe(1);
    expect(cities[0].name).toBe('تهران');
  });
});

describe('loadDailySettings — اعتبارسنجی شهرهای اضافه', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'raadban-dsettings-'));
  const path = join(tmp, 'daily-settings.json');

  test('فایل با مدخل‌های خراب → فقط معتبرها می‌مانند', () => {
    writeFileSync(path, JSON.stringify({
      ...DAILY_SETTINGS_DEFAULTS,
      extraWeatherCities: [
        { name: 'خوانسار', lat: 33.2205, lon: 50.315 },
        { name: 'بد', lat: null, lon: 1 },
        'خرید',
      ] as unknown as Array<{ name: string; lat: number; lon: number }>,
    }), 'utf8');
    const s = loadDailySettings(path);
    expect(s.extraWeatherCities?.length).toBe(1);
    expect(s.extraWeatherCities?.[0].name).toBe('خوانسار');
  });

  test('فایل بدون فیلد → پیش‌فرض‌ها (خوانسار + افجه لواسان)', () => {
    writeFileSync(path, JSON.stringify({ ...DAILY_SETTINGS_DEFAULTS, extraWeatherCities: undefined }), 'utf8');
    const s = loadDailySettings(path);
    expect(s.extraWeatherCities).toEqual(DAILY_SETTINGS_DEFAULTS.extraWeatherCities);
  });

  test('فایل نبود → پیش‌فرض کامل', () => {
    rmSync(path, { force: true });
    const s = loadDailySettings(join(tmp, 'nofile.json'));
    expect(s.city).toBe('تهران');
    expect(s.extraWeatherCities?.map((c) => c.name)).toEqual(['خوانسار', 'افجه لواسان']);
  });

  test('پاک‌سازی', () => {
    rmSync(tmp, { recursive: true, force: true });
  });
});

describe('کارت SVG — فونت نازنین و پس‌زمینهٔ عکس (خواستهٔ ۱۵ نوامبر)', () => {
  function input(): WeatherCardInput {
    const hours: HourlyEntry[] = [];
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      hours.push({ time: `2026-11-16T${hh}:00`, hhmm: `${hh}:00`, temp: 6 + (h % 11), feels: 5 + (h % 11), precipProb: h === 15 ? 60 : 0, windKmh: 6, code: h === 15 ? 63 : 0 });
    }
    return { city: 'خوانسار', tomorrow: tripleDateOf('2026-11-16', 'Asia/Tehran', 'umalqura'), weatherHour: '21:00', hours };
  }

  test('همهٔ متن‌ها فونت نازنین دارند با پشتیبان وزیرمتن', () => {
    const svg = makeWeatherCardSvg(input());
    expect(svg).toContain(`font-family="${FONT_FA}"`);
    expect(FONT_FA).toContain('B Nazanin');
    expect(FONT_FA).toContain('Vazirmatn');
    expect((svg.match(new RegExp(`font-family="${FONT_FA.replace(/'/g, "\\'")}"`, 'g')) || []).length).toBeGreaterThan(8);
  });

  test('حالت پس‌زمینهٔ عکس: بدون کف تخت، پنل‌ها نیمه‌شفاف', () => {
    const svg = makeWeatherCardSvg(input(), { photoBg: true });
    expect(svg).not.toContain('fill="#0a1c30"'); // کف تخت حذف
    expect(svg).toContain('fill-opacity="0.9"'); // سلول‌ها
    expect(svg).toContain('fill-opacity="0.88"'); // سربرگ
  });

  test('حالت تخت (پیش‌فرض): کف تخت هست، بدون شفافیت', () => {
    const svg = makeWeatherCardSvg(input());
    expect(svg).toContain('fill="#0a1c30"');
    expect(svg).not.toContain('fill-opacity="0.9"');
  });

  test('شهرهای مختلف در کارت می‌آیند — خوانسار و افجه لواسان', () => {
    expect(makeWeatherCardSvg(input())).toContain('خوانسار');
    expect(makeWeatherCardSvg({ ...input(), city: 'افجه لواسان' })).toContain('افجه لواسان');
  });
});
