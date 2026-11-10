/**
 * پیام‌های روزانهٔ رصدبان — صبحگاهی ۰۵:۰۰ و شبانگاهی ۲۰:۰۰ (به وقت کانال)
 * خواستهٔ کاربر (۱۰ نوامبر ۲۰۲۶): بسم‌الله + حدیث چهارده معصوم + تصویر طبیعت + تاریخ
 * سه‌گانه + مناسبت‌ها (+ اوقات شرعی فردا در پیام شبانگاهی). «صحت و اعتبار محتوا بر سرعت
 * انتشار اولویت دارد» — هیچ حدیث/مناسبت/زمان ساختگی تولید نمی‌شود.
 *
 * معماری: توابع خالص و تست‌پذیر + دو واکشی شبکه‌ای (تصویر ویکی‌مدیا). دفتر کل ربات =
 * فیلد daily از bot/state.json (هر چرخه در ریپو کامیت می‌شود — پس از ری‌استارت هم می‌ماند)؛
 * اپلیکیشن همین را به جدول‌های DailySettings/DailyRunLog/HadithUsage/DailyImageUsage آینه می‌کند.
 */
import { HADITH_BANK, INFALLIBLES, type HadithEntry, type InfallibleKey } from './hadiths-data';
import { OCCASIONS, type Occasion, type OccasionCategory, type OccasionCalendar } from './occasions-data';
import { tripleDateOf, shiftDateKey, type QamariBasis, type TripleDate } from './calendar';
import { formatPrayerBlock, computePrayerTimes, type PrayerSettings, type PrayerTimesDay } from './prayer';

