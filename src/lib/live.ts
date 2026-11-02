/**
 * خط لحظه‌ای اخبار — منطق خالص مشترک میان API و رابط کاربری
 *
 * خواستهٔ کاربر (۳ نوامبر ۲۰۲۶): «میخوام کل اخبار لحظه‌ای رو در یه تب برنامه ببینم
 * حتی اگر اتصال بله فعلا نباشه» — یعنی فید زندهٔ همهٔ مطالب گردآوری‌شده،
 * کاملاً مستقل از بات بله (بدون فراخوانی بله، بدون عوارض جانبی، فقط‌خواندنی).
 *
 * این فایل عمداً وابستگی به دیتابیس و ری‌اکت ندارد تا در تست واحد سبک بماند.
 */
import { enToFaDigits, jalaliDisplay } from './persian';

/** منطقهٔ داخلی — هر منبعی با region دیگر «خارجی» است */
export const FOREIGN_REGION = 'ایران';

export type ScopeParam = 'all' | 'foreign' | 'domestic';

export interface ClaimSummary {
  verified: number;
  disputed: number;
  refuted: number;
  pending: number;
  total: number;
}

/**
 * خلاصهٔ وضعیت ادعاهای یک مطلب بر اساس وضعیت استاندارد ۸گانهٔ سامانه.
 * بازگشت null یعنی هیچ ادعایی ثبت نشده (برچسب راستی‌آزمایی نمایش داده نمی‌شود).
 */
export function summarizeClaims(statuses: string[]): ClaimSummary | null {
  if (!statuses || statuses.length === 0) return null;
  const c: ClaimSummary = { verified: 0, disputed: 0, refuted: 0, pending: 0, total: statuses.length };
  for (const s of statuses) {
    if (s === 'تأییدشده_با_شواهد_کافی' || s === 'عمدتاً_تأییدشده') c.verified++;
    else if (s === 'ردشده_با_شواهد_کافی' || s === 'گمراه‌کننده') c.refuted++;
    else if (s === 'تأییدنشده' || s === 'مورد_اختلاف' || s === 'منسوخ_یا_اصلاح‌شده') c.disputed++;
    else c.pending++;
  }
  return c;
}

export interface VerdictBadge {
  label: string;
  className: string;
}

/**
 * برچسب جمع‌بندی راستی‌آزمایی — هماهنگ با قالب بله: ✓ تأیید شد / ⚠ مورد شک / ✗ ردشده.
 * اگر همهٔ ادعاها «در انتظار بررسی» باشد برچسبی نشان داده نمی‌شود (کاهش نویز).
 * اولویت: ردشده > مورد شک > تأیید (بدترین وضعیت برنده است تا گمراه‌کننده نباشد).
 */
export function verdictBadge(s: ClaimSummary | null): VerdictBadge | null {
  if (!s || s.total === 0) return null;
  if (s.refuted > 0) return { label: 'راستی‌آزمایی: ردشده', className: 'bg-rose-100 text-rose-800 border-rose-200' };
  if (s.disputed > 0) return { label: 'راستی‌آزمایی: مورد شک', className: 'bg-amber-100 text-amber-800 border-amber-200' };
  if (s.verified > 0) return { label: 'راستی‌آزمایی: تأیید شد', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  return null;
}

/** داخلی/خارجی/بدون منبع بر اساس region منبع */
export function scopeOf(region: string | null | undefined): 'داخلی' | 'خارجی' | 'بدون منبع' {
  if (!region) return 'بدون منبع';
  return region === FOREIGN_REGION ? 'داخلی' : 'خارجی';
}

/**
 * زمان نسبی فارسی: «همین حالا»، «۱۲ دقیقه پیش»، «۳ ساعت پیش»، «۵ روز پیش»،
 * و برای کهنه‌ترها تاریخ شمسی. ورودی نامعتبر → «—».
 */
export function faRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const sec = Math.round((now.getTime() - d.getTime()) / 1000);
  if (sec < 0) return 'همین حالا'; // ساعت سرور/مرورگر کمی جلو است
  if (sec < 60) return 'همین حالا';
  const min = Math.round(sec / 60);
  if (min < 60) return `${enToFaDigits(String(min))} دقیقه پیش`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${enToFaDigits(String(hr))} ساعت پیش`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${enToFaDigits(String(day))} روز پیش`;
  return jalaliDisplay(d);
}

/** عنوان نمایشی: ترجمهٔ فارسی، وگرنه متن نرمال/خام — یک‌خطی تا سقف مشخص */
export function displayTitle(p: { translationFa: string | null; normalized: string | null; content: string }): string {
  const raw = (p.translationFa || p.normalized || p.content || '').replace(/\s+/g, ' ').trim();
  return raw.length > 400 ? raw.slice(0, 400).trimEnd() + '…' : raw;
}

/** اعتبارسنجی پارامتر take — خارج از بازه → پیش‌فرض ۶۰، سقف ۱۰۰ */
export function clampTake(v: string | null, def = 60, max = 100): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(max, Math.floor(n));
}
