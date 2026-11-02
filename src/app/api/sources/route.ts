import { db } from '@/lib/db';
import { ok, fail, err500, sourceCreateSchema } from '@/lib/api-utils';
import { getConnector } from '@/lib/connectors';
import { extractChannelName } from '@/lib/connectors/types';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export async function GET() {
  try {
    const sources = await db.source.findMany({
      include: { categories: { include: { category: true } }, _count: { select: { posts: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok({ sources });
  } catch (e) { return err500(e, 'فهرست منابع'); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // افزودن گروهی: { items: [...] } یا { bulk: "سطر به سطر" }
    if (body.items && Array.isArray(body.items)) {
      const results: Record<string, unknown>[] = [];
      for (const item of body.items.slice(0, 50)) {
        const parsed = sourceCreateSchema.safeParse(item);
        if (!parsed.success) {
          results.push({ ok: false, error: parsed.error.issues[0]?.message || 'ورودی نامعتبر', name: item?.name });
          continue;
        }
        const r = await createOne(parsed.data);
        results.push(r);
      }
      return ok({ results });
    }
    if (typeof body.bulk === 'string' && body.bulk.trim()) {
      const lines = body.bulk.split('\n').map((s: string) => s.trim()).filter(Boolean).slice(0, 50);
      const results: Record<string, unknown>[] = [];
      for (const line of lines) {
        const name = extractChannelName(line);
        const guessPlatform = line.includes('eitaa.com') ? 'eitaa' : line.includes('bale.ai') ? 'bale'
          : line.includes('t.me') ? 'telegram' : /^https?:\/\//.test(line) ? 'rss' : 'telegram';
        const r = await createOne({
          name, platform: guessPlatform, identifier: name, categoryIds: body.categoryIds || [],
        });
        results.push(r);
      }
      return ok({ results });
    }

    const parsed = sourceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || 'ورودی نامعتبر', 422);
    }
    const r = await createOne(parsed.data);
    return 'ok' in r && r.ok ? ok(r) : fail((r as { error: string }).error, 409);
  } catch (e) { return err500(e, 'ایجاد منبع'); }
}

async function createOne(data: z.infer<typeof sourceCreateSchema>) {
  const connector = getConnector(data.platform);
  const identifier = connector ? connector.normalizeIdentifier(data.identifier) : data.identifier;
  // بررسی تکراری بودن پیش از ثبت
  const dupe = await db.source.findUnique({ where: { platform_identifier: { platform: data.platform, identifier } } });
  if (dupe) return { ok: false, error: `این منبع قبلاً با نام «${dupe.name}» ثبت شده است`, name: data.name };
  if (connector && !connector.validateIdentifier(identifier)) {
    return { ok: false, error: `شناسه برای پلتفرم ${connector.label} نامعتبر است (نام کانال بدون @ یا نشانی کامل)`, name: data.name };
  }
  const catIds = (data.categoryIds || []).filter(Boolean);
  const source = await db.source.create({
    data: {
      name: data.name,
      platform: data.platform,
      identifier,
      url: data.url || null,
      priority: data.priority || 'عادی',
      language: data.language || 'fa',
      region: data.region || 'ایران',
      topic: data.topic || null,
      entityType: data.entityType || 'رسانه',
      politicalOrientation: data.politicalOrientation || null,
      trustNote: data.trustNote || null,
      notes: data.notes || null,
      fetchIntervalMin: data.fetchIntervalMin ?? 60,
      maxItemsPerFetch: data.maxItemsPerFetch ?? 30,
      status: 'دریافت_موفق',
      statusDetail: 'تازه ثبت شده — در نخستین دریافت دوره‌ای به‌روزرسانی می‌شود',
      categories: catIds.length ? { create: catIds.map((categoryId) => ({ categoryId })) } : undefined,
    },
  });
  return { ok: true as const, sourceId: source.id, name: source.name };
}
