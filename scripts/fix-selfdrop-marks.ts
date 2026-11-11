/**
 * پاک‌سازی یک‌بارهٔ نشانه‌های خودحذفی state — اشکال ۱۲ نوامبر ۲۰۲۶:
 * در حالت بست، متن هر آیتمِ صف هنگام صف‌گذاری در sentMsgTexts/sentTitleTexts ثبت می‌شد
 * (در حالی که هنوز ارسال نشده بود) و سپس ضدتکرارِ زمان جمع‌بندی، خودِ آیتم‌های صف را
 * «تکراریِ ارسال‌شده» می‌پنداشت و حذف می‌کرد — خبرهای کوتاه هرگز ارسال نمی‌شدند.
 *
 * این اسکریپت نشانه‌های متناظر با آیتم‌های «هنوز در صف» را از state حذف می‌کند
 * (نشانه‌های ارسال‌شده‌های واقعی دست‌نخورده می‌مانند). پشتیبان state قبل از تغییر ذخیره می‌شود.
 * اجرا: bun scripts/fix-selfdrop-marks.ts
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const STATE = resolve(ROOT, 'bot/state.json');

/** همان normalizeTitle واقعی bot.ts — بدون import برای پرهیز از اجرای پیکربندی */
function normalizeTitle(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ی')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalizeTitle(s).split(' ').filter((w) => w.length > 2));
}

/** نسبت پوشش نشانه توسط متن آیتم — نشانهٔ خودِ آیتم ≈ ۱ است */
function containment(mark: string, itemText: string): number {
  const M = tokens(mark);
  if (M.size === 0) return 0;
  const T = tokens(itemText);
  let inter = 0;
  for (const t of M) if (T.has(t)) inter++;
  return inter / M.size;
}

const raw = readFileSync(STATE, 'utf8');
const st = JSON.parse(raw) as {
  bundleQueue?: Array<{ kind?: string; text: string }>;
  sentMsgTexts?: Record<string, number>;
  sentTitleTexts?: Record<string, number>;
  sentTitles?: Record<string, number>;
};
const queue = st.bundleQueue || [];
if (queue.length === 0) {
  console.log('صف خالی است — کاری لازم نیست.');
  process.exit(0);
}
copyFileSync(STATE, STATE + '.bak-selfdrop');
console.log(`پشتیبان: bot/state.json.bak-selfdrop | آیتم‌های صف: ${queue.length}`);

const texts = queue.map((q) => q.text || '');
const isOwnMark = (mark: string): boolean => texts.some((t) => containment(mark, t) >= 0.6);

let rmMsg = 0;
const msg = st.sentMsgTexts || {};
for (const k of Object.keys(msg)) {
  if (isOwnMark(k)) { delete msg[k]; rmMsg++; }
}
let rmTitle = 0;
const tt = st.sentTitleTexts || {};
for (const k of Object.keys(tt)) {
  if (isOwnMark(k)) { delete tt[k]; rmTitle++; }
}
st.sentMsgTexts = msg;
st.sentTitleTexts = tt;
writeFileSync(STATE, JSON.stringify(st, null, 2) + '\n', 'utf8');
console.log(`حذف از sentMsgTexts: ${rmMsg} | حذف از sentTitleTexts: ${rmTitle}`);
console.log('انجام شد — اکنون ضدتکرارِ جمع‌بندی فقط با ارسال‌شده‌های واقعی می‌سنجد.');
