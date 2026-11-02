/**
 * ارزیابی دستی یک ادعا (راستی‌آزمایی با جست‌وجوی وب)
 */
import { ok, err500 } from '@/lib/api-utils';
import { evaluateClaim } from '@/lib/factcheck/engine';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const r = await evaluateClaim(id, { searchWeb: body.searchWeb !== false });
    return ok(r);
  } catch (e) { return err500(e, 'راستی‌آزمایی ادعا'); }
}
