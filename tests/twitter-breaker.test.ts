/**
 * تست‌های واحد مدارشکن توییتر — نسخهٔ تطبیقی (۲ نوامبر ۲۰۲۶)
 * رفتار قفل‌شده: بودجهٔ ۱ حساب در پنجرهٔ ۹۰ ثانیه‌ای، خنکی تطبیقی پس از 429
 * (پایهٔ ۲۰ دقیقه؛ هر 429 پیاپی دوبرابر، سقف ۹۰ دقیقه).
 * برای سرعت و قطعیت، وضعیت پنجره مستقیم دستکاری می‌شود (بدون مکث‌های واقعی).
 */
import { describe, test, expect, beforeEach } from 'bun:test';
import { twitterGate, resetTwitterGateForTests, triggerTwitterCooldownForTests } from '@/lib/ingest';

const TW = globalThis as unknown as { __twWindowStart?: number; __twWindowUsed?: number; __tw429Streak?: number; __twCooldownUntil?: number };

describe('مدارشکن توییتر', () => {
  beforeEach(() => resetTwitterGateForTests());

  test('درخواست اول در پنجرهٔ تازه مجاز است', async () => {
    expect(await twitterGate()).toBeNull();
  });

  test('درخواست دوم در همان پنجره پرش صادقانه است (بودجهٔ ۱ در ۹۰ ثانیه)', async () => {
    TW.__twWindowStart = Date.now();
    TW.__twWindowUsed = 1;
    const msg = await twitterGate();
    expect(msg).toContain('حداکثر ۱ حساب');
    expect(msg).toContain('۹۰ ثانیه');
  });

  test('پنجرهٔ تازه بودجه را دوباره می‌دهد', async () => {
    TW.__twWindowStart = Date.now() - 91_000; // پنجرهٔ منقضی
    TW.__twWindowUsed = 1;
    expect(await twitterGate()).toBeNull();
  });

  test('پس از 429 همهٔ حساب‌ها خنک می‌شوند — حتی درخواست اول', async () => {
    triggerTwitterCooldownForTests();
    const msg = await twitterGate();
    expect(msg).toContain('مدارشکن ایکس فعال');
    expect(msg).toContain('دقیقه');
  });

  test('خنکی پایهٔ ۲۰ دقیقه است و پیام دقیقهٔ باقی‌مانده را می‌گوید', async () => {
    triggerTwitterCooldownForTests();
    const msg = (await twitterGate()) || '';
    const m = msg.match(/(\d+) دقیقه/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(0);
    expect(Number(m![1])).toBeLessThanOrEqual(20);
  });

  test('خنکی تطبیقی: هر 429 پیاپی دوبرابر تا سقف ۹۰ دقیقه', async () => {
    // شبیه‌سازی سه 429 پیاپی از راه گیتِ فعال‌سازی دستی + شبیه‌سازی زنجیره
    triggerTwitterCooldownForTests(); // streak=1 → ۴۰ دقیقه بعدی
    TW.__twCooldownUntil = 0; // فقط برای اندازه‌گیری خنکی بعدی بدون انتظار
    triggerTwitterCooldownForTests(); // streak=2 → ۸۰ دقیقه
    TW.__twCooldownUntil = 0;
    triggerTwitterCooldownForTests(); // streak=3 → سقف ۹۰ دقیقه
    TW.__twCooldownUntil = 0;
    triggerTwitterCooldownForTests(); // streak=4 → همچنان سقف ۹۰ دقیقه
    const left = (TW.__twCooldownUntil || 0) - Date.now();
    expect(left).toBeGreaterThan(89 * 60_000);
    expect(left).toBeLessThanOrEqual(90 * 60_000 + 1000);
  });
});
