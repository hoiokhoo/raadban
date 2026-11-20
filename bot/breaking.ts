/**
 * خبر فوری — خواستهٔ کاربر (۲۰ نوامبر ۲۰۲۶، دوم):
 * «هر توییت یا تروث سوشالی حاوی کلمهٔ ایران یا جنگ بود به شکل فوری با یه گیف چراغ گردان
 *  متحرک با عنوان فوری نمایش داده بشه … بلافاصله بدون وقفه اونو ارسال کنه».
 *
 * دو بخش:
 *  ۱) isBreakingTweetText — تشخیص محتوای فوری (ایران/جنگ — فارسی یا انگلیسی). خالص.
 *  ۲) گیف چراغ گردانِ «فوری» — ۱۴ فریم SVG (چراغ گردان پلیسی: پرتو نور چرخان حول گنبد قرمز،
 *     حلقهٔ تپنده، عنوان بزرگ «فوری») → رندر خام RGBA با sharp → کدگذاری GIF متحرک با gifenc
 *     (همان معماری گیف هواشناسی bot/weather-gif.ts — بدون وابستگی تازه).
 *
 * صادقانه: شکست هر مرحله → null؛ فراخواننده پیام متنی «فوری» را بدون گیف می‌فرستد
 * تا هیچ خبر فوری‌ای گم نشود.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- فونت‌پیکربندی پروژه‌ای — پیش از نخستین رندر sharp (متن «فوری» فونت فارسی دارد) ----------
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.FONTCONFIG_FILE) {
  try { mkdirSync(join(PROJECT_ROOT, '.fc-cache'), { recursive: true }); } catch { /* بی‌اهمیت */ }
  process.env.FONTCONFIG_FILE = join(PROJECT_ROOT, '.fontconfig.conf');
}

// ---------- تشخیص محتوای فوری — خالص و تست‌پذیر ----------

/** متن توییت/تروث‌سوشال «فوری» است؟ — حاوی واژهٔ «ایران» یا «جنگ» (فارسی/انگلیسی).
 *  خواستهٔ کاربر ۲۰ نوامبر: «هر توییت یا تروث سوشالی حاوی کلمهٔ ایران یا جنگ بود».
 *  «ایرانسل» برند است نه ایران — استثنا. خالص. */
export function isBreakingTweetText(text: string): boolean {
  const t = (text || '');
  if (!t.trim()) return false;
  if (/ایران(?!سل)/.test(t)) return true;
  if (/جنگ/.test(t)) return true; // جنگ، جنگی، جنگ‌ها، جنگنده — همه حوزهٔ جنگ
  if (/\bIran\b|\bPersia\b/.test(t)) return true;
  if (/\bwar\b|\bwars\b/i.test(t)) return true;
  return false;
}

/** نشان‌های «خبر فوری» برای «خبر» (نه توییت) — خواستهٔ کاربر ۲۰ نوامبر (سوم):
 *  «تویی‌ها و اخبار فوری قرمز کم‌رنگ» — اخبار فوری هم مثل توییت فوری بلافاصله ارسال شوند.
 *  آستانهٔ سخت‌گیرانه‌تر از توییت: «ایران» در خبر دربارهٔ خودِ ایران فراوان است و هر خبرِ
 *  ایران‌دار فوری نیست؛ فقط نشان‌های حاد جنگ/حمله/ترور خبر را «فوری» می‌کند (سیل‌آب کانال
 *  نمی‌شود). واژهٔ تنها «حمله» به‌خاطر «حملهٔ تیم فوتبال» و حوادث شهری فوری نیست —
 *  فقط ترکیب‌های نظامی/تروریستی. خالص و تست‌پذیر. */
const BREAKING_NEWS_FA_RE = /جنگ|بمباران|تهاجم|موشک\u200c?باران|حمله[\u200c‌ ]?(?:موشکی|هوایی|پهپادی|تروریستی|نظامی|گسترده)|ضربه[\u200c‌ ]?(?:موشکی|هوایی|نظامی)|ترور|اعدام|آتش[\u200c‌ ]?باز|پدافند را (?:فعال|روشن)/i;
const BREAKING_NEWS_EN_RE = /\bwar\b|missile strike|airstrike|air strike|drone strike|bombing|explosion|assassinated|military attack|invaded/i;

