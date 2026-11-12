/**
 * دریافت واقعی ۷ منبع تازه‌افزوده + تلاش مجدد منابع خطادار کلیدی
 * اجرا: bun run scripts/fetch-new.ts
 * صادق‌سازی: هر خطا همان‌طور که هست ثبت می‌شود — هیچ وانمودی به دریافت.
 */
const BASE = 'http://localhost:3000';

const WANTED = [
  '@WhiteHouse', '@IsraeliPM', '@MFA_China', '@araghchi',
  '@MedvedevRussiaE', '@ZakharovaMFA', '@khamenei_ir',
  'president.ir', // تلاش مجدد دفتر رئیس‌جمهور
];

interface SourceRow { id: string; name: string; platform: string; status: string }

async function main() {
  const r = await fetch(`${BASE}/api/sources`);
  const { sources } = (await r.json()) as { sources: SourceRow[] };
  for (const want of WANTED) {
    const s = sources.find((x) => x.name.includes(want) || x.identifier.includes(want));
    if (!s) { console.log(`✗ یافت نشد: ${want}`); continue; }
    const fr = await fetch(`${BASE}/api/sources/fetch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: s.id }),
    });
    const data = (await fr.json()) as { results?: Array<{ ok: boolean; inserted?: number; duplicatesSkipped?: number; error?: string }> };
    const res = data.results?.[0];
    if (res?.ok) {
      console.log(`✓ ${s.name.slice(0, 50)} — ${res.inserted} مطلب جدید (${res.duplicatesSkipped ?? 0} تکرار حذف شد)`);
    } else {
      console.log(`✗ ${s.name.slice(0, 50)} — خطای صادقانه: ${res?.error?.slice(0, 110) ?? 'نامشخص'}`);
    }
  }
}

main();
