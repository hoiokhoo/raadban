/**
 * نمودار روند دارایی‌ها — خواستهٔ کاربر (۲۰ نوامبر ۲۰۲۶، دومی):
 * «قرار بود چارت نمودار دارایی ها رو هم بزاری،اما الآن نیست» — کارت تصویری روندِ
 * ۳۰روزهٔ دارایی‌های شاخص: دلار، طلای ۱۸ عیار، سکهٔ بانکی، شاخص کل بورس، بیت‌کوین، نفت برنت.
 *
 * منبع: tgju «summary-table-data» — همان tgju گزارش بازار (بدون کلید، عمومی):
 *   https://api.tgju.org/v1/market/indicator/summary-table-data/{symbol}?lang=fa
 * ردیف‌ها جدید→قدیم‌اند: [open, low, high, close, Δ, Δ٪, تاریخ میلادی, تاریخ جلالی].
 *
 * ممیزی و اصلاح اساسی (خواستهٔ کاربر ۲۰ نوامبر، پنجم — «سوما برای عکس چارت نمودارها»):
 * تصویر تولیدشده تناقض آشکار درصد↔جهت نمودار و بازه‌های ناهمگون داشت. ممیزی با دادهٔ
 * زندهٔ واقعی هر شش نماد، ریشه‌ها را پیدا کرد و موتور از پایه اصلاح شد:
 *  ۱) محور زمان راست‌به‌چپ بود (قدیم=راست، جدید=چپ) در حالی که هر خواننده‌ای — و قرارداد
 *     جهانی نمودار مالی، حتی درUIهای فارسی مثل tgju/TradingView — چارت را چپ‌به‌راست
 *     می‌خواند؛ نتیجه: هر شش پنل «تناقض جهت/درصد» داشتند. اکنون: قدیم=چپ، جدید=راست +
 *     برچسب تاریخ آغاز زیر لبهٔ چپ و تاریخ پایان (امروز) زیر لبهٔ راست هر پنل.
 *  ۲) «۳۰ روز» در عمل «۳۰ ردیف معاملاتی» بود → بازهٔ تقویمی هر دارایی متفاوت (بورس از
 *     ۳۰ شهریور!). اکنون: پنجرهٔ تقویمی یکسان ۳۰ روز [امروز−۲۹، امروز] برای همهٔ دارایی‌ها؛
 *     نقاط بیرون پنجره حذف؛ بازهٔ واقعی و تعداد نقطه هر پنل صادقانه روی همان پنل.
 *  ۳) ردیف‌ها فقط وارونه‌سازی می‌شدند؛ ترتیب زمانی هرگز مرتب نمی‌شد. اکنون: مرتب‌سازی
 *     صعودی بر اساس تاریخ + حذف تاریخ‌های تکراری (نخستین رخداد) — ورودی با هر ترتیبی سازگار است.
 *  ۴) نقطهٔ زندهٔ امروز بدون سنجهٔ هم‌مقیاسی به سری می‌چسبید (خطر پرش ریال/تومان/دلار).
 *     اکنون: گارد نسبت [۰٫۳۵، ۲٫۸] نسبت به آخرین قیمت — نقطهٔ ناهم‌مقیاس رد می‌شود.
 *  ۵) درصد، فلش و رنگ همیشه از همان آرایه‌ای ساخته می‌شوند که نمودار از آن رسم می‌شود
 *     (نخست→آخر همان سری بریده‌شده در پنجره)؛ ناچیز (|pct|<۰٫۰۵) → رنگ خنثی و «—».
 *  ۶) تست‌های ناگزیر (tests/nov20-5-features.test.ts): جهت نمودار با علامت درصد هم‌خوان،
 *     مرتب‌سازی ورودی معکوس، حذف تکراری، پنجرهٔ یکسان، رد نقطهٔ پرت، سری ثابت، قیمت صفر،
 *     دادهٔ ناکافی → بدون درصد جعلی.
 *
 * معماری:
 *   تاریخچهٔ روزانه یک‌بار در روز واکشی و در state (chartHist) کش می‌شود؛
 *   نقطهٔ «امروزِ» هر سری از tgjuCurrent زندهٔ همان گزارش بازار به انتهای سری
 *   ملحق/جایگزین می‌شود (تاریخچهٔ tgju گاهی یک روز عقب است — نمودار همیشه تازه).
 *   شکست هر نماد → پنل همان نماد حذف؛ کمتر از ۳ پنل → کل کارت حذف (صادقانه،
 *   هیچ نیم‌نموداری ارسال نمی‌شود). کارت بازار خودش مستقل ارسال شده است.
 *
 * همان معماری کارت‌های پروژه: SVG راست‌به‌چپ با فونت وزیرمتن → PNG با sharp؛
 * همهٔ توابع خالص و تست‌پذیرند — فقط fetchAssetHistory زنده است.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faDigits } from './daily';
import { type TripleDate, tripleDateOf } from './calendar';
import { renderDensityFor } from './render-scale';
import { FONT_FA } from './card-font';
import { formatMoney } from './market';

// ---------- فونت‌پیکربندی پروژه‌ای — پیش از نخستین رندر sharp ----------
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.FONTCONFIG_FILE) {
  try { mkdirSync(join(PROJECT_ROOT, '.fc-cache'), { recursive: true }); } catch { /* بی‌اهمیت */ }
  process.env.FONTCONFIG_FILE = join(PROJECT_ROOT, '.fontconfig.conf');
}

