/**
 * تست‌های کارت تصویری هواشناسی (خواستهٔ کاربر ۱۳ نوامبر ۲۰۲۶:
 * «چک کن ببین این چارت‌ها در پیام‌رسان ربات بله هم ارسال می‌شود؟»)
 * پوشش: SVG خالص (بدون sharp — ارقام فارسی، جهت RTL صریح، بدون NaN)، نگاشت آیکن،
 * شب/روز، رنگ دما، کپشن ≤۱۰۲۴ نویسه، و رندر واقعی PNG با sharp (یک‌بار برای اطمینان از بوت‌استرپ فونت).
 */
import { describe, expect, test } from 'bun:test';
import {
  makeWeatherCardSvg,
  renderWeatherCardPng,
  tempColor,
  iconKindOf,
  isNightHour,
  type WeatherCardInput,
} from '../bot/weather-card';
import * as weatherCardModule from '../bot/weather-card';
import { tripleDateOf } from '../bot/calendar';
import type { HourlyEntry } from '../bot/weather';

// ---------- فیکسچر — ۲۴ ساعت ترکیبی همان ساختار HourlyEntry ----------

function hoursFixture(): HourlyEntry[] {
  const out: HourlyEntry[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    out.push({
      time: `2026-11-15T${hh}:00`,
      hhmm: `${hh}:00`,
      temp: 6 + (h % 12),
      feels: h === 14 ? 14 : 6 + (h % 12) - 1,
      precipProb: h === 15 ? 65 : h % 6 === 0 ? null : 0,
      windKmh: 5 + (h % 4),
      code: h === 15 ? 61 : h % 7 === 0 ? 2 : 0,
    });
  }
  return out;
}

function cardInput(): WeatherCardInput {
  return {
    city: 'تهران',
    tomorrow: tripleDateOf('2026-11-15', 'Asia/Tehran', 'umalqura'),
    weatherHour: '21:00',
    hours: hoursFixture(),
  };
}

// ---------- SVG خالص ----------

describe('makeWeatherCardSvg', () => {
  test('ساخت SVG کامل — شهر، ۲۴ سلول، ارقام فارسی، بدون NaN/undefined', () => {
    const svg = makeWeatherCardSvg(cardInput());
    expect(svg.length).toBeGreaterThan(2000);
    expect(svg).toContain('تهران');
    expect(svg).toContain('پیش‌بینی ساعتی فردا');
    expect((svg.match(/<circle/g) || []).length).toBeGreaterThan(10); // آیکن‌های خورشید/ماه
    expect(svg).toContain('۲۱:۰۰'); // ساعت فارسی
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
    expect(svg).toContain('\u202B'); // جهت‌نمای RTL صریح
  });

  test('بدون ساعت خالی → رشتهٔ خالی (هیچ کارت نیمه‌ساختگی)', () => {
    const input = { ...cardInput(), hours: [] };
    expect(makeWeatherCardSvg(input)).toBe('');
  });

  test('بی‌دادهٔ بارش → «بارش —» صادقانه، نه صفر ساختگی', () => {
    const hours = hoursFixture().map((h) => ({ ...h, precipProb: null }));
    const svg = makeWeatherCardSvg({ ...cardInput(), hours });
    expect(svg).toContain('بارش —');
    expect(svg).toContain('بی‌داده'); // تراشهٔ بیشترین بارش
  });

  test('ساعات بارش ≥۵۰٪ تراشهٔ چهارم می‌سازد', () => {
    const svg = makeWeatherCardSvg(cardInput()); // ساعت ۱۵ با ۶۵٪
    expect(svg).toContain('ساعات بارش');
  });
});

// ---------- نگاشت‌های خالص ----------

describe('iconKindOf / isNightHour / tempColor', () => {
  test('نگاشت کد WMO به شکل آیکن', () => {
    expect(iconKindOf(0)).toBe('sun');
    expect(iconKindOf(2)).toBe('sun-cloud');
    expect(iconKindOf(3)).toBe('cloud');
    expect(iconKindOf(63)).toBe('rain');
    expect(iconKindOf(73)).toBe('snow');
    expect(iconKindOf(95)).toBe('storm');
    expect(iconKindOf(-1)).toBe('cloud'); // کد ناشناخته → ابر محافظه‌کارانه
  });

  test('شب/روز — مرز ۱۸ و ۶', () => {
    expect(isNightHour('23:00')).toBe(true);
    expect(isNightHour('18:00')).toBe(true);
    expect(isNightHour('17:00')).toBe(false);
    expect(isNightHour('05:00')).toBe(true);
    expect(isNightHour('06:00')).toBe(false);
  });

  test('رنگ دما — سرد آبی تا گرم قرمز', () => {
    expect(tempColor(-5)).toBe('#7dd3fc');
    expect(tempColor(25)).toBe('#fbbf24');
    expect(tempColor(40)).toBe('#f87171');
  });
});

// ---------- کپشن حذف‌شده (خواستهٔ کاربر ۲۰ نوامبر: «اینو که زیر عکس به شکل متنی میاد حذف کن چون داخل عکس هست») ----------

describe('کپشن حذف‌شده — عکس هواشناسی بدون کپشن ارسال می‌شود', () => {
  test('سازندهٔ کپشن دیگر وجود ندارد — کارت همهٔ اطلاعات را خودش دارد', () => {
    const mod = weatherCardModule as unknown as Record<string, unknown>;
    expect(mod.buildWeatherCardCaption).toBeUndefined();
  });

  test('واژهٔ Open-Meteo از کارت حذف شد (خواستهٔ ۲۰ نوامبر: «کلمه open meteo حذف بشه»)', () => {
    const svg = makeWeatherCardSvg(cardInput());
    expect(svg).not.toContain('Open-Meteo');
    expect(svg).not.toContain('open-meteo');
    expect(svg).toContain('مدل‌های عددی جوّ'); // منبع بدون برند — گزارهٔ صادقانه باقی است
  });
});

// ---------- رندر واقعی (sharp + فونت وزیرمتن پروژه‌ای) ----------

describe('renderWeatherCardPng', () => {
  test('رندر واقعی PNG با ابعاد و حجم منطقی', async () => {
    const card = await renderWeatherCardPng(cardInput());
    expect(card).not.toBeNull();
    expect(card!.width).toBe(1080);
    expect(card!.height).toBeGreaterThan(1200);
    expect(card!.png.length).toBeGreaterThan(50_000);
    // امضای PNG
    const sig = Array.from(card!.png.slice(0, 8)).join(',');
    expect(sig).toBe('137,80,78,71,13,10,26,10');
  }, 30_000);

  test('بدون ساعت → null (ارسال کارت ساختگی ممنوع)', async () => {
    const card = await renderWeatherCardPng({ ...cardInput(), hours: [] });
    expect(card).toBeNull();
  });
});
