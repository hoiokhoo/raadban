/**
 * تست‌های یکپارچه نسخه ۱٫۱ — کانال‌های خوانش، رویدادهای پیش رو، ترجمه
 * پیش‌نیاز: سرور dev روی پورت 3000 (مثل tests/integration.test.ts)
 * اجرا: bun test tests/v11-integration.test.ts
 */
import { describe, test, expect, afterAll } from 'bun:test';

const BASE = 'http://localhost:3000';

async function api(path: string, method = 'GET', body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* HTML */ }
  return { status: res.status, data };
}

// پاکسازی: کانال‌های ساخته‌شده در تست نباید در DB واقعی بمانند
const createdChannels: string[] = [];
afterAll(async () => {
  for (const id of createdChannels) {
    await api(`/api/channels/${id}`, 'DELETE');
  }
});

describe('خوانش کانال‌ها — API', () => {
  test('فهرست کانال‌ها پاسخ معتبر می‌دهد', async () => {
    const r = await api('/api/channels');
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
    expect(Array.isArray(r.data.channels)).toBe(true);
  });

  test('شناسه نامعتبر کانال رد می‌شود', async () => {
    const r = await api('/api/channels', 'POST', { platform: 'telegram', identifier: 'نام غلط با فاصله!' });
    expect([422, 409]).toContain(r.status);
    expect(r.data.ok).toBe(false);
  });

  test('پلتفرم غیرفعال در خوانش رد می‌شود', async () => {
    const r = await api('/api/channels', 'POST', { platform: 'twitter', identifier: 'validname' });
    expect([409, 422]).toContain(r.status);
    expect(r.data.ok).toBe(false);
    // پیام خطا یا از اعتبارسنجی پلتفرم‌های مجاز است یا از بررسی اتصال‌دهنده
    const err = String(r.data.error);
    expect(err.includes('eitaa') || err.includes('پیاده‌سازی')).toBe(true);
  });

  test('کانال ناشناخته بدون دسترسی واقعی ثبت نمی‌شود (صداقت)', async () => {
    const r = await api('/api/channels', 'POST', { platform: 'telegram', identifier: `no_such_ch_${Date.now() % 100000}` });
    // انتظار: خطای صادقانه دریافت (کانال وجود ندارد یا پیش‌نمایش وب ندارد)
    expect([502, 409, 422]).toContain(r.status);
    expect(r.data.ok).toBe(false);
  });

  test('پیام ناموجود — راستی‌آزمایی خطای صریح می‌دهد', async () => {
    const r = await api('/api/messages/nonexistent_id/factcheck', 'POST');
    expect(r.status).toBe(404);
    expect(r.data.ok).toBe(false);
  });

  test('حذف کانال ناموجود ۴۰۴ می‌دهد', async () => {
    const r = await api('/api/channels/nonexistent_id', 'DELETE');
    expect(r.status).toBe(404);
  });
});

describe('رویدادهای پیش رو — API', () => {
  test('فهرست رویدادها با داده مستند seed پاسخ می‌دهد', async () => {
    const r = await api('/api/events');
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
    const events = r.data.events as Array<Record<string, unknown>>;
    expect(events.length).toBeGreaterThanOrEqual(5);

    const slugs = events.map((e) => e.slug);
    expect(slugs).toContain('us-midterms-2026');
    expect(slugs).toContain('cop31-antalya-2026');
    expect(slugs).toContain('g20-miami-2026');

    const midterms = events.find((e) => e.slug === 'us-midterms-2026');
    expect(midterms?.eventDateISO).toBe('2026-11-03');
    // نظرسنجی مستند: CNN ۵۲/۴۳
    const polls = JSON.parse(String(midterms?.pollsJson || '[]'));
    expect(polls.length).toBeGreaterThanOrEqual(2);
    expect(polls.some((p: { value: number }) => p.value === 52)).toBe(true);
    expect(polls.some((p: { value: number }) => p.value === 43)).toBe(true);
    // منابع ذخیره شده
    const sources = JSON.parse(String(midterms?.sourcesJson || '[]'));
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(midterms?.daysUntil).toBeTypeOf('number');
  });

  test('کنست اسرائیل صادقانه نامشخص است', async () => {
    const r = await api('/api/events');
    const events = r.data.events as Array<Record<string, unknown>>;
    const israel = events.find((e) => e.slug === 'israel-knesset-next');
    expect(israel).toBeTruthy();
    expect(israel?.dateCertainty).toBe('نامشخص');
    expect(israel?.eventDateISO).toBe(null);
  });

  test('تحلیل AI رویداد ناموجود ۴۰۴ می‌دهد', async () => {
    const r = await api('/api/events/nonexistent_id/analyze', 'POST');
    expect(r.status).toBe(404);
  });
});
