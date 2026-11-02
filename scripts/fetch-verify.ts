/**
 * دریافت و راستی‌آزمایی واقعی منابع نمونه — از API زنده سامانه استفاده می‌کند
 * اجرا: bun run scripts/fetch-verify.ts
 */
const BASE = 'http://localhost:3000';

const SAMPLES = [
  'ایسنا', 'فارس', 'ایلنا', 'انصاف',           // ایران
  'رادیو فردا', 'DW فارسی', 'یورونیوز', 'زمانه', // فارسی بین‌المللی
  'SCMP', 'گلوبال تایمز',                        // چین
  'TASS', 'RT',                                  // روسیه
  'نیویورک تایمز', 'NPR', 'Politico', 'د هیل', 'WSJ', // آمریکا
  'گاردین — بین‌الملل', 'گاردین — محیط زیست', 'France24', // اروپا
  'آناتولی', 'تایمز آو اسرائیل', 'الشرق الاوسط', 'دان', 'د هیندو', // سایر
  'BBC Sport', 'ESPN', 'WHO',                    // ورزش/سلامت
];

interface SourceRow { id: string; name: string; platform: string; status: string; lastFetchAt: string | null; lastError: string | null }

async function main() {
  const r = await fetch(`${BASE}/api/sources`);
  const { sources } = (await r.json()) as { sources: SourceRow[] };
  const results: Array<{ name: string; platform: string; ok: boolean; inserted?: number; dup?: number; error?: string; status: string }> = [];

  for (const want of SAMPLES) {
    const s = sources.find((x) => x.name.includes(want));
    if (!s) { results.push({ name: want, platform: '—', ok: false, error: 'منبع یافت نشد', status: '—' }); continue; }
    try {
      const fr = await fetch(`${BASE}/api/sources/fetch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: s.id }),
      });
      const data = await fr.json() as { results?: Array<{ ok: boolean; inserted?: number; duplicatesSkipped?: number; error?: string }> };
      const res = data.results?.[0];
      results.push({
        name: s.name.slice(0, 46), platform: s.platform, ok: !!res?.ok,
        inserted: res?.inserted, dup: res?.duplicatesSkipped, error: res?.error?.slice(0, 90), status: s.status,
      });
    } catch (e) {
      results.push({ name: s.name.slice(0, 46), platform: s.platform, ok: false, error: `خطای درخواست: ${String(e).slice(0, 60)}`, status: s.status });
    }
  }

  console.log('\n=== نتیجه دریافت واقعی نمونه منابع ===');
  let okCount = 0;
  for (const r2 of results) {
    const mark = r2.ok ? '✓' : '✗';
    if (r2.ok) okCount++;
    console.log(`${mark} [${r2.platform}] ${r2.name} | جدید:${r2.inserted ?? 0} تکراری:${r2.dup ?? 0} ${r2.ok ? '' : '| خطا: ' + (r2.error || 'نامعلوم')}`);
  }
  console.log(`\nجمع: ${okCount}/${results.length} موفق`);
}

main();
