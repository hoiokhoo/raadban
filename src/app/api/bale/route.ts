/**
 * بات بله — وضعیت، ذخیره تنظیمات، تست ارسال، اجرای دستی گزارش
 * توکن هرگز به کلاینت بازنمی‌گردد — فقط ماسک و وضعیت.
 */
import { ok, fail, err500 } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { baleGetMe, ensureBaleChatId, sendBaleMessage, saveBaleSettings, getBaleToken } from '@/lib/bale-bot';
import { getDigestConfig, saveDigestConfig, runBaleDigest, runBaleDailyReport } from '@/lib/bale-digest';

function maskToken(t: string): string {
  if (t.length < 12) return '••••';
  return `${t.slice(0, 6)}••••••${t.slice(-4)}`;
}

export async function GET() {
  try {
    const token = await getBaleToken();
    const [chatRow, cfg, lastSent, lastTry, lastDailyDate, lastDailyTry] = await Promise.all([
      db.setting.findUnique({ where: { key: 'bale_chat_id' } }),
      getDigestConfig(),
      db.setting.findUnique({ where: { key: 'bale_digest_last_at' } }),
      db.setting.findUnique({ where: { key: 'bale_digest_last_try' } }),
      db.setting.findUnique({ where: { key: 'bale_daily_last_date' } }),
      db.setting.findUnique({ where: { key: 'bale_daily_last_try' } }),
    ]);
    const me = token ? await baleGetMe() : { ok: false, error: 'توکن تنظیم نشده' };
    const lastJobs = await db.jobRun.findMany({
      where: { targetId: { in: ['bale:digest', 'manual:bale-digest', 'bale:daily', 'manual:bale-daily'] } },
      orderBy: { startedAt: 'desc' },
      take: 8,
      select: { targetId: true, status: true, startedAt: true, error: true, durationMs: true },
    });
    return ok({
      bot: { hasToken: Boolean(token), masked: token ? maskToken(token) : null, ...me },
      chatId: chatRow?.value || null,
      digest: { ...cfg, lastSentAt: lastSent?.value || null, lastTryAt: lastTry?.value || null },
      daily: { ...cfg, lastSentDate: lastDailyDate?.value || null, lastTryAt: lastDailyTry?.value || null },
      lastJobs,
    });
  } catch (e) { return err500(e, 'وضعیت بات بله'); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'save') {
      if (body.token !== undefined && typeof body.token !== 'string') return fail('توکن نامعتبر است', 422);
      if (body.chatId !== undefined && typeof body.chatId !== 'string') return fail('شناسه چت نامعتبر است', 422);
      await saveBaleSettings({ token: body.token, chatId: body.chatId });
      if (body.digest && typeof body.digest === 'object') await saveDigestConfig(body.digest);
      return ok({ saved: true });
    }

    if (action === 'clearChat') {
      await db.setting.deleteMany({ where: { key: 'bale_chat_id' } });
      return ok({ cleared: true });
    }

    if (action === 'discover') {
      const r = await ensureBaleChatId();
      return r.ok ? ok({ chatId: r.chatId, discovered: r.discovered }) : fail(r.error || 'کشف شناسه چت ناموفق بود', 422);
    }

    if (action === 'test') {
      const me = await baleGetMe();
      if (!me.ok) return fail(`اتصال به بات ناموفق بود: ${me.error}`, 502);
      const chat = body.chatId ? { ok: true, chatId: String(body.chatId) } : await ensureBaleChatId();
      if (!chat.ok) return fail(me.username ? `بات @${me.username} فعال است اما ${chat.error}` : (chat.error || ''), 422);
      const sent = await sendBaleMessage(chat.chatId!, '✅ تست اتصال سامانهٔ رصدبان — گزارش‌های خودکار خبری به همین چت ارسال می‌شود.');
      return sent.ok ? ok({ sent: true, chatId: chat.chatId, username: me.username }) : fail(sent.error || 'ارسال ناموفق بود', 502);
    }

    if (action === 'digest') {
      // اجرای پس‌زمینه — پاسخ فوری؛ نتیجه در JobRun «manual:bale-digest» و lastSentAt منعکس می‌شود
      const job = await db.jobRun.create({ data: { jobType: 'manual', targetId: 'manual:bale-digest', status: 'در_حال_اجرا' } });
      const t0 = Date.now();
      void runBaleDigest({ force: true })
        .then(async (r) => {
          await db.jobRun.update({
            where: { id: job.id },
            data: {
              status: r.sent ? 'موفق' : 'ناموفق',
              finishedAt: new Date(),
              durationMs: Date.now() - t0,
              error: r.sent ? null : (r.error || r.skipped || 'ارسال انجام نشد').slice(0, 800),
              details: r.sent ? `اخبار: ${r.newsSent ?? 0} · عکس: ${r.images ?? 0}${r.translated ? ` · ترجمه: ${r.translated}` : ''}` : null,
            },
          });
        })
        .catch(async (e) => {
          await db.jobRun.update({
            where: { id: job.id },
            data: { status: 'ناموفق', finishedAt: new Date(), durationMs: Date.now() - t0, error: String(e instanceof Error ? e.message : e).slice(0, 800) },
          }).catch(() => {});
        });
      return ok({ started: true, jobId: job.id });
    }

    if (action === 'daily') {
      // گزارش جامع روزانه — اجرای پس‌زمینه؛ نتیجه در JobRun «manual:bale-daily»
      const job = await db.jobRun.create({ data: { jobType: 'manual', targetId: 'manual:bale-daily', status: 'در_حال_اجرا' } });
      const t0 = Date.now();
      void runBaleDailyReport({ force: true })
        .then(async (r) => {
          await db.jobRun.update({
            where: { id: job.id },
            data: {
              status: r.sent ? 'موفق' : 'ناموفق',
              finishedAt: new Date(),
              durationMs: Date.now() - t0,
              error: r.sent ? null : (r.error || r.skipped || 'ارسال انجام نشد').slice(0, 800),
              details: r.sent ? `مطالب: ${r.posts ?? 0} · رویداد منتخب: ${r.items ?? 0}` : null,
            },
          });
        })
        .catch(async (e) => {
          await db.jobRun.update({
            where: { id: job.id },
            data: { status: 'ناموفق', finishedAt: new Date(), durationMs: Date.now() - t0, error: String(e instanceof Error ? e.message : e).slice(0, 800) },
          }).catch(() => {});
        });
      return ok({ started: true, jobId: job.id });
    }

    return fail('عملیات ناشناخته', 400);
  } catch (e) { return err500(e, 'عملیات بات بله'); }
}
