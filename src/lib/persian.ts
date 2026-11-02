/**
 * ابزارهای تاریخ و عدد فارسی
 * - تقویم شمسی با Intl (بدون وابستگی خارجی)
 * - مبنای منطقه زمانی قابل تنظیم (پیش‌فرض Asia/Tehran)
 * - تفکیک صریح: تاریخ گزارش، تاریخ انتشار مطلب، تاریخ وقوع رویداد
 */

export const SYSTEM_TIMEZONE = 'Asia/Tehran';

/** «۲٬۱۴۰» یا "2,140" یا «۱۴۰۲» -> 2140 */
export function faToEnDigits(s: string): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩';
  return s.replace(/[۰-۹٠-٩]/g, (d) => {
    const i = fa.indexOf(d);
    return String(i >= 0 ? i : ar.indexOf(d));
  });
}

export function enToFaDigits(s: string): string {
  return s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/** تاریخ میلادی yyyy-mm-dd در منطقه زمانی سامانه */
export function isoDateInTz(d: Date, tz: string = SYSTEM_TIMEZONE): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return p.format(d); // en-CA خروجی yyyy-mm-dd می‌دهد
}

/** ساعت HH:mm در منطقه زمانی سامانه */
export function timeInTz(d: Date, tz: string = SYSTEM_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

/** نمایش شمسی مثل ۹ آبان ۱۴۰۵ */
export function jalaliDisplay(d: Date | string, tz: string = SYSTEM_TIMEZONE): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: tz, year: 'numeric', month: 'long', day: 'numeric',
    }).format(date);
  } catch {
    return isoDateInTz(date, tz);
  }
}

/** نمایش کامل شمسی با ساعت مثل ۹ آبان ۱۴۰۵، ۱۷:۳۰ */
export function jalaliFull(d: Date | string, tz: string = SYSTEM_TIMEZONE): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: tz, year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date);
  } catch {
    return `${isoDateInTz(date, tz)} ${timeInTz(date, tz)}`;
  }
}

// ---------- سه‌تقویم: شمسی + قمری + میلادی (نسخه ۱٫۱) ----------

/** نمایش قمری اسلامی (ام‌القری) مثل ۹ ربیع‌الثانی ۱۴۴۸ */
export function hijriDisplay(d: Date | string, tz: string = SYSTEM_TIMEZONE): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-islamic-umalqura', {
      timeZone: tz, year: 'numeric', month: 'long', day: 'numeric',
    }).format(date);
  } catch {
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        timeZone: tz, year: 'numeric', month: 'long', day: 'numeric',
      }).format(date);
    } catch { return '—'; }
  }
}

/** نمایش میلادی فارسی مثل ۳۰ اکتبر ۲۰۲۶ */
export function gregorianDisplay(d: Date | string, tz: string = SYSTEM_TIMEZONE): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-gregory', {
      timeZone: tz, year: 'numeric', month: 'long', day: 'numeric',
    }).format(date);
  } catch {
    return isoDateInTz(date, tz);
  }
}

export interface TripleDateParts {
  shamsi: string;
  qamari: string;
  miladi: string;
}

/** سه‌گانه تقویمی به‌صورت اجزا — برای کامپوننت‌ها */
export function tripleDateParts(d: Date | string, tz: string = SYSTEM_TIMEZONE): TripleDateParts {
  const date = typeof d === 'string' ? new Date(d) : d;
  return {
    shamsi: jalaliDisplay(date, tz),
    qamari: hijriDisplay(date, tz),
    miladi: gregorianDisplay(date, tz),
  };
}

/** سه‌تقویم یک‌خطی با جداکننده — برای فضاهای کم */
export function tripleDateInline(d: Date | string, tz: string = SYSTEM_TIMEZONE): string {
  const p = tripleDateParts(d, tz);
  return `${p.shamsi} — ${p.qamari} — ${p.miladi}`;
}

/** yyyy-mm-dd شمسی برای ذخیره/مرتب‌سازی (اعداد لاتین) */
export function jalaliISO(d: Date | string, tz: string = SYSTEM_TIMEZONE): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((x) => x.type === t)?.value || '';
  const y = get('year').replace(/\D/g, '');
  return `${y}-${get('month')}-${get('day')}`;
}

/** افزودن n روز به تاریخ رشته‌ای yyyy-mm-dd (میلادی، بدون درگیری با TZ) */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z'); // ظهر UTC برای پرهیز از جابه‌جایی روز
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** شروع بازه «روز» در منطقه زمانی سامانه به‌صورت UTC */
export function dayRangeUTC(isoDate: string, tz: string = SYSTEM_TIMEZONE): { start: Date; end: Date } {
  // استخراج آفست آن روز در TZ هدف
  const guess = new Date(`${isoDate}T00:00:00Z`);
  const off1 = tzOffsetMs(guess, tz);
  const start = new Date(new Date(`${isoDate}T00:00:00Z`).getTime() - off1);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end };
}

