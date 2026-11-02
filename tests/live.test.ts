/**
 * تست منطق خالص خط لحظه‌ای اخبار (تب «اخبار لحظه‌ای» مستقل از بله)
 */
import { describe, expect, test } from 'bun:test';
import {
  summarizeClaims, verdictBadge, scopeOf, faRelative, displayTitle, clampTake,
  type ClaimSummary,
} from '../src/lib/live';

describe('summarizeClaims — خلاصهٔ وضعیت ادعاها', () => {
  test('بدون ادعا → null', () => {
    expect(summarizeClaims([])).toBeNull();
  });

  test('ادعای تأییدشده', () => {
    const s = summarizeClaims(['تأییدشده_با_شواهد_کافی'])!;
    expect(s.verified).toBe(1);
    expect(s.total).toBe(1);
  });

  test('عمدتاً تأییدشده هم تأیید حساب می‌شود', () => {
    expect(summarizeClaims(['عمدتاً_تأییدشده'])!.verified).toBe(1);
  });

  test('ردشده و گمراه‌کننده در سطل ردشده', () => {
    const s = summarizeClaims(['ردشده_با_شواهد_کافی', 'گمراه‌کننده'])!;
    expect(s.refuted).toBe(2);
  });

  test('تأییدنشده/مورد اختلاف/منسوخ در سطل مورد شک', () => {
    const s = summarizeClaims(['تأییدنشده', 'مورد_اختلاف', 'منسوخ_یا_اصلاح‌شده'])!;
    expect(s.disputed).toBe(3);
  });

  test('در انتظار بررسی → pending', () => {
    const s = summarizeClaims(['در_انتظار_بررسی', 'وضعیت_ناشناخته'])!;
    expect(s.pending).toBe(2);
    expect(s.verified + s.disputed + s.refuted).toBe(0);
  });
});

describe('verdictBadge — برچسب جمع‌بندی', () => {
  test('null بدون ادعا', () => {
    expect(verdictBadge(null)).toBeNull();
    expect(verdictBadge({ verified: 0, disputed: 0, refuted: 0, pending: 0, total: 0 })).toBeNull();
  });

  test('ردشده اولویت دارد (بدترین وضعیت برنده است)', () => {
    const s: ClaimSummary = { verified: 2, disputed: 1, refuted: 1, pending: 0, total: 4 };
    expect(verdictBadge(s)!.label).toContain('ردشده');
  });

  test('مورد شک بعد از ردشده', () => {
    const s: ClaimSummary = { verified: 1, disputed: 2, refuted: 0, pending: 0, total: 3 };
    expect(verdictBadge(s)!.label).toContain('مورد شک');
  });

  test('تأیید شد وقتی فقط تأیید باشد', () => {
    const s: ClaimSummary = { verified: 1, disputed: 0, refuted: 0, pending: 0, total: 1 };
    expect(verdictBadge(s)!.label).toContain('تأیید');
  });

  test('فقط در انتظار بررسی → بدون برچسب (کاهش نویز)', () => {
    const s: ClaimSummary = { verified: 0, disputed: 0, refuted: 0, pending: 3, total: 3 };
    expect(verdictBadge(s)).toBeNull();
  });
});

describe('scopeOf — داخلی/خارجی', () => {
  test('ایران → داخلی', () => {
    expect(scopeOf('ایران')).toBe('داخلی');
  });
  test('آمریکا/اسرائیل/چین → خارجی', () => {
    for (const r of ['آمریکا', 'اسرائیل', 'چین', 'بریتانیا']) expect(scopeOf(r)).toBe('خارجی');
  });
  test('بدون منبع', () => {
    expect(scopeOf(null)).toBe('بدون منبع');
    expect(scopeOf('')).toBe('بدون منبع');
  });
});

describe('faRelative — زمان نسبی فارسی', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  test('کمتر از یک دقیقه → همین حالا', () => {
    expect(faRelative(new Date(now.getTime() - 30_000).toISOString(), now)).toBe('همین حالا');
  });
  test('آینده → همین حالا (اختلاف ساعت سرور)', () => {
    expect(faRelative(new Date(now.getTime() + 20_000).toISOString(), now)).toBe('همین حالا');
  });
  test('دقیقه با رقم فارسی', () => {
    expect(faRelative(new Date(now.getTime() - 12 * 60_000).toISOString(), now)).toBe('۱۲ دقیقه پیش');
  });
  test('ساعت', () => {
    expect(faRelative(new Date(now.getTime() - 3 * 3600_000).toISOString(), now)).toBe('۳ ساعت پیش');
  });
  test('روز', () => {
    expect(faRelative(new Date(now.getTime() - 5 * 86400_000).toISOString(), now)).toBe('۵ روز پیش');
  });
  test('نامعتبر و تهی → —', () => {
    expect(faRelative(null)).toBe('—');
    expect(faRelative('not-a-date')).toBe('—');
  });
});

describe('displayTitle — عنوان نمایشی', () => {
  test('ترجمهٔ فارسی مقدم است', () => {
    expect(displayTitle({ translationFa: 'ترجمه', normalized: 'نرمال', content: 'خام' })).toBe('ترجمه');
  });
  test('بدون ترجمه → نرمال، بدون نرمال → خام', () => {
    expect(displayTitle({ translationFa: null, normalized: 'نرمال', content: 'خام' })).toBe('نرمال');
    expect(displayTitle({ translationFa: null, normalized: null, content: 'خام' })).toBe('خام');
  });
  test('فاصله‌های تکراری جمع و سقف ۴۰۰ نویسه با سه‌نقطه', () => {
    const long = 'الف '.repeat(200); // ۸۰۰ نویسه
    const t = displayTitle({ translationFa: null, normalized: long, content: long });
    expect(t.length).toBeLessThanOrEqual(401);
    expect(t.endsWith('…')).toBe(true);
  });
  test('خط فاصلهٔ فارسی وسط کلمه حفظ می‌شود (نیم‌فاصله)', () => {
    expect(displayTitle({ translationFa: null, normalized: 'رصد‌بان خوب است', content: 'x' })).toBe('رصد‌بان خوب است');
  });
});

describe('clampTake — سقف و پیش‌فرض', () => {
  test('پیش‌فرض ۶۰ و سقف ۱۰۰', () => {
    expect(clampTake(null)).toBe(60);
    expect(clampTake('')).toBe(60);
    expect(clampTake('نامعتبر')).toBe(60);
    expect(clampTake('250')).toBe(100);
    expect(clampTake('25')).toBe(25);
    expect(clampTake('12.9')).toBe(12);
    expect(clampTake('-5')).toBe(60);
  });
});
