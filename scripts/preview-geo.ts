/**
 * پیش‌نمایش تحلیل ۴ساعتهٔ ژئوپلیتیک (بخش چپ و راست) — بدون ارسال، بدون ذخیرهٔ state.
 * همان مسیر واقعی runGeoAnalysis: واکشی کانال‌ها → فیلتر تبلیغ → پنجرهٔ ۴ساعته + ضدتکرار →
 * تجمیع چندکاناله (تیک ≥۲ منبع) → پیکره → فراخوانی مدل با سوپرپرامپت geo.
 * اجرا: bun scripts/preview-geo.ts
 */
import { resolve } from 'node:path';
import {
  DEFAULT_SYSTEM_GEO,
  GEO_WINDOW_HOURS,
  buildGeoCorpus,
  buildGeoMemoryBlock,
  fetchAllGeoChannels,
  filterGeoPosts,
  geoItemsForMerge,
  loadGeoChannels,
  parseGeoChannelsFile,
  windowGeoPosts,
} from '../bot/geo';
import { mergeSimilarItems } from '../bot/hourly';
import { tehranParts } from '../bot/digest';
import { enToFaDigits, esc, chainCall } from '../bot/bot';
import { weekdayFaOf } from '../bot/calendar';
import { validateGeoText, splitGeoFooter, geoSummaryOf } from '../bot/geo';

const ROOT = resolve(import.meta.dir, '..');
const channelsFile = resolve(ROOT, 'bot/geo-channels.json');

// فهرست کانال‌ها — مستقیم از فایل
const channels = loadGeoChannels(channelsFile);
console.log(`کانال‌های رصد (${channels.length}): ${channels.map((c) => `${c.name}[${c.platform}]`).join('، ')}`);
const parsed = parseGeoChannelsFile(await Bun.file(channelsFile).text());
if (parsed.length !== channels.length) {
  console.error('⚠️ ناسازگاری پارس فایل کانال‌ها');
  process.exit(1);
}

console.log('\n─── واکشی همهٔ کانال‌ها ───');
const { posts, failed } = await fetchAllGeoChannels(channels, 15_000);
console.log(`دریافت شد: ${posts.length} پیام از ${channels.length - failed.length} کانال${failed.length ? ` — بی‌خروجی: ${failed.join('، ')} (صادقانه)` : ''}`);

const since = Date.now() - (GEO_WINDOW_HOURS * 3600_000 + 30 * 60_000);
const win = windowGeoPosts(posts, since, {});
const filtered = filterGeoPosts(win.picked);
const merged = mergeSimilarItems(geoItemsForMerge(filtered));
const verified = merged.filter((m) => m.verified).length;
console.log(`پنجرهٔ ۴ساعته: ${win.picked.length} — پس از فیلتر تبلیغ: ${filtered.length} — پس از تجمیع: ${merged.length} رویداد (چندمنبعی تأییدشده: ${verified})`);

const p = tehranParts(Date.now());
const weekday = weekdayFaOf(p.dateKey, 'Asia/Tehran');
const corpus = buildGeoCorpus(merged);
console.log(`\n─── نمونهٔ پیکرهٔ ورودی مدل (${enToFaDigits(String(merged.length))} رویداد) ───`);
console.log(corpus.slice(0, 3000));
console.log(merged.length > 8 ? '… (بریده شد)' : '');

const userMsg = [
  `تاریخ: ${weekday} ${p.dateFa} (${p.dateKey}) — ساعت ${p.hhmm}`,
  '',
  'حافظهٔ تحلیل‌های پیشین این بخش (تازه‌ترین اول — برای پیوستگی روایت بخوانید):',
  buildGeoMemoryBlock([]),
  '',
  `پیام‌های این بازه (${enToFaDigits(String(merged.length))} رویداد پس از تجمیع اولیهٔ سامانه — هر سطر: شماره — کانال (+n منبع دیگر) — متن):`,
  corpus,
].join('\n');

console.log('\n─── فراخوانی مدل با سوپرپرامپت تحلیل ۴ساعتهٔ ژئوپلیتیک ───');
const t0 = Date.now();
const r = await chainCall(DEFAULT_SYSTEM_GEO, userMsg, { maxTokens: 8000 });
console.log(`مدل: ${r.ok ? r.providerId : `ناموفق — ${r.error}`} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (!r.ok) {
  console.error('❌ مدل در دسترس نبود — پیش‌نمایش پیکره در بالا کافی است');
  process.exit(0);
}
const text = validateGeoText(r.content);
if (!text) {
  console.error('❌ متن مدل اعتبارسنجی نشد — خروجی خام:\n' + (r.content || '').slice(0, 1500));
  process.exit(0);
}
const split = splitGeoFooter(text);
const finalBody = split.body.length >= 300 ? split.body : text.trim();
const header = `🌐 <b>تحلیل ۴ساعتهٔ ژئوپلیتیک رصدبان</b> — بخش چپ و راست — ${esc(weekday)} ${esc(p.dateFa)}`;
console.log('\n─── پیام نهایی (همان‌که در بله منتشر می‌شد) ───\n');
console.log((`${header}\n\n${finalBody}`).replace(/<[^>]+>/g, ''));
console.log('\n─── خلاصهٔ حافظهٔ ذخیره‌شده برای بازه‌های بعد (پانوشت 🧷 یا استخراج قطعی) ───');
console.log((split.summary || geoSummaryOf(finalBody)) || '(خالی)');
process.exit(0);
