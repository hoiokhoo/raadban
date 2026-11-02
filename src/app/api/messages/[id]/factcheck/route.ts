/** راستی‌آزمایی هوش مصنوعی پیام — سگمنت‌به‌سگمنت با خلاصه و نتیجه‌گیری */
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { factcheckMessage } from '@/lib/factcheck/message';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await dbCheck(id);
    if (!existing) return fail('پیام یافت نشد', 404);

    const r = await factcheckMessage(id);
    if (!r.ok) return fail(r.error || 'راستی‌آزمایی ناموفق بود', 502, { missingQuotes: r.missingQuotes });
    return ok(r);
  } catch (e) { return err500(e, 'راستی‌آزمایی پیام'); }
}

async function dbCheck(id: string) {
  const { db } = await import('@/lib/db');
  return db.channelMessage.findUnique({ where: { id } });
}
