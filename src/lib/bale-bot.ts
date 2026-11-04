/**
 * بات بله — ارسال گزارش از طریق API رسمی بات (tapi.bale.ai)
 * سازگار با Telegram Bot API: getMe / sendMessage / getUpdates
 *
 * صراحت:
 * - توکن از BALE_BOT_TOKEN محیط یا Setting رمزنگاری‌شده «bale_bot_token»
 * - ارسال فقط به شناسه عددی چت ممکن است (sendMessage به @username خطای 404 می‌دهد)؛
 *   شناسه چت با getUpdates کشف خودکار می‌شود: کاربر یک بار به بات Start بدهد کافی است.
 * - هیچ پیام ساختگی «ارسال شد» تولید نمی‌شود؛ خطای شبکه/۴۲۹ شفاف بازمی‌گردد.
 * - کلید توکن هرگز در پیام خطا یا پاسخ API بازنمی‌گردد.
 */
import { db } from '@/lib/db';
import { encrypt, decrypt } from './security/crypto';
import { safeFetchBinary } from './security/ssrf';

const BALES_API_BASE = 'https://tapi.bale.ai';

export interface BaleApiResult {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  /** در ۴۲۹ — ثانیه‌های پیشنهادی انتظار */
  retryAfterSec?: number;
}

/** توکن فعال: محیط اول، سپس تنظیمات رمزنگاری‌شده */
export async function getBaleToken(): Promise<string | null> {
  const envTok = process.env.BALE_BOT_TOKEN?.trim();
  if (envTok) return envTok;
  try {
    const row = await db.setting.findUnique({ where: { key: 'bale_bot_token' } });
    if (row) return decrypt(row.value) || null;
  } catch { /* تنظیمات در دسترس نیست */ }
  return null;
}

