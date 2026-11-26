/**
 * کارت تصویری «دارایی‌ها و تورم» — جدا از کارت خودرو (خواستهٔ کاربر ۲۴ نوامبر ۲۰۲۶):
 * «برای به بخش طلا و دلار و بیتکوین و غیر ماشین، آمار تورم نقطه به نقطه سالانه و ماهانه
 *  بانک مرمزی رو هم وارد کن و کلا بکنش یه عکس جدا، اگر برای مسکن تهران هم شاخصی
 *  هست بزن توش».
 *
 *  → بخش طلا و سکه (tgju؛ سکه با قیمت بانکی بهار آزادی)، بخش ارز/بورس/کریپتو
 *    (نوبیتکس/بورس؛ دلار با نرخ مرکز مبادله)؛
 *  → بخش تورم: نقطه‌به‌نقطهٔ سالانه و ماهانه (دادهٔ CPI بانک مرکزی، واکشی ۲۴ نوامبر)؛
 *  → بخش مسکن تهران: میانهٔ قیمت هر متر (کیلید، ماه جاری)؛
 *  → هر ردیفِ غایب صادقانه حذف می‌شود (هیچ عدد ساختگی)؛ شکست کل رندر → null و
 *    فراخواننده پیام متنی می‌فرستد.
 *
 * معماری همان کارت‌ها: SVG راست‌به‌چپ با فونت وزیرمتن → PNG با sharp در ۲× (خواستهٔ
 * ۲۴ نوامبر: «کیفیت عکسها بیشتر بشه که تار نشه با زوم»).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faDigits } from './daily';
import { type TripleDate } from './calendar';
import { renderDensityFor } from './render-scale';
import { compactNum, faGroup, formatMoney, officialDeltaOf, type MacroStats, type Quote } from './market';
import { FONT_FA } from './card-font';

// ---------- فونت‌پیکربندی پروژه‌ای — پیش از نخستین رندر sharp ----------
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.FONTCONFIG_FILE) {
  try { mkdirSync(join(PROJECT_ROOT, '.fc-cache'), { recursive: true }); } catch { /* بی‌اهمیت */ }
  process.env.FONTCONFIG_FILE = join(PROJECT_ROOT, '.fontconfig.conf');
}

export interface AssetsCardInput {
  date: TripleDate;
  /** برچسب اسلات — «گزارش روزانه (ساعت ۱۵)» */
  slotLabel: string;
  /** اقلام غیر خودرو با درصد تغییر اعمال‌شده (applyDeltas) */
  quotes: Quote[];
  /** آمار کلان — تورم و مسکن (fetchMacroStats) */
  macro: MacroStats;
}

export interface CardPng {
  png: Buffer;
  width: number;
  height: number;
}

// ---------- هندسه — جدول یکدست ۴ستونی (میراث کارت بازار پیشین) ----------

const W = 1080;
const HEADER_H = 150;
const COLHDR_H = 58;
const SECTION_H = 54;
const ROW_H = 80;
const PAD = 36;
const FOOTER_H = 78;

/** لنگرهای افقی ستون‌ها (راست→چپ): نام | بازار | رسمی+اختلاف | تغییر ۲۴ساعته */
const X_NAME_R = W - PAD - 24;
const X_MKT_R = 690;
const X_OFF_R = 430;
const X_PCT_L = PAD + 30;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

function arrowSvg(x: number, y: number, up: boolean, color: string): string {
  const d = up
    ? `M ${x + 11} ${y + 8} L ${x + 21} ${y + 8} L ${x + 16} ${y - 3} Z`
    : `M ${x + 11} ${y - 3} L ${x + 21} ${y - 3} L ${x + 16} ${y + 8} Z`;
  return `<path d="${d}" fill="${color}"/>`;
}

// ---------- ردیف‌ها — خالص و تست‌پذیر ----------

