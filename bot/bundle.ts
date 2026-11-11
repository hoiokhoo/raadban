/**
 * بستهٔ خبری دوره‌ای — خواستهٔ کاربر (۱۲ نوامبر ۲۰۲۶):
 * «چرخهٔ ارسال خبر بشه هر ۲ ساعت اما خبری از قلم نیفته؛ توییت‌های افراد تأثیرگذار هم هر ۲ ساعت
 *  اما یک ساعت بعد از دستهٔ اخبار، در دستهٔ جداگانه — اگر توییت تازه نبود هیچ متنی نفرست».
 * زمان‌بندی اسلات‌محور و قطعی است (نه فاصله‌ای متغیر): بستهٔ خبری در ساعت‌های زوج تهران
 * (۰۰، ۰۲، …، ۲۲) و بستهٔ توییت در ساعت‌های فرد (۰۱، ۰۳، …، ۲۳) — یعنی دقیقاً یک ساعت بعد.
 * مسیر اصلی خبر: تحلیل هوشمند بازه (bot/hourly.ts — تجمیع مشابه‌ها + تیک اعتبارسنجی + تحلیل).
 * این ماژول تقسیم چندپیامی مسیر پشتیبان (شکست مدل) + بستهٔ توییت + توابع اسلات خالص است —
 * با سربرگ خنثی زمانی، بدون هیچ برندی («بست رصدبان» حذف شده — خواستهٔ صریح کاربر).
 */
import { shiftDateKey } from './calendar';
import { mergeSimilarItems, type HourlyItem, type MergedItem } from './hourly';

export interface BundleItem {
  kind: 'news' | 'tweet';
  text: string;
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

function hhmmOf(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour12: false, hour: '2-digit', minute: '2-digit' }).format(d.getTime());
  } catch {
    return '';
  }
}

export interface BundleChunkOpts {
  /** بازهٔ زمانی برای سربرگ — ISO آغاز و پایان صف */
  fromIso?: string;
  toIso?: string;
  maxLen?: number;
}

/** ساخت پیام‌های بست — گروه‌بندی موارد در قطعه‌های ≤ maxLen با سربرگ و شمارهٔ بخش.
 *  هر مورد هرگز نصف نمی‌شود مگر آنکه تنها و بزرگ‌تر از سقف باشد (آن‌گاه درون همان بخش شکسته می‌شود).
 *  شماره‌گذاری پس از ساخت قطعه‌ها انجام می‌شود تا شمار واقعی بخش‌ها درست باشد. */
export function buildBundleChunks(items: string[], opts: BundleChunkOpts = {}): string[] {
  const maxLen = Math.max(1200, opts.maxLen ?? 3300);
  if (items.length === 0) return [];
  // سربرگ خنثی — فقط بازهٔ زمانی؛ هیچ برندی از خودش نمی‌گوید (خواستهٔ کاربر)
  const header = opts.fromIso && opts.toIso
    ? `🕒 اخبار ${hhmmOf(opts.fromIso)} تا ${hhmmOf(opts.toIso)}`
    : '🕒 اخبار این ساعت';
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
    if (n <= 1) return `${header}\n${DIVIDER}\n\n${c}`;
    if (i === 0) return `${header} — بخش ۱ از ${faNum(n)}\n${DIVIDER}\n\n${c}`;
    return `${header} — ادامهٔ بخش ${faNum(i + 1)} از ${faNum(n)}\n${DIVIDER}\n\n${c}`;
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

/** بستهٔ توییت‌های افراد تأثیرگذار — دستهٔ جداگانه، یک ساعت بعد از بستهٔ خبر.
 *  توییت‌های هم‌مضمون یکی می‌شوند؛ هر توییت «نام حساب: متنِ کامل ترجمه‌شده» می‌ماند.
 *  صف خالی را caller با «هیچ پیامی» پاسخ می‌دهد (خواستهٔ صریح کاربر). تابع خالص تست‌پذیر. */
export function buildTweetBundleChunks(items: HourlyItem[], opts: { fromIso?: string; toIso?: string; maxLen?: number } = {}): TweetBundleResult {
  const merged = mergeSimilarItems(items);
  const lines = merged.map((m) => {
    const extra = m.sources.length > 1 ? ` (+${faNum(m.sources.length - 1)} توییت مشابه)` : '';
    return `𝕏 ${m.sources[0] || 'حساب ناشناس'}${extra}: ${m.text.replace(/\s+/g, ' ').trim()}`;
  });
  const maxLen = Math.max(1200, opts.maxLen ?? 3300);
  const body = lines.join(`\n\n${DIVIDER}\n\n`);
  const total = Math.max(1, Math.ceil(body.length / maxLen));
  const header = opts.fromIso && opts.toIso
    ? `🕒 آخرین توییت‌ها ${hhmmOf(opts.fromIso)} تا ${hhmmOf(opts.toIso)}`
    : '🕒 آخرین توییت‌های افراد تأثیرگذار';
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
  return {
    merged,
    chunks: chunks.map((c, i) => {
      if (total <= 1) return `${header}\n${DIVIDER}\n\n${c}`;
      if (i === 0) return `${header} — بخش ۱ از ${faNum(total)}\n${DIVIDER}\n\n${c}`;
      return `${header} — ادامهٔ بخش ${faNum(i + 1)} از ${faNum(total)}\n${DIVIDER}\n\n${c}`;
    }),
  };
}
