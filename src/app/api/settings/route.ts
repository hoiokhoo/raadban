/**
 * تنظیمات: مدل AI، سقف هزینه، زمان‌بندی، پرامپت‌ها
 * کلید API: ذخیره رمزنگاری‌شده سمت سرور؛ به کلاینت فقط ماسک و وضعیت برمی‌گردد.
 */
import { db } from '@/lib/db';
import { ok, fail, err500, settingsSchema } from '@/lib/api-utils';
import { encrypt, maskKey, decrypt } from '@/lib/security/crypto';
import { NextRequest } from 'next/server';

const SAFE_KEYS = ['ai_model', 'ai_budget', 'ai_providers', 'schedule', 'ui_prefs'];

/** حذف کلید از تعریف زنجیره پیش از بازگشت به کلاینت — هرگز کلید به مرورگر نمی‌رود */
function sanitizeProviders(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((p) => {
    if (typeof p !== 'object' || p === null) return p;
    const e = { ...(p as Record<string, unknown>) };
    const hasKey = typeof e.apiKey === 'string' && e.apiKey.length > 0;
    delete e.apiKey;
    if (hasKey) e.hasKey = true;
    return e;
  });
}

export async function GET() {
  try {
    const rows = await db.setting.findMany({ where: { key: { in: SAFE_KEYS } } });
    const map: Record<string, unknown> = {};
    for (const r of rows) {
      map[r.key] = r.key === 'ai_model'
        ? r.value
        : r.key === 'ai_providers'
          ? sanitizeProviders(JSON.parse(r.value))
          : JSON.parse(r.value);
    }
    const keyRow = await db.setting.findUnique({ where: { key: 'ai_api_key' } });
    return ok({
      settings: map,
      apiKey: keyRow ? { exists: true, masked: maskKey(decrypt(keyRow.value) || ''), updatedAt: keyRow.updatedAt } : { exists: false },
    });
  } catch (e) { return err500(e, 'تنظیمات'); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // کلید API جداگانه با رمزنگاری
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      const key = body.apiKey.trim();
      if (key.length < 8 || key.length > 300) return fail('کلید API باید بین ۸ تا ۳۰۰ نویسه باشد', 422);
      await db.setting.upsert({
        where: { key: 'ai_api_key' },
        create: { key: 'ai_api_key', value: encrypt(key) },
        update: { key: 'ai_api_key', value: encrypt(key) },
      });
      // اگر کاربر صریحاً حذف خواست
    } else if (body.clearApiKey === true) {
      await db.setting.deleteMany({ where: { key: 'ai_api_key' } });
    }

    const parsed = settingsSchema.safeParse(body.settings || {});
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'ورودی تنظیمات نامعتبر', 422);
    for (const [key, value] of Object.entries(parsed.data)) {
      await db.setting.upsert({
        where: { key },
        create: { key, value: key === 'ai_model' ? String(value) : JSON.stringify(value) },
        update: { key, value: key === 'ai_model' ? String(value) : JSON.stringify(value) },
      });
    }
    return ok({ saved: true });
  } catch (e) { return err500(e, 'ذخیره تنظیمات'); }
}
