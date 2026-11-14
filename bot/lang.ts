/**
 * دروازهٔ زبان — ریشه‌یابی و رفع باگ توییت عبری نتانیاهو (خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «الان یه تویییت از نتانیاهو اومده ولی ترجمه نشده!»).
 *
 * ریشهٔ باگ: needsTranslation قدیمی فقط سه خط را می‌شناخت — لاتین (>۳۵٪)، سیریلیک (>۲۰٪)
 * و عربیِ خالص. نویسه‌های عبری (U+0590–U+05FF) و چینی/یونانی/تایلندی و… «نامرئی» بودند:
 * توییت عبری سهم لاتین صفر داشت → «فارسی» تلقی می‌شد → نه وارد دستهٔ ترجمه می‌شد و نه
 * گیت بازرسی متوجه می‌شد → خام و بی‌ترجمه به بله می‌رفت.
 *
 * اصل این ماژول — منطق «فهرست سفید» به‌جای «فهرست سیاه»:
 * متن فقط وقتی فارسی است که نویسه‌های الفبایی‌اش به‌قاطع غالبِ خط عربی‌فارسی باشند؛
 * هر خطِ دیگر (عبری، چینی، یونانی، سیریلیک، لاتین و…) که سهم معناداری بیابد → نیازمند ترجمه.
 * همهٔ توابع خالص و بدون وابستگی — تست‌پذیر (tests/language-gate.test.ts).
 */

// ---------- محدوده‌های خط ----------
// خط عربی‌فارسی: بلوک اصلی + مکمل‌ها + صورت‌های نمایشی (فارسی/عربی/اردو همه اینجا هستند)
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_RE = /[A-Za-z]/;
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const HEBREW_RE = /[\u0590-\u05FF]/;

// نویسه‌های انحصاری عربی (در فارسی معیار هرگز به‌کار نمی‌روند) و نویسه‌های انحصاری فارسی
const ARABIC_ONLY_RE = /[ةيكٱ]/g;
const PERSIAN_ONLY_RE = /[پچژگ]/g;

export interface ScriptProfile {
  /** شمار همهٔ نویسه‌های الفبایی */
  letters: number;
  /** سهم خط عربی‌فارسی */
  arabic: number;
  /** سهم لاتین */
  latin: number;
  /** سهم سیریلیک */
  cyrillic: number;
  /** سهم عبری */
  hebrew: number;
  /** سهم بقیهٔ خط‌ها (چینی، یونانی، تایلندی، کره‌ای و…) */
  other: number;
  /** شمار نویسه‌های انحصاری عربی و فارسی — برای تفکیک عربی خالص از فارسی */
  arabicOnlyChars: number;
  persianOnlyChars: number;
}

/** نمای خط‌های متن — تابع خالص؛ فقط ۵۰۰ نویسهٔ نخست (سازگار با رفتار قبلی). */
export function scriptProfile(s: string): ScriptProfile {
  const t = (s || '').slice(0, 500);
  const chars = t.match(/\p{L}/gu) || [];
  let arabic = 0, latin = 0, cyrillic = 0, hebrew = 0, other = 0;
  for (const c of chars) {
    if (ARABIC_SCRIPT_RE.test(c)) arabic++;
    else if (LATIN_RE.test(c)) latin++;
    else if (CYRILLIC_RE.test(c)) cyrillic++;
    else if (HEBREW_RE.test(c)) hebrew++;
    else other++;
  }
  return {
    letters: chars.length,
    arabic,
    latin,
    cyrillic,
    hebrew,
    other,
    arabicOnlyChars: (t.match(ARABIC_ONLY_RE) || []).length,
    persianOnlyChars: (t.match(PERSIAN_ONLY_RE) || []).length,
  };
}

/** متن بدون نویسهٔ الفبایی؟ (فقط نشانه/عدد/فاصله) — نه فارسی است نه خارجی؛ ترجمه نمی‌خواهد */
export function hasNoLetters(s: string): boolean {
  return scriptProfile(s).letters === 0;
}

/**
 * آیا این متن غیرفارسی است و باید ترجمه شود؟ — دروازهٔ قطعی و بدون مدل.
 * تضمین خواستهٔ کاربر: «هیچ خبر/توییت غیرفارسی بدون ترجمه به بله نمی‌رود» — این بار
 * برای همهٔ خط‌های جهان، نه فقط لاتین/سیریلیک/عربی.
 * قواعد (به‌ترتیب):
 *  ۱) سهم لاتین > ۳۵٪ → انگلیسی/فرانسه/… (متن فارسی با برند لاتین کوتاه می‌گذرد)
 *  ۲) سهم سیریلیک > ۲۰٪ → روسی/اوکراینی/…
 *  ۳) سهم خط‌های غیرِ {عربی‌فارسی، لاتین، سیریلیک} > ۱۰٪ → عبری/چینی/یونانی/… —
 *     متن فارسی هرگز طبیعتاً این خط‌ها را ندارد؛ ۱۰٪ برای نقل‌قول کوتاهِ یک واژه بی‌گانه جا می‌گذارد
 *  ۴) عربیِ خالص (نویسه‌های انحصاری عربی ≥ ۲، هیچ نویسهٔ انحصاری فارسی، بلند) → ترجمه
 *  ۵) غیر این → فارسی تلقی می‌شود
 */
export function needsTranslationLang(s: string): boolean {
  const p = scriptProfile(s);
  if (p.letters === 0) return false;
  if (p.latin / p.letters > 0.35) return true;
  if (p.cyrillic / p.letters > 0.2) return true;
  if ((p.hebrew + p.other) / p.letters > 0.1) return true;
  if (p.arabicOnlyChars >= 2 && p.persianOnlyChars === 0 && p.letters > 40) return true;
  return false;
}

/** متن عربیِ خالص است؟ (عربی بدون هیچ نویسهٔ انحصاری فارسی و با نشانگرهای عربی) — برای گارد خروجی مدل */
export function isPureArabic(s: string): boolean {
  const p = scriptProfile(s);
  if (p.letters === 0) return false;
  // عربی غالب ولی اصلاً لاتین/عبری/… ندارد و نشانگر عربی دارد و فارسی‌نشانه ندارد
  if (p.latin + p.cyrillic + p.hebrew + p.other > 0) return false;
  return p.arabicOnlyChars >= 2 && p.persianOnlyChars === 0 && p.letters > 40;
}

/** آیا خروجی مدل فارسیِ قابل ارسال است؟ (سهم خط عربی‌فارسی ≥ ۵۰٪ از نویسه‌ها + عربی خالص نباشد) */
export function isPersianEnough(s: string): boolean {
  const p = scriptProfile(s);
  if (p.letters === 0) return false;
  if (p.arabic / p.letters < 0.5) return false;
  if (isPureArabic(s)) return false;
  return true;
}