/** متن «خبر» فوری است؟ — نشان‌های سخت جنگ/حمله (فارسی/انگلیسی). تابع خالص تست‌پذیر. */
export function isBreakingNewsText(text: string): boolean {
  const t = (text || '').replace(/[\u200c\u200f\u200e]/g, ' ');
  if (!t.trim()) return false;
  if (BREAKING_NEWS_FA_RE.test(t)) return true;
  if (BREAKING_NEWS_EN_RE.test(t)) return true;
  return false;
}

// ---------- فریم‌های چراغ گردان — خالص و تست‌پذیر ----------

export const BREAKING_GIF_SIZE = 560;
export const BREAKING_GIF_FRAMES = 14;
export const BREAKING_GIF_DELAY_MS = 90;
const FONT_FA = "'B Nazanin', Vazirmatn, sans-serif";

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

/** یک فریم چراغ گردان «فوری» — i = ۰..frames-۱. خالص و تست‌پذیر.
 *  صحنه (خواستهٔ کاربر ۲۰ نوامبر سوم — «تویی‌ها و اخبار فوری قرمز کم‌رنگ»):
 *  پس‌زمینهٔ «قرمز کم‌رنگ» روشن، پرتو نور چرخان سرخِ اشباع حول گنبد قرمز (چراغ گردان)،
 *  حلقهٔ هشدارِ متحدالشکل، و عنوان بزرگ «فوری» روی گنبد — دارک‌رِد برای خوانایی. */
