/**
 * تست‌های یکپارچه — سناریوهای پذیرش فصل ۱۴ سند مأموریت
 * پیش‌نیاز: سرور dev روی پورت 3000 و پایگاه داده seed شده
 * اجرا: bun test tests/integration.test.ts
 */
import { describe, test, expect } from 'bun:test';

const BASE = 'http://localhost:3000';

async function api(path: string, method = 'GET', body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* صفحه HTML */ }
  return { status: res.status, data };
}

describe('منابع — افزودن، تکراری، ویرایش، حذف', () => {
  test('افزودن منبع جدید موفق', async () => {
    const id = `test_src_${Date.now() % 100000}`;
    const r = await api('/api/sources', 'POST', {
      name: 'منبع تست یکپارچه', platform: 'telegram', identifier: id,
      categoryIds: [],
    });
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
    // پاکسازی — تست نباید منبع باقی بگذارد
    const s = r.data as { sourceId?: string };
    if (s.sourceId) await api(`/api/sources/manage?id=${s.sourceId}`, 'DELETE');
  });

  test('بررسی تکراری بودن پیش از ثبت — رد می‌شود', async () => {
    // خودکفا: ابتدا منبع جدید می‌سازیم، سپس ثبت دوباره همان شناسه باید ۴۰۹ بدهد
    const id = `dup_test_${Date.now() % 1000000}`;
    const c1 = await api('/api/sources', 'POST', { name: 'منبع تست تکرار', platform: 'telegram', identifier: id });
    expect(c1.status).toBe(200);
    const c2 = await api('/api/sources', 'POST', { name: 'منبع تست تکرار دوباره', platform: 'telegram', identifier: id });
    expect(c2.status).toBe(409);
    expect(String(c2.data.error)).toContain('قبلاً');
    // پاکسازی
    const s = c1.data as { sourceId?: string };
    if (s.sourceId) await api(`/api/sources/manage?id=${s.sourceId}`, 'DELETE');
  });

  test('شناسه نامعتبر رد می‌شود', async () => {
    const r = await api('/api/sources', 'POST', { name: 'تست', platform: 'telegram', identifier: 'نام غلط با فاصله' });
    expect(r.status).toBe(409);
  });

  test('ورودی نامعتبر (نام کوتاه) رد می‌شود', async () => {
    const r = await api('/api/sources', 'POST', { name: 'ت', platform: 'telegram', identifier: 'abc_test' });
    expect(r.status).toBe(422);
  });
});

describe('حفاظت از کلید API (فصل ۱۴)', () => {
  test('ذخیره کلید — پاسخ حاوی کلید واقعی نیست', async () => {
    const r = await api('/api/settings', 'POST', { apiKey: 'sk-super-secret-key-1234567890' });
    expect(r.status).toBe(200);
    const raw = JSON.stringify(r.data);
    expect(raw).not.toContain('sk-super-secret-key-1234567890');
    const g = await api('/api/settings');
    const gRaw = JSON.stringify(g.data);
    expect(gRaw).not.toContain('sk-super-secret-key-1234567890');
    expect((g.data.apiKey as { exists: boolean }).exists).toBe(true);
  });

  test('حذف کلید', async () => {
    await api('/api/settings', 'POST', { clearApiKey: true });
    const g = await api('/api/settings');
    expect((g.data.apiKey as { exists: boolean }).exists).toBe(false);
  });
});

describe('گزارش‌ها — جلوگیری از تکرار و وضعیت', () => {
  test('تولید دوباره همان روز بدون force، گزارش جدید نمی‌سازد (skipped)', async () => {
    const g1 = await api('/api/reports/generate', 'POST', {});
    const r1 = g1.data as { ok: boolean; reportId?: string; skipped?: boolean };
    const g2 = await api('/api/reports/generate', 'POST', {});
    const r2 = g2.data as { ok: boolean; reportId?: string; skipped?: boolean };
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r2.reportId).toBe(r1.reportId);
  }, 300000); // تولید اولین گزارش ممکن است مدل را فراخوانی کند

  test('تاریخ نامعتبر رد می‌شود', async () => {
    const r = await api('/api/reports/generate', 'POST', { date: 'not-a-date' });
    expect(r.status).toBe(422);
  });
});

