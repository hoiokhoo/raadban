/**
 * کارت تصویری پیش‌بینی ساعتی — خواستهٔ کاربر ۱۳ نوامبر ۲۰۲۶:
 * «یه اسکرین‌شات از بخش هواشناسی بده ببینم» → خروجی بخش هواشناسی از متنِ ۲۴خطی
 * به یک کارت PNG خوانا تبدیل شد تا در بله مثل اینفوگرافیک دیده شود.
 *
 * به‌روزرسانی ۱۵ نوامبر ۲۰۲۶ (خواستهٔ کاربر):
 * - فونت «نازنین» — B Nazanin (bot/assets/fonts/BNazanin.ttf) با پشتیبان وزیرمتن؛
 * - پس‌زمینهٔ تصویر طبیعت (bot/assets/nature-bg.jpg) کمی تیره‌شده تا خوانایی متن حفظ شود؛
 *   نبود فایل عکس/شکست ترکیب → بازگشت صادقانه به پس‌زمینهٔ تختِ قبلی (هیچ کارت نیمه‌ساختگی).
 *
 * معماری: ساخت SVG با چیدمان راست‌به‌چپ → تبدیل به PNG با sharp (libvips/librsvg).
 * فونت‌ها: بستهٔ npm «vazirmatn» + bot/assets/fonts از طریق FONTCONFIG_FILE پروژه‌ای
 * (.fontconfig.conf) در دسترس pango/librsvg قرار می‌گیرند — هیچ فونت سیستم‌محوری.
 *
 * صراحت: هر ساعت بی‌داده در کارت نمی‌آید؛ ورودی ناکافی (کمتر از MIN_HOURS) → null؛
 * شکست رندر (sharp/فونت) → null و فراخواننده به‌صورت شفاف پیام متنی می‌فرستد.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faDigits } from './daily';
import { type TripleDate } from './calendar';
import { renderDensityFor } from './render-scale';

// ---------- فونت‌پیکربندی پروژه‌ای — پیش از نخستین رندر sharp ----------
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.FONTCONFIG_FILE) {
  try { mkdirSync(join(PROJECT_ROOT, '.fc-cache'), { recursive: true }); } catch { /* بی‌اهمیت */ }
  process.env.FONTCONFIG_FILE = join(PROJECT_ROOT, '.fontconfig.conf');
}

/** خانوادهٔ فونت کارت — «نازنین» خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶؛ وزیرمتن پشتیبان نویسه‌های
 *  فاقد در نازنین (°، ٪، —) و sans-serif پشتیبان پایانی. ممیزی ۲۷ نوامبر: تعریف به
 *  bot/card-font.ts (ماژول مشترک همهٔ کارت‌ها) منتقل شد و از این‌جا صادر می‌ماند. */
export { FONT_FA } from './card-font';
import { FONT_FA } from './card-font';
/** ضخامت لایهٔ تیره‌کنندهٔ پس‌زمینهٔ طبیعت — «کمی تیره که مشکل خوندن ایجاد نکنه» */
export const BG_DARKEN = 0.45;

export interface WeatherCardInput {
  city: string;
  tomorrow: TripleDate;
  /** ساعت انتشار — «21:00» — در پانوشت کارت می‌آید */
  weatherHour: string;
  hours: Array<{ time: string; hhmm: string; temp: number; feels: number; precipProb: number | null; windKmh: number; code: number }>;
}

export interface WeatherCardPng {
  png: Buffer;
  width: number;
  height: number;
}

// ---------- هندسهٔ کارت ----------

const W = 1080;
const HEADER_H = 250;
const CHIPS_H = 110;
const ROW_H = 96;
const GRID_TOP = HEADER_H + CHIPS_H;
const GRID_COLS = 2;
const PAD = 36;
const FOOTER_H = 88;
const CARD_H = (input: { hours: unknown[] }) => GRID_TOP + Math.ceil(input.hours.length / GRID_COLS) * ROW_H + 26 + FOOTER_H;

