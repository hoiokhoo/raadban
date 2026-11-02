/**
 * دسته‌بندی‌ها: فهرست/ایجاد/ویرایش/حذف
 */
import { db } from '@/lib/db';
import { ok, fail, err500, categorySchema } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET() {
  try {
    const categories = await db.category.findMany({
      include: { sources: { include: { source: true } }, _count: { select: { posts: true, events: true, reports: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return ok({ categories });
  } catch (e) { return err500(e, 'فهرست دسته‌ها'); }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = categorySchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'ورودی نامعتبر', 422);
    const dupe = await db.category.findUnique({ where: { slug: parsed.data.slug } });
    if (dupe) return fail(`دسته با شناسه «${parsed.data.slug}» وجود دارد`, 409);
    const cat = await db.category.create({
      data: { ...parsed.data, description: parsed.data.description || null, promptTemplate: parsed.data.promptTemplate || null },
    });
    return ok({ category: cat });
  } catch (e) { return err500(e, 'ایجاد دسته'); }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return fail('شناسه دسته الزامی است', 422);
    const parsed = categorySchema.partial().safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'ورودی نامعتبر', 422);
    const cat = await db.category.update({ where: { id: body.id }, data: parsed.data as never });
    return ok({ category: cat });
  } catch (e) { return err500(e, 'ویرایش دسته'); }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return fail('شناسه دسته الزامی است', 422);
    await db.category.delete({ where: { id } });
    return ok({ deleted: id });
  } catch (e) { return err500(e, 'حذف دسته'); }
}
