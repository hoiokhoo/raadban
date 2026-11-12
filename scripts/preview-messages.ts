/**
 * پیش‌نمایش پیام‌های رصدبان — بدون هیچ اثر جانبی (هیچ state ذخیره نمی‌شود، هیچ پیامی ارسال نمی‌شود)
 * خواستهٔ کاربر (۱۲ نوامبر ۲۰۲۶): «یه پریویو از نتایج ربات رو بگیر و نمایش بده تا مشکلاتش رو اصلاح کنیم —
 * یه پریویو از اخبار - صبحگاهی - شامگاهی - قیمت‌ها».
 *
 * همهٔ پیام‌ها با همان کدِ واقعیِ ربات ساخته می‌شوند (همان توابع، همان ضدتکرار، همان زنجیرهٔ مدل).
 * خروجی: bot/preview-out.json (متن + آدرس عکس هر پیام) برای رندر بصری.
 *
 * اجرا: bun scripts/preview-messages.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chainCall, getHourlyPrompt, splitPhotoCaption, enToFaDigits } from '../bot/bot';
import { DEFAULT_SYSTEM_HOURLY, buildHourlyCorpus, buildHistoryBlock, dropAlreadySent, mergeSimilarItems, validateHourlyText, type HourlyItem } from '../bot/hourly';
import { pickHadith, fetchNatureImage, buildDailyMessage, type HadithUsage } from '../bot/daily';
import { fetchDayHistory, dayHistoryFromCache, type DayHistoryCacheEntry } from '../bot/day-history';
import { dateKeyOf, shiftDateKey, tripleDateOf, type QamariBasis } from '../bot/calendar';
import { computePrayerTimes } from '../bot/prayer';
import { fetchHourlyForecast, buildWeatherMessage } from '../bot/weather';
import { fetchMarketData, formatMarketMessage, type CarStore } from '../bot/market';
import { tehranParts, slotLabel } from '../bot/digest';

const ROOT = resolve(import.meta.dir, '..');
const readJson = <T>(p: string, fallback: T): T => {
  try { return JSON.parse(readFileSync(resolve(ROOT, p), 'utf8')) as T; } catch { return fallback; }
};

interface BotStateLike {
  bundleQueue?: Array<{ kind?: string; text: string; source?: string; ids?: string[]; titleKeys?: string[]; titleTexts?: string[]; queuedAt: string }>;
  sentTitleTexts?: Record<string, number>;
  sentMsgTexts?: Record<string, number>;
  hourlyAnalyses?: Array<{ hourKey: string; at: string; text: string; provider?: string; items: number }>;
  daily?: {
    usedHadiths?: Record<string, HadithUsage>;
    infallibleCursor?: number;
    usedImages?: Record<string, { dateKey: string; kind: string }>;
    dayHistoryCache?: Record<string, DayHistoryCacheEntry>;
  };
  priceSnap?: Record<string, number>;
  carStore?: CarStore;
}
interface DailySettings {
  timezone: string; city: string; lat: number; lon: number;
  prayerMethod: string; fajrAngle: number; ishaAngle: number; maghribMinutes: number; qamariBasis: QamariBasis;
  morningHour: string; eveningHour: string; weatherHour: string;
}

const state = readJson<BotStateLike>('bot/state.json', {});
const ds = readJson<DailySettings>('bot/daily-settings.json', {
  timezone: 'Asia/Tehran', city: 'تهران', lat: 35.6892, lon: 51.389,
  prayerMethod: 'tehran', fajrAngle: 17.7, ishaAngle: 14, maghribMinutes: 15, qamariBasis: 'umalqura',
  morningHour: '05:00', eveningHour: '21:00', weatherHour: '21:00',
});

const now = Date.now();
const pNow = tehranParts(now);
const todayKey = pNow.dateKey;
const tomorrowKey = shiftDateKey(todayKey, 1);

interface PreviewOut {
  label: string;
  title: string;
  text: string;
  photoUrl?: string;
  captionSplit?: { caption: string; rest: string };
  notes?: string[];
  meta?: Record<string, string>;
}
const out: PreviewOut[] = [];

function tokensOfLocal(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^\u0600-\u06FF0-9a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
  );
}

// ---------- ۱) بستهٔ خبری ۲ساعته — همان مسیر واقعی ضدتکرار + تجمیع + مدل ----------
async function previewNews(): Promise<void> {
  const queue = (state.bundleQueue || []).filter((q) => (q.kind || 'news') === 'news');
  if (queue.length === 0) {
    out.push({ label: 'news', title: 'بستهٔ خبری ۲ساعته', text: '(صف خبر خالی است — در چرخهٔ واقعی هیچ پیامی ارسال نمی‌شود)' });
    return;
  }
  const items: HourlyItem[] = queue.map((q) => ({
    id: q.ids?.[0] || `${q.queuedAt}|${(q.source || q.text.slice(0, 40)).trim()}`,
    source: (q.source || '').trim(),
    text: q.text.replace(/\n?🖼 عکس خود خبر: \S+/g, '').replace(/^✅$|^⚠️$/gm, '').trim(),
    at: q.queuedAt,
  }));
  const sentMsgSets = Object.keys(state.sentMsgTexts || {}).map((t) => tokensOfLocal(t));
  const titleSets = Object.keys(state.sentTitleTexts || {}).map((t) => tokensOfLocal(t));
  const dedup = dropAlreadySent(items, [...titleSets, ...sentMsgSets], 0.55);
  const mergedItems = mergeSimilarItems(dedup.kept);
  const history = Array.isArray(state.hourlyAnalyses) ? state.hourlyAnalyses : [];
  const userMsg = [
    'تحلیل‌های ساعات پیشین (تازه‌ترین اول — برای پیوستگی روایت بخوانید):',
    buildHistoryBlock(history),
    '',
    `رویدادهای این بازه (${enToFaDigits(String(mergedItems.length))} مورد پس از ضدتکرار و تجمیع اولیهٔ سامانه):`,
    buildHourlyCorpus(mergedItems),
  ].join('\n');
  let sys = DEFAULT_SYSTEM_HOURLY;
  try {
    const prompts = readJson<{ hourly?: string }>('bot/prompts.json', {});
    if (prompts.hourly && prompts.hourly.trim()) sys = prompts.hourly.trim();
  } catch { /* پیش‌فرض */ }
  const r = await chainCall(sys, userMsg, { maxTokens: 8000 });
  let aiText = r.ok ? validateHourlyText(r.content) : null;
  // همان تلاش دوبارهٔ واقعی ربات پس از اصلاح ۱۲ نوامبر — پاسخ نامعتبر (مثلاً غیرفارسی) یک تأمین‌کننده
  // → تأمین‌کنندهٔ بعدی زنجیره، نه مسیر خام
  let providerId = r.providerId;
  if (r.ok && !aiText && r.providerId) {
    const r2 = await chainCall(sys, userMsg, { maxTokens: 8000, skipIds: [r.providerId] });
    const ai2 = r2.ok ? validateHourlyText(r2.content) : null;
    if (ai2) { aiText = ai2; providerId = r2.providerId; }
  }
  const notes: string[] = [];
  let text: string;
  if (aiText) {
    // سربرگ حذف شد — خواستهٔ صریح کاربر ۱۲ نوامبر: «متن 🕒 اخبار 20:30 تا 20:41 رو حذف کن»
    text = aiText;
    notes.push(`مدل: ${providerId || 'نامشخص'}`);
  } else {
    // مسیر پشتیبان واقعی ربات — بست خام بدون سربرگ (متن کامل هر رویداد — همان buildBundleChunks)
    const DIVIDER = '➖➖➖➖➖';
    text = `${dedup.kept.map((q) => `• ${q.text.replace(/\s+/g, ' ').trim()}`).join(`\n\n${DIVIDER}\n\n`)}`;
    notes.push(`مسیر پشتیبان (بدون مدل) — ${r.ok ? 'متن مدل اعتبارسنجی نشد' : `شکست مدل: ${r.error || 'نامشخص'}`}`);
  }
  notes.push(`صف: ${queue.length} مورد | پس از ضدتکرار: ${dedup.kept.length} (حذف‌شدهٔ تکراری: ${dedup.dropped}) | پس از تجمیع: ${mergedItems.length}`);
  out.push({ label: 'news', title: 'بستهٔ خبری ۲ساعته', text, notes });
}

