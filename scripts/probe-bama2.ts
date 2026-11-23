/** بایدمدازی توالی واقعی fetchMarketData: کانال‌ها سپس باما — با ثبت دقیق خطاها */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function get(url: string, timeoutMs = 12000): Promise<{ ok: boolean; status?: number; text?: string; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json,text/html,*/*' }, signal: ctrl.signal, redirect: 'follow' });
    const text = await res.text().catch(() => '');
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    if (!text) return { ok: false, status: res.status, error: 'پاسخ خالی' };
    return { ok: true, status: res.status, text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.name : '?' };
  } finally { clearTimeout(timer); }
}

function parse(text: string) {
  const t = (text || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const mkt = t.match(/قیمت بازار\s*([0-9]{1,3}(?:,[0-9]{3}){2,})\s*تومان/);
  const fct = t.match(/قیمت (?:کارخانه|نمایندگی)\s*([0-9]{1,3}(?:,[0-9]{3}){2,})\s*تومان/);
  return { mkt: mkt ? mkt[1] : null, fct: fct ? fct[1] : null };
}

// ۱) مثل fetchMarketData: اول کانال‌های تلگرام
console.log('── کانال‌ها ──');
for (const ch of ['irankhodro3007', 'akhbar_khodroei', 'Akharin_khodro']) {
  const r = await get(`https://t.me/s/${ch}`);
  console.log(`${ch}: ${r.ok ? `OK len=${r.text?.length}` : `FAIL ${r.error}`}`);
}

// ۲) باما — متوالی با فاصلهٔ ۱ ثانیه
console.log('── باما (متوالی ۱s) ──');
const SLUGS = [
  'pride_151_gx', 'quick_manuals', 'saina_manuals_mtgas', 'shahin_g', 'atlas_g_mt', 'sahand_smt_gasoline',
  'arisun_2', 'parsnoa_1.6liter_mt', 'peugeot_207_manualtu5p', 'tara_v1p_6mt', 'dena_plusef7p_6mt',
  'runna_plus_tu5plus', 'samand_soren_plustu5p', 'reera_1.7literturbo_6at', 'haima_s5_6at',
  'haima_s7_1.5literturbopro', 'haima_8s', 'haima_7x_1.6literturbo', 'jac_j4', 'kmc_sr3_1.6liter',
];
let ok = 0;
for (const s of SLUGS) {
  const r = await get(`https://bama.ir/price/${s}`);
  const p = r.ok && r.text ? parse(r.text) : { mkt: null, fct: null };
  if (p.mkt || p.fct) ok++;
  console.log(`${s.padEnd(28)} ${r.ok ? `len=${String(r.text?.length).padStart(6)}` : `ERR:${r.error}`} بازار=${p.mkt ?? '—'} کارخانه=${p.fct ?? '—'}`);
  await new Promise((res) => setTimeout(res, 1000));
}
console.log(`موفق: ${ok}/${SLUGS.length}`);
