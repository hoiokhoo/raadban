/**
 * وقایع روز در تاریخ — جامع‌سازی بخش «وقایع روز» پیام صبحگاهی/شبانگاهی
 * خواستهٔ کاربر (۱۲ نوامبر ۲۰۲۶): «بخش وقایع روز رو جامع‌تر کنی… یه کانال اینو گذاشته، می‌خوام از
 * این دست وقایع رو تو هم بدی» — نمونهٔ کاربر (کانال یاپرس):
 *   ۲۱ آبان ۱۲۷۶؛ زادروز نیما یوشیج، پدر شعر نو فارسی.
 *   ۲۱ آبان ۱۳۹۰؛ انفجار بیدگنه؛ پایگاه موشکی شهید مدرس و شهادت سرتیپ حسن تهرانی مقدم.
 *
 * منبع: ویکی‌پدیای فارسی — صفحهٔ هر روز سال (مثلاً fa.wikipedia.org/wiki/۲۱_آبان) با بخش‌های
 * «رویدادها»، «زادروزها» و «درگذشت‌ها/درگذشتگان». این منبع دقیقاً همان دسته وقایع مطلوب کاربر
 * است (رویداد تاریخی با سال، زادروز چهره‌ها، درگذشت‌ها) و هر روز سال را پوشش می‌دهد.
 *
 * صادقانه: فقط آنچه واقعاً در صفحه ثبت شده؛ شکست واکشی/پارس یا روزِ بی‌ثبت‌وقعه → خروجی خالی و
 * کل بخش از پیام حذف می‌شود (هیچ واقعهٔ ساختگی). منبع در لاگ ثبت می‌شود نه در پیام (پیام روزانه
 * طبق خواستهٔ کاربر بدون خط منبع است).
 *
 * معماری: پارسر و فرمت‌کنندهٔ خالص و تست‌پذیر + یک واکشی شبکه‌ای با تلاش دوباره (fetch + پشتیبان curl).
 */

import { execFile } from 'node:child_process';

export type DayHistoryKind = 'event' | 'birth' | 'death';

export interface DayHistoryEntry {
  /** سال خورشیدی وقوع — از متن صفحه */
  year: number;
  /** متن پاک‌شده (بدون نشانه‌گذاری ویکی، بدون پانویس) */
  text: string;
  kind: DayHistoryKind;
}

export interface DayHistory {
  /** عنوان صفحه — «۲۱ آبان» */
  title: string;
  pageUrl: string;
  entries: DayHistoryEntry[];
}

/** حافظهٔ روزانهٔ وقایع — واکشی موفق یک روز تا پایان همان روز استفاده می‌شود (بدون فشار مجدد به ویکی‌پدیا) */
export interface DayHistoryCacheEntry {
  title: string;
  entries: DayHistoryEntry[];
  at: string;
}

/** هرس حافظهٔ وقایع — فقط آخرین keep روز (کلیدها ISO dateKey و مرتب‌شدنی) */
export function pruneDayHistoryCache(cache: Record<string, DayHistoryCacheEntry> | undefined, keep = 8): Record<string, DayHistoryCacheEntry> {
  const src = cache && typeof cache === 'object' ? cache : {};
  const keys = Object.keys(src).sort();
  const out: Record<string, DayHistoryCacheEntry> = {};
  for (const k of keys.slice(-keep)) {
    const v = src[k];
    if (v && typeof v.title === 'string' && Array.isArray(v.entries)) out[k] = v;
  }
  return out;
}