export function makeBreakingGifFrameSvg(i: number, frames = BREAKING_GIF_FRAMES, size = BREAKING_GIF_SIZE): string {
  const cx = size / 2;
  const cy = size / 2 + size * 0.02;
  const t = i / frames; // فاز ۰..۱
  const rot = (i * 360) / frames; // چرخش پرتو — یک دور کامل در هر لوپ
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2); // تپش گنبد
  const domeR = size * 0.19;
  // پرتو نور چرخان — مخروط بلند از مرکز (چراغ گردان پلیسی؛ دو بازوی روبه‌رو)
  const beam = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const spread = 0.24; // نیم‌زاویهٔ بازشدگی
    const len = size * 0.46;
    const pts = (rStart: number, rEnd: number) => {
      const x1 = cx + Math.cos(a - spread) * rStart;
      const y1 = cy + Math.sin(a - spread) * rStart;
      const x2 = cx + Math.cos(a - spread) * rEnd;
      const y2 = cy + Math.sin(a - spread) * rEnd;
      const x3 = cx + Math.cos(a + spread) * rEnd;
      const y3 = cy + Math.sin(a + spread) * rEnd;
      const x4 = cx + Math.cos(a + spread) * rStart;
      const y4 = cy + Math.sin(a + spread) * rStart;
      return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} L ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
    };
    // دو لایه: هستهٔ روشن + هالهٔ پهن محو — پرتو سرخِ اشباع روی پس‌زمینهٔ قرمز کم‌رنگ
    return `<path d="${pts(domeR * 1.05, len)}" fill="#ff4438" opacity="0.5"/>`
      + `<path d="${pts(domeR * 0.6, len * 1.12)}" fill="#ffb03a" opacity="0.18"/>`;
  };
  // حلقهٔ هشدار متحدالشکن — بیرون‌زده و محو
  const ringPhase = (i % 5) / 5;
  const ringR = domeR * (1.15 + ringPhase * 0.85);
  const ringOp = 0.5 * (1 - ringPhase);
  const ring = `<circle cx="${cx}" cy="${cy}" r="${ringR.toFixed(1)}" fill="none" stroke="#e5484d" stroke-width="${(size * 0.02).toFixed(1)}" opacity="${ringOp.toFixed(2)}"/>`;
  const baseY = cy + domeR * 1.02;
  // بستر تیرهٔ عنوان «فوری» — خوانایی کامل متن روی هر پس‌زمینه/پرتو
  const textY = cy + domeR + size * 0.16;
  const textFs = Math.round(size * 0.17);
  const pillW = textFs * 2.6;
  const pillH = textFs * 1.5;
  const pillY = textY - textFs * 1.02;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.45" r="0.9">
      <stop offset="0" stop-color="#fff4f3"/><stop offset="1" stop-color="#ffdfda"/>
    </radialGradient>
    <radialGradient id="dome" cx="0.5" cy="0.35" r="0.9">
      <stop offset="0" stop-color="#ff8a80"/><stop offset="0.45" stop-color="#ff3b30"/><stop offset="1" stop-color="#a01015"/>
    </radialGradient>
    <filter id="soft2" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  ${beam(rot)}${beam(rot + 180)}
  <circle cx="${cx}" cy="${cy}" r="${(domeR * 1.7).toFixed(1)}" fill="#ff3b30" opacity="${(0.05 + 0.05 * pulse).toFixed(2)}"/>
  ${ring}
  <ellipse cx="${cx}" cy="${baseY + size * 0.045}" rx="${(domeR * 1.25).toFixed(1)}" ry="${(size * 0.028).toFixed(1)}" fill="#e8bdb6"/>
  <rect x="${(cx - domeR * 1.05).toFixed(1)}" y="${baseY.toFixed(1)}" width="${(domeR * 2.1).toFixed(1)}" height="${(size * 0.075).toFixed(1)}" rx="${(size * 0.022).toFixed(1)}" fill="#f6d7d2" stroke="#d8a49c" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${domeR.toFixed(1)}" fill="url(#dome)" opacity="${(0.82 + 0.18 * pulse).toFixed(2)}"/>
  <ellipse cx="${(cx - domeR * 0.32).toFixed(1)}" cy="${(cy - domeR * 0.38).toFixed(1)}" rx="${(domeR * 0.26).toFixed(1)}" ry="${(domeR * 0.16).toFixed(1)}" fill="#ffe3e0" opacity="0.75"/>
  <g filter="url(#soft2)"><rect x="${(cx - pillW / 2).toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH.toFixed(1)}" rx="${(pillH / 2).toFixed(1)}" fill="#ff8f86" opacity="0.6"/></g>
  <rect x="${(cx - pillW / 2).toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH.toFixed(1)}" rx="${(pillH / 2).toFixed(1)}" fill="#8f0f16" opacity="0.9"/>
  <rect x="${(cx - pillW / 2).toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH.toFixed(1)}" rx="${(pillH / 2).toFixed(1)}" fill="none" stroke="#ff6b6b" stroke-width="2" opacity="0.6"/>
  <text x="${cx}" y="${textY.toFixed(1)}" font-family="${FONT_FA}" font-size="${textFs}" font-weight="700" fill="#ffffff" text-anchor="middle">${rtl('فوری')}</text>
  <text x="${cx}" y="${textY.toFixed(1)}" font-family="${FONT_FA}" font-size="${textFs}" font-weight="700" fill="none" stroke="#ff3b30" stroke-width="1.2" text-anchor="middle" opacity="0.5">${rtl('فوری')}</text>
</svg>`;
}

// ---------- رندر GIF — شکست هر مرحله → null ----------

export interface BreakingGif {
  gif: Buffer;
  width: number;
  height: number;
}

/** کدگذاری ۱۴ فریم به GIF متحرک — هم‌الگوی renderWeatherGif (sharp + gifenc). */
export async function renderBreakingGif(): Promise<BreakingGif | null> {
  try {
    const sharp = (await import('sharp')).default;
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
    const encoder = GIFEncoder();
    for (let i = 0; i < BREAKING_GIF_FRAMES; i++) {
      const svg = makeBreakingGifFrameSvg(i);
      const { data } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
      const u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const palette = quantize(u8, 128);
      const index = applyPalette(u8, palette);
      encoder.writeFrame(index, BREAKING_GIF_SIZE, BREAKING_GIF_SIZE, { palette, delay: BREAKING_GIF_DELAY_MS });
    }
    encoder.finish();
    const gif = Buffer.from(encoder.bytes());
    if (gif.length < 3000 || gif.slice(0, 3).toString('latin1') !== 'GIF') return null;
    return { gif, width: BREAKING_GIF_SIZE, height: BREAKING_GIF_SIZE };
  } catch {
    return null;
  }
}
