/**
 * مدیریت کلید API تأمین‌کنندگان مدل — افزوده‌شده به درخواست کاربر
 * - ذخیره رمزنگاری‌شده در Setting «ai_provider_keys» — کلید هرگز به مرورگر برنمی‌گردد
 * - نمایش مصرف امروز (توکن تخمینی) و نرخ موفقیت هر تأمین‌کننده از AiUsage
 * - OpenRouter با کلید فعال: ماندهٔ واقعی حساب از API خودش (در شکست: «نامشخص» صادقانه)
 */
import { ok, fail, err500 } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { encrypt, maskKey } from '@/lib/security/crypto';
import { getProviderChain, loadProviderKeys } from '@/lib/ai/providers';

const KNOWN_IDS = ['gemini', 'zai', 'pollinations', 'fcc', 'groq', 'openrouter', 'nvidia', 'github-models', 'together'];

async function usageToday(): Promise<Map<string, { tokens: number; ok: number; fail: number }>> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db.aiUsage.findMany({
    where: { createdAt: { gte: startOfDay } },
    select: { model: true, estTokens: true, status: true },
  });
  const map = new Map<string, { tokens: number; ok: number; fail: number }>();
  for (const r of rows) {
    // مدل به شکل «glm-4.5-air» یا «providerId/model» ثبت می‌شود — پیشوند شناسه تأمین‌کننده
    const pid = r.model.includes('/') ? r.model.split('/')[0] : 'zai';
    const cur = map.get(pid) ?? { tokens: 0, ok: 0, fail: 0 };
    cur.tokens += r.estTokens || 0;
    if (r.status === 'موفق') cur.ok++;
    else if (r.status === 'ناموفق') cur.fail++;
    map.set(pid, cur);
  }
  return map;
}

/** ماندهٔ واقعی OpenRouter — تنها سرویسی در زنجیره با نقطهٔ پایانی عمومی ماندهٔ کلید */
async function openrouterBalance(key?: string): Promise<{ usedUSD?: number; limitUSD?: number | null; remainingUSD?: number | null; isFreeTier?: boolean; note?: string }> {
  if (!key) return { note: 'بدون کلید' };
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { note: `نامشخص (HTTP ${res.status})` };
    const data = (await res.json()) as { data?: { usage?: number; limit?: number | null; is_free_tier?: boolean; usage_daily?: number } };
    const usage = data.data?.usage ?? 0;
    const limit = data.data?.limit ?? null;
    const freeTier = data.data?.is_free_tier === true;
    return {
      usedUSD: usage,
      limitUSD: limit,
      remainingUSD: limit === null || limit === undefined ? null : Math.max(0, limit - usage),
      isFreeTier: freeTier,
      note: freeTier
        ? 'سطح رایگان: بدون سقف ریالی — مانده بی‌نهایت است؛ فقط محدودیت نرخ سرویس رایگان اعمال می‌شود'
        : limit === null
          ? 'بدون سقف تعیین‌شده — مصرف از اعتبار حساب کم می‌شود'
          : undefined,
    };
  } catch (e) {
    return { note: `نامشخص (${e instanceof Error ? e.message : 'خطا'})` };
  }
}

export async function GET() {
  try {
    const [chain, keys, usage] = await Promise.all([getProviderChain(), loadProviderKeys(), usageToday()]);
    const providers: Record<string, unknown>[] = [];
    for (const p of chain) {
      const u = usage.get(p.id) ?? { tokens: 0, ok: 0, fail: 0 };
      const hasSettingKey = Boolean(keys[p.id]);
      providers.push({
        id: p.id,
        label: p.label,
        kind: p.kind,
        enabled: p.enabled,
        model: p.model || null,
        baseUrl: p.baseUrl || null,
        note: p.note || null,
        hasKey: Boolean(p.apiKey) || hasSettingKey,
        keyMasked: (p.apiKey || (hasSettingKey ? keys[p.id] : '')) ? maskKey(p.apiKey || keys[p.id]) : null,
        keySource: hasSettingKey ? 'settings' : p.apiKey ? 'env' : null,
        isDefault: p.id === 'gemini',
        usageToday: { tokens: u.tokens, ok: u.ok, fail: u.fail },
        known: KNOWN_IDS.includes(p.id),
      });
    }
    const orKey = keys['openrouter'] || process.env.OPENROUTER_API_KEY || undefined;
    const openrouter = await openrouterBalance(orKey);
    return ok({ providers, openrouter });
  } catch (e) { return err500(e, 'مدیریت کلیدهای مدل'); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const providerId = String(body.providerId || '').trim().slice(0, 60);
    if (!providerId || !/^[a-z0-9-]+$/i.test(providerId)) return fail('شناسه تأمین‌کننده نامعتبر است', 422);
    if (providerId === 'zai' || providerId === 'pollinations') return fail('این تأمین‌کننده کلید نمی‌گیرد', 422);

    const row = await db.setting.findUnique({ where: { key: 'ai_provider_keys' } });
    let current: Record<string, string> = {};
    if (row) { try { current = JSON.parse(row.value); } catch { current = {}; } }

    // حذف کلید
    if (body.remove === true) {
      delete current[providerId];
      await db.setting.upsert({
        where: { key: 'ai_provider_keys' },
        create: { key: 'ai_provider_keys', value: JSON.stringify(current) },
        update: { key: 'ai_provider_keys', value: JSON.stringify(current) },
      });
      return ok({ removed: providerId });
    }

    // افزودن/به‌روزرسانی کلید
    const key = String(body.apiKey || '').trim();
    if (key.length < 8 || key.length > 500) return fail('کلید باید بین ۸ تا ۵۰۰ نویسه باشد', 422);
    current[providerId] = encrypt(key);
    await db.setting.upsert({
      where: { key: 'ai_provider_keys' },
      create: { key: 'ai_provider_keys', value: JSON.stringify(current) },
      update: { key: 'ai_provider_keys', value: JSON.stringify(current) },
    });
    return ok({ saved: providerId, masked: maskKey(key) });
  } catch (e) { return err500(e, 'ذخیره کلید مدل'); }
}
