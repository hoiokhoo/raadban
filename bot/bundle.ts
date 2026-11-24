/**
 * بستهٔ خبری دوره‌ای — خواستهٔ کاربر (۱۲ نوامبر ۲۰۲۶):
 * «چرخهٔ ارسال خبر بشه هر ۲ ساعت اما خبری از قلم نیفته؛ توییت‌های افراد تأثیرگذار هم هر ۲ ساعت
 *  اما یک ساعت بعد از دستهٔ اخبار، در دستهٔ جداگانه — اگر توییت تازه نبود هیچ متنی نفرست».
 * زمان‌بندی اسلات‌محور و قطعی است (نه فاصله‌ای متغیر): بستهٔ خبری در ساعت‌های زوج تهران
 * (۰۰، ۰۲، …، ۲۲) و بستهٔ توییت در ساعت‌های فرد (۰۱، ۰۳، …، ۲۳) — یعنی دقیقاً یک ساعت بعد.
 * مسیر اصلی خبر: تحلیل هوشمند بازه (bot/hourly.ts — تجمیع مشابه‌ها + تیک اعتبارسنجی + تحلیل).
 * این ماژول تقسیم چندپیامی مسیر پشتیبان (شکست مدل) + بستهٔ توییت + توابع اسلات خالص است —
 * بدون هیچ برندی («بست رصدبان» حذف شده) و «بدون سربرگ زمانی» در همهٔ بسته‌ها
 * (خواستهٔ صریح کاربر ۱۲ و ۱۳ نوامبر ۲۰۲۶).
 */
import { shiftDateKey } from './calendar';
import { mergeSimilarItems, type HourlyItem, type MergedItem } from './hourly';

export interface BundleItem {
  kind: 'news' | 'tweet';
  text: string;
  /** متن اصلی توییت (انگلیسی/هر زبان) — توییت‌ها «متن اصلی + نام فارسی توییت‌کننده: ترجمه»
  *  نشان داده می‌شوند (خواستهٔ کاربر ۱۶ نوامبر ۲۰۲۶: بجای برچسب «ترجمه فارسی» نام توییت‌کننده
  *  به فارسی بیاید)؛ خبر فارسی و توییت فارسی این فیلد را ندارند */
  orig?: string;
  /** نام فارسی توییت‌کننده + مسئولیت («دونالد ترامپ (رئیس‌جمهور آمریکا)») — خط دوم توییت */
  faName?: string;
  /** نام منبع برای پیکرهٔ تحلیل ساعتی («ایسنا» یا «𝕏 @handle») — خواستهٔ کاربر: تیک اعتبارسنجی بر پایهٔ شمار منابع */
  source?: string;
  /** برای علامت‌زدن ضدتکرار پس از ارسال موفق */
  ids: string[];
  titleKeys: string[];
  titleTexts: string[];
  msgText?: string;
  cat?: string;
  queuedAt: string; // ISO
}

/** آیا زمان ارسال بستهٔ ساعتی رسیده؟ — lastBundleAt نامشخص → true (اولین بسته بلافاصله)
 *  (از نسخهٔ ۱۲ نوامبر ربات از اسلات‌های قطعی dueBundleSlotKey استفاده می‌کند؛ این تابع برای
 *  سازگاری و تست باقی است) */
export function shouldFlushBundle(lastBundleAt: string | undefined, now: number, minMinutes = 60): boolean {
  if (!lastBundleAt) return true;
  const t = Date.parse(lastBundleAt);
  if (!Number.isFinite(t)) return true;
  return now - t >= minMinutes * 60_000;
}

// ---------- اسلات‌های قطعی بسته‌ها (خواستهٔ کاربر ۱۲ نوامبر ۲۰۲۶) ----------

/** کلید اسلات تکرارشونده — هر periodMin دقیقه با آغاز offsetMin از نیمه‌شب (به وقت کانال).
 *  مثال: offset=0/period=120 → کلید «<تاریخ>T00:00» و «T02:00» و … (بستهٔ خبری)؛
 *  offset=60/period=120 → «T01:00» و «T03:00» و … (بستهٔ توییت — یک ساعت بعد از خبر).
 *  پیش از نخستین اسلات روز (مثل ۰۰:۳۰ برای توییت) کلید اسلات دیروز برمی‌گردد (جبران).
 *  تابع خالص تست‌پذیر. */
export function periodicSlotKey(dateKey: string, minutes: number, offsetMin: number, periodMin: number): string {
  const period = Math.max(1, periodMin);
  let diff = minutes - offsetMin;
  let day = dateKey;
  if (diff < 0) { diff += 1440; day = shiftDateKey(dateKey, -1); }
  const start = offsetMin + Math.floor(diff / period) * period;
  const hh = String(Math.floor(start / 60)).padStart(2, '0');
  const mm = String(start % 60).padStart(2, '0');
  return `${day}T${hh}:${mm}`;
}

