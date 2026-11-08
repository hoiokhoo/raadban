/**
 * راه‌اندازی سرور — شروع زمان‌بند یک‌بار برای هر پروسه
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // خودترمیمی بانک پس از ریست سندباکس: اگر منابع خالی بود، کاتالوگ واقعی bot/sources.json وارد می‌شود
    const { ensureDatabaseSeeded } = await import('@/lib/bootstrap');
    await ensureDatabaseSeeded();
    const { startScheduler } = await import('@/lib/scheduler');
    startScheduler();
  }
}
