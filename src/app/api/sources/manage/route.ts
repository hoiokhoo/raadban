/**
 * مدیریت منابع: ویرایش/فعال-غیرفعال/حذف با id در URL query
 */
import { db } from '@/lib/db';
import { ok, fail, err500, sourceUpdateSchema } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function PATCH(req: NextRequest) {
  try {
    const parsed = sourceUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'ورودی نامعتبر', 422);
    const { id, categoryIds, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (categoryIds) {
      data.categories = {
        deleteMany: {},
        create: categoryIds.filter(Boolean).map((categoryId) => ({ categoryId })),
      };
    }
    const source = await db.source.update({ where: { id }, data: data as never });
    return ok({ sourceId: source.id });
  } catch (e) { return err500(e, 'ویرایش منبع'); }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id.length < 5) return fail('شناسه منبع نامعتبر', 422);
    await db.source.delete({ where: { id } });
    return ok({ deleted: id });
  } catch (e) { return err500(e, 'حذف منبع'); }
}
