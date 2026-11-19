/**
 * پیش‌نمایش کارت بستهٔ خبری با دادهٔ واقعی — دقیقاً همان زنجیرهٔ ربات:
 * منابع واقعی (bot/sources.json) → fetchAllSources → پنجرهٔ ۴ ساعت → تجمیع مشابه‌ها
 * → کارت PNG (تیک = دادهٔ «≥۲ منبع مستقل» خوشه). شکست هر مرحله → exit(2) (هیچ دادهٔ ساختگی).
 * اجرا: bun scripts/preview-news-card.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fetchAllSources, type BotSource, type BotItem } from '../bot/bot';
import { mergeSimilarItems, type HourlyItem } from '../bot/hourly';
import { tripleDateOf } from '../bot/calendar';
import { renderNewsCardPng } from '../bot/news-card';
import { categorizeFa, groupByCategory } from '../bot/categories';

const tz = 'Asia/Tehran';

const raw = JSON.parse(readFileSync('bot/sources.json', 'utf8')) as BotSource[];
const srcs = (Array.isArray(raw) ? raw : []).filter((s) => s && s.name && s.platform && s.identifier);
console.log(`منابع: ${srcs.length}`);
if (srcs.length === 0) {
  console.error('❌ فهرست منابع خالی است — پیش‌نمایش صادقانه انجام نمی‌شود');
  process.exit(2);
}

const { items, failed, perSource } = await fetchAllSources(srcs);
const silent = perSource.filter((s) => !s.ok).map((s) => s.name);
console.log(`دریافت: ${items.length} مطلب — ${failed} منبع بی‌خروجی${silent.length ? ` (${silent.slice(0, 5).join('، ')}…)` : ''}`);
if (items.length === 0) {
  console.error('❌ هیچ دادهٔ واقعی دریافت نشد — پیش‌نمایش صادقانه انجام نمی‌شود');
  process.exit(2);
}

// پنجرهٔ ۴ ساعت (بازهٔ واقعی بسته)؛ کمبود آیتم → کل دریافتی (باز هم دادهٔ واقعی)
const since = Date.now() - 4 * 3600_000;
const atOf = (it: BotItem): number => {
  const t = it.publishedAt ? Date.parse(String(it.publishedAt)) : NaN;
  return Number.isFinite(t) ? t : Date.now();
};
const windowed = items.filter((it) => atOf(it) >= since);
const picked = windowed.length >= 3 ? windowed : items.slice(0, 60);
console.log(`بازهٔ ۴ ساعته: ${windowed.length} مطلب → کارت از ${Math.min(picked.length, 60)} مطلب`);

const hourly: HourlyItem[] = picked.map((it) => ({
  id: it.id,
  source: (it.sourceName || '').trim(),
  text: (it.content || '').replace(/\s+/g, ' ').trim().slice(0, 300),
  at: new Date(atOf(it)).toISOString(),
}));
const merged = mergeSimilarItems(hourly);
console.log(`پس از تجمیع: ${merged.length} رویداد — دومانبعی: ${merged.filter((m) => m.verified).length}`);
if (merged.length < 3) {
  console.error('❌ رویداد کافی برای کارت نیست — پیش‌نمایش صادقانه انجام نمی‌شود');
  process.exit(2);
}

const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const date = tripleDateOf(todayKey, tz, 'umalqura');
// دسته‌بندی + اولویت‌بندی همان مسیر ربات (خواستهٔ ۱۹ نوامبر)
const rawItems = merged.slice(0, 10).map((m) => ({
  text: m.text.slice(0, 170),
  tick: m.verified, // تیک کارت فقط از دادهٔ خوشه — نه از مدل
  source: (m.sources[0] || '').trim(),
}));
const cardItems = groupByCategory(rawItems, (it) => categorizeFa(it.text)).flatMap((sec) => sec.items.map((it) => ({ ...it, section: sec.label })));
const card = await renderNewsCardPng({ date, items: cardItems, total: merged.length, dropped: 0 });
if (!card) {
  console.error('❌ رندر کارت ناموفق بود');
  process.exit(2);
}
mkdirSync('download/preview', { recursive: true });
writeFileSync('download/preview/news-card.png', card.png);
console.log(`✅ کارت: ${card.width}×${card.height} — ${Math.round(card.png.length / 1024)} کیلوبایت → download/preview/news-card.png`);
// کپشن حذف شد — خواستهٔ کاربر ۱۹ نوامبر: «فقط عکس حاوی اخبار باشه»