// ---------- قالب‌بندی متن ----------

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function faDigits(s: string): string {
  return s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

// ---------- ضدتکرار حدیث (شناسه‌ای + معنایی) ----------

export interface HadithUsage { id: string; dateKey: string; kind: 'morning' | 'evening' }

/** نرمال‌سازی متن عربی برای تشخیص تکرار معنایی — حذف اعراب/نقطه‌گذاری، یکسان‌سازی حروف */
export function normalizeHadithArabic(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // اعراب و کشیده
    .replace(/[ٱأإآ]/g, 'ا')
    .replace(/[ىئيي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensOf(s: string): Set<string> {
  return new Set(normalizeHadithArabic(s).split(' ').filter((w) => w.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** آیا نامزد با یکی از احادیثِ پیش‌تر منتشرشده هم‌مضمون است؟ (آستانهٔ محافظه‌کارانهٔ ۰٫۷۲) */
export function isSemanticDuplicate(candidate: string, usedArabic: string[]): boolean {
  const ct = tokensOf(candidate);
  for (const u of usedArabic) {
    if (jaccard(ct, tokensOf(u)) >= 0.72) return true;
  }
  return false;
}

export interface PickHadithOpts {
  kind: 'morning' | 'evening';
  dateKey: string;
  /** شناسه‌های به‌کاررفتهٔ دائمی — هرگز هرس نمی‌شود (بانک محدود است) */
  usedHadithIds: Record<string, HadithUsage>;
  /** نشانگر چرخش چهارده معصوم ۰..۱۳ — برای انتخاب متعادل */
  infallibleCursor: number;
}

export interface PickHadithResult {
  hadith: HadithEntry;
  nextCursor: number;
}

/** انتخاب حدیث: چرخش متعادل روی چهارده معصوم + ضدتکرار مطلق + ضدتکرار معنایی.
 *  هیچ‌کدام پیدا نشد → null (صادقانه: «بانک به پایان رسیده» — هیچ ساختگی). */
export function pickHadith(opts: PickHadithOpts): PickHadithResult | null {
  const usedIds = new Set(Object.keys(opts.usedHadithIds || {}));
  const usedArabic = HADITH_BANK.filter((h) => usedIds.has(h.id)).map((h) => h.arabic);
  const start = ((opts.infallibleCursor % INFALLIBLES.length) + INFALLIBLES.length) % INFALLIBLES.length;
  for (let i = 0; i < INFALLIBLES.length; i++) {
    const idx = (start + i) % INFALLIBLES.length;
    const inf = INFALLIBLES[idx];
    const candidates = HADITH_BANK.filter((h) => h.infallible === inf.key && !usedIds.has(h.id));
    for (const h of candidates) {
      if (isSemanticDuplicate(h.arabic, usedArabic)) continue;
      return { hadith: h, nextCursor: (idx + 1) % INFALLIBLES.length };
    }
  }
  return null;
}

/** پیام وضعیت بانک برای پنل مدیریت */
export function bankStatus(usedHadithIds: Record<string, HadithUsage>): { total: number; used: number; remaining: number; perInfallible: Array<{ name: string; total: number; used: number }> } {
  const used = new Set(Object.keys(usedHadithIds || {}));
  const perInfallible = INFALLIBLES.map((inf) => ({
    name: inf.name,
    total: HADITH_BANK.filter((h) => h.infallible === inf.key).length,
    used: HADITH_BANK.filter((h) => h.infallible === inf.key && used.has(h.id)).length,
  }));
  return { total: HADITH_BANK.length, used: used.size, remaining: HADITH_BANK.length - used.size, perInfallible };
}

// ---------- مناسبت‌ها ----------

const ORDER: OccasionCategory[] = ['official', 'religious', 'history-ir', 'world', 'history-world'];

function faYear(n: number | undefined): string {
  if (!n) return '';
  // سال میلادی/شمسی/هجری هر سه با ارقام فارسی
  return ` (${faDigits(String(n))})`;
}

export interface OccasionHit extends Occasion {
  calLabel: string;
}

/** مناسبت‌های یک روز سه‌تقویمی — بدون ساختگی؛ خالی بود یعنی واقعاً مناسبت ثبت‌شده‌ای نیست */
export function matchOccasions(td: TripleDate): OccasionHit[] {
  const hits: OccasionHit[] = [];
  const calLabel: Record<OccasionCalendar, string> = { shamsi: 'شمسی', qamari: 'قمری', miladi: 'میلادی' };
  for (const o of OCCASIONS) {
    const k = o.cal === 'shamsi' ? td.keys.j : o.cal === 'qamari' ? td.keys.h : td.keys.g;
    if (k.m === o.m && k.d === o.d) hits.push({ ...o, calLabel: calLabel[o.cal] });
  }
  return hits;
}

/** بلوک مناسبت‌ها — فهرست ساده و بی‌برچسب (خواستهٔ کاربر: «برچسب‌ها رو حذف کن»)
 *  خالی → پیام صادقانه؛ ترتیب: رسمی/ملی، مذهبی، تاریخی ایران، جهانی */
export function formatOccasionsBlock(hits: OccasionHit[], dayLabel: 'امروز' | 'فردا', compact = false): string {
  if (hits.length === 0) {
    return `<b>🎉 مناسبت‌های ${dayLabel}</b>\n• مناسبت رسمی یا واقعهٔ تاریخی ثبت‌شده‌ای برای ${dayLabel} در بانک نیست.`;
  }
  const L: string[] = [`<b>🎉 مناسبت‌های ${dayLabel}</b>`];
  const ordered = [...hits].sort((a, b) => ORDER.indexOf(a.cat) - ORDER.indexOf(b.cat));
  for (const h of ordered.slice(0, compact ? 6 : 10)) {
    L.push(`• ${xmlEsc(h.title)}${faYear(h.year)}`);
  }
  return L.join('\n');
}

// ---------- تصویر روز طبیعت — ویکی‌مدیا (مجوزدار، بدون کلید) ----------

export interface NatureImage {
  url: string; // آدرس مستقیم تصویر
  imageKey: string; // آدرس پایهٔ فایل — ضدتکرار
  title: string;
  pageUrl: string;
  artist: string;
  license: string;
  /** برچسب منبع برای کپشن — Wikimedia Commons | Openverse (CC) */
  sourceLabel: string;
}

const MORNING_QUERIES = [
  'sunrise mountain landscape',
  'misty forest morning',
  'river valley dawn',
  'green meadow sunrise',
  'lake sunrise calm',
  'forest trail morning light',
  'waterfall green landscape',
  'golden sunrise field',
];
const EVENING_QUERIES = [
  'sunset landscape sea',
  'starry sky mountains night',
  'moonlit lake night',
  'forest dusk twilight',
  'mountain sunset panorama',
  'sea horizon sunset calm',
  'night sky stars landscape',
  'sunset lake reflection',
];

const HUMAN_WORDS = /people|person|man\b|woman|portrait|crowd|child|silhouette|human|tourist|street|building|church|mosque|temple|statue|sculpture|city|urban/i;

async function getJson(url: string, timeoutMs = 15_000, headers?: Record<string, string>): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: headers ?? { 'User-Agent': 'RaadbanBot/1.0 (daily nature image; contact via repo)', Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface CommonsPage {
  title?: string;
  imageinfo?: Array<{ url?: string; thumburl?: string; thumbwidth?: number; descriptionurl?: string; width?: number; extmetadata?: Record<string, { value?: string }> }>;
}

/** استخراج تصویر از پاسخ ویکی‌مدیا — تابع خالص تست‌پذیر */
export function pickNatureFromCommons(json: unknown, usedKeys: Set<string>): NatureImage | null {
  try {
    const pages = Object.values((json as { query?: { pages?: Record<string, CommonsPage> } })?.query?.pages || {});
    const cands: NatureImage[] = [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info) continue;
      const url = info.thumburl || info.url;
      if (!url) continue;
      const width = info.width || info.thumbwidth || 0;
      if (width && width < 1100) continue;
      const title = (p.title || '').replace(/^File:/, '');
      if (HUMAN_WORDS.test(title)) continue;
      const meta = info.extmetadata || {};
      const strip = (s: string | undefined) => (s || '').replace(/<[^>]+>/g, '').trim().slice(0, 120);
      cands.push({
        url,
        imageKey: (info.url || url).split('?')[0],
        title,
        pageUrl: info.descriptionurl || 'https://commons.wikimedia.org',
        artist: strip(meta.Artist?.value) || 'نامشخص',
        license: strip(meta.LicenseShortName?.value) || 'مشخص‌نشده',
        sourceLabel: 'Wikimedia Commons',
      });
    }
    const fresh = cands.filter((c) => !usedKeys.has(c.imageKey));
    const pool = fresh.length > 0 ? fresh : cands;
    if (pool.length === 0) return null;
    // انتخاب قطعی بر اساس ترکیب کلیدها — نه Math.random بی‌تست‌پذیر
    const idx = Math.abs(hashOf([...usedKeys].sort().join('|'))) % pool.length;
    return pool[idx];
  } catch {
    return null;
  }
}

const NO_IMAGE_WORDS = /banner|logo|icon|map|diagram|chart|graph|text|font|screenshot|drawing|painting|illustration|observatory|bridge|tower|skyline/i;

/** پارس پاسخ Openverse (تصاویر CC بدون کلید) — تابع خالص تست‌پذیر */
export function pickNatureFromOpenverse(json: unknown, usedKeys: Set<string>): NatureImage | null {
  try {
    const results = (json as { results?: Array<Record<string, unknown>> })?.results || [];
    const cands: NatureImage[] = [];
    for (const r of results) {
      const url = typeof r.url === 'string' ? r.url : '';
      if (!url) continue;
      const width = Number(r.width) || 0;
      const height = Number(r.height) || 0;
      if (width && width < 1100) continue;
      if (height && width && height / width > 1.1) continue; // عمودیِ خیلی بلند نه
      const title = typeof r.title === 'string' ? r.title : '';
      if (HUMAN_WORDS.test(title) || NO_IMAGE_WORDS.test(title)) continue;
      const license = [typeof r.license === 'string' ? r.license.toUpperCase() : '', typeof r.license_version === 'string' ? r.license_version : ''].filter(Boolean).join(' ') || 'CC';
      cands.push({
        url,
        imageKey: url.split('?')[0],
        title: title.slice(0, 140) || 'nature photo',
        pageUrl: typeof r.foreign_landing_url === 'string' ? r.foreign_landing_url : 'https://openverse.org',
        artist: (typeof r.creator === 'string' ? r.creator : '').trim().slice(0, 100) || 'نامشخص',
        license,
        sourceLabel: 'Openverse (CC)',
      });
    }
    const fresh = cands.filter((c) => !usedKeys.has(c.imageKey));
    const pool = fresh.length > 0 ? fresh : cands;
    if (pool.length === 0) return null;
    const idx = Math.abs(hashOf([...usedKeys].sort().join('|'))) % pool.length;
    return pool[idx];
  } catch {
    return null;
  }
}

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** واکشی تصویر طبیعت — منبع اول ویکی‌مدیا (۳ تلاش)، منبع دوم Openverse (CC بدون کلید).
 *  شکست هر دو → null (پیام بدون عکس + ثبت خطا، هیچ عکس ساختگی) */
export async function fetchNatureImage(kind: 'morning' | 'evening', dateKey: string, usedImages: Record<string, { dateKey: string; kind: string }>): Promise<NatureImage | null> {
  const queries = kind === 'morning' ? MORNING_QUERIES : EVENING_QUERIES;
  const q = queries[Math.abs(hashOf(`${kind}:${dateKey}`)) % queries.length];
  const usedKeys = new Set(Object.keys(usedImages || {}));

  // ۱) ویکی‌مدیا Commons — جست‌وجوی مستند با مجوز و عکاس
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(`filetype:bitmap ${q}`)}&gsrnamespace=6&gsrlimit=25&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  for (const d of [0, 4000, 10_000]) {
    if (d > 0) await new Promise((r) => setTimeout(r, d));
    const json = await getJson(api);
    if (!json) continue;
    const picked = pickNatureFromCommons(json, usedKeys);
    if (picked) return picked;
  }

  // ۲) پشتیبان Openverse — تجمیع تصاویر CC (Flickr/StockSnap/…) با اطلاعات مجوز
  //  نکتهٔ عملی: Openverse با UA سفارشی پاسخ ۴۰۱/۵۰۴ می‌دهد — درخواست با هدر پیش‌فرض
  const ov = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial&size=large&page_size=20`;
  for (const d of [0, 5000]) {
    if (d > 0) await new Promise((r) => setTimeout(r, d));
    const json = await getJson(ov, 15_000, { Accept: 'application/json' });
    if (!json) continue;
    const picked = pickNatureFromOpenverse(json, usedKeys);
    if (picked) return picked;
  }
  return null;
}

// ---------- پیام‌ها ----------

export interface DailyContext {
  kind: 'morning' | 'evening';
  dateKey: string; // روزِ پیام (صبح: امروز؛ شب: امروز و تاریخ فردا)
  tz: string;
  qamariBasis: QamariBasis;
  city: string;
  prayer?: PrayerSettings;
  hadith: HadithEntry;
  image: NatureImage | null;
}

export interface DailyMessage {
  text: string;
  photoUrl?: string;
  photoCaption?: string;
}

/** بلوک تاریخ — بدون برچسب (خواستهٔ صریح کاربر ۱۰ نوامبر ۲۰۲۶: «ننویس شمسی: یا میلادی: —
 *  این بخش‌ها رو حذف کن»). ماه‌ها خودْ گویا هستند: آبان = خورشیدی، رجب = قمری، نوامبر = میلادی.
 *  تنها یادداشت کوچک، مبنای تقویم قمری است (الزام شفافیت روش محاسبه). */
function datesBlock(td: TripleDate, dayLabel: string): string {
  const basis = td.qamariBasis === 'umalqura' ? 'ام‌القری' : 'تقویم مدنی قمری';
  return [
    `📅 <b>${dayLabel}: ${xmlEsc(td.weekdayFa)}</b>`,
    `${xmlEsc(td.shamsi)} • ${xmlEsc(td.qamari)} • ${xmlEsc(td.miladi)}`,
    `<i>(تقویم قمری بر مبنای ${basis})</i>`,
  ].join('\n');
}

/** بلوک حدیث — بدون برچسب (خواستهٔ صریح کاربر: «فقط بنویس پیامبر اکرم(ص): متن حدیث»)
 *  گویندهٔ مستقیم + متن عربی + ترجمهٔ روان + منبع مستند — بدون هیچ سربرگ جداکننده */
function hadithBlock(h: HadithEntry): string {
  return [
    `<b>${xmlEsc(h.narrator)}:</b>`,
    `«${xmlEsc(h.arabic)}»`,
    '',
    `«${xmlEsc(h.persian)}»`,
    `📚 ${xmlEsc(h.source)}`,
  ].join('\n');
}

/** پیام صبحگاهی — متن + عکس. هیچ بخش ساختگی: حدیث ندارد → پیام صادر نمی‌شود (در caller). */
export function buildMorningMessage(ctx: DailyContext & { today: TripleDate; occasions: OccasionHit[] }): DailyMessage {
  const { today, occasions, hadith, image } = ctx;
  const L: string[] = [
    `<b>${BISMILLAH}</b>`,
    '',
    `🌅 <b>پیام صبحگاهی رصدبان</b>`,
    '',
    hadithBlock(hadith),
    '',
    datesBlock(today, 'امروز'),
    '',
    formatOccasionsBlock(occasions, 'امروز'),
    '',
    '— رصدبان | پیام صبحگاهی هر روز ساعت ۵:۰۰',
  ];
  const msg: DailyMessage = { text: L.join('\n') };
  if (image) {
    msg.photoUrl = image.url;
    msg.photoCaption = [
      '🌄 تصویر صبحگاهی طبیعت',
      `📌 منبع: ${xmlEsc(image.sourceLabel)}`,
      `👤 عکاس: ${xmlEsc(image.artist)}`,
      `📜 مجوز: ${xmlEsc(image.license)}`,
      '',
      'صبحتان بخیر 🌅',
    ].join('\n');
  }
  return msg;
}

/** پیام شبانگاهی — تاریخِ «فردا» + مناسبت‌های فردا + اوقات شرعی فردا */
export function buildEveningMessage(ctx: DailyContext & { tomorrow: TripleDate; tomorrowOccasions: OccasionHit[]; prayerTimes: PrayerTimesDay | null }): DailyMessage {
  const { tomorrow, tomorrowOccasions, hadith, image, prayerTimes, city } = ctx;
  const L: string[] = [
    `<b>${BISMILLAH}</b>`,
    '',
    `🌙 <b>پیام شبانگاهی رصدبان</b>`,
    '',
    hadithBlock(hadith),
    '',
    datesBlock(tomorrow, 'فردا'),
    '',
    formatOccasionsBlock(tomorrowOccasions, 'فردا', true),
    '',
  ];
  if (prayerTimes) {
    L.push(formatPrayerBlock(prayerTimes, city, tomorrow.shamsi));
    L.push('');
  } else {
    L.push('🕌 اوقات شرعی فردا: محاسبهٔ نجومی در دسترس نبود — زمان اشتباه یا حدسی منتشر نمی‌شود.');
    L.push('');
  }
  L.push('— رصدبان | پیام شبانگاهی هر روز ساعت ۲۰:۰۰');
  const msg: DailyMessage = { text: L.join('\n') };
  if (image) {
    msg.photoUrl = image.url;
    msg.photoCaption = [
      '🌌 تصویر شبانهٔ طبیعت',
      `📌 منبع: ${xmlEsc(image.sourceLabel)}`,
      `👤 عکاس: ${xmlEsc(image.artist)}`,
      `📜 مجوز: ${xmlEsc(image.license)}`,
      '',
      'شبتان بخیر 🌙',
    ].join('\n');
  }
  return msg;
}

/** ساخت پیام کامل بر اساس تنظیمات — بدون هیچ واکشی state؛ caller تصمیم ارسال/ثبت می‌گیرد */
export async function buildDailyMessage(input: {
  kind: 'morning' | 'evening';
  dateKey: string;
  tz: string;
  qamariBasis: QamariBasis;
  city: string;
  prayer: PrayerSettings;
  hadith: HadithEntry;
  image: NatureImage | null;
}): Promise<DailyMessage> {
  const td = tripleDateOf(input.dateKey, input.tz, input.qamariBasis);
  if (input.kind === 'morning') {
    return buildMorningMessage({ ...input, today: td, occasions: matchOccasions(td) });
  }
  // شب: تاریخ فردا
  const tomorrow = tripleDateOf(shiftDateKey(input.dateKey, 1), input.tz, input.qamariBasis);
  const pt = computePrayerTimes(shiftDateKey(input.dateKey, 1), input.prayer);
  return buildEveningMessage({ ...input, tomorrow, tomorrowOccasions: matchOccasions(tomorrow), prayerTimes: pt });
}
