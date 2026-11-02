/**
 * وارد/صادر کردن فهرست منابع با فایل استاندارد JSON (فصل ۴)
 */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET() {
  try {
    const sources = await db.source.findMany({ include: { categories: { include: { category: true } } } });
    const categories = await db.category.findMany();
    const payload = {
      format: 'khabar-rasi-export/v1',
      exportedAt: new Date().toISOString(),
      categories: categories.map((c) => ({ name: c.name, slug: c.slug, description: c.description, color: c.color, promptTemplate: c.promptTemplate, isActive: c.isActive })),
      sources: sources.map((s) => ({
        name: s.name, platform: s.platform, identifier: s.identifier, url: s.url,
        isActive: s.isActive, priority: s.priority, language: s.language, region: s.region,
        topic: s.topic, trustNote: s.trustNote, notes: s.notes,
        fetchIntervalMin: s.fetchIntervalMin, maxItemsPerFetch: s.maxItemsPerFetch,
        categories: s.categories.map((sc) => sc.category.slug),
      })),
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="khabar-rasi-sources-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e) { return err500(e, 'صادر کردن منابع'); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.format !== 'khabar-rasi-export/v1') {
      return fail('قالب فایل نامعتبر است؛ فایل صادرشده همین سامانه (khabar-rasi-export/v1) را وارد کنید', 422);
    }
    let imported = 0, skipped = 0;
    const errors: string[] = [];
    const slugMap = new Map((await db.category.findMany()).map((c) => [c.slug, c.id]));
    for (const s of (body.sources || []).slice(0, 100)) {
      if (!s?.name || !s?.platform || !s?.identifier) { skipped++; continue; }
      const dupe = await db.source.findUnique({ where: { platform_identifier: { platform: s.platform, identifier: s.identifier } } });
      if (dupe) { skipped++; continue; }
      const catIds = (s.categories || []).map((slug: string) => slugMap.get(slug)).filter(Boolean);
      await db.source.create({
        data: {
          name: String(s.name).slice(0, 120), platform: String(s.platform), identifier: String(s.identifier),
          url: s.url || null, isActive: Boolean(s.isActive ?? true),
          priority: ['بالا', 'عادی', 'پایین'].includes(s.priority) ? s.priority : 'عادی',
          language: s.language || 'fa', region: s.region || 'ایران', topic: s.topic || null,
          trustNote: s.trustNote || null, notes: s.notes || null,
          fetchIntervalMin: Number(s.fetchIntervalMin) || 60,
          maxItemsPerFetch: Number(s.maxItemsPerFetch) || 30,
          status: 'دریافت_موفق',
          categories: catIds.length ? { create: catIds.map((id: string) => ({ categoryId: id })) } : undefined,
        },
      });
      imported++;
    }
    return ok({ imported, skipped, errors: errors.slice(0, 5) });
  } catch (e) { return err500(e, 'وارد کردن منابع'); }
}
