/**
 * تست‌های واحد نسخه ۱٫۱ — سه‌تقویم، سگمنت‌سازی راستی‌آزمایی پیام، ترجمه
 * اجرا: bun test tests/v11-features.test.ts
 */
import { describe, test, expect } from 'bun:test';
import { hijriDisplay, gregorianDisplay, tripleDateInline, tripleDateParts, jalaliDisplay } from '../src/lib/persian';
import { buildSegments, normWithMap, normalizeVerdict } from '../src/lib/factcheck/segments';
import { isLikelyForeign } from '../src/lib/translate';

describe('سه‌تقویم — شمسی + قمری + میلادی', () => {
  test('تاریخ میلادی قطعی، شمسی درست را می‌دهد', () => {
    // ۳ نوامبر ۲۰۲۶ = ۱۲ آبان ۱۴۰۵
    const s = jalaliDisplay('2026-11-03T00:00:00Z');
    expect(s).toContain('۱۴۰۵');
    expect(s).toContain('آبان');
  });
  test('قمری از تقویم ام‌القری با ماه معروف است', () => {
    const h = hijriDisplay('2026-12-14T00:00:00Z'); // G20 میامی
    expect(h).toMatch(/۱۴۴۸|1448/);
    // دی و رجب هم‌زمان‌اند — نام ماه قمری باید یکی از ماه‌های شناخته‌شده باشد
    const months = ['محرم', 'صفر', 'ربیع', 'جمادی', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذی'];
    expect(months.some((m) => h.includes(m))).toBe(true);
  });
  test('میلادی فارسی سال ۲۰۲۶ را نشان می‌دهد', () => {
    expect(gregorianDisplay('2026-11-03T00:00:00Z')).toMatch(/۲۰۲۶|2026/);
  });
  test('سه‌تقویم یک‌خطی هر سه تقویم را دارد', () => {
    const t = tripleDateInline('2026-11-03T00:00:00Z');
    expect(t).toContain('۱۴۰۵');
    expect(t).toContain('۱۴۴۸');
    expect(t).toContain('۲۰۲۶');
  });
  test('اجزای سه‌تقویم ساختار کامل دارند', () => {
    const p = tripleDateParts(new Date());
    expect(p.shamsi.length).toBeGreaterThan(3);
    expect(p.qamari.length).toBeGreaterThan(3);
    expect(p.miladi.length).toBeGreaterThan(3);
  });
});

describe('سگمنت‌سازی راستی‌آزمایی پیام', () => {
  test('نرمال‌سازی با نگاشت: فاصله‌های اضافی و نیم‌فاصله', () => {
    const { norm, map } = normWithMap('سلام   دنیای زیبا');
    expect(norm).toBe('سلام دنیای زیبا');
    expect(map.length).toBe(norm.length);
    expect(map[0]).toBe(0);
    expect(map[map.length - 1]).toBe(16); // آخرین نویسه «ا» در اندیس ۱۶ متن خام
  });
  test('quote عین متن، برش دقیق از متن اصلی می‌دهد', () => {
    const text = 'بانک مرکزی نرخ دلار را ۵۸ هزار تومان اعلام کرد. این در حالی است که بازار معاملاتی بود.';
    const r = buildSegments(text, [
      { quote: 'نرخ دلار را ۵۸ هزار تومان اعلام کرد', verdict: 'درست', explanation: 'مطابق داده‌های رسمی', basis: 'دانش مدل' },
    ]);
    expect(r.missingQuotes.length).toBe(0);
    expect(r.segments.length).toBe(3);
    expect(r.segments[0].verdict).toBe('خنثی');
    expect(r.segments[1].verdict).toBe('درست');
    expect(r.segments[1].text).toBe('نرخ دلار را ۵۸ هزار تومان اعلام کرد');
    expect(r.segments[2].verdict).toBe('خنثی');
  });
  test('چند quote بدون همپوشانی، ترتیب حفظ می‌شود', () => {
    const text = 'جمله اول اینجا است. جمله دوم بعدی است. جمله سوم پایانی است.';
    const r = buildSegments(text, [
      { quote: 'جمله دوم بعدی است', verdict: 'نادرست' },
      { quote: 'جمله اول اینجا است', verdict: 'درست' },
    ]);
    expect(r.missingQuotes.length).toBe(0);
    const verdicts = r.segments.filter((s) => s.verdict !== 'خنثی').map((s) => s.verdict);
    expect(verdicts).toEqual(['درست', 'نادرست']);
  });
  test('همپوشانی quoteها — بلندتر اولویت می‌گیرد', () => {
    const text = 'نرخ دلار ۵۸ هزار تومان اعلام شد امروز';
    const r = buildSegments(text, [
      { quote: 'نرخ دلار ۵۸ هزار تومان اعلام شد امروز', verdict: 'گمراه‌کننده' },
      { quote: 'نرخ دلار ۵۸ هزار تومان', verdict: 'درست' },
    ]);
    const marked = r.segments.filter((s) => s.verdict !== 'خنثی');
    expect(marked.length).toBe(1);
    expect(marked[0].verdict).toBe('گمراه‌کننده');
  });
  test('quote ناموجود به missing می‌رود و متن بی‌رنگ می‌ماند', () => {
    const text = 'این متن اصلی پیام است.';
    const r = buildSegments(text, [{ quote: 'این عبارت در متن نیست', verdict: 'درست' }]);
    expect(r.missingQuotes.length).toBe(1);
    expect(r.segments.length).toBe(1);
    expect(r.segments[0].verdict).toBe('خنثی');
    expect(r.segments[0].text).toBe(text);
  });
  test('نرمال‌سازی نیم‌فاصله در تطبیق اعمال می‌شود', () => {
    const text = 'می‌رویم به بازار';
    const r = buildSegments(text, [{ quote: 'میرویم به بازار', verdict: 'درست' }]);
    // quote بدون نیم‌فاصله هم باید پیدا شود (نیم‌فاصله در نرمال‌سازی حذف می‌شود)
    expect(r.missingQuotes.length).toBe(0);
    expect(r.segments.length).toBe(1);
    expect(r.segments[0].verdict).toBe('درست');
  });
  test('نام‌های متفاوت حکم نرمال می‌شوند', () => {
    expect(normalizeVerdict('دروغ')).toBe('نادرست');
    expect(normalizeVerdict('تاییدناپذیر')).toBe('تأییدناپذیر');
    expect(normalizeVerdict('چیز عجیب')).toBe('تأییدناپذیر');
  });
});

describe('تشخیص زبان برای ترجمه', () => {
  test('متن انگلیسی خارجی تشخیص داده می‌شود', () => {
    expect(isLikelyForeign('The Federal Reserve announced new interest rates today in Washington.')).toBe(true);
  });
  test('متن فارسی خارجی نیست', () => {
    expect(isLikelyForeign('بانک مرکزی نرخ بهره را اعلام کرد و بازار واکنش نشان داد.')).toBe(false);
  });
  test('متن چینی خارجی تشخیص داده می‌شود', () => {
    expect(isLikelyForeign('中国人民银行今天宣布了新的利率政策。')).toBe(true);
  });
});