function tzOffsetMs(d: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(d);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUTC - d.getTime();
}

// ---------- استخراج تاریخ از متن فارسی ----------

const FA_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

export interface ExtractedDate {
  raw: string;
  kind: 'شمسی' | 'میلادی' | 'نسبی';
  /** تاریخ وقوع استانداردشده به ISO میلادی (تقریبی برای شمسی) */
  iso?: string;
  /** توضیح تشخیص */
  note?: string;
}

/** تبدیل تاریخ شمسی (jy, jm, jd) به ISO میلادی — الگوریتم تقویم جلالی */
export function jalaliToISO(jy: number, jm: number, jd: number): string {
  let gy = jy > 979 ? 1600 : 621;
  const y = jy > 979 ? jy - 979 : jy;
  let days =
    365 * y + Math.floor(y / 33) * 8 + Math.floor(((y % 33) + 3) / 4) +
    78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const cum = [0, 31, leap ? 60 : 59, leap ? 91 : 90, leap ? 121 : 120, leap ? 152 : 151,
    leap ? 182 : 181, leap ? 213 : 212, leap ? 244 : 243, leap ? 274 : 273, leap ? 305 : 304, leap ? 335 : 334];
  let gm = 0;
  for (let i = 0; i < 12; i++) { if (gd > cum[i]) gm = i + 1; else break; }
  gd -= cum[gm - 1];
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

/**
 * استخراج تاریخ‌های ذکرشده در متن فارسی:
 *  - «۱۴۰۴/۰۸/۰۹» ، «9 آبان 1404» ، «۱۳ آبان‌ماه» ، «دیروز» ، «امروز»
 * تاریخ را نسبت به تاریخ انتشار مطلب تفسیر می‌کند (تاریخ وقوع ≠ تاریخ انتشار).
 */
export function extractDates(text: string, publishedAt?: Date): ExtractedDate[] {
  const out: ExtractedDate[] = [];
  const t = faToEnDigits(text);
  const base = publishedAt || new Date();
  const baseISO = isoDateInTz(base);

  // الگوی شمسی ۱۴۰۴/۰۸/۰۹ یا 1404-08-09
  const jalaliNum = t.match(/\b(1[34]\d{2})[\/\-.](0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12]\d|3[01])\b/g);
  for (const m of jalaliNum || []) {
    const [jy, jm, jd] = m.split(/[\/\-.]/).map(Number);
    out.push({ raw: m, kind: 'شمسی', iso: jalaliToISO(jy, jm, jd) });
  }

  // الگوی «۹ آبان ۱۴۰۴» یا «آبان ۱۴۰۴»
  for (let i = 0; i < FA_MONTHS.length; i++) {
    const re = new RegExp(`(\\d{1,2})?\\s*${FA_MONTHS[i]}(?:\\s*ماه)?\\s*(1[34]\\d{2})?`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const day = m[1] ? Number(m[1]) : undefined;
      const year = m[2] ? Number(m[2]) : undefined;
      // سال نامشخص: نزدیک‌ترین سال به امروز
      const todayJ = new Intl.DateTimeFormat('en-u-ca-persian', {
        timeZone: SYSTEM_TIMEZONE, year: 'numeric',
      }).formatToParts(base).find((x) => x.type === 'year')?.value || '1404';
      const y = year ?? Number(todayJ.replace(/\D/g, ''));
      const iso = day ? jalaliToISO(y, i + 1, day) : undefined;
      out.push({
        raw: m[0].trim(), kind: 'شمسی', iso,
        note: day ? undefined : 'روز ماه ذکر نشده — ماه تقریبی',
      });
    }
  }

  // الگوی میلادی ISO در متن
  const greg = t.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/g);
  for (const m of greg || []) {
    const [y, mo, d] = m.split('-').map(Number);
    out.push({ raw: m, kind: 'میلادی', iso: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  // نسبی
  if (/دیروز/.test(text)) {
    out.push({ raw: 'دیروز', kind: 'نسبی', iso: addDaysISO(baseISO, -1), note: 'نسبت به تاریخ انتشار' });
  }
  if (/امروز/.test(text)) {
    out.push({ raw: 'امروز', kind: 'نسبی', iso: baseISO, note: 'نسبت به تاریخ انتشار' });
  }
  const faN = t.match(/(\d+)\s*روز\s*(پیش|گذشته|قبل)/);
  if (faN) {
    out.push({ raw: faN[0], kind: 'نسبی', iso: addDaysISO(baseISO, -Number(faN[1])), note: 'نسبت به تاریخ انتشار' });
  }
  return out;
}
