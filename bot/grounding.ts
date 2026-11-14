/**
 * قفل تیک اعتبارسنجی به جمله‌های منبع — رفع ریشه‌ای هالوسینیشن (خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶):
 * «رفع ریشه‌ای هالوسینیشن — قفل‌کردن تیک اعتبارسنجی به جمله‌های منبع و مقایسهٔ اجباری خروجی/منبع».
 *
 * ریشهٔ اشکال (مورد ۱۰ از بستهٔ ۱۴ نوامبر: «مراسم عزاداری … با حضور رهبر انقلاب در زینبیه» با تیک ✅):
 * تیک ✅ را خودِ مدل می‌گذاشت و هیچ تطبیقی میان متن خروجی و جمله‌های منبع انجام نمی‌شد.
 *
 * اصل این ماژول — تیک دیگر تصمیم مدل نیست:
 * ۱) هر تیک/هشدار (✅/⚠️) که مدل نوشته باشد حذف می‌شود.
 * ۲) هر مورد شماره‌دار خروجی به‌اجبار با خوشه‌های منبع مقایسه می‌شود:
 *    - شباهت ژاکارد با بهترین خوشه + تطبیق همهٔ اعداد مورد با کل پیکرهٔ منبع.
 *    - عددی که در هیچ جملهٔ منبعی نیست → مورد «ساختگی» است و حذف می‌شود (هیچ عدد ساختگی).
 *    - شباهت زیر آستانهٔ قطعی → مورد بی‌خاستگاه است و حذف می‌شود (هالوسینیشن).
 *    - شبابهٔ مرزی → مورد می‌ماند ولی بدون تیک (محافظه‌کارانه — خبر واقعی از دست نمی‌رود).
 * ۳) تیک ✅ فقط وقتی می‌آید که مورد در خوشه‌ای خاستگاه داشته باشد که دادهٔ سامانه آن را
 *    «≥۲ منبع مستقل» (MergedItem.verified) تشخیص داده — نه حدس مدل.
 * همهٔ توابع خالص و تست‌پذیرند؛ هیچ وابستگی به شبکه/مدل.
 */
import { tokensFa, type MergedItem } from './hourly';
import { faDigits } from './daily';

// ---------- آستانه‌ها (قابل تزریق برای تست) ----------

/** شباهت ژاکارد ≥ این مقدار → مورد خاستگاه‌دار در خوشهٔ منبع */
export const GROUND_SIM_KEEP = 0.26;
/** شباهت زیر این مقدار → بی‌خاستگاه قطعی (حتی بدون عدد بیگانه) */
export const GROUND_SIM_DROP = 0.09;

export interface GroundOptions {
  simKeep?: number;
  simDrop?: number;
  maxDroppedSamples?: number;
}

// ---------- ابزار عدد — تطبیق اجباری اعداد خروجی/منبع ----------

/** تبدیل ارقام فارسی/عربی به لاتین */
export function digitsToEn(s: string): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  return s.replace(/[۰-۹٠-٩]/g, (c) => {
    const i = fa.indexOf(c);
    return String(i >= 0 ? i : ar.indexOf(c));
  });
}

/** همهٔ «چهره‌های» یک عدد را می‌سازد تا جداساز هزارگان/اعشار سبب ردِّ نادرست نشود:
 *  «۲٬۵۰۰» و «2,500» و «2500» هم‌ارث‌اند؛ «۳٫۵» و «3.5» هم. */
export function numberVariants(numStr: string): string[] {
  const en = digitsToEn(numStr)
    .replace(/\u066B/g, '.') // ممیز اعشار فارسی
    .replace(/\u066C/g, ','); // جداکنندهٔ هزارگان فارسی
  const noSep = en.replace(/[.,\s]/g, '');
  const set = new Set([en, noSep].filter((v) => /\d/.test(v)));
  return [...set];
}

/** استخراج اعداد یک متن + همهٔ چهره‌هایشان — «۲۲ آبان» → {'22'}، «۲٬۵۰۰ دلار» → {'2,500', '2500'} */
export function numbersOfText(s: string): Set<string> {
  const out = new Set<string>();
  if (!s) return out;
  const en = digitsToEn(s).replace(/\u066B/g, '.').replace(/\u066C/g, ',');
  const runs = en.match(/\d+(?:[.,]\d+)*/g) || [];
  for (const r of runs) for (const v of numberVariants(r)) out.add(v);
  return out;
}