describe('امنیت — SSRF در جریان واقعی', () => {
  test('منبع با نشانی داخلی در دریافت خطای صریح امنیتی می‌دهد', async () => {
    // ساخت منبع rss با آدرس داخلی
    const c = await api('/api/sources', 'POST', { name: 'تست SSRF', platform: 'rss', identifier: 'http://127.0.0.1:3000/api/status' });
    const srcId = (c.data as { sourceId?: string }).sourceId as string;
    expect(srcId).toBeTruthy();
    const f = await api('/api/sources/fetch', 'POST', { sourceId: srcId });
    const res = (f.data as { results: Array<{ ok: boolean; error?: string }> }).results[0];
    expect(res.ok).toBe(false);
    expect(String(res.error)).toContain('SSRF');
    // پاکسازی
    await api(`/api/sources/manage?id=${srcId}`, 'DELETE');
  });
});

describe('زمان‌بندی و سوابق', () => {
  test('ذخیره زمان‌بندی با ساعت نامعتبر رد می‌شود', async () => {
    const r = await api('/api/schedule', 'POST', { reportTime: '25:99', activeDays: [0] });
    expect(r.status).toBe(422);
  });
  test('ذخیره زمان‌بندی معتبر موفق', async () => {
    const r = await api('/api/schedule', 'POST', { reportTime: '22:30', activeDays: [0, 1, 2, 3, 4, 5, 6], catchUp: true });
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
  });
  test('سوابق وظایف ثبت می‌شوند', async () => {
    const r = await api('/api/jobs');
    const jobs = r.data.jobs as Array<Record<string, unknown>>;
    expect(jobs.length).toBeGreaterThan(0);
  });
});

describe('جست‌وجو و راستی‌آزمایی', () => {
  test('جست‌وجوی عبارت کوتاه رد می‌شود', async () => {
    const r = await api('/api/search?q=د');
    expect(r.status).toBe(422);
  });
  test('جست‌وجوی واقعی نتیجه برمی‌گرداند', async () => {
    // خودکفا: یک مطلب دستی با عبارت مشخص وارد می‌شود، سپس همان عبارت جست‌وجو می‌شود
    const marker = `دلار تومان بازارسنجی-${Date.now() % 1000000}`;
    const m = await api('/api/posts/manual', 'POST', {
      content: `${marker} — نرخ دلار در بازار آزاد امروز گزارش شد؛ این متن صرفاً برای آزمون یکپارچه جست‌وجوی سامانه وارد شده است و ادعای واقعی نیست.`,
    });
    expect(m.status).toBe(200);
    const r = await api('/api/search?q=' + encodeURIComponent('دلار تومان'));
    expect(r.status).toBe(200);
    const posts = r.data.posts as unknown[];
    expect(posts.length).toBeGreaterThan(0);
  });
  test('فهرست ادعاها با وضعیت کار می‌کند', async () => {
    const r = await api('/api/claims?status=' + encodeURIComponent('تأییدنشده'));
    expect(r.status).toBe(200);
  });
});

describe('صادق بودن — پلتفرم‌های پشتیبانی‌نشده', () => {
  test('کاتالوگ اتصال‌دهنده‌ها وضعیت واقعی دارد', async () => {
    const r = await api('/api/errors');
    const catalog = r.data.connectorCatalog as Array<{ key: string; implemented: boolean; limits: string }>;
    // توییتر و تروث سوشال اکنون پیاده‌سازی واقعی دارند (سندیکاسیون ایکس / API عمومی)
    const tw = catalog.find((c) => c.key === 'twitter');
    const ts = catalog.find((c) => c.key === 'truthsocial');
    expect(tw?.implemented).toBe(true);
    expect(ts?.implemented).toBe(true);
    // پلتفرم‌های بی‌پیاده‌سازی همچنان صادقانه اعلام می‌شوند
    const notImpl = catalog.filter((c) => !c.implemented);
    expect(notImpl.length).toBeGreaterThan(0);
  });
});
