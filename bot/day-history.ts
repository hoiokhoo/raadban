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

// ---------- فرمت‌کنندهٔ بلوک پیام (خالص) ----------

const CAPS: Record<DayHistoryKind, number> = { event: 10, birth: 5, death: 5 };
const MAX_TEXT = 160;

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

/** بلوک «وقایع امروز/فردا» — به سبک نمونهٔ کاربر: «۱۲۷۶؛ زادروز نیما یوشیج، پدر شعر نو فارسی».
 *  ترتیب: رویدادها، سپس زادروزها، سپس درگذشت‌ها. خالی → رشتهٔ خالی؛ کل بخش از پیام حذف می‌شود. */
export function formatDayHistoryBlock(entries: DayHistoryEntry[], dayLabel: 'امروز' | 'فردا'): string {
  if (!entries || entries.length === 0) return '';
  const L: string[] = [`<b>📜 وقایع ${dayLabel} در تاریخ</b>`];
  for (const kind of ['event', 'birth', 'death'] as const) {
    const list = entries.filter((e) => e.kind === kind).slice(0, CAPS[kind]);
    const prefix = kind === 'birth' ? 'زادروز ' : kind === 'death' ? 'درگذشت ' : '';
    for (const e of list) L.push(`• ${faNum(e.year)}؛ ${prefix}${truncate(e.text, MAX_TEXT)}`);
  }
  return L.length > 1 ? L.join('\n') : '';
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