/** فراخوانی خام API بات بله */
export async function baleApi(method: string, payload?: Record<string, unknown>, timeoutMs = 20000): Promise<BaleApiResult> {
  const token = await getBaleToken();
  if (!token) return { ok: false, error: 'توکن بات بله تنظیم نشده است (BALE_BOT_TOKEN)' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BALES_API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = null; }
    const errObj = (data as { error_code?: number; description?: string } | null);
    if (!res.ok || (errObj && typeof errObj.error_code === 'number' && errObj.error_code >= 400)) {
      const retryAfter = (data as { parameters?: { retry_after?: number } } | null)?.parameters?.retry_after;
      return {
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}${errObj?.description ? `: ${errObj.description}` : text.slice(0, 160)}`,
        retryAfterSec: retryAfter,
      };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === 'AbortError' ? `timeout پس از ${timeoutMs}ms` : e.message) : 'خطای ناشناخته';
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** فراخوانی API با توکن صریح — برای مدیریت بات‌های اختصاصی هر بخش خبری (BotCategory) */
export async function baleApiWith(token: string, method: string, payload?: Record<string, unknown>, timeoutMs = 15000): Promise<BaleApiResult> {
  if (!token?.trim()) return { ok: false, error: 'توکن خالی است' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BALES_API_BASE}/bot${token.trim()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = null; }
    const errObj = (data as { error_code?: number; description?: string } | null);
    if (!res.ok || (errObj && typeof errObj.error_code === 'number' && errObj.error_code >= 400)) {
      const retryAfter = (data as { parameters?: { retry_after?: number } } | null)?.parameters?.retry_after;
      return { ok: false, status: res.status, error: `HTTP ${res.status}${errObj?.description ? `: ${errObj.description}` : text.slice(0, 160)}`, retryAfterSec: retryAfter };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === 'AbortError' ? `timeout پس از ${timeoutMs}ms` : e.message) : 'خطای ناشناخته';
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** شمار اعضای چت/کانال — برای آمار «تعداد نفرات عضو شده» در اپلیکیشن (خواستهٔ کاربر) */
export async function getChatMemberCount(token: string, chatId: string): Promise<{ ok: boolean; count?: number; error?: string }> {
  const r = await baleApiWith(token, 'getChatMemberCount', { chat_id: chatId });
  if (!r.ok) return { ok: false, error: r.error };
  const count = (r.data as { result?: number } | null)?.result;
  return typeof count === 'number' ? { ok: true, count } : { ok: false, error: 'پاسخ بدون شمار اعضا' };
}

/** تست اتصال — getMe */
export async function baleGetMe(): Promise<{ ok: boolean; username?: string; botId?: number; error?: string }> {
  const r = await baleApi('getMe');
  if (!r.ok) return { ok: false, error: r.error };
  const me = r.data as { result?: { id?: number; username?: string } } | null;
  return { ok: true, username: me?.result?.username, botId: me?.result?.id };
}

/** کشف خودکار شناسه چت: Setting، سپس آخرین پیام‌های دریافتی بات */
export async function ensureBaleChatId(): Promise<{ ok: boolean; chatId?: string; discovered?: boolean; error?: string }> {
  try {
    const row = await db.setting.findUnique({ where: { key: 'bale_chat_id' } });
    if (row?.value?.trim()) return { ok: true, chatId: row.value.trim() };
  } catch { /* ادامه با کشف */ }
  const r = await baleApi('getUpdates', { limit: 20, allowed_updates: ['message', 'channel_post'] });
  if (!r.ok) return { ok: false, error: `getUpdates ناموفق: ${r.error}` };
  const updates = (r.data as { result?: Array<Record<string, unknown>> } | null)?.result ?? [];
  for (const u of updates.reverse()) {
    const msg = (u.message ?? u.channel_post) as { chat?: { id?: number | string } } | undefined;
    const id = msg?.chat?.id;
    if (id !== undefined && id !== null) {
      const chatId = String(id);
      await db.setting.upsert({
        where: { key: 'bale_chat_id' },
        create: { key: 'bale_chat_id', value: chatId },
        update: { key: 'bale_chat_id', value: chatId },
      });
      return { ok: true, chatId, discovered: true };
    }
  }
  return { ok: false, error: 'هنوز هیچ گفت‌وگویی با بات ثبت نشده — یک بار در بله بات را باز کنید و Start بزنید' };
}

/** تفکیک متن بلند به قطعه‌های مجاز (سقف بله ≈ ۴۰۹۶ نویسه) — تابع خالص تست‌پذیر */
export function splitForBale(text: string, maxLen = 3500): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    // برش روی آخرین مرز پاراگراف/خط پیش از سقف
    let cut = rest.lastIndexOf('\n\n', maxLen);
    if (cut < maxLen * 0.4) cut = rest.lastIndexOf('\n', maxLen);
    if (cut < maxLen * 0.4) cut = maxLen;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** سقف کپشن عکس در بله (سازگار با تلگرام) — تابع خالص تست‌پذیر */
export function splitPhotoCaption(caption: string, maxLen = 1024): { caption: string; rest: string } {
  const c = caption.trim();
  if (c.length <= maxLen) return { caption: c, rest: '' };
  let cut = c.lastIndexOf('\n\n', maxLen);
  if (cut < maxLen * 0.4) cut = c.lastIndexOf('\n', maxLen);
  if (cut < maxLen * 0.4) cut = maxLen;
  return { caption: c.slice(0, cut), rest: c.slice(cut).trim() };
}

/** ارسال عکس با کپشن — نردبان تلاش صادقانه:
 *  ۱) sendPhoto با URL مستقیم (سرور بله خودش عکس را می‌گیرد) با کپشن HTML
 *  ۲) همان با کپشن ساده (اگر HTML پذیرفته نشد)
 *  ۳) دانلود امن تصویر (سیاست SSRF) و آپلود multipart
 *  ۴۲۹ → انتظار طبق retry_after و یک تلاش مجدد */
export async function sendBalePhoto(
  chatId: string,
  imageUrl: string,
  caption?: string
): Promise<{ ok: boolean; mode?: 'url' | 'upload'; error?: string }> {
  const cap = (caption || '').trim().slice(0, 1024);
  const plainCap = cap.replace(/<[^>]+>/g, '');
  let lastErr = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await baleApi('sendPhoto', {
      chat_id: chatId,
      photo: imageUrl,
      ...(cap ? { caption: cap, parse_mode: 'HTML' } : {}),
    });
    if (r.ok) return { ok: true, mode: 'url' };
    lastErr = r.error || '';
    const retryAfter = r.retryAfterSec;
    if (retryAfter && attempt === 0) {
      await new Promise((res) => setTimeout(res, Math.min(retryAfter, 30) * 1000));
      continue;
    }
    if (cap && (String(r.error || '').includes("can't parse") || String(r.error || '').includes('parse'))) {
      const r2 = await baleApi('sendPhoto', { chat_id: chatId, photo: imageUrl, caption: plainCap });
      if (r2.ok) return { ok: true, mode: 'url' };
      lastErr = r2.error || '';
      break;
    }
    break;
  }
  // آپلود multipart — وقتی سرور بله به URL دسترسی ندارد (هات‌لینک/فایروال)
  const dl = await safeFetchBinary(imageUrl);
  if (!dl.ok || !dl.bytes) {
    return { ok: false, error: `sendPhoto با URL ناموفق بود (${lastErr || 'نامشخص'}) و دریافت تصویر هم ناموفق بود: ${dl.error || dl.status}` };
  }
  const token = await getBaleToken();
  if (!token) return { ok: false, error: 'توکن بات بله تنظیم نشده است' };
  const form = new FormData();
  form.append('chat_id', chatId);
  if (plainCap) form.append('caption', plainCap);
  form.append('photo', new Blob([dl.bytes], { type: dl.contentType || 'image/jpeg' }), 'photo.jpg');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${BALES_API_BASE}/bot${token}/sendPhoto`, { method: 'POST', body: form, signal: controller.signal });
    const text = await res.text().catch(() => '');
    if (!res.ok) return { ok: false, error: `آپلود عکس ناموفق بود (HTTP ${res.status}): ${text.slice(0, 160)}` };
    return { ok: true, mode: 'upload' };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === 'AbortError' ? 'timeout آپلود عکس' : e.message) : 'خطای ناشناخته';
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** ارسال متن (چندقطعه‌ای) به چت مشخص */
export async function sendBaleMessage(chatId: string, text: string): Promise<{ ok: boolean; chunks: number; error?: string }> {
  const parts = splitForBale(text);
  let sent = 0;
  for (let i = 0; i < parts.length; i++) {
    let attempt = 0;
    for (;;) {
      const r = await baleApi('sendMessage', {
        chat_id: chatId,
        text: parts[i],
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      if (r.ok) { sent++; break; }
      // ۴۲۹ → انتظار طبق retry_after و یک تلاش مجدد
      const retryAfter = r.retryAfterSec;
      if (retryAfter && attempt === 0) {
        await new Promise((res) => setTimeout(res, Math.min(retryAfter, 30) * 1000));
        attempt++;
        continue;
      }
      // اگر HTML پذیرفته نشد، نسخهٔ ساده امتحان می‌شود
      if (String(r.error || '').includes("can't parse") || String(r.error || '').includes('parse')) {
        const r2 = await baleApi('sendMessage', { chat_id: chatId, text: parts[i] });
        if (r2.ok) { sent++; break; }
        return { ok: false, chunks: sent, error: `ارسال قطعهٔ ${i + 1}/${parts.length} ناموفق: ${r2.error}` };
      }
      return { ok: false, chunks: sent, error: `ارسال قطعهٔ ${i + 1}/${parts.length} ناموفق: ${r.error}` };
    }
  }
  return { ok: true, chunks: sent };
}

/** ذخیره توکن/شناسه چت از رابط کاربری — توکن رمزنگاری می‌شود */
export async function saveBaleSettings(input: { token?: string; chatId?: string }): Promise<void> {
  if (typeof input.token === 'string' && input.token.trim().length >= 10) {
    await db.setting.upsert({
      where: { key: 'bale_bot_token' },
      create: { key: 'bale_bot_token', value: encrypt(input.token.trim()) },
      update: { key: 'bale_bot_token', value: encrypt(input.token.trim()) },
    });
  }
  if (typeof input.chatId === 'string' && input.chatId.trim()) {
    await db.setting.upsert({
      where: { key: 'bale_chat_id' },
      create: { key: 'bale_chat_id', value: input.chatId.trim() },
      update: { key: 'bale_chat_id', value: input.chatId.trim() },
    });
  }
}
