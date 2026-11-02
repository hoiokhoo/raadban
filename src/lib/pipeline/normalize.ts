/**
 * مرحله ۱-۴ خط لوله: نرمال‌سازی و پاک‌سازی متن فارسی
 * محتوای اصلی حفظ می‌شود؛ فقط نویزهای نمایشی حذف/استاندارد می‌شوند.
 */

/** نرمال‌سازی حروف فارسی: ی/ک عربی، اعراب، اعداد */
export function normalizePersian(text: string): string {
  return text
    // ی و ک عربی → فارسی
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    // اعراب و کشیدگی
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    // اعداد فارسی/عربی → لاتین (برای پردازش؛ نمایش جداست)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    // نیم‌فاصله استاندارد
    .replace(/\u200c+/g, '\u200c')
    // فاصله‌های تکراری و خطوط خالی تکراری
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** هش نرمال برای تشخیص تکرار: فقط کلمات، بدون نویز */
export function contentHash(text: string): string {
  const norm = normalizePersian(text)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '') // لینک‌ها در مقایسه لحاظ نمی‌شوند
    .replace(/[^\u0600-\u06FF\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0') + '_' + norm.length.toString(16);
}

/** شباهت جاکارد روی مجموعه کلمات (تشخیص بازنشر با تغییر جزئی) */
export function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) =>
    new Set(
      normalizePersian(s).toLowerCase()
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[^\u0600-\u06FF\w\s]/g, ' ')
        .split(/\s+/).filter((w) => w.length > 1)
    );
  const A = words(a), B = words(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

// ---------- تشخیص محتوای تبلیغاتی/ناقص/غیرمرتبط ----------

const AD_PATTERNS = [
  /(کانال|پیج|صفحه)\s*(ما|دیگر)\s*(را\s*)?(در|لایک|فالو|جویین|عضو|معرفی)/,
  /(فروش|تخفیف)\s*(ویژه|استثنایی|خاص)/,
  /درصد\s*تخفیف|تخفیف\s*درصد|٪\s*تخفیف|تخفیف\s*٪/,
  /لینک\s*(ثبت\s*نام|دورهمی|عضویت)/,
  /@(admin|modir|support)/i,
  /(تبلیغات|اعلامیه\s*همکاری)/,
  /معرفی\s*کن|به\s*دوستانت/,
];

const SPONSOR_HINTS = /(قیمت|تومان|ریال|سفارش|خرید|فروش|ثبت\s*نام)/;

export interface ContentQuality {
  isAd: boolean;
  isTruncated: boolean;
  qualityNote?: string;
}

export function assessContentQuality(text: string): ContentQuality {
  const trimmed = text.trim();
  if (trimmed.length < 20) {
    return { isAd: false, isTruncated: true, qualityNote: 'متن بسیار کوتاه — احتمالاً ناقص یا فقط رسانه' };
  }
  const adHits = AD_PATTERNS.filter((r) => r.test(trimmed)).length;
  if (adHits >= 2 || (adHits >= 1 && SPONSOR_HINTS.test(trimmed) && trimmed.length < 400)) {
    return { isAd: true, isTruncated: false, qualityNote: 'الگوهای تبلیغاتی تشخیص داده شد' };
  }
  return { isAd: false, isTruncated: false };
}

/** واژه‌های کاربردی رایج فارسی/عربی — برای متن‌های بی‌«پچژگ» (بسیاری از واژه‌های فارسی این حروف را ندارند) */
const FA_COMMON = new Set([
  'که', 'در', 'از', 'این', 'است', 'برای', 'با', 'شد', 'شود', 'می', 'های', 'یک', 'بر', 'تا', 'هم',
  'را', 'آن', 'کرد', 'کردند', 'شده', 'گفت', 'دارد', 'درباره', 'نیز', 'بعد', 'قبل', 'روی', 'بین',
  'بود', 'خود', 'کنند', 'دهد', 'باشد', 'باید', 'خواهد', 'دو', 'وی', 'آنها', 'همه', 'دیگر', 'چند',
  'مورد', 'به', 'هایت', 'طی', 'ویژه', 'شبکه', 'خبرگزاری', 'منتشر', 'اعلام', 'برنامه', 'صورت',
]);
const AR_COMMON = new Set([
  'في', 'من', 'على', 'عن', 'إن', 'أن', 'الى', 'التي', 'الذي', 'هذا', 'هذه', 'قد', 'مع', 'بعد',
  'قبل', 'بين', 'هو', 'هي', 'كان', 'ليس', 'عند', 'كل', 'بعض', 'عبر', 'حيث', 'ثم', 'أو', 'ولا',
  'لكن', 'أنه', 'اليوم', 'بعدما', 'حول', 'ضد', 'معاً', 'كما', 'لدى', 'أي', 'غير', 'بينما', 'الأمم',
  'المتحدة', 'الذي', 'الذين', 'كانت', 'أصبح', 'عشرة', 'السابق',
]);

/** تشخیص زبان ساده فارسی/عربی/سایر بر پایه نویسه‌ها + واژه‌های کاربردی رایج */
export function detectLanguage(text: string): 'fa' | 'ar' | 'en' | 'other' {
  const faChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const persianSpecific = (text.match(/[پچژگ‌]/g) || []).length; // + نیم‌فاصله
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (latin > faChars && latin > 5) return 'en';
  if (faChars > 5) {
    if (persianSpecific > 0) return 'fa';
    // متن بدون «پچژگ» و نیم‌فاصله — حکم با واژه‌های کاربردی رایج (ایراد نقد: فارسیِ بی‌پچژگ عربی خوانده می‌شد)
    let fa = 0, ar = 0;
    for (const t of text.split(/[\s\u200c،؛,.:;!؟?()«»"'\-—]+/)) {
      if (FA_COMMON.has(t)) fa++;
      else if (AR_COMMON.has(t)) ar++;
    }
    return fa >= ar ? 'fa' : 'ar';
  }
  return 'other';
}
