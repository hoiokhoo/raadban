/**
 * آزمون زندهٔ وقایع روز — واکشی واقعی از ویکی‌پدیای فارسی و ساخت پیام صبحگاهی/شبانگاهی کامل
 * اجرا: bun scripts/preview-day-history.ts
 */
import { fetchDayHistory } from '../bot/day-history';
import { buildDailyMessage } from '../bot/daily';
import { pickHadith } from '../bot/daily';
import { tripleDateOf, shiftDateKey, dateKeyOf } from '../bot/calendar';
import { HADITH_BANK } from '../bot/hadiths-data';

async function main(): Promise<void> {
  const tz = 'Asia/Tehran';
  const todayKey = dateKeyOf(Date.now(), tz);
  const t0 = Date.now();
  const hist = await fetchDayHistory(tripleDateOf(todayKey, tz, 'umalqura').keys.j);
  console.log(`⏱ واکشی: ${((Date.now() - t0) / 1000).toFixed(1)}s | عنوان: ${hist?.title} | مدخل: ${hist?.entries.length ?? 'null'}`);
  if (!hist || hist.entries.length === 0) {
    console.log('❌ خروجی خالی — بخش وقایع حذف می‌شود (صادقانه)');
    return;
  }
  const prayer = { lat: 35.6892, lon: 51.389, method: 'tehran' as const, fajrAngle: 17.7, ishaAngle: 14, maghribMinutes: 15, tz };
  const morning = await buildDailyMessage({
    kind: 'morning', dateKey: todayKey, tz, qamariBasis: 'umalqura', city: 'تهران',
    prayer, hadith: HADITH_BANK[0], image: null, dayHistory: hist.entries,
  });
  console.log('──────── پیام صبحگاهی (امروز) ────────');
  console.log(morning.text.replace(/<[^>]+>/g, ''));
  console.log(`طول متن: ${morning.text.length} نویسه`);
  const evening = await buildDailyMessage({
    kind: 'evening', dateKey: todayKey, tz, qamariBasis: 'umalqura', city: 'تهران',
    prayer, hadith: HADITH_BANK[1], image: null, dayHistory: hist.entries,
  });
  console.log('──────── خط وقایع در پیام شبانگاهی (فردا) ────────');
  const lines = evening.text.replace(/<[^>]+>/g, '').split('\n');
  const start = lines.findIndex((l) => l.includes('وقایع فردا'));
  if (start >= 0) console.log(lines.slice(start, start + 6).join('\n'));
  else console.log('(بلوک وقایع فردا در پیام شب نیست — صادقانه)');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
