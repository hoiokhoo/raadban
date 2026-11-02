/** ترجمه فارسی روان یک پیام کانال */
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { translateChannelMessage } from '@/lib/translate';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await translateChannelMessage(id);
    if (!r.ok) return fail(r.error || 'ترجمه ناموفق بود', 502);
    return ok(r);
  } catch (e) { return err500(e, 'ترجمه پیام'); }
}
