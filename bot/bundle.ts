/**
 * بستهٔ خبری ساعتی — خواستهٔ کاربر (۱۰ نوامبر ۲۰۲۶):
 * «انتشار اخبار هر یه ساعت — هر چی خبر در اون ساعت اومده تجمیع بشه».
 * مسیر اصلی: تحلیل هوشمند ساعتی (bot/hourly.ts — تجمیع مشابه‌ها + تیک اعتبارسنجی + تحلیل).
 * این ماژول فقط تقسیم چندپیامی مسیر پشتیبان (شکست مدل) است — با سربرگ خنثی زمانی،
 * بدون هیچ برندی («بست رصدبان» حذف شد — خواستهٔ صریح کاربر).
 */

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

/** آیا زمان ارسال بستهٔ ساعتی رسیده؟ — lastBundleAt نامشخص → true (اولین بسته بلافاصله) */
export function shouldFlushBundle(lastBundleAt: string | undefined, now: number, minMinutes = 60): boolean {
  if (!lastBundleAt) return true;
  const t = Date.parse(lastBundleAt);
  if (!Number.isFinite(t)) return true;
  return now - t >= minMinutes * 60_000;
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
 *  هر مورد هرگز نصف نمی‌شود مگر آنکه تنها و بزرگ‌تر از سقف باشد (آن‌گاه درون همان بخش شکسته می‌شود). */
export function buildBundleChunks(items: string[], opts: BundleChunkOpts = {}): string[] {
  const maxLen = Math.max(1200, opts.maxLen ?? 3300);
  if (items.length === 0) return [];
  const totalText = items.join(`\n\n${DIVIDER}\n\n`);
  const n = Math.max(1, Math.ceil(totalText.length / maxLen));
  // سربرگ خنثی — فقط بازهٔ زمانی؛ هیچ برندی از خودش نمی‌گوید (خواستهٔ کاربر)
  const header = opts.fromIso && opts.toIso
    ? `🕒 اخبار ${hhmmOf(opts.fromIso)} تا ${hhmmOf(opts.toIso)}`
    : '🕒 اخبار این ساعت';
  const chunks: string[] = [];
  let current: string[] = [];
  let curLen = 0;
  const flushCurrent = () => {
    if (current.length > 0) chunks.push(current.join(`\n\n${DIVIDER}\n\n`));
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
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut).trimStart();
      }
      if (rest) chunks.push(rest);
      continue;
    }
    current.push(it);
    curLen += (current.length > 1 ? DIVIDER.length + 4 : 0) + it.length;
  }
  flushCurrent();
  return chunks.map((c, i) => {
    if (n <= 1) return `${header}\n${DIVIDER}\n\n${c}`;
    if (i === 0) return `${header} — بخش ۱ از ${faNum(n)}\n${DIVIDER}\n\n${c}`;
    return `${header} — ادامهٔ بخش ${faNum(i + 1)} از ${faNum(n)}\n${DIVIDER}\n\n${c}`;
  });
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
function faNum(n: number): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}
