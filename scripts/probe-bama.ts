/** تشخیص ناپایداری واکشی باما — وضعیت HTTP و محتوای پاسخ‌های ناموفق */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function probe(url: string, label: string, headers: Record<string, string>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, redirect: 'follow' });
    const text = await res.text().catch(() => '');
    const hasMkt = /قیمت بازار\s*[0-9]/.test(text.replace(/<[^>]+>/g, ' '));
    const hasFct = /قیمت (?:کارخانه|نمایندگی)\s*[0-9]/.test(text.replace(/<[^>]+>/g, ' '));
    console.log(`${label} → HTTP ${res.status} len=${text.length} بازار=${hasMkt} کارخانه=${hasFct}`);
  } catch (e) {
    console.log(`${label} → ERR ${e instanceof Error ? e.name : '?'}`);
  } finally { clearTimeout(t); }
}

const models = [
  ['peugeot_207_manualtu5p', 'پژو207'],
  ['quick_manuals', 'کوییک'],
  ['saina_manuals_mtgas', 'ساینا'],
  ['haima_s7_1.5literturbopro', 'هایماS7'],
  ['jac_j4', 'J4'],
  ['tara_v1p_6mt', 'تارا'],
] as const;

console.log('=== سری ۱: هدر ساده (مثل get فعلی) ===');
await Promise.all(models.map(([slug, l]) => probe(`https://bama.ir/price/${slug}`, l, { 'User-Agent': UA, Accept: 'application/json,text/html,*/*' })));

console.log('=== سری ۲: با Accept-Language + Accept کامل ===');
await new Promise((r) => setTimeout(r, 3000));
await Promise.all(models.map(([slug, l]) => probe(`https://bama.ir/price/${slug}`, l, {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fa,en;q=0.8',
})));

console.log('=== سری ۳: متوالی (نه هم‌زمان) با هدر کامل ===');
for (const [slug, l] of models) {
  await new Promise((r) => setTimeout(r, 1200));
  await probe(`https://bama.ir/price/${slug}`, l, {
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fa,en;q=0.8',
  });
}