export interface AssetsRow {
  title: string;
  /** مقدار اصلی — قیمت بازار قالب‌بندی‌شده */
  value: string;
  /** درصد تغییر ۲۴ساعته — null یعنی «—» */
  pct: number | null;
  /** مبلغ اختلاف ۲۴ساعته قالب‌بندی‌شده — null یعنی بی‌پایه */
  chgAbs: string | null;
  /** قیمت رسمی (دولتی/بانکی) قالب‌بندی‌شده — null یعنی «—» */
  official: string | null;
  /** اختلاف بازار از رسمی — مبلغ و درصد؛ null یعنی بی‌معنا */
  gapAbs: string | null;
  gapPct: string | null;
  gapUp: boolean | null;
}

export interface AssetsSection {
  title: string;
  rows: AssetsRow[];
}

/** ردیف دارایی از یک Quote — همان قالب‌بندی کارت بازار پیشین. خالص. */
export function assetsRowOf(q: Quote): AssetsRow {
  const pct = typeof q.changePct === 'number' && Number.isFinite(q.changePct) ? q.changePct : null;
  const abs = typeof q.changeAbs === 'number' && Number.isFinite(q.changeAbs) ? q.changeAbs : null;
  const gap = officialDeltaOf(q);
  const gapMeaningful = gap !== null && Math.abs(gap.diff) >= 1;
  const official = q.officialToman !== undefined && Number.isFinite(q.officialToman) && q.officialToman > 0
    ? formatMoney(q.officialToman, 'toman')
    : null;
  return {
    title: q.title,
    value: formatMoney(q.value, q.unit),
    pct,
    chgAbs: abs !== null && Math.abs(abs) >= 1
      ? `${compactNum(abs, q.unit)}${q.unit === 'usd' ? ' دلار' : q.unit === 'index' ? '' : ' تومان'}`
      : null,
    official,
    gapAbs: gapMeaningful ? compactNum(gap.diff, 'toman') : null,
    gapPct: gapMeaningful ? `${faGroup(Math.abs(gap.pct), 1)}٪` : null,
    gapUp: gapMeaningful ? gap.diff > 0 : null,
  };
}

/** همهٔ بخش‌های کارت دارایی — طلا/سکه، ارز/بورس/کریپتو، تورم، مسکن. خالص و تست‌پذیر. */
export function assetsSectionsOf(quotes: Quote[], macro: MacroStats): AssetsSection[] {
  const sections: AssetsSection[] = [];
  const gold = ['geram18', 'geram24', 'sekee', 'nim']
    .map((k) => quotes.find((q) => q.key === k))
    .filter((q): q is Quote => Boolean(q))
    .map(assetsRowOf);
  if (gold.length > 0) sections.push({ title: 'طلا و سکه', rows: gold });

  const rest = ['usd', 'tedpix', 'btc', 'oil_brent']
    .map((k) => quotes.find((q) => q.key === k))
    .filter((q): q is Quote => Boolean(q))
    .map(assetsRowOf);
  if (rest.length > 0) sections.push({ title: 'ارز، بورس و کریپتو', rows: rest });

  // ── تورم بانک مرکزی — نقطه‌به‌نقطهٔ سالانه و ماهانه (خواستهٔ ۲۴ نوامبر) ──
  const infl: AssetsRow[] = [];
  if (macro.inflationYoy) {
    const y = macro.inflationYoy;
    infl.push({
      title: 'تورم نقطه‌به‌نقطه سالانه',
      value: `${faGroup(y.pct, 1)}٪`,
      pct: y.prevPct !== undefined && Number.isFinite(y.prevPct) ? Math.round((y.pct - y.prevPct) * 10) / 10 : null,
      chgAbs: null,
      official: y.periodFa,
      gapAbs: null,
      gapPct: null,
      gapUp: null,
    });
  }
  if (macro.inflationMom) {
    const m = macro.inflationMom;
    infl.push({
      title: 'تورم نقطه‌به‌نقطه ماهانه',
      value: `${faGroup(m.pct, 1)}٪`,
      pct: null,
      chgAbs: null,
      official: m.periodFa,
      gapAbs: null,
      gapPct: null,
      gapUp: null,
    });
  }
  if (infl.length > 0) sections.push({ title: 'تورم — بانک مرکزی', rows: infl });

  // ── مسکن تهران — شاخص میانهٔ هر متر (خواستهٔ ۲۴ نوامبر: «اگر شاخصی هست بزن توش») ──
  if (macro.housingTehran) {
    const h = macro.housingTehran;
    sections.push({
      title: 'مسکن تهران',
      rows: [{
        title: 'میانهٔ قیمت هر متر آپارتمان',
        value: formatMoney(h.tomanPerM2, 'toman'),
        pct: null,
        chgAbs: null,
        official: h.periodFa,
        gapAbs: null,
        gapPct: null,
        gapUp: null,
      }],
    });
  }
  return sections;
}