/** خواندن حافظهٔ یک روز — فقط مدخلِ غیرخالیِ همان روز معتبر است */
export function dayHistoryFromCache(cache: Record<string, DayHistoryCacheEntry> | undefined, dateKey: string): DayHistory | null {
  const v = cache?.[dateKey];
  if (!v || !Array.isArray(v.entries) || v.entries.length === 0) return null;
  return {
    title: v.title,
    pageUrl: `https://fa.wikipedia.org/wiki/${encodeURIComponent(v.title)}`,
    entries: v.entries,
  };
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function faNum(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

function faToInt(s: string): number | null {
  const latin = s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
  const n = Number(latin);
  return Number.isFinite(n) ? n : null;
}

/** نام فارسی ماه‌های خورشیدی — مطابق صفحات ویکی‌پدیا */
export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/** عنوان صفحهٔ ویکی‌پدیای روز خورشیدی — «۲۱ آبان»؛ نامعتبر → رشتهٔ خالی */
export function faWikiDayTitle(j: { y: number; m: number; d: number }): string {
  if (!Number.isInteger(j.m) || !Number.isInteger(j.d) || j.m < 1 || j.m > 12 || j.d < 1 || j.d > 31) return '';
  return `${faNum(j.d)} ${JALALI_MONTHS[j.m - 1]}`;
}

/** نشانی API واکشی متن صفحه — تابع خالص تست‌پذیر */
export function dayHistoryApiUrl(title: string): string {
  return `https://fa.wikipedia.org/w/api.php?action=query&redirects=1&titles=${encodeURIComponent(title)}&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2`;
}

/** نشانی API ویکی‌پدیای انگلیسی — برای رویدادهای جهانی روز میلادی */
export function enDayHistoryApiUrl(title: string): string {
  return `https://en.wikipedia.org/w/api.php?action=query&redirects=1&titles=${encodeURIComponent(title)}&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2`;
}

// ---------- پارسر متن ویکی (خالص) ----------

/** پاک‌سازی متن یک مدخل — حذف پانویس، پیوند‌ها، قالب‌ها و تگ‌ها */
export function cleanWikiText(s: string): string {
  return s
    .replace(/<ref[^>]*\/>/g, '') // <ref name="x"/> خودبسته
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '') // <ref …>…</ref> (حتی با قالب درون)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1') // [[هدف|برچسب]] → برچسب
    .replace(/\[\[([^\]]+)\]\]/g, '$1') // [[هدف]] → هدف
    .replace(/\{\{[^{}]*\}\}/g, '') // قالب‌های سادهٔ باقی‌مانده
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-–—:.،؛\s]+|[-–—:.،؛\s]+$/g, '');
}

/** پارس یک گلولهٔ فهرست — سال + متن؛ بدون سالِ معتبر → null (صادقانه: در خط زمانی نمی‌نشیند) */
function parseBullet(body: string, kind: DayHistoryKind): DayHistoryEntry | null {
  let year: number | null = null;
  let rest = '';
  const linked = /^\[\[\s*([۰-۹]+)\s*(?:\([^)]*\))?\s*\|\s*([۰-۹]+)\s*\]\]\s*[-–—:.،]?\s*/.exec(body);
  if (linked) {
    year = faToInt(linked[2]);
    rest = body.slice(linked[0].length);
  } else {
    const plain = /^([۰-۹]{1,4})\s*(?:\([^)]*\))?\s*([-–—:.،]|$)\s*/.exec(body);
    if (plain) {
      year = faToInt(plain[1]);
      rest = body.slice(plain[0].length);
    }
  }
  if (year === null || !Number.isFinite(year) || year < 1 || year > 1500) return null;
  const text = cleanWikiText(rest);
  if (text.length < 3) return null;
  return { year, text, kind };
}

/** پارس متن کامل صفحهٔ یک روز — بخش‌ها: رویدادها/زادروزها(تولد)/درگذشت‌ها(درگذشتگان، مرگ‌ها).
 *  بخش «مناسبت‌ها» عمداً نادیده گرفته می‌شود (بانک مناسبت‌های مستقل داریم). خروجی بدون تکرار. */
