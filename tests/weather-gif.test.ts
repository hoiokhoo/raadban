/**
 * تست‌های گیف متحرک وضعیت غالب هواشناسی — خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «گیف هم به اون بخش اضافه کن». پوشش: وضعیت غالب (تکرار شکل آیکن)، برچسب فارسی،
 * فریم‌های SVG برداری (بدون NaN، شکل هر وضعیت)، رندر واقعی GIF متحرک با sharp+gifenc.
 */
import { describe, expect, test } from 'bun:test';
import {
  dominantKindOf,
  KIND_LABELS,
  makeWeatherGifFrameSvg,
  renderWeatherGif,
  buildWeatherGifCaption,
  GIF_FRAMES,
  GIF_SIZE,
} from '../bot/weather-gif';
import type { HourlyEntry } from '../bot/weather';

function hoursWith(codes: number[]): HourlyEntry[] {
  return codes.map((code, i) => ({
    time: `2026-11-16T${String(i).padStart(2, '0')}:00`,
    hhmm: `${String(i).padStart(2, '0')}:00`,
    temp: 10,
    feels: 9,
    precipProb: 0,
    windKmh: 5,
    code,
  }));
}

describe('dominantKindOf — وضعیت غالب روز', () => {
  test('بیشترین تکرار شکل برنده است — بارانی', () => {
    const codes = [...Array(10).fill(63), ...Array(9).fill(0), ...Array(5).fill(3)];
    const dom = dominantKindOf(hoursWith(codes));
    expect(dom?.kind).toBe('rain'); // ۱۰ بارانی در برابر ۹ آفتابی و ۵ ابری
    expect(dom?.label).toBe('بارانی');
  });

  test('روز آفتابی خالص', () => {
    const dom = dominantKindOf(hoursWith(Array(24).fill(0)));
    expect(dom?.kind).toBe('sun');
    expect(dom?.label).toBe('آفتابی');
  });

  test('روز برفی', () => {
    const dom = dominantKindOf(hoursWith([...Array(10).fill(73), ...Array(9).fill(0), ...Array(5).fill(3)]));
    expect(dom?.kind).toBe('snow'); // ۱۰ برفی در برابر ۹ آفتابی و ۵ ابری
    expect(dom?.label).toBe('برفی');
  });

  test('ورودی خالی → null (هیچ وضعیت ساختگی)', () => {
    expect(dominantKindOf([])).toBeNull();
    expect(dominantKindOf(undefined as unknown as HourlyEntry[])).toBeNull();
  });

  test('همهٔ شکل‌ها برچسب فارسی دارند', () => {
    for (const k of ['sun', 'sun-cloud', 'cloud', 'rain', 'snow', 'storm', 'moon']) {
      expect(typeof KIND_LABELS[k]).toBe('string');
      expect(KIND_LABELS[k].length).toBeGreaterThan(1);
    }
  });
});

describe('makeWeatherGifFrameSvg — فریم برداری', () => {
  test('هر وضعیت برای هر فریم SVG معتبر می‌سازد — بدون NaN/undefined', () => {
    for (const kind of ['sun', 'sun-cloud', 'cloud', 'moon', 'rain', 'snow', 'storm', 'unknown-kind']) {
      for (const i of [0, 5, GIF_FRAMES - 1]) {
        const svg = makeWeatherGifFrameSvg(kind, i);
        expect(svg.length).toBeGreaterThan(300);
        expect(svg).toContain('<svg');
        expect(svg).not.toContain('NaN');
        expect(svg).not.toContain('undefined');
        expect(svg).toContain(`width="${GIF_SIZE}"`);
      }
    }
  });

  test('فریم‌های متفاوتند — انیمیشن واقعی است نه فریم ثابت', () => {
    const a = makeWeatherGifFrameSvg('sun', 0);
    const b = makeWeatherGifFrameSvg('sun', 3);
    expect(a).not.toBe(b);
  });

  test('هیچ متن در گیف نیست — بدون وابستگی فونت', () => {
    for (const kind of ['sun', 'rain', 'storm']) {
      expect(makeWeatherGifFrameSvg(kind, 0)).not.toContain('<text');
    }
  });
});

describe('buildWeatherGifCaption — کپشن', () => {
  test('شهر + برچسب وضعیت + دما با ارقام فارسی، زیر سقف بله', () => {
    const cap = buildWeatherGifCaption('تهران', { kind: 'rain', label: 'بارانی' }, { minT: 6, maxT: 17 });
    expect(cap).toContain('تهران');
    expect(cap).toContain('بارانی');
    expect(cap).toContain('۶°');
    expect(cap).toContain('۱۷°');
    expect(cap.length).toBeLessThanOrEqual(1024);
  });

  test('بدون دما هم کپشن کامل می‌شود', () => {
    const cap = buildWeatherGifCaption('خوانسار', { kind: 'snow', label: 'برفی' });
    expect(cap).toContain('خوانسار');
    expect(cap).not.toContain('کمینه');
  });
});

// ---------- رندر واقعی GIF (sharp + gifenc) ----------

describe('renderWeatherGif — رندر واقعی', () => {
  test('GIF متحرک ۴۸۰×۴۸۰ با امضای درست — یک وضعیت نمونه', async () => {
    const g = await renderWeatherGif('rain');
    expect(g).not.toBeNull();
    expect(g!.width).toBe(GIF_SIZE);
    expect(g!.height).toBe(GIF_SIZE);
    expect(g!.gif.slice(0, 3).toString('latin1')).toBe('GIF');
    expect(g!.gif.length).toBeGreaterThan(10_000);
    // پس‌زمینهٔ تیرهٔ گرادیانی → میانهٔ روشنایی پایین (خوانا در کانال تیره)
  }, 60_000);

  test('هر وضعیت رندر می‌شود — هیچ‌کدام null نیست', async () => {
    for (const kind of ['sun', 'cloud', 'snow', 'storm', 'moon', 'sun-cloud']) {
      const g = await renderWeatherGif(kind);
      expect(g).not.toBeNull();
      expect(g!.gif.length).toBeGreaterThan(3_000);
    }
  }, 120_000);
});
