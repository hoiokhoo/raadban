/**
 * اجرای دستی سیستم: دریافت | پردازش | راستی‌آزمایی | گزارش
 */
import { ok, err500 } from '@/lib/api-utils';
import { runNow } from '@/lib/scheduler';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { kind } = await req.json();
    const valid = ['ingest', 'pipeline', 'factcheck', 'report'];
    if (!valid.includes(kind)) return ok({ ok: false, error: 'نوع اجرا نامعتبر' }, 400);
    const startedAt = new Date();
    await runNow(kind);
    return ok({ kind, startedAt, finishedAt: new Date(), note: 'اجرا پایان یافت — جزئیات در سوابق وظایف' });
  } catch (e) { return err500(e, 'اجرای دستی'); }
}
