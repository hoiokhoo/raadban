/**
 * تست‌های اعلان‌های خودکار مدیر (خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶):
 * «اگر N چرخهٔ پیاپی شکست یا منبعی چند روز خاموش شد، یک پیام به چت مدیر».
 * پوشش: زنجیرهٔ شکست (آستانه/ضداسپم/ریست)، خاموشی منبع (آستانه/مهلت منبع تازه/بازگشت/هرس)،
 * و متن‌های اعلان.
 */
import { describe, expect, test } from 'bun:test';
import {
  updateFailStreak,
  updateSourceHealth,
  buildSilentSourcesText,
  buildFailStreakText,
  DAY_MS,
  type SourceStat,
  type SourceHealth,
  type AdminHealth,
} from '../bot/admin-alerts';

// ---------- زنجیرهٔ شکست چرخه‌ها ----------

describe('updateFailStreak — N چرخهٔ پیاپی شکست', () => {
  const t0 = new Date('2026-11-15T08:00:00.000Z');

  test('زیر آستانه اعلان نمی‌دهد؛ رسیدن به آستانه یک‌بار اعلان می‌دهد', () => {
    let h: AdminHealth | undefined;
    let r1 = updateFailStreak(h, true, t0, { threshold: 3 });
    h = r1.health;
    expect(h.failStreak).toBe(1);
    expect(r1.alert).toBeNull();
    const r2 = updateFailStreak(h, true, new Date(t0.getTime() + 6_000_000), { threshold: 3 });
    h = r2.health;
    expect(r2.alert).toBeNull();
    const r3 = updateFailStreak(h, true, new Date(t0.getTime() + 12_000_000), { threshold: 3 });
    expect(r3.health.failStreak).toBe(3);
    expect(r3.alert).not.toBeNull();
    expect(r3.alert!.streak).toBe(3);
    expect(r3.alert!.sinceIso).toBe(t0.toISOString()); // آغاز زنجیره یاد می‌ماند
  });

  test('ضداسپم: شکست پابرجا → اعلان مجدد فقط پس از ۲۴ ساعت', () => {
    let h: AdminHealth = { failStreak: 3, streakSince: '2026-11-15T06:00:00.000Z', streakAlertedAt: '2026-11-15T08:30:00.000Z' };
    const soon = updateFailStreak(h, true, new Date(Date.parse('2026-11-15T10:00:00.000Z')), { threshold: 3 });
    expect(soon.alert).toBeNull(); // ۱.۵ ساعت پس از اعلان — ضداسپم
    const later = updateFailStreak(soon.health, true, new Date(Date.parse('2026-11-16T09:00:00.000Z')), { threshold: 3 });
    expect(later.alert).not.toBeNull(); // بیش از ۲۴ ساعت — اعلان مجدد
    expect(later.health.failStreak).toBe(5);
  });

  test('یک موفقیت → ریست کامل زنجیره', () => {
    const h: AdminHealth = { failStreak: 7, streakSince: '2026-11-14T08:00:00.000Z', streakAlertedAt: '2026-11-15T08:00:00.000Z' };
    const r = updateFailStreak(h, false, new Date('2026-11-15T12:00:00.000Z'), { threshold: 3 });
    expect(r.health.failStreak).toBe(0);
    expect(r.health.streakSince).toBeUndefined();
    expect(r.health.streakAlertedAt).toBeUndefined();
    expect(r.alert).toBeNull();
  });
});

// ---------- خاموشی منابع ----------