/** اعداد مورد که در هیچ جملهٔ منبعی نیستند — سیگنال قطعی ساختگی‌بودن */
export function foreignNumbers(itemText: string, corpusTexts: string[]): string[] {
  const corpus = new Set<string>();
  for (const t of corpusTexts) for (const v of numbersOfText(t)) corpus.add(v);
  const missing: string[] = [];
  for (const v of numbersOfText(itemText)) {
    if (!corpus.has(v)) missing.push(v);
  }
  return missing;
}

// ---------- پارس موارد شماره‌دار خروجی مدل ----------

/** سطر مورد شماره‌دار — «۱. متن» یا «1) متن»؛ رقم اعشاری («۱.۵ میلیون») مورد نیست */
export const ITEM_LINE_RE = /^\s*([۰-۹0-9]{1,2})\s*[.)]\s+(?=\S)/;

/** حذف تیک/هشدار مدل — تیک از این پس فقط از سوی سامانه می‌آید */
export function stripModelTicks(s: string): string {
  return s.replace(/[✅⚠️]/gu, '').replace(/\s{2,}/g, ' ').trim();
}

export interface ItemBlock {
  /** اندیس سطر آغاز مورد در متن خام */
  startLine: number;
  /** شمارهٔ اصلی مدل */
  no: string;
  /** متن کامل بدون شماره و بدون تیک (سطرهای پیوست هم ادغام‌شده) */
  text: string;
}

/** سطرهای بخش/سربرگ — مورد شماره‌دار در آن‌ها نیست؛ سطر پیوستِ مورد نمی‌شوند.
 *  (🔗/🧠/📈 گزارش شبانهٔ ۲۲:۳۰ — بدون این‌ها سربرگِ پس از آخرین مورد، ادامهٔ متن آن مورد می‌شد
 *  و در بازسازی می‌بلعید؛ خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶: همان قفل برای شب ۲۲:۳۰) */
const SECTION_LINE_RE = /^\s*(?:🔍|📊|⚖️|🧭|🗂|🔗|🧠|📈|🔮|🗞|🧷|🌙|🕒|🖼|🌐)/u;

/** تجزیهٔ خروجی مدل به بلوک‌های «مورد شماره‌دار» + سطرهای دیگر.
 *  سطرهای بدون شمارهٔ پس از یک مورد (ادامهٔ متن شکسته) به همان مورد می‌چسبند. */
export function parseItemBlocks(raw: string): { blocks: ItemBlock[]; isItemLine: boolean[] } {
  const lines = raw.split('\n');
  const isItemLine: boolean[] = new Array(lines.length).fill(false);
  const blocks: ItemBlock[] = [];
  let cur: ItemBlock | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(ITEM_LINE_RE);
    if (m) {
      cur = { startLine: i, no: m[1], text: stripModelTicks(line.slice(m[0].length)) };
      blocks.push(cur);
      isItemLine[i] = true;
      continue;
    }
    const isContinuation =
      cur !== null && line.trim() !== '' && !SECTION_LINE_RE.test(line) && !/^\s*[•‣·-]\s/u.test(line);
    if (isContinuation) {
      cur!.text += ` ${stripModelTicks(line)}`;
      isItemLine[i] = true; // بخشی از همان بلوک — در بازسازی جداگانه نمی‌آید
      continue;
    }
    cur = null; // سطر خالی/بخش/بولت → زنجیرهٔ مورد فعلی بسته شد
  }
  return { blocks, isItemLine };
}

// ---------- قفل تیک + مقایسهٔ اجباری ----------

export interface GroundedItem {
  /** متن نهایی مورد (بدون شماره/تیک) — ورودی کارت خبری */
  text: string;
  /** تیک قطعی: خاستگاه در خوشهٔ ≥۲ منبع مستقل */
  tick: boolean;
  /** شباهت با خوشهٔ منطبق — برای پایش/تست */
  sim: number;
  /** اندیس خوشهٔ منطبق در merged */
  matchIdx: number;
  /** منبع نمایندهٔ خوشه — برای کارت */
  source: string;
}