// ---------- پیکربندی دارایی‌ها ----------

export interface ChartAsset {
  /** کلید پایدار در state.chartHist.assets */
  key: string;
  /** نماد tgju history API */
  symbol: string;
  /** کلید همان نماد در tgjuCurrent (ajax.json) برای نقطهٔ زندهٔ امروز */
  liveKey: string;
  title: string;
  unit: 'toman' | 'usd' | 'index';
  /** قیمت ریالی → تقسیم بر ۱۰ (تومان) */
  rial: boolean;
}

/** شش دارایی شاخص — ترتیب = چیدمان کارت (راست→چپ، بالا→پایین) */
export const CHART_ASSETS: ChartAsset[] = [
  { key: 'usd', symbol: 'price_dollar_rl', liveKey: 'price_dollar_rl', title: 'دلار آزاد', unit: 'toman', rial: true },
  { key: 'gold', symbol: 'geram18', liveKey: 'geram18', title: 'طلای ۱۸ عیار', unit: 'toman', rial: true },
  { key: 'coin', symbol: 'sekeb', liveKey: 'sekeb', title: 'سکهٔ بانکی', unit: 'toman', rial: true },
  { key: 'tse', symbol: 'bourse', liveKey: 'bourse', title: 'شاخص کل بورس', unit: 'index', rial: false },
  { key: 'btc', symbol: 'crypto-bitcoin', liveKey: 'crypto-bitcoin', title: 'بیت‌کوین', unit: 'usd', rial: false },
  { key: 'brent', symbol: 'oil_brent', liveKey: 'oil_brent', title: 'نفت برنت', unit: 'usd', rial: false },
];

/** پنجرهٔ نمودار — تقویمی، نه «ردیف معاملاتی»: [امروز−۲۹، امروز] برای همهٔ دارایی‌ها */
export const CHART_DAYS = 30;

/** سقف ردیف‌های نگه‌داشته‌شده در پارس/کش — پنجرهٔ ۳۰روزه حتی با دادهٔ ۵روزه/هفته و تأخیر فید پوشش داده می‌شود */
export const HIST_KEEP_ROWS = 45;

export interface HistSeries {
  /** قیمت‌های روزانه قدیم→جدید (واحد نهایی: تومان/دلار/امتیاز) */
  closes: number[];
  /** تاریخ میلادی هر نقطه «YYYY-MM-DD» قدیم→جدید */
  dates: string[];
}

// ---------- پنجرهٔ تقویمی — خالص و تست‌پذیر ----------

