/**
 * آزمون زندهٔ پرامپت تحلیل جامع شبانه — یک فراخوانی واقعی مدل با پیکرهٔ امروز؛
 * «هیچ چیزی ارسال نمی‌شود و state تغییر نمی‌کند» — فقط اعتبارسنجی متن خروجی و پانوشت حافظه.
 * اجرا: bun scripts/test-nightly-prompt.ts
 */
import { readFileSync } from 'node:fs';
import { loadPromptOverrides, getNightlyPrompt, chainCall, enToFaDigits } from '../bot/bot';
import { tehranParts } from '../bot/digest';
import { mergeSimilarItems, buildHourlyCorpus, type HourlyItem } from '../bot/hourly';
import { buildNightlyMemoryBlock, todayPoolSlice, validateNightlyText, splitMemoryFooter } from '../bot/nightly';
import { weekdayFaOf } from '../bot/calendar';

interface St { dailyPool?: Array<{ id: string; source: string; text: string; fa?: string; at: string }>; nightlyAnalyses?: unknown[] }

loadPromptOverrides();
const st = JSON.parse(readFileSync('bot/state.json', 'utf8')) as St;
const p = tehranParts(Date.now());
const todayItems = todayPoolSlice((st.dailyPool || []) as never, p.dateKey);
console.log(`آرشیو امروز: ${todayItems.length} رویداد`);
if (todayItems.length < 5) { console.log('آرشیو کوچک است — آزمون زنده امروز ممکن نیست'); process.exit(0); }
const hourlyItems: HourlyItem[] = todayItems.map((it) => ({ id: it.id, source: it.source, text: (it.fa || '').trim() || it.text, at: it.at }));
const merged = mergeSimilarItems(hourlyItems);
const corpus = buildHourlyCorpus(merged, 60, 380);
const memory = buildNightlyMemoryBlock((st.nightlyAnalyses as never[]) as never);
const weekday = weekdayFaOf(p.dateKey, 'Asia/Tehran');
const userMsg = [
  `تاریخ: ${weekday} ${p.dateFa} (${p.dateKey}) — ساعت ${p.hhmm}`,
  '',
  'حافظهٔ روزهای پیشین (به ترتیب زمانی — برای پیوستگی روایت بخوانید):',
  memory,
  '',
  `رویدادهای امروز (${enToFaDigits(String(merged.length))} رویداد پس از تجمیع اولیهٔ سامانه — هر سطر: شماره — منبع (+n منبع دیگر) — متن):`,
  corpus,
].join('\n');
console.log(`فراخوانی مدل... (${merged.length} رویداد)`);
const t0 = Date.now();
const r = await chainCall(getNightlyPrompt(), userMsg, { maxTokens: 8000 });
console.log(`مدل: ${r.ok ? `موفق (${r.providerId})` : `ناموفق — ${r.error}`} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (!r.ok || !r.content) process.exit(1);
const text = validateNightlyText(r.content);
console.log(`اعتبارسنجی متن: ${text ? `PASS (${text.length} نویسه)` : 'FAIL — متن نامعتبر'}`);
if (!text) { console.log('--- خروجی خام مدل (۶۰۰ نویسه اول) ---'); console.log(r.content.slice(0, 600)); process.exit(1); }
const { body, summary } = splitMemoryFooter(text);
console.log(`پانوشت حافظهٔ 🧷: ${summary ? `هست (${summary.length} نویسه)` : 'نیست — شب بعد از آغاز متن خلاصه ساخته می‌شود'}`);
console.log(`بدنه پیام: ${body.length} نویسه`);
console.log('=== پیش‌نمایش پیام شبانه (بدون ارسال) ===');
console.log(body.slice(0, 2200));
console.log(process.exitCode ? '' : '=== پایان — همه‌چیز سالم بود ===');
