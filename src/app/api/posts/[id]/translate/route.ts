/** ترجمه فارسی روان یک پست خبری (قابلیت ۱٫۱-ب) */
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { translatePost } from '@/lib/translate';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await translatePost(id);
    if (!r.ok) return fail(r.error || 'ترجمه ناموفق بود', 502);
    return ok(r);
  } catch (e) { return err500(e, 'ترجمه پست'); }
}
