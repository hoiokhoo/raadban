/**
 * بازار رصدبان — گزارش قیمت (خودرو، طلا و سکه، دلار، شاخص بورس، بیت‌کوین، برنت)
 * خواستهٔ کاربر (۹ نوامبر ۲۰۲۶): «ظهر و شب هر روز آخرین قیمت خودروهای داخل ایران،
 * قیمت طلا ۱۸ و ۲۴ عیار، قیمت دلار آزاد، شاخص بورس، قیمت بیت‌کوین و قیمت نفت برنت
 * و آخرین درصد تغییرشان از خبر قبلی رو بفرستی».
 *
 * منابع (به ترتیب اولویت — خواستهٔ صریح کاربر):
 *   دلار و بیت‌کوین: نوبیتکس (api.nobitex.ir) → پشتیبان: tgju
 *   طلا و سکه: tgju آنلاین (call1.tgju.org/ajax.json)
 *   شاخص بورس: سایت بورس (tsetmc) → پشتیبان: tgju («نشد از سایتهای جایگزین»)
 *   نفت برنت: tgju (oil_brent)
 *   خودرو: کانال‌های خبری خودرو در تلگرام (t.me/s/… — فرمت «مدل⬅️قیمت»)
 *
 * صراحت: هر منبعی که پاسخ نداد صادقانه «دریافت نشد» می‌آید؛ هیچ عدد ساختگی.
 * صفر وابستگی — فقط fetch استاندارد؛ همهٔ پارسرها خالص و تست‌پذیر.
 */

// ---------- ابزار عدد و قالب فارسی ----------

/** تبدیل ارقام فارسی/عربی به ASCII — برای پارس قیمت‌ها */
export function faToEnDigits(s: string): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  return s.replace(/[۰-۹٠-٩]/g, (c) => {
    const i = fa.indexOf(c);
    return String(i >= 0 ? i : ar.indexOf(c));
  });
}

/** «2,649,000» یا «254,171,000» → عدد؛ نامعتبر → null */
export function num(s: string | undefined | null): number | null {
  if (!s) return null;
  const t = faToEnDigits(String(s)).replace(/[,\s٬]/g, '').replace(/[۰-۹]/g, '');
  const m = t.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) ? v : null;
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** رقم فارسی + جداکنندهٔ هزارگان «٬» — 25417100 → «۲۵٬۴۱۷٬۱۰۰» */
export function faGroup(n: number, decimals = 0): string {
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const out = (frac ? `${grouped}٫${frac}` : grouped).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
  return (neg ? '−' : '') + out;
}

/** نمایش مقدار بر حسب واحد — بهومان ≥۱ میلیارد → «میلیارد تومان»؛ خودرو از کانال به همین شکل می‌آید */
export function formatMoney(value: number, unit: 'toman' | 'usd' | 'index'): string {
  if (unit === 'index') return faGroup(value, value >= 1000 ? 0 : 2);
  if (unit === 'usd') return `${faGroup(value, value >= 100 ? 0 : 2)} دلار`;
  // toman
  if (Math.abs(value) >= 1e9) return `${faGroup(value / 1e9, 3)} میلیارد تومان`;
  return `${faGroup(value, 0)} تومان`;
}

/** نمایش درصد تغییر — ▲/▼/— با رقم فارسی */
export function formatPct(p: number | undefined | null): string {
  if (p === undefined || p === null || !Number.isFinite(p)) return '—';
  if (Math.abs(p) < 0.05) return 'بدون تغییر';
  const arrow = p > 0 ? '▲' : '▼';
  return `${arrow}${faGroup(Math.abs(p), Math.abs(p) >= 10 ? 1 : 1)}٪`;
}

/** درصد تغییر — تابع خالص تست‌پذیر؛ prev صفر/نامعتبر → null */
export function deltaPct(prev: number, now: number): number | null {
  if (!Number.isFinite(prev) || !Number.isFinite(now) || prev === 0) return null;
  return Math.round(((now - prev) / Math.abs(prev)) * 10000) / 100;
}

// ---------- تایپ عمومی ----------

export type QuoteUnit = 'toman' | 'usd' | 'index';

