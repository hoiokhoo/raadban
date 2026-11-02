/**
 * وضعیت زنجیره مدل‌ها (failover) — بدون افشای کلید
 * برای هر تأمین‌کننده: فعال/غیرفعال، دلیل غیرفعال بودن، آخرین خطا و آخرین موفقیت ثبت‌شده
 */
import { ok, err500 } from '@/lib/api-utils';
import { getProviderChain } from '@/lib/ai/providers';
import { modelLabelOf } from '@/lib/ai/client';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const chain = await getProviderChain();
    const primaryModel =
      (await db.setting.findUnique({ where: { key: 'ai_model' } }))?.value || 'glm-4.5-air';

    const providers: Array<Record<string, unknown>> = [];
    for (const p of chain) {
      const label = modelLabelOf(p, primaryModel);
      const [lastFail, lastOk] = await Promise.all([
        db.aiUsage.findFirst({ where: { model: label, status: 'ناموفق' }, orderBy: { createdAt: 'desc' } }),
        db.aiUsage.findFirst({ where: { model: label, status: 'موفق' }, orderBy: { createdAt: 'desc' } }),
      ]);
      providers.push({
        id: p.id,
        label: p.label,
        kind: p.kind,
        enabled: p.enabled,
        hasKey: Boolean(p.apiKey),
        baseUrl: p.baseUrl || null,
        model: label,
        note: p.note || null,
        lastError: lastFail ? { error: lastFail.error?.slice(0, 200), at: lastFail.createdAt } : null,
        lastSuccessAt: lastOk?.createdAt || null,
      });
    }
    return ok({ providers, activeFirst: providers.find((p) => p.enabled)?.id || null });
  } catch (e) { return err500(e, 'وضعیت زنجیره مدل‌ها'); }
}