describe('updateSourceHealth — منبع خاموش چندروزه', () => {
  const now = new Date('2026-11-15T08:00:00.000Z');

  test('منبع سالم → تاریخ تازه؛ منبع ناکام → تاریخ قبلی می‌ماند و پس از ۳ روز اعلان می‌شود', () => {
    const prior: SourceHealth = {
      lastOkAt: {
        'ایسنا': '2026-11-15T07:00:00.000Z',
        'مهر': '2026-11-11T08:00:00.000Z', // ۴ روز خاموش
      },
      alertedAt: {},
    };
    const stats: SourceStat[] = [
      { name: 'ایسنا', ok: true },
      { name: 'مهر', ok: false },
    ];
    const r = updateSourceHealth(prior, stats, now, { silentDays: 3 });
    expect(r.health.lastOkAt!['ایسنا']).toBe(now.toISOString()); // تازه شد
    expect(r.health.lastOkAt!['مهر']).toBe('2026-11-11T08:00:00.000Z'); // حفظ شد
    expect(r.alerts.length).toBe(1);
    expect(r.alerts[0]!.name).toBe('مهر');
    expect(r.alerts[0]!.silentDays).toBe(4);
  });

  test('ضداسپم: اعلان تکراری یک منبع تا ۳ روز بعد نمی‌آید', () => {
    const prior: SourceHealth = {
      lastOkAt: { 'مهر': '2026-11-11T08:00:00.000Z' },
      alertedAt: { 'مهر': '2026-11-14T08:00:00.000Z' }, // دیروز اعلان شده
    };
    const r = updateSourceHealth(prior, [{ name: 'مهر', ok: false }], now, { silentDays: 3, reAlertDays: 3 });
    expect(r.alerts.length).toBe(0);
  });

  test('منبع تازه (نخستین مشاهده) دورهٔ مهلت می‌گیرد — روز اول شمرده نمی‌شود', () => {
    const r = updateSourceHealth(undefined, [{ name: 'خبرگزاری تازه', ok: false }], now, { silentDays: 3 });
    expect(r.alerts.length).toBe(0);
    expect(r.health.lastOkAt!['خبرگزاری تازه']).toBe(now.toISOString());
  });

  test('بازگشت منبع → شمارش از صفر و مجوز اعلان بعدی', () => {
    const prior: SourceHealth = {
      lastOkAt: { 'مهر': '2026-11-11T08:00:00.000Z' },
      alertedAt: { 'مهر': '2026-11-14T08:00:00.000Z' },
    };
    const back = updateSourceHealth(prior, [{ name: 'مهر', ok: true }], now, { silentDays: 3 });
    expect(back.alerts.length).toBe(0);
    expect(back.health.lastOkAt!['مهر']).toBe(now.toISOString());
    expect(back.health.alertedAt!['مهر']).toBeUndefined(); // پاک شد
    // دوباره خاموش شود → از الان شمرده می‌شود، نه از تاریخ قدیم
    const again = updateSourceHealth(back.health, [{ name: 'مهر', ok: false }], new Date(now.getTime() + DAY_MS), { silentDays: 3 });
    expect(again.alerts.length).toBe(0); // فقط ۱ روز — زیر آستانه
  });

  test('منبع حذف‌شده از فهرست، هرس می‌شود', () => {
    const prior: SourceHealth = { lastOkAt: { 'کهنه': '2026-11-01T00:00:00.000Z', 'ایسنا': '2026-11-15T07:00:00.000Z' } };
    const r = updateSourceHealth(prior, [{ name: 'ایسنا', ok: true }], now, { silentDays: 3 });
    expect(r.health.lastOkAt!['کهنه']).toBeUndefined();
    expect(r.health.lastOkAt!['ایسنا']).toBeDefined();
  });

  test('همهٔ منابع خاموش → همه اعلان می‌شوند (پیام واحد جمعی)', () => {
    const prior: SourceHealth = {
      lastOkAt: { 'الف': '2026-11-10T08:00:00.000Z', 'ب': '2026-11-09T08:00:00.000Z' },
      alertedAt: {},
    };
    const r = updateSourceHealth(prior, [{ name: 'الف', ok: false }, { name: 'ب', ok: false }], now, { silentDays: 3 });
    expect(r.alerts.length).toBe(2);
  });
});

// ---------- متن اعلان ----------

describe('متن اعلان‌های مدیر — فارسی و HTML-امن', () => {
  test('متن منبع خاموش — نام، روزها، آخرین خروجی', () => {
    const t = buildSilentSourcesText(
      [{ name: 'مهر <تست>', lastOkAt: '2026-11-11T08:00:00.000Z', silentDays: 4 }],
      'شنبه ۲۴ آبان ۱۴۰۵'
    );
    expect(t).toContain('<b>⚠️');
    expect(t).toContain('مهر &lt;تست&gt;'); // escape
    expect(t).toContain('۴ روز خاموشی');
    expect(t).toContain('2026-11-11');
    expect(t).toContain('اعلان خودکار مدیر');
  });

  test('متن زنجیرهٔ شکست — شمار چرخه و علت', () => {
    const t = buildFailStreakText({ streak: 4, sinceIso: '2026-11-15T06:00:00.000Z' }, 'شنبه ۲۴ آبان ۱۴۰۵', 'زنجیرهٔ هوش مصنوعی پاسخ معتبر نداد');
    expect(t).toContain('۴ چرخهٔ پیاپی ناموفق');
    expect(t).toContain('2026-11-15');
    expect(t).toContain('هوش مصنوعی');
  });
});