/** اسلات سررسیدشدهٔ بسته — null اگر همان اسلات قبلاً انجام شده است.
 *  آخرین اسلاتِ گذشته هنوز انجام نشده → کلید آن (اجرای جبرانی در اولین چرخهٔ بعد). تابع خالص. */
export function dueBundleSlotKey(
  now: number,
  offsetMin: number,
  periodMin: number,
  lastDone: string | undefined,
  parts: { dateKey: string; minutes: number }
): string | null {
  const key = periodicSlotKey(parts.dateKey, parts.minutes, offsetMin, periodMin);
  return key === lastDone ? null : key;
}

const DIVIDER = '➖➖➖➖➖';

// ---------- سقف حجم بسته‌ها (خواستهٔ ۲۵ نوامبر ۲۰۲۶: «حجم اخبار زیاده») ----------

export interface BundleBudget<T> {
  /** موارد همین اسلات — اولویت‌دار (جنگ/ایران) همیشه انتخاب، سپس ترتیب صف (قدیمی→جدید) */
  send: T[];
  /** به‌تعویق‌افتاده‌ها — به ابتدای صف برمی‌گردند و اسلات بعدی اول ارسال می‌شوند؛
   *  هیچ موردی بی‌صدا حذف نمی‌شود (اصل «خبری از قلم نمی‌افتد» دست‌نخورده) */
  deferred: T[];
}

/** سقف حجم بسته — نظم صف با «اولویت + FIFO»: موارد جنگ/ایران هرگز به تعویق نمی‌افتند و
 *  جلو می‌پرند؛ بقیه به ترتیب arrival تا سقف. مازاد deferred — اسلات بعد (≤ یک دوره) ارسال می‌شود.
 *  سپر انباشت: صفِ ≥ backlogFlush یعنی عقب‌افتادگی سنگین/فشار پایدار — سقف خاموش می‌شود و
 *  همه ارسال می‌شود (گرسنگیِ دائمی خبر بدتر از بستهٔ پرحجم است؛ صف خودش سقف سخت دارد).
 *  تابع خالص تست‌پذیر — کمینهٔ ۱ و بیشینهٔ ۸۸ قفل شده تا تنظیم غلط env ربات را لال نکند. */
export function budgetQueueForBundle<T extends { text: string }>(
  queue: T[],
  opts: { maxItems: number; isPriority: (text: string) => boolean; backlogFlush?: number }
): BundleBudget<T> {
  const max = Math.max(1, Math.min(88, Math.floor(opts.maxItems) || 1));
  if (queue.length <= max) return { send: queue.slice(), deferred: [] };
  if (opts.backlogFlush !== undefined && queue.length >= opts.backlogFlush) {
    return { send: queue.slice(), deferred: [] }; // سپر انباشت — تخلیهٔ کامل
  }
  const priority: T[] = [];
  const rest: T[] = [];
  for (const q of queue) (opts.isPriority(q.text) ? priority : rest).push(q);
  const send = priority.slice(); // گروه اولویت کامل می‌رود حتی اگر از سقف بگذرد
  if (send.length < max) send.push(...rest.slice(0, max - send.length));
  const deferred = rest.slice(Math.max(0, max - priority.length));
  return { send, deferred };
}


export interface BundleChunkOpts {
  maxLen?: number;
}

/** ساخت پیام‌های بست — گروه‌بندی موارد در قطعه‌های ≤ maxLen.
 *  خواستهٔ کاربر ۱۲ نوامبر ۲۰۲۶: سربرگ «🕒 اخبار …» حذف شد — پیام با خودِ خبرها آغاز می‌شود و
 *  بخش‌های ادامه فقط نشانگر «— ادامه» دارند. هر مورد هرگز نصف نمی‌شود مگر آنکه تنها و
 *  بزرگ‌تر از سقف باشد (آنگاه درون همان بخش شکسته می‌شود). */