export interface Quote {
  /** کلید پایدار برای مقایسهٔ بین‌گزارشی — «car:<مدل نرمال>» | «geram18» | «usd» | … */
  key: string;
  title: string;
  value: number;
  unit: QuoteUnit;
  /** منبع واقعی این عدد — در پیام می‌آید (نوبیتکس | tgju | بورس تهران | کانال خودرو) */
  srcLabel: string;
  /** درصد تغییر: اولویت با مقایسه به گزارش قبل؛ نبود → تغییر روز منبع */
  changePct?: number;
  changeSrc?: 'prev' | 'source' | 'none';
  /** نمایش آمادهٔ مقدار */
  display?: string;
  emoji: string;
}

export type PriceSnapshot = Record<string, number>; // key → مقدار گزارش قبل

/** اعمال تغییرات — اولویت: مقایسه با گزارش قبل (خواستهٔ کاربر: «درصد تغییرشون از خبر قبلی»)،
 *  نبودش → تغییر روزِ خود منبع (د); هیچ‌کدام → بدون تغییرات */
export function applyDeltas(quotes: Quote[], prev: PriceSnapshot | undefined): Quote[] {
  return quotes.map((q) => {
    const pv = prev?.[q.key];
    const d = pv !== undefined ? deltaPct(pv, q.value) : null;
    if (d !== null) return { ...q, changePct: d, changeSrc: 'prev' as const };
    if (q.changePct !== undefined && Number.isFinite(q.changePct)) return { ...q, changeSrc: 'source' as const };
    return { ...q, changePct: undefined, changeSrc: 'none' as const };
  });
}

// ---------- tgju (طلا، سکه، دلار پشتیبان، برنت، شاخص پشتیبان، بیت‌کوین پشتیبان) ----------

export interface TgjuEntry { p?: string; h?: string; l?: string; d?: string; dt?: string; t?: string }

/** پارس پاسخ call1.tgju.org/ajax.json — تابع خالص تست‌پذیر */
export function parseTgjuCurrent(json: string): Record<string, TgjuEntry> {
  try {
    const o = JSON.parse(json) as { current?: Record<string, TgjuEntry> };
    if (!o || typeof o !== 'object' || !o.current || typeof o.current !== 'object') return {};
    return o.current;
  } catch {
    return {};
  }
}

/** tgju قیمت‌ها را به ریال می‌دهد → تومان = ÷۱۰ */
export function rialToToman(rial: number | null): number | null {
  return rial !== null && Number.isFinite(rial) && rial > 0 ? rial / 10 : null;
}

function tgjuQuote(cur: Record<string, TgjuEntry>, key: string, value: number | null, title: string, unit: QuoteUnit, emoji: string): Quote | null {
  if (value === null) return null;
  const d = num(cur[key]?.d);
  return {
    key, title, value, unit, srcLabel: 'tgju', emoji,
    changePct: d !== null && d !== 0 ? d : undefined,
  };
}

// ---------- نوبیتکس (دلار/تتر و بیت‌کوین — خواستهٔ صریح کاربر) ----------

export interface NobitexStats {
  btcToman?: number;
  usdToman?: number;
  btcChangePct?: number;
  usdChangePct?: number;
}

/** پارس api.nobitex.ir/market/stats/get — dstCurrency=rls → ریال → تومان ÷۱۰ */
export function parseNobitexStats(json: string): NobitexStats {
  const out: NobitexStats = {};
  try {
    const o = JSON.parse(json) as { status?: string; stats?: Record<string, { latest?: string; dayChange?: string }> };
    if (!o || o.status !== 'ok' || !o.stats || typeof o.stats !== 'object') return out;
    const btc = o.stats.btc;
    const usdt = o.stats.usdt;
    const btcV = num(btc?.latest);
    if (btcV !== null && btcV > 0) {
      out.btcToman = btcV / 10;
      const c = num(btc?.dayChange);
      if (c !== null) out.btcChangePct = c;
    }
    const usdV = num(usdt?.latest);
    if (usdV !== null && usdV > 0) {
      out.usdToman = usdV / 10;
      const c = num(usdt?.dayChange);
      if (c !== null) out.usdChangePct = c;
    }
    return out;
  } catch {
    return out;
  }
}

