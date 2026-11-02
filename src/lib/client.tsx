'use client';
/**
 * کلاینت API و قالب‌بندی فارسی برای رابط کاربری
 */
export async function api<T = Record<string, unknown>>(
  path: string,
  opts?: { method?: string; body?: unknown; timeoutMs?: number }
): Promise<T & { ok: boolean; error?: string }> {
  const res = await fetch(path, {
    method: opts?.method || 'GET',
    headers: opts?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
    // عملیات‌های سنگین (خوشه‌بندی/اسکن/ترجمه) ممکن است چند دقیقه طول بکشند
    signal: opts?.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'پاسخ سرور قابل خواندن نبود' }));
  return data as T & { ok: boolean; error?: string };
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export function faNum(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—';
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function faDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

export function faDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
      .format(new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso));
  } catch { return iso; }
}

export const PLATFORM_LABELS: Record<string, string> = {
  telegram: 'تلگرام', eitaa: 'ایتا', bale: 'بله', rss: 'RSS', web: 'وب‌سایت',
  twitter: 'توییتر/ایکس', truthsocial: 'تروث سوشال', instagram: 'اینستاگرام', aparat: 'آپارات',
};

export const STATUS_STYLES: Record<string, string> = {
  'دریافت_موفق': 'bg-emerald-100 text-emerald-800',
  'فعال': 'bg-emerald-100 text-emerald-800',
  'غیرفعال': 'bg-slate-200 text-slate-700',
  'خطای_اتصال': 'bg-rose-100 text-rose-800',
  'نیازمند_احراز': 'bg-amber-100 text-amber-800',
  'محدود_دسترسی': 'bg-orange-100 text-orange-800',
  'پشتیبانی‌نشده': 'bg-zinc-200 text-zinc-600',
  'در_انتظار_تأیید': 'bg-sky-100 text-sky-800',
  'تأییدشده': 'bg-emerald-100 text-emerald-800',
  'ردشده': 'bg-rose-100 text-rose-700',
  'کامل': 'bg-emerald-100 text-emerald-800',
  'ناقص': 'bg-amber-100 text-amber-800',
  'ناموفق': 'bg-rose-100 text-rose-800',
  'در_انتظار_بررسی': 'bg-sky-100 text-sky-800',
  'تأییدشده_با_شواهد_کافی': 'bg-emerald-100 text-emerald-800',
  'عمدتاً_تأییدشده': 'bg-teal-100 text-teal-800',
  'تأییدنشده': 'bg-amber-100 text-amber-800',
  'مورد_اختلاف': 'bg-orange-100 text-orange-800',
  'گمراه‌کننده': 'bg-rose-100 text-rose-800',
  'ردشده_با_شواهد_کافی': 'bg-rose-200 text-rose-900',
  'منسوخ_یا_اصلاح‌شده': 'bg-violet-100 text-violet-800',
};

export function statusStyle(s: string): string {
  return STATUS_STYLES[s] || 'bg-slate-100 text-slate-700';
}