// ---------- ۲ و ۳) پیام صبحگاهی و شبانگاهی — همان مسیر واقعی ----------
async function previewDaily(): Promise<void> {
  const daily = state.daily || {};
  const prayer = { lat: ds.lat, lon: ds.lon, method: ds.prayerMethod, fajrAngle: ds.fajrAngle, ishaAngle: ds.ishaAngle, maghribMinutes: ds.maghribMinutes, tz: ds.timezone };
  // شبیه‌سازی دو پیامِ یک روز: حدیث صبح ثبت می‌شود تا شب حدیثِ دیگری بگیرد (بدون نوشتن روی state واقعی)
  const usedMorning: Record<string, HadithUsage> = { ...(daily.usedHadiths || {}) };
  let cursor = daily.infallibleCursor || 0;
  const kinds = [
    { kind: 'morning' as const, label: 'پیام صبحگاهی', hour: ds.morningHour, slot: `${todayKey}T${ds.morningHour}` },
    { kind: 'evening' as const, label: 'پیام شبانگاهی', hour: ds.eveningHour, slot: `${todayKey}T${ds.eveningHour}` },
  ];
  for (const k of kinds) {
    const pick = pickHadith({ kind: k.kind, dateKey: todayKey, usedHadithIds: usedMorning, infallibleCursor: cursor });
    if (!pick) {
      out.push({ label: k.kind, title: k.label, text: '(بانک احادیث به پایان رسیده — پیام منتشر نمی‌شود)' });
      continue;
    }
    const img = await fetchNatureImage(k.kind, todayKey, daily.usedImages || {}).catch(() => null);
    // وقایع روز در تاریخ (ویکی‌پدیا) — صبح: امروز، شب: فردا؛ اول حافظهٔ همان روز، نبود → واکشی؛
    // شکست → بخش حذف می‌شود (صادقانه). پیش‌نمایش هیچ چیزی در state نمی‌نویسد.
    const histDayKey = k.kind === 'morning' ? todayKey : tomorrowKey;
    const hist = dayHistoryFromCache((daily.dayHistoryCache || {}) as Record<string, DayHistoryCacheEntry>, histDayKey) ?? (await fetchDayHistory(tripleDateOf(histDayKey, ds.timezone, ds.qamariBasis).keys.j).catch(() => null));
    const msg = await buildDailyMessage({
      kind: k.kind, dateKey: todayKey, tz: ds.timezone, qamariBasis: ds.qamariBasis, city: ds.city,
      prayer, hadith: pick.hadith, image: img, dayHistory: hist?.entries ?? null,
      morningHour: ds.morningHour, eveningHour: ds.eveningHour,
    });
    const notes: string[] = [`حدیث: ${pick.hadith.id} — ${pick.hadith.narrator} | بانک: ${Object.keys(usedMorning).length + 1} استفاده‌شده`];
    if (hist && hist.entries.length > 0) notes.push(`وقایع ${hist.title}: ${hist.entries.length} مدخل از ویکی‌پدیای فارسی`);
    else notes.push('وقایع روز: دریافت نشد/خالی — بخش وقایع در پیام نمی‌آید (صادقانه)');
    if (img) notes.push(`عکس: ${img.sourceLabel} — ${img.title.slice(0, 70)}`);
    else notes.push('بدون عکس (هیچ منبع تصویری پاسخ نداد — پیام بی‌عکس ارسال می‌شود)');
    const po: PreviewOut = { label: k.kind, title: k.label, text: msg.text, notes, photoUrl: msg.photoUrl };
    if (msg.photoUrl) {
      const cap = splitPhotoCaption(msg.text, 1024);
      po.captionSplit = cap;
      if (cap.rest) notes.push(`کپشن عکس سقف ۱۰۲۴ نویسه دارد — ${cap.rest.length} نویسهٔ آخر در پیام جداگانهٔ ادامه ارسال می‌شود`);
    }
    out.push(po);
    usedMorning[pick.hadith.id] = { id: pick.hadith.id, dateKey: todayKey, kind: k.kind };
    cursor = pick.nextCursor;
  }
}