// ---------- ساخت SVG — خالص و تست‌پذیر ----------

export function makeAssetsCardSvg(input: AssetsCardInput): string {
  const { date, slotLabel, quotes, macro } = input;
  const sections = assetsSectionsOf(quotes || [], macro || {});
  if (sections.length === 0) return '';

  const rowsTotal = sections.reduce((a, s) => a + s.rows.length, 0);
  const H = HEADER_H + COLHDR_H + sections.length * SECTION_H + rowsTotal * ROW_H + 24 + FOOTER_H;

  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
  <text x="${W - PAD}" y="74" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl('دارایی‌ها و تورم — رصدبان')}</text>
  <text x="${W - PAD}" y="124" font-size="25" fill="#9fc3e8" text-anchor="end">${rtl(`${date.weekdayFa} ${date.shamsi} • ${date.miladi} • ${esc(slotLabel)}`)}</text>`;

  const colHdr = `
  <rect x="${PAD}" y="${HEADER_H + 8}" width="${W - PAD * 2}" height="${COLHDR_H - 16}" rx="12" fill="#123a5e"/>
  <text x="${X_NAME_R}" y="${HEADER_H + 42}" font-size="24" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl('نام')}</text>
  <text x="${X_MKT_R}" y="${HEADER_H + 42}" font-size="24" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl('آخرین قیمت')}</text>
  <text x="${X_OFF_R}" y="${HEADER_H + 42}" font-size="24" font-weight="700" fill="#ffd75e" text-anchor="end">${rtl('رسمی / دوره')}</text>
  <text x="${PAD}" y="${HEADER_H + 42}" font-size="19" font-weight="700" fill="#ffd75e" text-anchor="start">${rtl('تغییر نسبت به دیروز ساعت ۱۵')}</text>`;

  let y = HEADER_H + COLHDR_H;
  const bodySvg = sections
    .map((sec) => {
      const head = `
  <rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${SECTION_H - 14}" rx="12" fill="#164a75"/>
  <text x="${W - PAD - 20}" y="${y + 34}" font-size="26" font-weight="700" fill="#ffffff" text-anchor="end">${rtl(esc(sec.title))}</text>`;
      y += SECTION_H;
      const rows = sec.rows
        .map((r, i) => {
          const ry = y + i * ROW_H;
          const bg = i % 2 === 0 ? '#102941' : '#0d2135';
          const cyText = ry + 50;
          const pctColor = r.pct === null || Math.abs(r.pct) < 0.05 ? '#94a3b8' : r.pct > 0 ? '#4ade80' : '#f87171';
          const hasPct = r.pct !== null && Math.abs(r.pct) >= 0.05;
          // ممیزی ۲۷ نوامبر — جداکنندهٔ اعشار فارسی «٫»: faDigits فقط ارقام را برمی‌گرداند و «.»
          // لاتینِ toFixed دست‌نخورده می‌ماند و «۳۸.۸٪» با نقطهٔ لاتین رندر می‌شد (ناسازگار با
          // faGroup بقیهٔ گزارش و assets-chart که «٫» درست می‌سازند)
          const pctText = hasPct ? `${faDigits(Math.abs(r.pct!).toFixed(1).replace('.', '٫'))}٪` : null;
          const pctY = r.chgAbs && hasPct ? ry + 40 : cyText;
          const chgY = ry + 64;
          const gapColor = r.gapUp === null || r.gapUp ? '#fbbf24' : '#4ade80';
          return `
  <rect x="${PAD}" y="${ry}" width="${W - PAD * 2}" height="${ROW_H - 12}" rx="12" fill="${bg}"/>
  <text x="${X_NAME_R}" y="${cyText}" font-size="26" fill="#e8f1fa" text-anchor="end">${rtl(esc(r.title))}</text>
  <text x="${X_MKT_R}" y="${cyText}" font-size="25" font-weight="700" fill="#ffffff" text-anchor="end">${rtl(esc(r.value))}</text>
  ${r.official
    ? `<text x="${X_OFF_R}" y="${r.gapAbs ? ry + 34 : cyText}" font-size="23" fill="#9fc3e8" text-anchor="end">${rtl(esc(r.official))}</text>${r.gapAbs && r.gapPct && r.gapUp !== null ? `<text x="${X_OFF_R}" y="${ry + 62}" font-size="17" fill="${gapColor}" text-anchor="end">${rtl(`اختلاف ${esc(r.gapAbs)} (${esc(r.gapPct)})`)}</text>` : ''}`
    : `<text x="${X_OFF_R}" y="${cyText}" font-size="24" fill="#7fa8c6" text-anchor="end">${rtl('—')}</text>`}
  ${hasPct ? `${arrowSvg(PAD, pctY - 9, r.pct! > 0, pctColor)}
  <text x="${X_PCT_L}" y="${pctY}" font-size="24" font-weight="700" fill="${pctColor}" text-anchor="start">${rtl(pctText!)}</text>` : `<text x="${X_PCT_L}" y="${cyText}" font-size="24" fill="#7fa8c6" text-anchor="start">${rtl('—')}</text>`}
  ${hasPct && r.chgAbs ? `<text x="${X_PCT_L}" y="${chgY}" font-size="16" fill="${pctColor}" text-anchor="start">${rtl(esc(r.chgAbs))}</text>` : ''}`;
        })
        .join('');
      y += sec.rows.length * ROW_H;
      return head + rows;
    })
    .join('');

  const footerY = H - 30;
  const footer = `
  <text x="${W - PAD}" y="${footerY}" font-size="19" fill="#6f93b4" text-anchor="end">${rtl('رصدبان • طلا/ارز: tgju/نوبیتکس • رسمی: مرکز مبادله/بانکی')}</text>
  <text x="${PAD}" y="${footerY}" font-size="19" fill="#6f93b4" text-anchor="start">${rtl('تورم: بانک مرکزی • مسکن: کیلید')}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT_FA}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1c30"/>
  ${header}
  ${colHdr}
  ${bodySvg}
  ${footer}
</svg>`;
}

// ---------- رندر PNG ----------

/** رندر کارت به PNG (۲× در حد سقف ابعاد بله) — شکست هر مرحله → null */
export async function renderAssetsCardPng(input: AssetsCardInput): Promise<CardPng | null> {
  try {
    const svg = makeAssetsCardSvg(input);
    if (!svg) return null;
    const dims = svg.match(/width="(\d+)" height="(\d+)"/);
    const density = dims ? renderDensityFor(Number(dims[1]), Number(dims[2])) : 72;
    const sharp = (await import('sharp')).default;
    const png = await sharp(Buffer.from(svg), { density }).png().toBuffer();
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height || png.length < 5000) return null;
    return { png, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}