/** تاریخ ISO ± چند روز — خالص (YYYY-MM-DD) */
export function isoAddDays(iso: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export interface WindowSpec {
  start: string;
  end: string;
}

/** پنجرهٔ تقویمی یکسان همهٔ دارایی‌ها: [امروز−(روزها−۱)، امروز] — خالص */
export function chartWindow(todayIso: string, days = CHART_DAYS): WindowSpec {
  return { start: isoAddDays(todayIso, -(days - 1)), end: todayIso };
}

/** فاصلهٔ تقویمی دو تاریخ ISO (b−a) به روز — خالص؛ ورودی نامعتبر → ۰ */
export function daysBetweenIso(a: string, b: string): number {
  const ma = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
  const mb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if (!ma || !mb) return 0;
  const da = Date.UTC(Number(ma[1]), Number(ma[2]) - 1, Number(ma[3]));
  const db = Date.UTC(Number(mb[1]), Number(mb[2]) - 1, Number(mb[3]));
  return Math.round((db - da) / 86_400_000);
}

/** بریدن سری به پنجرهٔ تقویمی — نقاط بیرون [start, end] حذف؛ ترتیب حفظ می‌شود. خالص. */
export function clipSeriesToWindow(s: HistSeries, win: WindowSpec): HistSeries {
  const closes: number[] = [];
  const dates: string[] = [];
  for (let i = 0; i < s.dates.length; i++) {
    const d = s.dates[i]!;
    if (d >= win.start && d <= win.end) {
      closes.push(s.closes[i]!);
      dates.push(d);
    }
  }
  return { closes, dates };
}

// ---------- پارس واکشی — خالص و تست‌پذیر ----------

/** پارس پاسخ summary-table-data — با هر ترتیب ردیفی سازگار:
 *  نقاط معتبر → نگه‌داشتن HIST_KEEP_ROWS موردِ جدیدتر → مرتب‌سازی صعودی بر اساس تاریخ →
 *  حذف تاریخ تکراری (نخستین رخداد در پیمایش جدید→قدیم می‌ماند). خروجی همیشه قدیم→جدید. */
export function parseHistorySeries(json: string, opts: { keepRows?: number; rial?: boolean } = {}): HistSeries | null {
  try {
    const keep = opts.keepRows ?? HIST_KEEP_ROWS;
    const div = opts.rial ? 10 : 1;
    const o = JSON.parse(json) as { data?: unknown[][] };
    const rows = Array.isArray(o?.data) ? o.data : [];
    const byDate = new Map<string, number>(); // تاریخ → close (نخستین رخدادِ پیمایش جدید→قدیم برنده است)
    let kept = 0;
    for (const r of rows) {
      if (kept >= keep) break;
      if (!Array.isArray(r) || r.length < 8) continue;
      const closeRaw = String(r[3] ?? '').replace(/[^0-9.]/g, '');
      const close = Number(closeRaw);
      const dm = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(String(r[6] ?? ''));
      if (!Number.isFinite(close) || close <= 0 || !dm) continue;
      const iso = `${dm[1]}-${dm[2]}-${dm[3]}`;
      if (!byDate.has(iso)) byDate.set(iso, close / div);
      kept++;
    }
    if (byDate.size < 8) return null; // سری خیلی کوتاه → بی‌نمودار صادقانه
    const dates = [...byDate.keys()].sort(); // مرتب‌سازی صعودی — ترتیب ورودی هرچه باشد
    return { closes: dates.map((d) => byDate.get(d)!), dates };
  } catch {
    return null;
  }
}

/** دامنهٔ مجاز نسبت نقطهٔ زنده به آخرین قیمت سری — بیرون از آن، نقطهٔ زنده ناهم‌مقیاس
 *  (ریال↔تومان↔دلار) است و رد می‌شود تا نمودار/درصد از دو مقیاس مختلف ساخته نشود. */
export const LIVE_POINT_MIN_RATIO = 0.35;
export const LIVE_POINT_MAX_RATIO = 2.8;

/** نقطهٔ زندهٔ امروز — آخرین نقطه امروز است → جایگزین؛ نیست → الحاق به انتها. خالص.
 *  گارد هم‌مقیاسی: زندهٔ خارج از نسبت [۰٫۳۵، ۲٫۸] با آخرین قیمت → سری دست‌نخورده. */
export function mergeLivePoint(series: HistSeries, todayIso: string, live: number | null, rial: boolean): HistSeries {
  const raw = live !== null && Number.isFinite(live) && live > 0 ? live : null;
  if (raw === null) return series;
  const liveVal = rial ? raw / 10 : raw;
  const lastClose = series.closes[series.closes.length - 1];
  if (typeof lastClose === 'number' && lastClose > 0) {
    const ratio = liveVal / lastClose;
    if (ratio < LIVE_POINT_MIN_RATIO || ratio > LIVE_POINT_MAX_RATIO) return series; // ناهم‌مقیاس → رد صادقانه
  }
  const last = series.dates[series.dates.length - 1] ?? '';
  if (last === todayIso) {
    const closes = [...series.closes];
    closes[closes.length - 1] = liveVal;
    return { closes, dates: [...series.dates] };
  }
  if (todayIso > last) return { closes: [...series.closes, liveVal], dates: [...series.dates, todayIso] };
  return series; // تاریخ زنده قدیمی‌تر از آخرین نقطهٔ سری → بی‌معنا؛ سری دست‌نخورده
}

export interface ChartPanel {
  key: string;
  title: string;
  unit: 'toman' | 'usd' | 'index';
  values: number[];
  /** درصد تغییر بازه (نخست → آخر همان آرایهٔ values) — گردیده به یک رقم اعشار */
  pct: number;
  /** تاریخ اولین/آخرین نقطه «YYYY-MM-DD» */
  firstDate: string;
  lastDate: string;
  /** تعداد نقاط واقعی پنل (پنجرهٔ تقویمی می‌تواند کمتر از ۳۰ کند) */
  points: number;
  /** گسترهٔ تقویمی واقعی پنل به روز (آخرین−نخستین) */
  spanDays: number;
}

/** ساخت یک پنل از سری آماده — سری نال/کوتاه → null. خالص.
 *  win داده شود → سری به همان پنجرهٔ تقویمی بریده می‌شود؛ درصد و نمودار همیشه از
 *  «همان» سری بریده‌شده ساخته می‌شوند (یک متغیر محاسباتی واحد برای عدد/فلش/رنگ). */
export function buildChartPanel(asset: ChartAsset, series: HistSeries | null, win?: WindowSpec): ChartPanel | null {
  const s = win ? clipSeriesToWindow(series ?? { closes: [], dates: [] }, win) : series;
  if (!s || s.closes.length < 8) return null;
  const first = s.closes[0]!;
  const last = s.closes[s.closes.length - 1]!;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0) return null;
  const pct = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0;
  return {
    key: asset.key,
    title: asset.title,
    unit: asset.unit,
    values: s.closes,
    pct,
    firstDate: s.dates[0]!,
    lastDate: s.dates[s.dates.length - 1]!,
    points: s.closes.length,
    spanDays: daysBetweenIso(s.dates[0]!, s.dates[s.dates.length - 1]!),
  };
}

