/**
 * ادعاها: فهرست با فیلتر وضعیت/دسته
 */
import { db } from '@/lib/db';
import { ok, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const status = sp.get('status');
    const take = Math.min(60, Number(sp.get('take') || 30));
    const claims = await db.claim.findMany({
      where: status ? { status } : {},
      include: {
        post: { include: { source: true } },
        evidence: true,
        factcheckReports: { orderBy: { generatedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return ok({ claims });
  } catch (e) { return err500(e, 'فهرست ادعاها'); }
}