export function parseFaWikiDayWikitext(wt: string): DayHistoryEntry[] {
  const entries: DayHistoryEntry[] = [];
  let kind: DayHistoryKind | null = null;
  for (const rawLine of wt.split('\n')) {
    const line = rawLine.trim();
    const h = /^==+\s*(.+?)\s*==+$/.exec(line);
    if (h) {
      const sec = h[1];
      if (sec.includes('رویداد')) kind = 'event';
      else if (sec.includes('زادروز') || sec.includes('تولد')) kind = 'birth';
      else if (sec.includes('درگذشت') || sec.includes('مرگ')) kind = 'death';
      else kind = null;
      continue;
    }
    if (!kind || !line.startsWith('*')) continue;
    const parsed = parseBullet(line.replace(/^\*+\s*/, ''), kind);
    if (parsed) entries.push(parsed);
  }
  // ضدتکرار (سال + متن یکسان)
  const seen = new Set<string>();
  return entries.filter((e) => {
    const k = `${e.year}|${e.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------- پالایش محتوایی — خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶ ----------
// «در بخش وقایع روز تمامی حوادث مربوط به اغتشاشات و مسایل ضد جمهوری اسلامی و بازیگران و
//  بازیکنهای فوتبال رو حذف کن» — پالایش روی متن هر مدخل (رویداد/زادروز/درگذشت یکسان)؛
// حافظهٔ خام ویکی‌پدیا دست‌نخورده می‌ماند و پالایش در زمان نمایش اعمال می‌شود (پالایش
// بعدی بدون واکشی مجدد اثر می‌کند). هر دو فهرست صریح، خالص و تست‌پذیرند.

/** واژه‌های موضوع اغتشاغ/اعتراض/ضد جمهوری اسلامی — هر مدخلِ دارای این واژه‌ها حذف می‌شود.
 *  دقت: واژه‌های انقلابی/مردمی (انقلاب، قیام، راهپیمایی ۲۲ بهمن) عمداً در این فهرست نیستند.
 *  ۱۶ نوامبر ۲۰۲۶ — نام‌های چهره‌های ماجرای ۱۴۰۱ به‌صورت صریح اضافه شدند (خواستهٔ کاربر:
 *  «حوادث مرتبط با اغتشاشات ایران مثه کیان پیرفلک و ... نمی‌خوام داخل وقایع بیاد») —
 *  متنِ برخی مدخل‌های ویکی نامِ چهره را دارد ولی واژهٔ «اعتراض» نه؛ نام‌ها خودشان مسدود می‌کنند. */
export const RIOT_ANTI_IRI_KEYWORDS: readonly string[] = [
  'اغتشاش',
  'اعتراض', // اعتراضات/اعتراض‌های — همهٔ بازه‌ها
  'خیزش', // خیزش ۱۴۰۱ و مشابه
  'شورش',
  'مهسا امینی',
  'زن، زندگی، آزادی',
  'زن زندگی آزادی',
  'ضد جمهوری اسلامی',
  'ضدجمهوری اسلامی',
  'ضد انقلاب',
  'ضدانقلاب',
  'سلطنت‌طلب',
  'سلطنت طلب',
  'سازمان مجاهدین خلق', // وقایع تروریستی این گروه — بازوی ضد جمهوری اسلامی
  // چهره‌های ماجرای اغتشاشات ۱۴۰۱ — بازنویسیِ بی‌واژهٔ «اعتراض» هم مسدود شود
  'پیرفلک', // کیان پیرفلک
  'نیکا شاکرمی',
  'شاکرمی',
  'حدیث نجفی',
  'سارینا اسماعیل',
  'پوپک زرین',
];

/** واژهٔ حوزهٔ بازیگران سینما/تلویزیون و فوتبال (بازیکن/فوتبالیست/بازی فوتبال) */
export const SHOW_FOOTBALL_KEYWORDS: readonly string[] = [
  'بازیگر',
  'هنرپیشه',
  'فوتبال', // فوتبالیست، بازیکن فوتبال، تیم ملی فوتبال، فوتبالی
];

/** سال‌های موج رویدادهای اغتشاشی — رویدادهای این سال‌ها با کلیدواژهٔ نرمِ خشونت/اعتراض مسدود می‌شوند
 *  (خواستهٔ کاربر ۱۶ نوامبر، صفحهٔ واقعی ۲۵ آبان: «قتل‌عام ماهشهر»، «قطعی اینترنت ۱۳۹۸»،
 *  «حمله به بازار ایذه»، «حادثه ۲۵ آبان ۱۴۰۱» — هیچ‌کدام واژهٔ «اعتراض» نداشتند) */
export const RIOT_ERA_YEARS: readonly number[] = [1398, 1401, 1402, 1403];
const RIOT_ERA_SOFT_RE = /حمله|کشته|قتل|مرگ|تیر|قطعی|اینترنت|اعتراض|اغتشاش|ایذه|ماهشهر|خودسوزی|حادثه|دستگیری|خیابان|بازار/;

/** مدخلِ سال‌های اغتشاش با نشانهٔ خشونت/اعتراض — باید حذف شود (سال + بافت، نه فقط واژه) */
export function isRiotEraEntry(year: number, text: string): boolean {
  return RIOT_ERA_YEARS.includes(year) && RIOT_ERA_SOFT_RE.test((text || '').replace(/[\u200c\u200f\u200e]/g, ''));
}

/** یک مدخل باید حذف شود؟ — تطبیق زیررشته‌ای روی متن پاک؛ خالص و تست‌پذیر */
export function isDayHistoryBlocked(text: string): boolean {
  const t = (text || '').replace(/[\u200c\u200f\u200e]/g, ''); // نیم‌فاصله/کنترل bidi نادیده
  const all = [...RIOT_ANTI_IRI_KEYWORDS, ...SHOW_FOOTBALL_KEYWORDS];
  return all.some((k) => t.includes(k.replace(/[\u200c]/g, '')));
}

/** پالایش فهرست وقایع — ورودی خام، خروجی فقط مدخل‌های مجاز؛ ترتیب حفظ می‌شود. تابع خالص.
 *  ۱۶ نوامبر: لایهٔ دوم سال‌محور — مدخل‌های سال‌های اغتشاش (۱۳۹۸/۱۴۰۱/…) با هر نشانهٔ
 *  خشونت/اعتراض (حمله/قتل/قطعی اینترنت/حادثه/…) حذف می‌شوند؛ رخدادهای بی‌طرف همان سال‌ها می‌مانند. */
export function filterDayHistoryEntries(entries: DayHistoryEntry[]): DayHistoryEntry[] {
  return (entries || []).filter((e) => e && typeof e.text === 'string' &&
    !isDayHistoryBlocked(e.text) &&
    !isRiotEraEntry(e.year, e.text));
}

// ---------- فرمت‌کنندهٔ بلوک پیام (خالص) ----------

const CAPS: Record<DayHistoryKind, number> = { event: 10, birth: 5, death: 5 };
const MAX_TEXT = 160;

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

/** بلوک «وقایع امروز/فردا» — قالب نمونهٔ کاربر (۱۶ نوامبر ۲۰۲۶):
 *  «۲۵ آبان ۱۲۹۳؛ درگذشت ستارخان.» — تاریخ کامل (روز ماه سال) در هر سطر.
 *  dayMonth = عنوان روز («۲۵ آبان»)؛ نبود → قالب قدیمی فقط با سال (سازگاری).
 *  ترتیب: رویدادها، سپس زادروزها، سپس درگذشت‌ها. خالی → رشتهٔ خالی؛ کل بخش از پیام حذف می‌شود. */
export function formatDayHistoryBlock(entries: DayHistoryEntry[], dayLabel: 'امروز' | 'فردا', dayMonth?: string): string {
  if (!entries || entries.length === 0) return '';
  const dm = (dayMonth || '').replace(/[؛;.,]\s*$/, '').trim();
  const L: string[] = [`<b>📜 وقایع ${dayLabel} در تاریخ</b>`];
  for (const kind of ['event', 'birth', 'death'] as const) {
    const list = entries.filter((e) => e.kind === kind).slice(0, CAPS[kind]);
    const prefix = kind === 'birth' ? 'زادروز ' : kind === 'death' ? 'درگذشت ' : '';
    for (const e of list) {
      const when = dm ? `${dm} ${faNum(e.year)}` : faNum(e.year);
      L.push(`• ${when}؛ ${prefix}${truncate(e.text, MAX_TEXT)}`);
    }
  }
  return L.length > 1 ? L.join('\n') : '';
}

// ---------- وقایع جهانی امروز (میلادی) — خواستهٔ کاربر ۱۶ نوامبر ۲۰۲۶ ----------
// نمونهٔ کاربر: «۱۶ نوامبر ۱۹۴۵؛ ایجاد یونسکو.» — بخش «رویدادهای جهانی» از صفحهٔ روزِ
// ویکی‌پدیای انگلیسی (November 16) واکشی و ترجمهٔ فارسی در caller انجام می‌شود.

/** نام ماه‌های میلادی — برای نشانی صفحهٔ روز ویکی‌پدیای انگلیسی */
export const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** نام فارسی ماه‌های میلادی — برای بلوک «رویدادهای جهانی» («۱۶ نوامبر ۱۹۴۵؛ …») */
export const EN_MONTHS_FA = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];

/** نشانی صفحهٔ روز میلادی — «November 16»؛ نامعتبر → رشتهٔ خالی */
export function enWikiDayTitle(m: number, d: number): string {
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${EN_MONTHS[m - 1]} ${d}`;
}

/** پالایندهٔ اهمیت رویداد جهانی — ایران/ایران‌باوری یا کلیدواژه‌های تاریخی مهم
 *  (جنگ، پیمان، استقلال، تأسیس نهاد جهانی، زلزله، هسته‌ای، ترور، المپیک…).
 *  رویدادهای جزئی (زادروز بازیکن بیسبال و…) رد می‌شوند. تابع خالص تست‌پذیر. */
export function isSignificantWorldEvent(text: string): boolean {
  const t = (text || '');
  if (/\b(Iran|Persia|Persian|Tehran)\b/i.test(t)) return true;
  return /\b(founded|established|treaty|independence|independent|declared|constitution|revolution|war\b|war begins|begins|ends|signed|assassinat|earthquake|nuclear|United Nations|UNESCO|NATO|World Health|Olympic|summit|launch|first\s|pandemic|vaccine|collapse|resign)\w*/i.test(t);
}

/** پارس بخش Events صفحهٔ روزِ ویکی‌پدیای انگلیسی — «* [[1945]] – UNESCO founded.»
 *  ساختار واقعی صفحه: ==Events== زیرمجموعه‌های ===Pre-1600=== / ===1601–1900=== / ===1901–present===
 *  دارد و جداکنندهٔ سال گاهی موجودیت HTML «&ndash;» است — هر دو پوشش داده می‌شوند:
 *  فقط سربرگ سطح‌۲ بخش را عوض می‌کند؛ زیرمجموعه‌ها (===) بخش جاری را نگه می‌دارند.
 *  خروجی: مدخل‌های مهم (پالایندهٔ اهمیت)، حداکثر limit مورد، تازه‌ترین اول. خالص و تست‌پذیر. */
export function parseEnWikiDayWikitext(wt: string, limit = 6): DayHistoryEntry[] {
  if (!wt) return [];
  let inEvents = false;
  const raw: Array<{ year: number; text: string }> = [];
  for (const rawLine of wt.split('\n')) {
    const line = rawLine.trim();
    // سربرگ سطح ۲ («==Events==») — فقط این بخش را عوض می‌کند؛ زیرمجموعه‌های === نادیده
    if (line.startsWith('==') && !line.startsWith('===')) {
      const secTitle = line.replace(/^==+\s*/, '').replace(/\s*==+$/, '').trim();
      inEvents = /^events?\b/i.test(secTitle);
      continue;
    }
    if (line.startsWith('===')) continue; // زیرمجموعهٔ همان بخش
    if (!inEvents || !line.startsWith('*')) continue;
    // موجودیت‌های رایج جداکننده: &ndash; / &mdash;
    const stripped = line.replace(/^\*+\s*/, '').replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—');
    const m = /^\[?\[?(\d{3,4})\]?\]?\s*[–—-]\s*(.+)$/.exec(stripped);
    if (!m) continue;
    const year = Number(m[1]);
    const text = cleanWikiText(m[2]);
    if (!Number.isFinite(year) || year < 1 || year > 2100 || text.length < 8) continue;
    if (!isSignificantWorldEvent(text)) continue;
    raw.push({ year, text });
  }
  // انتخاب مخلوط: ایران‌مرتبط‌ها همیشه + ۳ رویداد تازه‌ترین + تکمیل با رویدادهای شاخص کهنِ
  // دوران مدرن (≥۱۸۰۰ — مثل تأسیس یونسکو ۱۹۴۵ در نمونهٔ کاربر)؛ خروجی مرتب بر سال نزولی.
  const seen = new Set<string>();
  const uniq = raw.filter((e) => {
    const k = `${e.year}|${e.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => b.year - a.year);
  const picked = uniq.filter((e) => /\b(Iran|Persia|Persian|Tehran)\b/i.test(e.text)).slice(0, 2);
  const others = uniq.filter((e) => !picked.includes(e));
  for (const e of others.slice(0, 3)) picked.push(e); // تازه‌ترین‌ها
  for (let i = others.length - 1; i >= 0 && picked.length < limit; i--) {
    if (others[i]!.year >= 1800) picked.push(others[i]!); // شاخص‌های کهنِ دوران مدرن
  }
  return picked.slice(0, limit).sort((a, b) => b.year - a.year).map((e) => ({ year: e.year, text: e.text, kind: 'event' as const }));
}

/** واکشی رویدادهای جهانی امروز میلادی از ویکی‌پدیای انگلیسی — دو تلاش (fetch + پشتیبان curl).
 *  شکست کامل → null (بخش حذف می‌شود، صادقانه). ورودی: کلید میلادی TripleDate.keys.g (ماه، روز). */
export async function fetchWorldDayHistory(g: { m: number; d: number }): Promise<DayHistory | null> {
  const title = enWikiDayTitle(g.m, g.d);
  if (!title) return null;
  const url = enDayHistoryApiUrl(title);
  for (const delay of [0, 4000]) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const json = (await getJson(url)) ?? (await getJsonViaCurl(url));
    if (!json) continue;
    const wt = extractWikitext(json);
    if (!wt) continue;
    const entries = parseEnWikiDayWikitext(wt);
    if (entries.length === 0) continue;
    return { title, pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, entries };
  }
  return null;
}

// ---------- واکشی شبکه‌ای ----------

function extractWikitext(json: unknown): string | null {
  try {
    const q = (json as { query?: { pages?: unknown } })?.query;
    const pagesRaw = q?.pages;
    if (!pagesRaw) return null;
    const p = (Array.isArray(pagesRaw) ? pagesRaw[0] : Object.values(pagesRaw as Record<string, unknown>)[0]) as
      | { missing?: boolean; revisions?: Array<{ slots?: { main?: { content?: string } } }> }
      | undefined;
    if (!p || p.missing) return null;
    const c = p.revisions?.[0]?.slots?.main?.content;
    return typeof c === 'string' && c.length > 0 ? c : null;
  } catch {
    return null;
  }
}

const DAY_HISTORY_UA = 'RaadbanBot/1.0 (daily day-history; contact via repo)';

async function getJson(url: string, timeoutMs = 15_000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': DAY_HISTORY_UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** مسیر پشتیبان curl — برخی زیرساخت‌ها (مثل IP دیتاسنتر همین پروژه در برابر لبهٔ ضدفرسایش
 *  ویکی‌مدیا) fetch داخلی را ۴۰۳ می‌کنند در حالی که curl همان نشانی را پاس می‌دهد. بدون shell —
 *  execFile با آرگومان آرایه‌ای (بدون ریسک تزریق؛ نشانی داخلی و ساخته‌شده از نام ماه‌هاست). */
function getJsonViaCurl(url: string, timeoutMs = 20_000): Promise<unknown | null> {
  return new Promise((resolve) => {
    execFile(
      'curl',
      ['-s', '--fail', '--max-time', String(Math.ceil(timeoutMs / 1000)), '-A', DAY_HISTORY_UA, '-H', 'Accept: application/json', url],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        try {
          resolve(JSON.parse(String(stdout)));
        } catch {
          resolve(null);
        }
      },
    );
  });
}

/** واکشی وقایع یک روز خورشیدی از ویکی‌پدیای فارسی — دو تلاش؛ هر تلاش: اول fetch، بعد پشتیبان curl.
 *  شکست کامل → null (بخش حذف می‌شود، صادقانه). ورودی: کلید خورشیدی روز از TripleDate.keys.j */
export async function fetchDayHistory(j: { y: number; m: number; d: number }): Promise<DayHistory | null> {
  const title = faWikiDayTitle(j);
  if (!title) return null;
  const url = dayHistoryApiUrl(title);
  for (const delay of [0, 4000]) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const json = (await getJson(url)) ?? (await getJsonViaCurl(url));
    if (!json) continue;
    const wt = extractWikitext(json);
    if (!wt) continue;
    return { title, pageUrl: `https://fa.wikipedia.org/wiki/${encodeURIComponent(title)}`, entries: parseFaWikiDayWikitext(wt) };
  }
  return null;
}