/** ناگزیرِ هم‌خوانی جهت/درصد — درصد مثبت یعنی نقطهٔ پایانی بالاتر از نقطهٔ آغازین همان
 *  آرایه و بلعکس؛ مقدار درصد نیز عیناً از نخست/آخر بازمحاسبه می‌شود. تست‌ها همین را
 *  برای هر سنجه‌ای می‌سنجند (خواستهٔ ممیزی: «نمودار صعودی با درصد منفی → تست باید شکست بخورد»). */
export function panelMatchesPct(p: ChartPanel): boolean {
  const first = p.values[0];
  const last = p.values[p.values.length - 1];
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) return false;
  const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  if (sign(last - first) !== sign(p.pct)) return false;
  const recomputed = ((last - first) / first) * 100;
  return Math.abs(recomputed - p.pct) <= 0.06;
}

// ---------- هندسهٔ اسپارک‌لاین — خالص و تست‌پذیر ----------

/** نقاط اسپارک‌لاین چپ‌به‌راست (قدیم→چپ، جدید→راست — قرارداد جهانی نمودار مالی؛ ممیزی ۲۰ نوامبر) —
 *  خروجی: polyline + مسیر ناحیه + آخرین نقطه (راست) */
export function sparklinePoints(values: number[], x: number, y: number, w: number, h: number): { pts: string; area: string; lastX: number; lastY: number } {
  const n = values.length;
  if (n < 2 || w <= 0 || h <= 0) return { pts: '', area: '', lastX: x + w, lastY: y + h / 2 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const px = (i: number) => x + (i / (n - 1)) * w; // i=۰ (قدیم‌ترین) → چپ؛ i=n−۱ (جدیدترین) → راست
  const py = (v: number) => (span === 0 ? y + h / 2 : y + (1 - (v - min) / span) * h);
  const coords = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  return {
    pts: coords.join(' '),
    area: `${x.toFixed(1)},${(y + h).toFixed(1)} ${coords.join(' ')} ${(x + w).toFixed(1)},${(y + h).toFixed(1)}`,
    lastX: px(n - 1),
    lastY: py(values[n - 1]!),
  };
}

// ---------- ساخت SVG — خالص و تست‌پذیر ----------

const W = 1080;
const HEADER_H = 170;
const FOOTER_H = 84;
const PAD = 36;
const GAP = 24;
/** شبکهٔ ۲×۳ — هر پنل ۴۹۲×۲۶۰ */
const PANEL_W = Math.floor((W - PAD * 2 - GAP) / 2);
const PANEL_H = 260;
const PANEL_ROWS = 3;

/** رنگ/فلش از یک متغیر واحد (pct) — خنثی فقط برای تغییر واقعیِ ناچیز (|pct|<۰٫۰۵) */
const PCT_NEUTRAL_EPS = 0.05;
const COLOR_UP = '#4ade80';
const COLOR_DOWN = '#f87171';
const COLOR_FLAT = '#cbd5e1';

export interface AssetsChartInput {
  date: TripleDate;
  panels: ChartPanel[];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

/** برچسب تاریخ جلالی «YYYY-MM-DD» → «۲۷ آبان» (بدون سال — فشرده برای پنل) */
function jalaliShort(dateIso: string): string {
  const t = tripleDateOf(dateIso, 'Asia/Tehran', 'umalqura');
  // shamsi = «۲۷ آبان ۱۴۰۵» → «۲۷ آبان»
  const parts = t.shamsi.split(' ');
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : t.shamsi;
}

/** برچسب گسترهٔ صادقانهٔ پنل — پنجرهٔ کامل تقویمی یا بازه/تعداد نقطهٔ واقعیِ کمتر */
function spanLabel(p: ChartPanel): string {
  const sparse = p.spanDays < CHART_DAYS - 2 || p.points < CHART_DAYS - 5;
  const daysTxt = faDigits(String(Math.min(p.spanDays, CHART_DAYS)));
  return sparse ? `${daysTxt} روز • ${faDigits(String(p.points))} نقطه` : `${faDigits(String(CHART_DAYS))} روز`;
}

/** کارت نمودار دارایی‌ها — سربرگ + شبکهٔ ۲×۳ پنل اسپارک‌لاین + پانوشت مینیمال */
export function makeAssetsChartSvg(input: AssetsChartInput): string {
  const { date, panels } = input;
  if (!panels || panels.length < 3) return '';
  const rows = Math.min(PANEL_ROWS, Math.ceil(panels.length / 2));
  const bodyH = rows * PANEL_H + (rows - 1) * GAP;
  const H = HEADER_H + 20 + bodyH + FOOTER_H;

  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="76" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('نمودار روند دارایی‌ها')}</text>
  <text x="${W - PAD}" y="128" font-size="26" fill="#9fc3e8" text-anchor="end">${rtl(`روند ${faDigits(String(CHART_DAYS))} روز اخیر • ${date.weekdayFa} ${date.shamsi}`)}</text>`;

  const pieces: string[] = [];
  panels.slice(0, PANEL_ROWS * 2).forEach((p, i) => {
    const col = i % 2; // ۰ = ستون راست، ۱ = ستون چپ (RTL)
    const row = Math.floor(i / 2);
    const x = col === 0 ? W - PAD - PANEL_W : PAD;
    const y = HEADER_H + 20 + row * (PANEL_H + GAP);
    const bg = row % 2 === 0 ? '#102941' : '#0d2135';
    const up = p.pct > PCT_NEUTRAL_EPS;
    const down = p.pct < -PCT_NEUTRAL_EPS;
    const color = up ? COLOR_UP : down ? COLOR_DOWN : COLOR_FLAT; // رنگ فقط از همان pct
    // ممیزی ۲۷ نوامبر — فلش برداری به‌جای گلیف ▲▼ (در هیچ‌کدام از فونت‌های فارسی سرور
    // نیست و به DejaVu می‌افتاد — دو زبان بصری مختلف در یک کارت، هم‌سو با فلش‌های برداری
    // کارت بازار bot/market-card.ts و bot/assets-card.ts)
    const pctArrow = (x: number, y: number): string =>
      up
        ? `<path d="M ${x + 5} ${y + 5} L ${x + 15} ${y + 5} L ${x + 10} ${y - 5} Z" fill="${color}"/>`
        : down
          ? `<path d="M ${x + 5} ${y - 5} L ${x + 15} ${y - 5} L ${x + 10} ${y + 5} Z" fill="${color}"/>`
          : '';
    const pctTxt = `${faDigits(String(Math.abs(p.pct)).replace('.', '٫'))}٪`;
    const cur = p.values[p.values.length - 1]!;
    const spark = sparklinePoints(p.values, x + 24, y + 104, PANEL_W - 48, 116);
    pieces.push(`
  <rect x="${x}" y="${y}" width="${PANEL_W}" height="${PANEL_H}" rx="14" fill="${bg}"/>
  <text x="${x + PANEL_W - 24}" y="${y + 44}" font-size="27" font-weight="700" fill="#e8f1fa" text-anchor="end">${rtl(esc(p.title))}</text>
  <text x="${x + PANEL_W - 24}" y="${y + 78}" font-size="22" fill="#9fc3e8" text-anchor="end">${rtl(formatMoney(cur, p.unit))}</text>
  <text x="${x + 48}" y="${y + 44}" font-size="26" font-weight="700" fill="${color}" text-anchor="start">${rtl(pctTxt)}</text>
  ${pctArrow(x + 26, y + 44)}
  <text x="${x + 24}" y="${y + 74}" font-size="17" fill="#6f93b4" text-anchor="start">${rtl(spanLabel(p))}</text>
  <polyline points="${spark.pts}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
  <polygon points="${spark.area}" fill="${color}" fill-opacity="0.13" stroke="none"/>
  <circle cx="${spark.lastX.toFixed(1)}" cy="${spark.lastY.toFixed(1)}" r="6" fill="${color}" stroke="#0a1c30" stroke-width="2"/>
  <text x="${x + 24}" y="${y + PANEL_H - 16}" font-size="17" fill="#6f93b4" text-anchor="start">${rtl(jalaliShort(p.firstDate))}</text>
  <text x="${x + PANEL_W - 24}" y="${y + PANEL_H - 16}" font-size="17" fill="#8fb4d6" text-anchor="end">${rtl(jalaliShort(p.lastDate))}</text>`);
  });

  const footerY = H - 34;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="end">${rtl('رصدبان')}</text>
  <text x="${PAD}" y="${footerY}" font-size="20" fill="#6f93b4" text-anchor="start">${rtl(`پنجرهٔ تقویمی ${faDigits(String(CHART_DAYS))} روز • چپ: آغاز بازه — راست: امروز`)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT_FA}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1c30"/>
  ${header}
  ${pieces.join('\n')}
  ${footer}
</svg>`;
}

// ---------- رندر PNG ----------

export interface CardPng {
  png: Buffer;
  width: number;
  height: number;
}

/** رندر کارت به PNG — شکست هر مرحله → null (هیچ کارت نیمه‌ساختگی ارسال نمی‌شود).
 *  تراکم ۲× (در حد سقف ابعاد بله) — خواستهٔ کاربر ۲۴ نوامبر: «کیفیت عکسها بیشتر بشه
 *  که تار نشه با زوم کردن». */
export async function renderAssetsChartPng(input: AssetsChartInput): Promise<CardPng | null> {
  try {
    if (!input.panels || input.panels.length < 3) return null;
    const svg = makeAssetsChartSvg(input);
    if (!svg) return null;
    const sharp = (await import('sharp')).default;
    const dims = svg.match(/width="(\d+)" height="(\d+)"/);
    const density = dims ? renderDensityFor(Number(dims[1]), Number(dims[2])) : 72;
    const png = await sharp(Buffer.from(svg), { density }).png().toBuffer();
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height || png.length < 5000) return null;
    return { png, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

// ---------- واکشی زندهٔ تاریخچه ----------

const UA = 'Mozilla/5.0 (compatible; RaadbanBot/1.0; +https://github.com)';

/** URL عمومی و بی‌کلید تاریخچهٔ tgju — خالص و تست‌پذیر */
export function historyUrl(symbol: string): string {
  return `https://api.tgju.org/v1/market/indicator/summary-table-data/${encodeURIComponent(symbol)}?lang=fa`;
}

/** واکشی تاریخچهٔ یک نماد — شکست/تایم‌اوت → null صادقانه (بقیهٔ نمادها مستقل‌اند) */
export async function fetchAssetHistory(symbol: string, rial: boolean, timeoutMs = 15_000): Promise<HistSeries | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(historyUrl(symbol), { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    return parseHistorySeries(text, { rial });
  } catch {
    return null;
  }
}
