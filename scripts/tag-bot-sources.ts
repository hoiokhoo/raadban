/**
 * برچسب‌گذاری دسته‌ای منابع ربات → bot/sources.json
 * دستهٔ منبع = «پیش‌فرضِ» مسیریابی است؛ دسته‌بندی دقیق هر خبر با مدل انجام می‌شود (فیلد cat).
 * قواعد کلیدواژه‌ای شفاف و تست‌پذیر — اجرا: bun scripts/tag-bot-sources.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

interface Src { name: string; identifier: string; region?: string; language?: string; category?: string }

const RULES: Array<{ cat: string; re: RegExp }> = [
  { cat: 'sports', re: /sport|football|fifa|espn|varzesh|goal\.com|skysports|ورزش|فوتبال|ورزشی|ورزsh3|پرسپولیس|استقلال/i },
  { cat: 'energy', re: /oil|opec|energy|petrol|petroleum|gas|شانا|نفت|گاز|انرژی|پتروشیمی/i },
  { cat: 'tech', re: /tech|ai|silicon|فناوری|دیجیتال|فناوری|تکنولوژی/i },
  { cat: 'economy', re: /econom|business|finance|bloomberg|forbes|marketwatch|بازار|اقتصاد|بورس/i },
];

// خبرگزاری‌ها/رسانه‌های داخلی ایران → دستهٔ ایران (پیش‌فرض؛ مدل هر خبر را دقیق دسته‌بندی می‌کند)
const IRANIAN = /ایرنا|ایسنا|تسنیم|فارس|مهر|خبرگزاری دانشجو|باشگاه خبرنگاران|جام‌جم|ایران اینترنشنال|رادیو فردا|عصر ایران|خبر آنلاین|isna|irna|tasnim|mehrnews|farsnews|yjc\.ir|khabaronline|asriran/i;

const srcs: Src[] = JSON.parse(readFileSync('bot/sources.json', 'utf8'));
let tagged = 0;
const counts: Record<string, number> = {};
for (const s of srcs) {
  const hay = `${s.name} ${s.identifier} ${s.region || ''}`;
  let cat: string | undefined;
  if (IRANIAN.test(s.name) || (s.region === 'ایران' && /isna|irna|tasnim|mehrnews|farsnews|yjc|khabaronline|asriran|jamaran|dolat|president\.ir/i.test(s.identifier))) cat = 'iran';
  else {
    for (const r of RULES) if (r.re.test(hay)) { cat = r.cat; break; }
  }
  // آژانس‌های عمومی جهانی بدون برچسب می‌مانند → پیش‌فرض؛ دسته‌بندی واقعی با مدل انجام می‌شود
  if (cat) { s.category = cat; tagged++; counts[cat] = (counts[cat] || 0) + 1; }
  else delete s.category;
}
writeFileSync('bot/sources.json', JSON.stringify(srcs, null, 1), 'utf8');
console.log(`منابع برچسب‌خورده: ${tagged}/${srcs.length}`, JSON.stringify(counts));