export function buildBundleChunks(items: string[], opts: BundleChunkOpts = {}): string[] {
  const maxLen = Math.max(1200, opts.maxLen ?? 3300);
  if (items.length === 0) return [];
  const pieces: string[] = []; // قطعه‌های بدون سربرگ — شماره‌گذاری در پایان
  let current: string[] = [];
  let curLen = 0;
  const flushCurrent = () => {
    if (current.length > 0) pieces.push(current.join(`\n\n${DIVIDER}\n\n`));
    current = [];
    curLen = 0;
  };
  for (const it of items) {
    const sep = current.length > 0 ? DIVIDER.length + 4 : 0;
    if (current.length > 0 && curLen + sep + it.length > maxLen) flushCurrent();
    // یک موردِ تنها که از سقف بزرگ‌تر است — درون خودش شکسته می‌شود
    if (current.length === 0 && it.length > maxLen) {
      let rest = it;
      while (rest.length > maxLen) {
        let cut = rest.lastIndexOf('\n\n', maxLen);
        if (cut < maxLen * 0.4) cut = rest.lastIndexOf('\n', maxLen);
        if (cut < maxLen * 0.4) cut = maxLen;
        pieces.push(rest.slice(0, cut));
        rest = rest.slice(cut).trimStart();
      }
      if (rest) pieces.push(rest);
      continue;
    }
    current.push(it);
    curLen += (current.length > 1 ? DIVIDER.length + 4 : 0) + it.length;
  }
  flushCurrent();
  const n = pieces.length;
  return pieces.map((c, i) => {
    if (n <= 1) return c;
    if (i === 0) return `${c}\n\n${DIVIDER}\n\n— ادامه`;
    return `— ادامه\n\n${c}`;
  });
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
function faNum(n: number): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

// ---------- بستهٔ جداگانهٔ توییت‌ها (خواستهٔ کاربر ۱۲ نوامبر ۲۰۲۶) ----------

export interface TweetBundleResult {
  /** پیام‌های آمادهٔ ارسال (سربرگ خنثی + تجمیع مشابه‌ها) */
  chunks: string[];
  /** رویدادهای توییت پس از تجمیع مشابه‌ها */
  merged: MergedItem[];
}

/** متن نمایشی یک توییت — خواستهٔ کاربر (۱۹ نوامبر ۲۰۲۶): «میخوام متن زبان اصلی توییت یا
 *  تروث سوشال رو بزاری فقط فارس روان رو بزار» — متن اصلی حذف؛ فقط «نام فارسی (مسئولیت): ترجمهٔ
 *  فارسی روان». نبود faName → برچسب «🗣 ترجمه فارسی:». توییت فارسی/بدون ترجمه‌کننده → خود متن. خالص تست‌پذیر. */
export function tweetDisplayBody(_orig: string | undefined, fa: string, faName?: string): string {
  const one = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
  const t = one(fa);
  const label = one(faName || '');
  return label ? `${label}: ${t}` : t;
}

/** بستهٔ توییت‌های افراد مشهور و تأثیرگذار — دستهٔ جداگانه، یک ساعت بعد از بستهٔ خبر.
 *  خواستهٔ کاربر (۱۳ نوامبر ۲۰۲۶): فقط افراد مشهور/تأثیرگذار (نه خبرگزاری‌ها — فهرست bot/tweets.json)،
 *  هر توییت «نام حساب: متن اصلی + نام فارسی توییت‌کننده: ترجمهٔ فارسی زیرش» و «بدون هیچ سربرگ زمانی» —
 *  پیام با خودِ توییت‌ها آغاز می‌شود مثل بستهٔ خبری؛ ادامهٔ چندپیامی فقط نشانگر «— ادامه» دارد.
 *  صف خالی را caller با «هیچ پیامی» پاسخ می‌دهد (خواستهٔ صریح کاربر). تابع خالص تست‌پذیر. */
export function buildTweetBundleChunks(items: HourlyItem[], opts: { maxLen?: number } = {}): TweetBundleResult {
  const merged = mergeSimilarItems(items);
  const lines = merged.map((m) => {
    const extra = m.sources.length > 1 ? ` (+${faNum(m.sources.length - 1)} توییت مشابه)` : '';
    return `${m.sources[0] || 'حساب ناشناس'}${extra}: ${tweetDisplayBody(m.orig, m.text, m.faName)}`;
  });
  const maxLen = Math.max(1200, opts.maxLen ?? 3300);
  const chunks: string[] = [];
  let current: string[] = [];
  let curLen = 0;
  const flushCurrent = () => {
    if (current.length > 0) chunks.push(current.join(`\n\n${DIVIDER}\n\n`));
    current = [];
    curLen = 0;
  };
  for (const line of lines) {
    const sep = current.length > 0 ? DIVIDER.length + 4 : 0;
    if (current.length > 0 && curLen + sep + line.length > maxLen) flushCurrent();
    if (current.length === 0 && line.length > maxLen) {
      let rest = line;
      while (rest.length > maxLen) {
        let cut = rest.lastIndexOf(' ', maxLen);
        if (cut < maxLen * 0.4) cut = maxLen;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut).trimStart();
      }
      if (rest) chunks.push(rest);
      continue;
    }
    current.push(line);
    curLen += (current.length > 1 ? DIVIDER.length + 4 : 0) + line.length;
  }
  flushCurrent();
  // بدون سربرگ — خواستهٔ صریح کاربر ۱۳ نوامبر: عنوان «آخرین توییت‌ها از ساعت فلان تا فلان» حذف شد
  const n = chunks.length;
  return {
    merged,
    chunks: chunks.map((c, i) => {
      if (n <= 1) return c;
      if (i === 0) return `${c}\n\n${DIVIDER}\n\n— ادامه`;
      return `— ادامه\n\n${c}`;
    }),
  };
}
