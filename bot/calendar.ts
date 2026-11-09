/**
 * تقویم سه‌گانهٔ رصدبان — شمسی، قمری، میلادی + روز هفته
 * خواستهٔ کاربر: «تبدیل تاریخ‌ها باید با کتابخانهٔ معتبر و به‌روز انجام شود… از محاسبات دستی و
 * تقریبی استفاده نشود… در تقویم قمری منبع یا روش محاسبه مشخص باشد.»
 *
 * مبنا: Intl (ICU) — تقویم شمسی بر مبنای «persian» (تقویم رسمی ایران)، قمری بر مبنای
 * «islamic-umalqura» (روش محاسبهٔ مشخص و شفاف در پیام ذکر می‌شود) یا «islamic-civil»،
 * میلادی بر مبنای «gregory». صفر وابستگی — Intl استاندارد ECMAScript.
 */

export type QamariBasis = 'umalqura' | 'civil';

export interface CalYMD { y: number; m: number; d: number }

export interface TripleDate {
  /** کلید روز ISO در منطقهٔ زمانی کانال — «2026-11-10» */
  dateKey: string;
  weekdayFa: string;
  /** نمایش‌های آمادهٔ فارسی */
  shamsi: string;
  qamari: string;
  miladi: string;
  /** ماه/روز هر تقویم برای تطبیق مناسبت‌ها */
  keys: { j: CalYMD; h: CalYMD; g: CalYMD };
  qamariBasis: QamariBasis;
}

/** کلید روز ISO — همان منطق tehranParts ولی پارامتری منطقهٔ زمانی */
export function dateKeyOf(epoch: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(epoch);
}

/** یک روز جلو/عقب — با تقویم محلی منطقهٔ زمانی (بدون خطای DST) */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** روز هفتهٔ فارسی یک کلید روز در منطقهٔ زمانی کانال */
export function weekdayFaOf(dateKey: string, tz: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const epoch = new Date(Date.UTC(y, m - 1, d, 12)).getTime();
  return new Intl.DateTimeFormat('fa-IR', { timeZone: tz, weekday: 'long' }).format(epoch);
}

function ymdOf(calendar: string, epoch: number, tz: string): CalYMD {
  const parts = new Intl.DateTimeFormat(`en-u-ca-${calendar}`, { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(epoch);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** نمایش فارسی یک تاریخ با تقویم دلخواه — «۱۹ آبان ۱۴۰۵» */
function faDateOf(calendar: string, epoch: number, tz: string): string {
  return new Intl.DateTimeFormat(`fa-IR-u-ca-${calendar}`, { timeZone: tz, year: 'numeric', month: 'long', day: 'numeric' }).format(epoch);
}

/** تاریخ سه‌گانهٔ یک روز مشخص (کلید روز) — همهٔ محاسبات با Intl/ICU */
export function tripleDateOf(dateKey: string, tz: string, qamariBasis: QamariBasis = 'umalqura'): TripleDate {
  const [y, m, d] = dateKey.split('-').map(Number);
  const epoch = new Date(Date.UTC(y, m - 1, d, 12)).getTime();
  const j = ymdOf('persian', epoch, tz);
  const h = ymdOf(qamariBasis === 'umalqura' ? 'islamic-umalqura' : 'islamic-civil', epoch, tz);
  const g = ymdOf('gregory', epoch, tz);
  return {
    dateKey,
    weekdayFa: weekdayFaOf(dateKey, tz),
    shamsi: faDateOf('persian', epoch, tz),
    qamari: faDateOf(qamariBasis === 'umalqura' ? 'islamic-umalqura' : 'islamic-civil', epoch, tz),
    miladi: faDateOf('gregory', epoch, tz),
    keys: { j, h, g },
    qamariBasis,
  };
}

/** تاریخ سه‌گانهٔ «امروز» بر اساس ساعت واقعی */
export function tripleDate(epoch: number, tz: string, qamariBasis: QamariBasis = 'umalqura'): TripleDate {
  return tripleDateOf(dateKeyOf(epoch, tz), tz, qamariBasis);
}