// ---------- شاخص بورس (tsetmc — سایت خود بورس؛ خواستهٔ کاربر) ----------

export interface TseIndex { index?: number; changePct?: number }

/** پارس MarketTotal.aspx — خط اول CSV: «شاخص,تغییر,…» (تغییر به درصد نیست؛ درصد محاسبه می‌شود)
 *  فرمت واقعی: Index,IndexChange,IndexLow?,… — پارس tolerant خط اول */
export function parseTsetmcMarketTotal(text: string): TseIndex {
  const out: TseIndex = {};
  if (!text) return out;
  const first = faToEnDigits(text.trim().split('\n')[0] || '');
  const parts = first.split(',').map((p) => p.trim());
  const idx = num(parts[0]);
  if (idx !== null && idx > 1000) out.index = idx;
  const chg = num(parts[1]);
  if (chg !== null && out.index && out.index > 0) {
    // تغییر مطلق شاخص → درصد نسبت به شاخصِ امروز (شاخص دیروز = امروز − تغییر)
    out.changePct = Math.round((chg / (out.index - chg || 1)) * 10000) / 100;
  }
  return out;
}

// ---------- خودرو — کانال‌های خبری خودرو تلگرام (فرمت «مدل⬅️قیمت») ----------

export interface CarEntry { model: string; valueToman: number; displayRaw: string; date?: string }

