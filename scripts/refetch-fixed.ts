/**
 * دریافت واقعی منابع اصلاح‌شده از طریق API زنده سامانه
 * اجرا: bun run scripts/refetch-fixed.ts
 */
const BASE = 'http://localhost:3000';

const WANTS = ['خبرگزاری فارس', 'باشگاه خبرنگاران جوان', 'صدا و سیما', 'تجارت نیوز', 'المسیره', 'NOW14', 'RFI فارسی'];

interface SourceRow { id: string; name: string; platform: string; status: string }

async function main() {
  const r = await fetch(`${BASE}/api/sources`);
  const { sources } = (await r.json()) as { sources: SourceRow[] };
  let okCount = 0;

  for (const want of WANTS) {
    const s = sources.find((x) => x.name.includes(want));
    if (!s) { console.log(`✗ «${want}» یافت نشد`); continue; }
    try {
      const fr = await fetch(`${BASE}/api/sources/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: s.id }),
      });
      const data = (await fr.json()) as { results?: Array<{ ok: boolean; inserted?: number; duplicatesSkipped?: number; error?: string }> };
      const res = data.results?.[0];
      const ok = !!res?.ok;
      if (ok) okCount++;
      console.log(
        `${ok ? '✓' : '✗'} [${s.platform}] ${s.name.slice(0, 50)} | جدید: ${res?.inserted ?? 0} تکراری: ${res?.duplicatesSkipped ?? 0}` +
        (ok ? '' : ` | خطا: ${(res?.error || 'نامعلوم').slice(0, 100)}`),
      );
    } catch (e) {
      console.log(`✗ ${s.name.slice(0, 50)} | خطای درخواست: ${String(e).slice(0, 80)}`);
    }
  }
  console.log(`\nجمع: ${okCount}/${WANTS.length} موفق`);
}

main();