export interface GroundResult {
  /** متن نهایی آمادهٔ ارسال (شماره‌گذاری مجدد، تیک فقط از سامانه) — همهٔ موارد حذف شوند → null */
  text: string | null;
  /** موارد نگه‌داشته‌شده به ترتیب — سوخت کارت بستهٔ خبری */
  items: GroundedItem[];
  total: number;
  kept: number;
  /** موارد بی‌خاستگاه/عددساختگی حذف‌شده */
  dropped: number;
  /** موارد تیک‌دار (همگی خاستگاه در خوشهٔ دومانبعی) */
  ticked: number;
  /** تا ۳ نمونهٔ حذف‌شده برای لاگ/اعلان مدیر */
  droppedSamples: string[];
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** قلب رفع ریشه‌ای ⑨ — مقایسهٔ اجباری هر موردِ خروجی با جمله‌های منبع و قفل تیک.
 *  خروجی: متن پاک‌شده + فهرست موارد خاستگاه‌دار. تیک مدل در هیچ حالتی زنده نمی‌ماند. */
export function groundAiBundle(raw: string, merged: MergedItem[], opts: GroundOptions = {}): GroundResult {
  const simKeep = opts.simKeep ?? GROUND_SIM_KEEP;
  const simDrop = opts.simDrop ?? GROUND_SIM_DROP;
  const maxSamples = opts.maxDroppedSamples ?? 3;
  const corpusTexts = (merged || []).map((m) => m?.text || '');

  const { blocks, isItemLine } = parseItemBlocks(raw || '');
  const lines = (raw || '').split('\n');

  // هیچ مورد شماره‌داری نبود (همه تحلیل/سایر بخش‌ها) — متن دست‌نخورده می‌ماند،
  // ولی تیک مدل (اگر بی‌دلیل گذاشته باشد) باز هم حذف می‌شود: تیک بدون قفل ممنوع.
  if (blocks.length === 0) {
    const t = stripModelTicks((raw || '').replace(/^[✅⚠️]+\s*/gm, ''));
    return { text: t, items: [], total: 0, kept: 0, dropped: 0, ticked: 0, droppedSamples: [] };
  }

  const clusterTokens = corpusTexts.map((t) => tokensFa(t));
  const droppedSamples: string[] = [];
  const items: GroundedItem[] = [];
  const emit: Array<{ block: ItemBlock; verdict: 'keep' | 'keep-notick'; item?: GroundedItem } | { block: ItemBlock; verdict: 'drop' }> = [];
  let dropped = 0;

  for (const b of blocks) {
    const text = b.text.trim();
    if (!text) { emit.push({ block: b, verdict: 'drop' }); dropped++; continue; }
    const tk = tokensFa(text);
    let bestIdx = -1;
    let bestSim = 0;
    clusterTokens.forEach((ct, i) => {
      const sim = jaccard(tk, ct);
      if (sim > bestSim) { bestSim = sim; bestIdx = i; }
    });
    const missing = foreignNumbers(text, corpusTexts);
    let verdict: 'keep' | 'keep-notick' | 'drop';
    if (missing.length > 0) verdict = 'drop'; // عدد ساختگی — سخت‌گیرانه (هیچ عدد ساختگی)
    else if (bestSim >= simKeep) verdict = 'keep';
    else if (bestSim < simDrop) verdict = 'drop'; // بی‌خاستگاه — هالوسینیشن
    else verdict = 'keep-notick'; // بازنویسی آزاد مرزی — می‌ماند، بدون تیک
    if (verdict === 'drop') {
      dropped++;
      if (droppedSamples.length < maxSamples) droppedSamples.push(text.length > 110 ? `${text.slice(0, 110)}…` : text);
      emit.push({ block: b, verdict });
      continue;
    }
    const cluster = bestIdx >= 0 ? merged[bestIdx] : undefined;
    const item: GroundedItem = {
      text,
      tick: verdict === 'keep' && cluster?.verified === true,
      sim: bestSim,
      matchIdx: bestIdx,
      source: (cluster?.sources?.[0] || '').trim(),
    };
    items.push(item);
    emit.push({ block: b, verdict, item });
  }

  // بازسازی سطر به سطر — سطرهای غیرمورد دست‌نخورده؛ موارد شماره‌گذاری مجدد پیاپی
  const out: string[] = [];
  let n = 0;
  const blockByStart = new Map(emit.map((e) => [e.block.startLine, e]));
  for (let i = 0; i < lines.length; i++) {
    if (isItemLine[i]) {
      const e = blockByStart.get(i);
      if (!e) continue; // سطر پیوستِ مورد — قبلاً در متن همان مورد ادغام شده
      if (e.verdict === 'drop') continue;
      n++;
      out.push(`${faDigits(String(n))}.${e.item!.tick ? ' ✅' : ''} ${e.item!.text}`);
      continue;
    }
    out.push(lines[i]);
  }
  let text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (items.length === 0) text = ''; // همهٔ موارد حذف شد → هیچ متن نیمه‌ساختی ارسال نمی‌شود
  return {
    text: items.length === 0 ? null : text,
    items,
    total: blocks.length,
    kept: items.length,
    dropped,
    ticked: items.filter((x) => x.tick).length,
    droppedSamples,
  };
}
