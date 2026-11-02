/**
 * راه‌اندازی سرور — شروع زمان‌بند یک‌بار برای هر پروسه
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('@/lib/scheduler');
    startScheduler();
  }
}