// ---------- ۴) پیش‌بینی ساعتی فردا — همان مسیر واقعی Open-Meteo ----------
async function previewWeather(): Promise<void> {
  const hours = await fetchHourlyForecast(ds.lat, ds.lon, ds.timezone, tomorrowKey).catch(() => null);
  const tomorrow = tripleDateOf(tomorrowKey, ds.timezone, ds.qamariBasis);
  const msg = buildWeatherMessage({ city: ds.city, tomorrow, weatherHour: ds.weatherHour, hours });
  if (!msg) {
    out.push({ label: 'weather', title: 'پیش‌بینی ساعتی فردا', text: `(دادهٔ معتبر برای ${tomorrowKey} دریافت نشد — پیام ساختگی منتشر نمی‌شود و چرخهٔ بعد تلاش می‌کند)` });
    return;
  }
  out.push({ label: 'weather', title: `پیش‌بینی ساعتی فردا (${tomorrowKey})`, text: msg.text, notes: [`${hours?.length ?? 0} ساعت معتبر از Open-Meteo`] });
}

// ---------- ۵) گزارش بازار — همان مسیر واقعی (نوبیتکس/tgju/tsetmc/stooq/کانال خودرو) ----------
async function previewMarket(): Promise<void> {
  const md = await fetchMarketData({ carChannels: ['akhbar_khodroei'], carStore: state.carStore });
  const text = formatMarketMessage(md.quotes, state.priceSnap);
  const okItems = md.quotes.length;
  out.push({
    label: 'market', title: `گزارش بازار (${slotLabel(pNow.hhmm)})`, text,
    notes: [`${okItems} قلم دریافت شد | دریافت‌نشده: ${md.failures.length || '۰'} | تغییر٪ نسبت به گزارش قبلی state`],
  });
}

async function main(): Promise<void> {
  console.log(`پیش‌نمایش رصدبان — تاریخ تهران ${todayKey}، ساعت ${pNow.hhmm}`);
  const steps: Array<[string, () => Promise<void>]> = [
    ['بستهٔ خبری', previewNews],
    ['پیام‌های روزانه', previewDaily],
    ['پیش‌بینی ساعتی', previewWeather],
    ['گزارش بازار', previewMarket],
  ];
  for (const [name, fn] of steps) {
    const t0 = Date.now();
    try {
      await fn();
      console.log(`✅ ${name} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      console.error(`❌ ${name}: ${e instanceof Error ? e.message : e}`);
      out.push({ label: 'error', title: name, text: `(خطای ساخت پیش‌نمایش: ${e instanceof Error ? e.message : String(e)})` });
    }
  }
  const dest = resolve(ROOT, 'bot/preview-out.json');
  writeFileSync(dest, JSON.stringify({ generatedAt: new Date().toISOString(), tehranNow: `${todayKey} ${pNow.hhmm}`, messages: out }, null, 2), 'utf8');
  console.log(`خروجی: ${dest} — ${out.length} پیام`);
}

main().catch((e) => { console.error(e); process.exit(1); });