/** نرمال‌سازی نام مدل برای یکتاسازی/تطبیق — ی/ک فارسی، بدون علائم */
export function normalizeCarModel(s: string): string {
  return faToEnDigits(s)
    .toLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** یک خط قیمت «ساینا⬅️1.815» یا «سورن(XU7P)⬅️برق:1.565/رینگ:1.597» → ورودی خودرو
 *  فقط فرمت ⬅ پذیرفته می‌شود (فرمت ثابت کانال‌های قیمت) — خطوط «قیمت دلار: …» و تبلیغات رد می‌شوند.
 *  واحد محاوره‌ای کانال: عدد <۳۰ = میلیارد تومان، ≥۳۰ = میلیون تومان (پراید ۴۸۵ = ۴۸۵ میلیون) */
export function parseCarLine(line: string): CarEntry | null {
  const clean = faToEnDigits(line).replace(/⬅️|⬅|←/g, '⬅');
  const sepIdx = clean.indexOf('⬅');
  if (sepIdx < 0) return null;
  const model = clean.slice(0, sepIdx).replace(/[⭕️❌️🔴🔹🔸💠•\-–—*#|]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\u200c\s]+|[\u200c\s]+$/g, '').trim();
  const valuePart = clean.slice(sepIdx + 1);
  const m = valuePart.match(/\d+(?:\.\d+)?/);
  if (!model || !m) return null;
  if (model.length < 2 || model.length > 60) return null;
  const v = Number(m[0]);
  if (!Number.isFinite(v) || v <= 0) return null;
  // حذف خطوط راهنما/تبلیغ (شماره تلفن و…) — قرارداد کانال: <۳۰ = میلیارد تومان، ≥۳۰ = میلیون تومان
  // (هر دو یک مقیاس تومان‌اند: ۳۰۰۰ میلیون = ۳٫۰ میلیارد) — بازهٔ معقول خودرو: ۵۰ میلیون تا ۳۰ میلیارد
  if (v < 0.05 || v > 29999) return null;
  const valueToman = v < 30 ? v * 1e9 : v * 1e6;
  return { model, valueToman, displayRaw: String(v) };
}

/** شمار خطوط قیمت واقعی یک پیام — معیار تشخیص «فهرست قیمت» از متن معمولی */
export function carListLineCount(text: string): number {
  return (text || '').split('\n').filter((l) => parseCarLine(l.trim()) !== null).length;
}

/** مدل‌های پرتقاضا به ترتیب نمایش — تطبیق با زیررشتهٔ نرمال‌شده */
export const CAR_FEATURED: Array<{ match: string; label: string }> = [
  { match: 'پراید', label: 'پراید' },
  { match: 'تیبا', label: 'تیبا' },
  { match: 'کوییک', label: 'کوییک' },
  { match: 'کوئیک', label: 'کوئیک' },
  { match: 'شاهین', label: 'شاهین' },
  { match: 'ساینا', label: 'ساینا' },
  { match: 'سورن', label: 'سورن' },
  { match: 'دنا', label: 'دنا' },
  { match: 'تارا', label: 'تارا' },
  { match: 'سمند', label: 'سمند' },
  { match: '206', label: 'پژو ۲۰۶' },
  { match: '207', label: 'پژو ۲۰۷' },
  { match: 'رانا', label: 'رانا' },
  { match: 'پیکان', label: 'پیکان' },
  { match: 'هایما', label: 'هایما' },
  { match: 'تیگو', label: 'تیگو' },
  { match: 'اریزو', label: 'آریزو' },
  { match: 'فید', label: 'فیدلیتی' },
  { match: 'لاماری', label: 'لاماری' },
];

/** پارس چند پیام کانال خودرو — همهٔ پیام‌های فهرست‌قیمت (≥۳ خط قیمت) اسکن و
 *  برای هر مدل «تازه‌ترین» قیمت می‌ماند. تابع خالص تست‌پذیر. */
export function parseCarPriceLists(messages: Array<{ text: string; date?: string }>): CarEntry[] {
  const byModel = new Map<string, CarEntry & { sortDate: number }>();
  for (const msg of messages) {
    if (!msg?.text) continue;
    const lines = msg.text.split('\n');
    const entries: CarEntry[] = [];
    for (const line of lines) {
      const e = parseCarLine(line.trim());
      if (e) entries.push({ ...e, date: msg.date });
    }
    if (entries.length < 3) continue; // فهرست واقعی قیمت — نه متن معمولی خبر
    const ts = msg.date ? Date.parse(msg.date) : 0;
    for (const e of entries) {
      const k = normalizeCarModel(e.model);
      if (!k) continue;
      const old = byModel.get(k);
      if (!old || ts >= old.sortDate) byModel.set(k, { ...e, model: e.model.trim(), sortDate: ts });
    }
  }
  return [...byModel.values()].map(({ model, valueToman, displayRaw, date }) => ({ model, valueToman, displayRaw, date }));
}

/** گزینش مدل‌های نمایشی: اول تطبیق فهرست پرتقاضا؛ کمتر از ۴ مورد → تازه‌ترین‌ها */
export function pickFeaturedCars(cars: CarEntry[], limit = 10): CarEntry[] {
  const norm = cars.map((c) => ({ c, k: normalizeCarModel(c.model) }));
  const out: CarEntry[] = [];
  const used = new Set<string>();
  for (const f of CAR_FEATURED) {
    if (out.length >= limit) break;
    const hit = norm.find((x) => !used.has(x.k) && x.k.includes(normalizeCarModel(f.match)));
    if (hit) { out.push(hit.c); used.add(hit.k); }
  }
  if (out.length < 4) {
    for (const x of norm) {
      if (out.length >= limit) break;
      if (!used.has(x.k)) { out.push(x.c); used.add(x.k); }
    }
  }
  return out;
}

// ---------- واکشی‌های زنده ----------

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function get(url: string, timeoutMs = 12_000): Promise<{ ok: boolean; text?: string; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json,text/html,*/*' }, signal: ctrl.signal, redirect: 'follow' });
    const text = await res.text().catch(() => '');
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    if (!text) return { ok: false, error: 'پاسخ خالی' };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? (e.name === 'AbortError' ? `timeout ${timeoutMs}ms` : e.message) : 'خطای ناشناخته' };
  } finally {
    clearTimeout(timer);
  }
}

export interface FetchMarketOpts {
  /** فهرست شناسهٔ کانال‌های خودرو (t.me/s/<id>) — پیش‌فرض akhbar_khodroei */
  carChannels?: string[];
  timeoutMs?: number;
}

export interface MarketData {
  quotes: Quote[];
  /** سطرهای «دریافت نشد» — صراحت کامل */
  failures: string[];
  sources: string[];
}

/** واکشی همهٔ قیمت‌ها — خطای هر منبع بقیه را نمی‌اندازد؛ هر شکست صادقانه در failures */
export async function fetchMarketData(opts: FetchMarketOpts = {}): Promise<MarketData> {
  const failures: string[] = [];
  const sources = new Set<string>();
  const quotes: Quote[] = [];
  const timeoutMs = opts.timeoutMs ?? 12_000;

  // ۱) tgju — طلا/سکه + پشتیبان‌ها (یک درخواست)
  let tgjuCur: Record<string, TgjuEntry> = {};
  const tg = await get('https://call1.tgju.org/ajax.json', timeoutMs);
  if (tg.ok && tg.text) {
    tgjuCur = parseTgjuCurrent(tg.text);
    if (Object.keys(tgjuCur).length === 0) failures.push('tgju: پاسخ قابل تجزیه نبود');
    else sources.add('tgju');
  } else {
    failures.push(`tgju: ${tg.error || 'ناموفق'}`);
  }

  const g18 = rialToToman(num(tgjuCur.geram18?.p));
  const g24 = rialToToman(num(tgjuCur.geram24?.p));
  const sek = rialToToman(num(tgjuCur.sekee?.p));
  const nimQ = rialToToman(num(tgjuCur.nim?.p));
  const q18 = tgjuQuote(tgjuCur, 'geram18', g18, 'طلای ۱۸ عیار', 'toman', '🥇');
  const q24 = tgjuQuote(tgjuCur, 'geram24', g24, 'طلای ۲۴ عیار', 'toman', '🥇');
  const qSek = tgjuQuote(tgjuCur, 'sekee', sek, 'سکه امامی', 'toman', '🪙');
  const qNim = tgjuQuote(tgjuCur, 'nim', nimQ, 'نیم‌سکه', 'toman', '🪙');
  for (const q of [q18, q24, qSek, qNim]) if (q) quotes.push(q);

  const brentUsd = num(tgjuCur.oil_brent?.p);
  const qBrent = tgjuQuote(tgjuCur, 'oil_brent', brentUsd, 'نفت برنت', 'usd', '🛢');
  if (qBrent) quotes.push(qBrent); else failures.push('برنت: در tgju یافت نشد');

  const btcUsd = num(tgjuCur['crypto-bitcoin']?.p);
  const usdTgju = rialToToman(num(tgjuCur.price_dollar_rl?.p));
  const tedpixTgju = num(tgjuCur.bourse?.p);

  // ۲) نوبیتکس — دلار و بیت‌کوین (اولویت اول کاربر) — مسدود/خطا → پشتیبان tgju
  const nb = await get('https://api.nobitex.ir/market/stats/get?srcCurrency=btc,usdt&dstCurrency=rls', timeoutMs);
  let nobitexOk = false;
  if (nb.ok && nb.text) {
    const st = parseNobitexStats(nb.text);
    if (st.usdToman) {
      nobitexOk = true;
      sources.add('نوبیتکس');
      quotes.push({
        key: 'usd', title: 'دلار (تتر نوبیتکس)', value: st.usdToman, unit: 'toman',
        srcLabel: 'نوبیتکس', emoji: '💵', changePct: st.usdChangePct,
      });
    } else {
      failures.push('نوبیتکس دلار: پاسخ فاقد قیمت');
    }
    if (st.btcToman) {
      nobitexOk = true;
      quotes.push({
        key: 'btc', title: 'بیت‌کوین', value: st.btcToman, unit: 'toman',
        srcLabel: 'نوبیتکس', emoji: '₿', changePct: st.btcChangePct,
      });
    } else if (!btcUsd) {
      failures.push('نوبیتکس بیت‌کوین: پاسخ فاقد قیمت');
    }
  } else {
    failures.push(`نوبیتکس: ${nb.error || 'ناموفق'}`);
  }
  if (!nobitexOk || quotes.every((q) => q.key !== 'usd')) {
    // پشتیبان tgju — فقط اگر نوبیتکس دلار نداد
    if (!quotes.some((q) => q.key === 'usd') && usdTgju) {
      const d = num(tgjuCur.price_dollar_rl?.d);
      quotes.push({
        key: 'usd', title: 'دلار', value: usdTgju, unit: 'toman', srcLabel: 'tgju', emoji: '💵',
        changePct: d !== null && d !== 0 ? d : undefined,
      });
    }
    if (!quotes.some((q) => q.key === 'btc') && btcUsd) {
      const d = num(tgjuCur['crypto-bitcoin']?.d);
      quotes.push({
        key: 'btc', title: 'بیت‌کوین', value: btcUsd, unit: 'usd', srcLabel: 'tgju', emoji: '₿',
        changePct: d !== null && d !== 0 ? d : undefined,
      });
    }
  }

  // ۳) شاخص کل بورس — اول سایت خود بورس (tsetmc)؛ نشد → tgju («سایتهای جایگزین»)
  let tseDone = false;
  try {
    const tse = await get('https://cdn.tsetmc.com/sites/default/files/tsev2/data/MarketTotal.aspx', timeoutMs);
    if (tse.ok && tse.text) {
      const idx = parseTsetmcMarketTotal(tse.text);
      if (idx.index) {
        sources.add('بورس تهران');
        quotes.push({ key: 'tedpix', title: 'شاخص کل بورس', value: idx.index, unit: 'index', srcLabel: 'بورس تهران', emoji: '📈', changePct: idx.changePct });
        tseDone = true;
      }
    }
  } catch { /* پشتیبان پایین */ }
  if (!tseDone) {
    if (tedpixTgju && tedpixTgju > 1000) {
      const d = num(tgjuCur.bourse?.d);
      sources.add('tgju');
      quotes.push({ key: 'tedpix', title: 'شاخص کل بورس', value: tedpixTgju, unit: 'index', srcLabel: 'tgju', emoji: '📈', changePct: d !== null && d !== 0 ? d : undefined });
    } else {
      failures.push('شاخص بورس: tsetmc و tgju هر دو در دسترس نبودند');
    }
  }

  // ۴) برنت از tgju نیامد → پشتیبان stooq (CSV عمومی، صفر کلید)
  if (!quotes.some((q) => q.key === 'oil_brent')) {
    try {
      const st = await get('https://stooq.com/q/l/?s=cb.f&f=sd2t2ohlcv&h&e=csv', timeoutMs);
      if (st.ok && st.text) {
        const line = st.text.trim().split('\n')[1] || '';
        const cols = line.split(',');
        const close = num(cols[6]);
        if (close && close > 5) {
          sources.add('stooq');
          quotes.push({ key: 'oil_brent', title: 'نفت برنت', value: close, unit: 'usd', srcLabel: 'stooq', emoji: '🛢' });
        }
      }
    } catch { /* صادقانه دریافت نشد می‌ماند */ }
  }

  // ۵) خودرو — کانال‌های خبری خودرو (فهرست‌های «مدل⬅️قیمت» — کف بازار به اعلام کانال)
  //  صفحه‌بندی تا ۴ صفحه در هر کانال تا یافتن فهرست واقعی قیمت (۳ خط قیمت یا بیشتر)
  const chans = (opts.carChannels && opts.carChannels.length ? opts.carChannels : ['irankhodro3007', 'akhbar_khodroei']).slice(0, 5);
  const carMsgs: Array<{ text: string; date?: string }> = [];
  for (const ch of chans) {
    let before = '';
    let channelOk = false;
    for (let page = 0; page < 4 && !channelOk; page++) {
      const r = await get(`https://t.me/s/${ch.trim()}${before}`, timeoutMs);
      if (!r.ok || !r.text) { if (page === 0) failures.push(`کانال خودرو ${ch}: ${r.error || 'ناموفق'}`); break; }
      const blocks = r.text.split('<div class="tgme_widget_message ').slice(1);
      let parsed = 0;
      for (const b of blocks) {
        const tm = b.match(/<time datetime="([^"]+)"/)?.[1];
        const tx = b.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
        if (!tx) continue;
        parsed++;
        const text = tx.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
        if (text && carListLineCount(text) >= 3) carMsgs.push({ text, date: tm });
      }
      channelOk = carMsgs.length > 0;
      if (parsed === 0) break;
      const oldest = [...blocks].reverse().map((b) => b.match(/data-post="([^"]+)"/)?.[1]).find(Boolean);
      if (!oldest) break;
      before = `?before=${oldest.split('/').pop()}`;
    }
    if (channelOk) sources.add('کانال اخبار خودرو');
  }
  if (carMsgs.length === 0) failures.push('خودرو: فهرست قیمت قابل استخراج از کانال‌ها نبود');
  const cars = parseCarPriceLists(carMsgs);
  const featured = pickFeaturedCars(cars, 10);
  for (const c of featured) {
    quotes.push({
      key: `car:${normalizeCarModel(c.model)}`,
      title: c.model,
      value: c.valueToman,
      unit: 'toman',
      srcLabel: 'کانال اخبار خودرو',
      emoji: '🚗',
    });
  }

  return { quotes: applyDeltas(quotes, undefined), failures, sources: [...sources] };
}

// ---------- قالب پیام ----------

/** قالب پیام گزارش بازار — HTML-امن (esc توسط caller با esc بات اعمال می‌شود؟ — نه؛
 *  اینجا خودش XML-escape می‌کند چون sendBaleMessage با parse_mode:HTML می‌فرستد) */
export function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface MarketMessageOpts {
  /** «ظهر» | «شب» */
  slotLabel: string;
  dateFa: string; // «۱۸ آبان ۱۴۰۵»
  timeFa: string; // «۱۲:۳۰»
}

/** پیام گزارش بازار — خواستهٔ کاربر: همهٔ اقلام + درصد تغییر نسبت به گزارش قبلی */
export function formatMarketMessage(quotes: Quote[], failures: string[], prev: PriceSnapshot | undefined, opts: MarketMessageOpts): string {
  const withDelta = applyDeltas(quotes, prev);
  const L: string[] = [
    `📊 <b>گزارش بازار رصدبان — ${xmlEsc(opts.slotLabel)} ${xmlEsc(opts.dateFa)}</b>`,
    `🕘 ساعت ${xmlEsc(opts.timeFa)}`,
    '',
  ];
  const cars = withDelta.filter((q) => q.key.startsWith('car:'));
  if (cars.length) {
    L.push('<b>🚗 خودرو (کف بازار):</b>');
    for (const c of cars) L.push(`• ${xmlEsc(c.title)}: ${formatMoney(c.value, c.unit)} (${formatPct(c.changePct)})`);
    L.push('');
  }
  const gold = withDelta.filter((q) => ['geram18', 'geram24', 'sekee', 'nim'].includes(q.key));
  if (gold.length) {
    L.push('<b>🥇 طلا و سکه:</b>');
    for (const c of gold) L.push(`• ${xmlEsc(c.title)}: ${formatMoney(c.value, c.unit)} (${formatPct(c.changePct)})`);
    L.push('');
  }
  for (const key of ['usd', 'tedpix', 'btc', 'oil_brent']) {
    const q = withDelta.find((x) => x.key === key);
    if (q) L.push(`${q.emoji} <b>${xmlEsc(q.title)}</b>: ${formatMoney(q.value, q.unit)} (${formatPct(q.changePct)})`);
  }
  const failed = failures.filter(Boolean);
  if (failed.length) {
    L.push('', '⚠️ دریافت نشد:');
    for (const f of failed.slice(0, 5)) L.push(`• ${xmlEsc(f)}`);
  }
  L.push('', '٪ تغییر نسبت به گزارش قبلی رصدبان؛ اقلام بدون سابقه = تغییر روز منبع.', `منابع: ${[...new Set(withDelta.map((q) => q.srcLabel))].join('، ')}`);
  return L.join('\n');
}

/** عکس‌برداری مقادیر برای گزارش بعدی (پایهٔ درصد تغییر) */
export function snapshotOf(quotes: Quote[]): PriceSnapshot {
  const out: PriceSnapshot = {};
  for (const q of quotes) if (Number.isFinite(q.value) && q.value > 0) out[q.key] = q.value;
  return out;
}