/** رنگ متن دما بر اساس مقدار — از یخی تا گرم */
export function tempColor(t: number): string {
  if (t <= 0) return '#7dd3fc';
  if (t <= 10) return '#93c5fd';
  if (t <= 18) return '#4ade80';
  if (t <= 27) return '#fbbf24';
  if (t <= 34) return '#fb923c';
  return '#f87171';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** جهت‌نمای راست‌به‌چپ صریح — متن‌هایی که با رقم شروع می‌شوند در پایهٔ LTR جابه‌جا می‌شوند؛
 *  RLE/PDF چیدمان پاراگراف هر متن را قطعاً RTL می‌کند (pango کنترل‌های bidi را رعایت می‌کند) */
function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

/** آیکن برداری سادهٔ هر وضعیت — شکل‌های SVG (بدون وابستگی به فونت ایموجی) */
function iconSvg(kind: string, cx: number, cy: number): string {
  const s = (x: number, y: number, r: number, fill: string) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
  if (kind === 'sun') {
    let rays = '';
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      const x1 = cx + Math.cos(a) * 13, y1 = cy + Math.sin(a) * 13;
      const x2 = cx + Math.cos(a) * 18, y2 = cy + Math.sin(a) * 18;
      rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>`;
    }
    return rays + s(cx, cy, 10, '#fbbf24');
  }
  if (kind === 'sun-cloud') {
    return s(cx - 8, cy - 8, 8, '#fbbf24')
      + `<ellipse cx="${cx + 3}" cy="${cy + 4}" rx="13" ry="8" fill="#cbd5e1"/><ellipse cx="${cx + 11}" cy="${cy + 2}" rx="9" ry="7" fill="#e2e8f0"/>`;
  }
  if (kind === 'cloud') {
    return `<ellipse cx="${cx - 5}" cy="${cy}" rx="13" ry="9" fill="#94a3b8"/><ellipse cx="${cx + 7}" cy="${cy - 2}" rx="10" ry="8" fill="#b8c4d4"/>`;
  }
  if (kind === 'moon') {
    return `<path d="M ${cx + 6} ${cy - 10} A 11 11 0 1 0 ${cx + 6} ${cy + 10} A 8.5 8.5 0 1 1 ${cx + 6} ${cy - 10} Z" fill="#e2d9a8"/>`;
  }
  if (kind === 'rain') {
    return `<ellipse cx="${cx - 4}" cy="${cy - 6}" rx="12" ry="8" fill="#94a3b8"/><ellipse cx="${cx + 7}" cy="${cy - 8}" rx="9" ry="7" fill="#b8c4d4"/>`
      + `<line x1="${cx - 5}" y1="${cy + 3}" x2="${cx - 7}" y2="${cy + 11}" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>`
      + `<line x1="${cx + 4}" y1="${cy + 3}" x2="${cx + 2}" y2="${cy + 11}" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  if (kind === 'snow') {
    return `<ellipse cx="${cx - 4}" cy="${cy - 6}" rx="12" ry="8" fill="#b8c4d4"/>`
      + `<circle cx="${cx - 5}" cy="${cy + 7}" r="2.5" fill="#e0f2fe"/><circle cx="${cx + 5}" cy="${cy + 8}" r="2.5" fill="#e0f2fe"/>`;
  }
  // storm
  return `<ellipse cx="${cx - 4}" cy="${cy - 7}" rx="12" ry="8" fill="#64748b"/><ellipse cx="${cx + 7}" cy="${cy - 9}" rx="9" ry="7" fill="#94a3b8"/>`
    + `<path d="M ${cx - 2} ${cy} L ${cx - 7} ${cy + 9} L ${cx - 1} ${cy + 9} L ${cx - 5} ${cy + 16}" fill="none" stroke="#facc15" stroke-width="2.5" stroke-linejoin="round"/>`;
}

/** گروه‌بندی کد WMO به شکل آیکن — خالص و تست‌پذیر */
export function iconKindOf(code: number): string {
  if (code === 0 || code === 1) return 'sun';
  if (code === 2) return 'sun-cloud';
  if (code === 3 || code === 45 || code === 48) return 'cloud';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloud';
}

/** ساعت روز یا شب — برای رنگ سلول و انتخاب خورشید/ماه */
export function isNightHour(hhmm: string): boolean {
  const h = Number(hhmm.slice(0, 2));
  return h >= 18 || h < 6;
}

// ---------- ساخت SVG — خالص و تست‌پذیر (بدون sharp) ----------

export interface WeatherCardSvgOptions {
  /** پس‌زمینهٔ تصویر طبیعت — true: بدون کف تخت، پنل‌ها نیمه‌شفاف (لایه‌ها روی عکس می‌نشینند) */
  photoBg?: boolean;
}

export function makeWeatherCardSvg(input: WeatherCardInput, opts: WeatherCardSvgOptions = {}): string {
  const { city, tomorrow, hours } = input;
  if (!hours || hours.length === 0) return '';
  const H = CARD_H(input);
  const photo = opts.photoBg === true;
  // شفافیت پنل‌ها روی عکس — متن سفید روی پنل تیرهٔ نیمه‌شفاف + عکس تیره‌شده = خوانا
  const hdrA = photo ? 0.88 : 1;
  const chipA = photo ? 0.92 : 1;
  const cellA = photo ? 0.9 : 1;
  const cellNightA = photo ? 0.93 : 1;

  const temps = hours.map((h) => h.temp);
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const maxPrecip = hours.reduce<{ prob: number; hhmm: string } | null>((acc, h) => {
    if (h.precipProb === null) return acc;
    if (!acc || h.precipProb > acc.prob) return { prob: h.precipProb, hhmm: h.hhmm };
    return acc;
  }, null);
  const maxWind = hours.reduce((a, h) => (h.windKmh > a ? h.windKmh : a), 0);
  const wetHours = hours.filter((h) => h.precipProb !== null && h.precipProb >= 50).length;

  const chips: Array<{ label: string; value: string }> = [
    { label: 'کمینه / بیشینه', value: `${faDigits(String(minT))}° / ${faDigits(String(maxT))}°` },
    maxPrecip
      ? { label: 'بیشترین بارش', value: `${faDigits(String(maxPrecip.prob))}٪ — ${faDigits(maxPrecip.hhmm)}` }
      : { label: 'بیشترین بارش', value: 'بی‌داده' },
    { label: 'بیشترین باد', value: `${faDigits(String(maxWind))} کیلومتر/ساعت` },
  ];
  if (wetHours > 0) chips.push({ label: 'ساعات بارش ≥۵۰٪', value: faDigits(String(wetHours)) });

  // سربرگ
  const header = `
  <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)" fill-opacity="${hdrA}"/>
  <text x="${W - PAD}" y="82" font-family="${FONT_FA}" font-size="42" font-weight="700" fill="#ffffff" text-anchor="end">${rtl(`پیش‌بینی ساعتی فردا — ${esc(city)}`)}</text>
  <text x="${W - PAD}" y="134" font-family="${FONT_FA}" font-size="28" fill="#9fc3e8" text-anchor="end">${rtl(`${tomorrow.weekdayFa} ${tomorrow.shamsi} • ${tomorrow.miladi}`)}</text>
  <text x="${W - PAD}" y="196" font-family="${FONT_FA}" font-size="34" font-weight="500" fill="#ffd75e" text-anchor="end">${rtl(`کمینه ${faDigits(String(minT))}°  •  بیشینه ${faDigits(String(maxT))}°  •  ${faDigits(String(hours.length))} ساعت معتبر`)}</text>`;

  // تراشه‌ها — راست به چپ
  const chipW = (W - PAD * 2 - (chips.length - 1) * 16) / chips.length;
  const chipsSvg = chips.map((c, i) => {
    const x = W - PAD - chipW - i * (chipW + 16); // اولین تراشه راست‌ترین
    return `
  <rect x="${x.toFixed(1)}" y="${HEADER_H + 22}" width="${chipW.toFixed(1)}" height="${CHIPS_H - 44}" rx="14" fill="#123a5e" fill-opacity="${chipA}"/>
  <text x="${(x + chipW / 2).toFixed(1)}" y="${HEADER_H + 52}" font-family="${FONT_FA}" font-size="22" fill="#8fb8d9" text-anchor="middle">${rtl(c.label)}</text>
  <text x="${(x + chipW / 2).toFixed(1)}" y="${HEADER_H + 86}" font-family="${FONT_FA}" font-size="27" font-weight="700" fill="#e8f1fa" text-anchor="middle">${rtl(c.value)}</text>`;
  }).join('');

  // شبکهٔ ساعتی — دو ستون؛ ستون راست نیمهٔ اول روز (راست‌به‌چپ خوانده می‌شود)
  const colW = (W - PAD * 2 - 20) / GRID_COLS;
  const rows = Math.ceil(hours.length / GRID_COLS);
  const cellsSvg = hours.map((h, i) => {
    const col = Math.floor(i / rows); // پر کردن ستونی: اول ستون راست کامل، بعد چپ
    const row = i % rows;
    const xRight = W - PAD - col * (colW + 20); // لبهٔ راست سلول
    const yTop = GRID_TOP + 14 + row * ROW_H;
    const night = isNightHour(h.hhmm);
    const bg = night ? '#0f2c47' : '#123a5e';
    const bgA = night ? cellNightA : cellA;
    const iconKind = isNightHour(h.hhmm) && (h.code === 0 || h.code === 1) ? 'moon' : iconKindOf(h.code);
    const precip = h.precipProb === null ? 'بارش —' : `بارش ${faDigits(String(h.precipProb))}٪`;
    const feels = Math.abs(h.feels - h.temp) >= 3 ? `  (احساس ${faDigits(String(h.feels))}°)` : '';
    const cx = xRight - colW + 56;
    return `
  <rect x="${(xRight - colW).toFixed(1)}" y="${yTop}" width="${colW.toFixed(1)}" height="${ROW_H - 12}" rx="12" fill="${bg}" fill-opacity="${bgA}"/>
  ${iconSvg(iconKind, cx, yTop + (ROW_H - 12) / 2)}
  <text x="${xRight - 24}" y="${yTop + 40}" font-family="${FONT_FA}" font-size="28" font-weight="700" fill="#ffffff" text-anchor="end">${rtl(faDigits(h.hhmm))}</text>
  <text x="${xRight - 24}" y="${yTop + 72}" font-family="${FONT_FA}" font-size="23" fill="#c9d9ea" text-anchor="end">${rtl(`${precip} • باد ${faDigits(String(h.windKmh))}`)}</text>
  <text x="${xRight - colW + 100}" y="${yTop + 48}" font-family="${FONT_FA}" font-size="29" font-weight="700" fill="${tempColor(h.temp)}" text-anchor="start">${rtl(`${faDigits(String(h.temp))}°${feels}`)}</text>`;
  }).join('');

  // «Open-Meteo» حذف شد — خواستهٔ کاربر ۲۰ نوامبر ۲۰۲۶ («کلمه open meteo حذف بشه»)
  const footer = `
  <text x="${W - PAD}" y="${H - 34}" font-family="${FONT_FA}" font-size="22" fill="${photo ? '#b9cfe3' : '#6f93b4'}" text-anchor="end">${rtl(`مدل‌های عددی جوّ • منطقهٔ زمانی ${esc(city)}`)}</text>
  <text x="${PAD}" y="${H - 34}" font-family="${FONT_FA}" font-size="22" fill="${photo ? '#b9cfe3' : '#6f93b4'}" text-anchor="start">${rtl(`رصدبان | هر شب ساعت ${faDigits(input.weatherHour)}`)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2239"/><stop offset="1" stop-color="#164a75"/>
    </linearGradient>
  </defs>
  ${photo ? '' : `<rect width="${W}" height="${H}" fill="#0a1c30"/>`}
  ${header}
  ${chipsSvg}
  ${cellsSvg}
  ${footer}
</svg>`;
}

// ---------- رندر PNG ----------

/** پس‌زمینهٔ طبیعت — یک‌بار بارگذاری و در حافظهٔ فرایند کش می‌شود؛ نبود فایل → null (کارت تخت قبلی) */
let natureBgCache: Buffer | null | undefined;
function loadNatureBg(): Buffer | null {
  if (natureBgCache !== undefined) return natureBgCache;
  try {
    natureBgCache = readFileSync(join(PROJECT_ROOT, 'bot', 'assets', 'nature-bg.jpg'));
  } catch {
    natureBgCache = null; // دارایی گم‌شده → بازگشت صادقانه به پس‌زمینهٔ تخت
  }
  return natureBgCache;
}

/** رندر کارت به PNG — شکست هر مرحله → null (هیچ کارت خراب ارسال نمی‌شود).
 *  پس‌زمینه: تصویر طبیعتِ تیره‌شده (خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶) + لایهٔ کارت نیمه‌شفاف روی آن؛
 *  نبود/شکست عکس → همان کارت با پس‌زمینهٔ تختِ تیرهٔ قبلی — هر دو مسیر دادهٔ یکسان و خوانا. */
export async function renderWeatherCardPng(input: WeatherCardInput): Promise<WeatherCardPng | null> {
  try {
    if (!input.hours || input.hours.length === 0) return null;
    const H = CARD_H(input);
    const sharp = (await import('sharp')).default;

    const finish = async (png: Buffer): Promise<WeatherCardPng | null> => {
      const meta = await sharp(png).metadata();
      if (!meta.width || !meta.height || png.length < 5000) return null;
      return { png, width: meta.width, height: meta.height };
    };

    // ۱) مسیر پس‌زمینهٔ تصویر طبیعت — عکس تیره‌شده زیر، لایهٔ کارت (بدون کف تخت) روی آن.
    //    همهٔ لایه‌ها با همان مقیاس تراکم (۲× در حد بله — خواستهٔ ۲۴ نوامبر) بزرگ می‌شوند.
    const bgBuf = loadNatureBg();
    if (bgBuf) {
      try {
        const svgOverlay = makeWeatherCardSvg(input, { photoBg: true });
        if (!svgOverlay) return null;
        const density = renderDensityFor(W, H);
        const scale = density / 72;
        const overlayPng = await sharp(Buffer.from(svgOverlay), { density }).png().toBuffer();
        const darkSvg = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}"><rect width="${W * scale}" height="${H * scale}" fill="#04101d" fill-opacity="${BG_DARKEN}"/></svg>`,
        );
        const base = await sharp(bgBuf)
          .resize(Math.round(W * scale), Math.round(H * scale), { fit: 'cover', position: 'attention' })
          .composite([{ input: darkSvg }])
          .png()
          .toBuffer();
        const out = await sharp(base).composite([{ input: overlayPng }]).png().toBuffer();
        const r = await finish(out);
        if (r) return r;
      } catch {
        // شکست ترکیب عکس → ادامه با مسیر تخت (هیچ کارت نیمه‌ساختگی ارسال نمی‌شود)
      }
    }

    // ۲) مسیر تخت — همان ظاهر پایدار قبلی
    const svg = makeWeatherCardSvg(input);
    if (!svg) return null;
    const png = await sharp(Buffer.from(svg), { density: renderDensityFor(W, H) }).png().toBuffer();
    return await finish(png);
  } catch {
    return null;
  }
}

// کپشن زیر عکس هواشناسی حذف شد — خواستهٔ کاربر ۲۰ نوامبر ۲۰۲۶:
// «اینو که زیر عکس به شکل متنی میاد حذف کن چون داخل عکس هست» — کارت همهٔ اطلاعات
// (شهر، تاریخ، کمینه/بیشینه، بارش، باد) را خودش دارد؛ عکس بدون هیچ کپشن متنی ارسال می‌شود.
