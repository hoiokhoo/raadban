/**
 * محافظت در برابر SSRF
 * برای جست‌وجوی وب و دریافت محتوای منابع، درخواست به آدرس‌های داخلی/خصوصی مسدود است.
 */

export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h) return true;
  // localhost و واریانت‌ها
  if (h === 'localhost' || h === 'localhost.localdomain' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  // آدرس مستقیم IP
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]), b = Number(ipv4[2]);
    const parts = [a, b, Number(ipv4[3]), Number(ipv4[4])];
    if (parts.some((x) => Number.isNaN(x) || x < 0 || x > 255)) return true; // فرمت نامعتبر
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  if (h === '::1' || h === '[::1]' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  if (h === '0.0.0.0' || h === 'metadata.google.internal' || h === '169.254.169.254') return true;
  return false;
}

/** اعتبارسنجی URL پیش از fetch؛ در غیرصورت خطای توضیحی برمی‌گردد */
export function safeUrlForFetch(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('نشانی نامعتبر است');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('فقط پروتکل http/https مجاز است');
  }
  if (isPrivateHost(u.hostname)) {
    throw new Error('دسترسی به نشانی‌های داخلی مسدود است (سیاست امنیتی SSRF)');
  }
  return u;
}

/** fetch امن با سقف زمان، سقف حجم و محدودسازی ریدایرکت */
export async function safeFetch(
  rawUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number; headers?: Record<string, string> } = {}
): Promise<{ ok: boolean; status: number; text: string; error?: string; finalUrl: string }> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxBytes = opts.maxBytes ?? 1_500_000; // سقف ۱.۵ مگابایت
  try {
    const u = safeUrlForFetch(rawUrl);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(u.toString(), {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KhabarRasiBot/1.0; +local news verifier)',
        ...(opts.headers || {}),
      },
    });
    clearTimeout(t);
    // پس از ریدایرکت هم مقصد نهایی باید امن باشد
    safeUrlForFetch(res.url || u.toString());
    const buf = await res.arrayBuffer();
    const truncated = buf.byteLength > maxBytes ? buf.slice(0, maxBytes) : buf;
    const text = new TextDecoder('utf-8').decode(truncated);
    return { ok: res.ok, status: res.status, text, finalUrl: res.url || u.toString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'خطای ناشناخته شبکه';
    return { ok: false, status: 0, text: '', error: msg, finalUrl: rawUrl };
  }
}

/** دریافت باینری امن (تصویر برای آپلود به بله) — همان سیاست SSRF با سقف حجم ۵ مگابایت */
export async function safeFetchBinary(
  rawUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<{ ok: boolean; status: number; bytes?: ArrayBuffer; contentType?: string; error?: string }> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxBytes = opts.maxBytes ?? 5_000_000; // سقف ۵ مگابایت برای تصویر
  try {
    const u = safeUrlForFetch(rawUrl);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(u.toString(), {
      signal: ac.signal,
      redirect: 'follow',
      // UA مرورگر — بسیاری از CDNهای تصویر خبری UAهای بات را با ۴۰۰ می‌بندند
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' },
    });
    clearTimeout(t);
    safeUrlForFetch(res.url || u.toString());
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) return { ok: false, status: res.status, error: `حجم فایل بیش از سقف ${Math.round(maxBytes / 1_000_000)}MB است` };
    return { ok: true, status: res.status, bytes: buf, contentType: res.headers.get('content-type') || 'image/jpeg' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'خطای ناشناخته شبکه';
    return { ok: false, status: 0, error: msg };
  }
}
