/**
 * زمان‌بند درون‌پردازشی — فصل ۹ سند
 * - tick هر دقیقه، بدون وابستگی به فراخوانی HTTP
 * - دریافت دوره‌ای منابع (fetchIntervalMin هر منبع)
 * - گزارش شبانه در ساعت تنظیمی با TZ تهران
 * - جلوگیری از گزارش تکراری + سیاست جبران بازه ازدست‌رفته (catch-up)
 * - قفل هم‌زمانی: هرگز دو نمونه موازی از یک کار
 */
import { db } from '@/lib/db';
import { ingestSource, ingestAll, processPendingPosts } from './ingest';
import { generateDailyReport } from './reports';
import { isoDateInTz, timeInTz, SYSTEM_TIMEZONE, addDaysISO } from './persian';
import { evaluateClaim } from './factcheck/engine';
import { getDigestConfig, runBaleDigest, runBaleDailyReport } from './bale-digest';
import { rebuildClusters } from './pipeline/clustering-run';

interface SchedulerState {
  timer: NodeJS.Timeout | null;
  running: Set<string>; // قفل کارهای در حال اجرا
  lastTickAt: Date | null;
  startedAt: Date;
  enabled: boolean;
}

const g = globalThis as unknown as { __khabarScheduler?: SchedulerState };

function state(): SchedulerState {
  if (!g.__khabarScheduler) {
    g.__khabarScheduler = {
      timer: null, running: new Set(), lastTickAt: null,
      startedAt: new Date(), enabled: true,
    };
  }
  return g.__khabarScheduler;
}

async function guarded(jobId: string, fn: () => Promise<void>): Promise<void> {
  const s = state();
  if (s.running.has(jobId)) return; // جلوگیری از اجرای موازی تکراری
  s.running.add(jobId);
  const job = await db.jobRun.create({ data: { jobType: jobId.split(':')[0], targetId: jobId, status: 'در_حال_اجرا' } });
  const t0 = Date.now();
  try {
    await fn();
    await db.jobRun.update({ where: { id: job.id }, data: { status: 'موفق', finishedAt: new Date(), durationMs: Date.now() - t0 } });
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : 'خطای ناشناخته';
    await db.jobRun.update({ where: { id: job.id }, data: { status: 'ناموفق', finishedAt: new Date(), durationMs: Date.now() - t0, error: err.slice(0, 800) } });
  } finally {
    s.running.delete(jobId);
  }
}

async function tick(): Promise<void> {
  const s = state();
  s.lastTickAt = new Date();
  if (!s.enabled) return;

  const sched = await db.setting.findUnique({ where: { key: 'schedule' } });
  const cfg = sched ? JSON.parse(sched.value) : {
    reportTime: '22:30', activeDays: [0, 1, 2, 3, 4, 5, 6], catchUp: true, timezone: SYSTEM_TIMEZONE,
    autoFactcheck: true,
  };
  if (cfg.enabled === false) return;

  // ۱) دریافت دوره‌ای منابع — شکست واقعی هر منبع در JobRun هم صادقانه ثبت می‌شود
  //    (پرش هماهنگ مدارشکن ایکس خطا نیست و «ناموفق» ثبت نمی‌شود)
  //    ترتیب «قدیمی‌ترین دریافت اول» → بودجهٔ ایکس بین همهٔ حساب‌ها می‌چرخد (نوبت‌دهی)
  const sources = await db.source.findMany({ where: { isActive: true }, orderBy: { lastFetchAt: 'asc' } });
  const now = Date.now();
  for (const src of sources) {
    const due = !src.lastFetchAt || (now - src.lastFetchAt.getTime()) >= src.fetchIntervalMin * 60_000;
    if (due) {
      await guarded(`fetch:${src.id}`, async () => {
        const out = await ingestSource(src.id);
        if (!out.ok && !out.skippedCoordinated) {
          throw new Error(out.error || 'دریافت ناموفق بود');
        }
      });
    }
  }

  // ۲) پردازش مطالب خام در انتظار — حالت اقتصادی: هر ۳۰ دقیقه و فقط ۲ مطلب
  //    (قبلاً هر تیک ۶۰ ثانیه‌ای ۴ مطلب پردازش می‌شد = مصرف بی‌رویهٔ سهمیهٔ مدل)
  const pendingCount = await db.post.count({ where: { processingStatus: 'خام' } });
  if (pendingCount > 0) {
    const lastPipe = await db.setting.findUnique({ where: { key: 'pipeline_last_at' } });
    const lastPipeMs = lastPipe ? new Date(lastPipe.value).getTime() : 0;
    if (Date.now() - (Number.isNaN(lastPipeMs) ? 0 : lastPipeMs) >= 30 * 60_000) {
      await db.setting.upsert({
        where: { key: 'pipeline_last_at' },
        create: { key: 'pipeline_last_at', value: new Date().toISOString() },
        update: { key: 'pipeline_last_at', value: new Date().toISOString() },
      });
      await guarded('pipeline', async () => { await processPendingPosts(2); });
    }
  }

  // ۳) راستی‌آزمایی ادعاهای در انتظار — حالت اقتصادی: هر ۵ دقیقه حداکثر ۱ ادعا (قبلاً هر تیک ۱ ادعا)
  if (cfg.autoFactcheck !== false) {
    const pendingClaims = await db.claim.count({ where: { status: 'در_انتظار_بررسی', evidenceSearchedAt: null } });
    if (pendingClaims > 0) {
      const lastFc = await db.setting.findUnique({ where: { key: 'factcheck_last_at' } });
      const lastFcMs = lastFc ? new Date(lastFc.value).getTime() : 0;
      if (Date.now() - (Number.isNaN(lastFcMs) ? 0 : lastFcMs) >= 5 * 60_000) {
        await db.setting.upsert({
          where: { key: 'factcheck_last_at' },
          create: { key: 'factcheck_last_at', value: new Date().toISOString() },
          update: { key: 'factcheck_last_at', value: new Date().toISOString() },
        });
        await guarded('factcheck', async () => {
          const claims = await db.claim.findMany({
            where: { status: 'در_انتظار_بررسی', evidenceSearchedAt: null },
            orderBy: { createdAt: 'desc' }, take: 1,
          });
          for (const c of claims) {
            await evaluateClaim(c.id, { searchWeb: true }).catch(() => {});
          }
        });
      }
    }
  }

  // ۴) گزارش خودکار نیم‌ساعته به بات بله (دریافت → یک فراخوانی یکپارچهٔ مدل → جداسازی خبرها → ارسال)
  const digestCfg = await getDigestConfig();
  try {
    const lastTry = await db.setting.findUnique({ where: { key: 'bale_digest_last_try' } });
    const lastTryMs = lastTry ? new Date(lastTry.value).getTime() : 0;
    if (digestCfg.enabled && Date.now() - (Number.isNaN(lastTryMs) ? 0 : lastTryMs) >= digestCfg.intervalMin * 60_000) {
      await db.setting.upsert({
        where: { key: 'bale_digest_last_try' },
        create: { key: 'bale_digest_last_try', value: new Date().toISOString() },
        update: { key: 'bale_digest_last_try', value: new Date().toISOString() },
      });
      await guarded('bale:digest', async () => {
        const r = await runBaleDigest();
        if (!r.sent && r.error) console.log('[bale:digest] ارسال ناموفق:', r.error);
      });
    }
  } catch (e) {
    console.error('[bale:digest] خطای چرخه:', e instanceof Error ? e.message : e);
  }

  // ۵) گزارش جامع روزانهٔ بله — پایان هر روز (پیش‌فرض ۲۳:۰۰ تهران؛ روزی یک‌بار)
  const nowTime = timeInTz(new Date(), cfg.timezone || SYSTEM_TIMEZONE);
  const todayISO = isoDateInTz(new Date(), cfg.timezone || SYSTEM_TIMEZONE);
  try {
    if (digestCfg.dailyEnabled) {
      const [dhh, dmm] = digestCfg.dailyTime.split(':').map(Number);
      const nowMin2 = Number(nowTime.slice(0, 2)) * 60 + Number(nowTime.slice(3, 5));
      const dailyMin = (dhh || 23) * 60 + (dmm || 0);
      if (nowMin2 >= dailyMin) {
        const lastDaily = await db.setting.findUnique({ where: { key: 'bale_daily_last_date' } });
        if (lastDaily?.value !== todayISO) {
          // جلوگیری از فشار تلاش مجدد هر دقیقه در صورت خطای ارسال
          const lastTry = await db.setting.findUnique({ where: { key: 'bale_daily_last_try' } });
          const lastTryMs = lastTry ? new Date(lastTry.value).getTime() : 0;
          if (Date.now() - (Number.isNaN(lastTryMs) ? 0 : lastTryMs) >= 30 * 60_000) {
            await db.setting.upsert({
              where: { key: 'bale_daily_last_try' },
              create: { key: 'bale_daily_last_try', value: new Date().toISOString() },
              update: { key: 'bale_daily_last_try', value: new Date().toISOString() },
            });
            await guarded('bale:daily', async () => {
              const r = await runBaleDailyReport();
              if (!r.sent && r.error) console.log('[bale:daily] ارسال ناموفق:', r.error);
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('[bale:daily] خطای چرخه:', e instanceof Error ? e.message : e);
  }

  // ۶) گزارش شبانه در ساعت تعیین‌شده + جبران بازه ازدست‌رفته
  const dayOfWeek = new Date().getUTCDay();
  const days = (cfg.activeDays as number[] | undefined) ?? [0, 1, 2, 3, 4, 5, 6];

  if (days.includes(dayOfWeek)) {
    const [hh, mm] = String(cfg.reportTime || '22:30').split(':').map(Number);
    const nowMin = Number(nowTime.slice(0, 2)) * 60 + Number(nowTime.slice(3, 5));
    const reportMin = (hh || 22) * 60 + (mm || 30);

    if (nowMin >= reportMin) {
      // فقط یک‌بار در شب: اگر گزارش جامع امروز (حتی ناقص) ثبت شده، دوباره شروع نکن
      const existingReport = await db.dailyReport.findFirst({
        where: { reportDate: todayISO, categoryId: null, status: { not: 'ناموفق' } },
        select: { id: true },
      });
      if (!existingReport) {
        await guarded(`report:${todayISO}`, async () => {
          const categories = await db.category.findMany({ where: { isActive: true } });
          for (const cat of categories) {
            await generateDailyReport(todayISO, cat.id);
          }
          // گزارش جامع همه دسته‌ها
          await generateDailyReport(todayISO, null);
        });

        // سیاست جبران: اگر سرویس قطع بوده و روزهای قبلی گزارش ندارند
        if (cfg.catchUp !== false) {
          await guarded('report:catchup', async () => {
            for (let i = 1; i <= 3; i++) {
              const past = addDaysISO(todayISO, -i);
              const existing = await db.dailyReport.findFirst({ where: { reportDate: past, categoryId: null } });
              if (existing) break; // نزدیک‌ترین روز جبران شد
              const hadPosts = await db.post.count({ where: { publishedDateOnly: past } });
              if (hadPosts > 0) {
                await generateDailyReport(past, null);
              }
            }
          });
        }
      }
    }
  }

  // ۶) خانه‌داری: پاک‌سازی لاگ‌های قدیمی (نگهداشت ۳۰ روز)
  if (Math.random() < 0.02) {
    await guarded('housekeeping', async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      await db.jobRun.deleteMany({ where: { startedAt: { lt: cutoff }, status: { notIn: ['ناموفق'] } } });
      await db.aiUsage.deleteMany({ where: { createdAt: { lt: cutoff }, status: { notIn: ['ناموفق'] } } });
    });
  }

  // ۷) بازسازی خودکار «خط خبری» (خوشه‌بندی T9) — هر ۱۲۰ دقیقه؛ خط گره‌دار همیشه تازه می‌ماند
  //    خطای خوشه‌بندی هرگز دریافت/گزارش را متوقف نمی‌کند (ایزوله با try/catch)
  try {
    const lastCl = await db.setting.findUnique({ where: { key: 'clusters_last_at' } });
    const lastClMs = lastCl ? new Date(lastCl.value).getTime() : 0;
    if (Date.now() - (Number.isNaN(lastClMs) ? 0 : lastClMs) >= 120 * 60_000) {
      await db.setting.upsert({
        where: { key: 'clusters_last_at' },
        create: { key: 'clusters_last_at', value: new Date().toISOString() },
        update: { key: 'clusters_last_at', value: new Date().toISOString() },
      });
      await guarded('clusters:auto', async () => { await rebuildClusters(7, 2500); });
    }
  } catch (e) {
    console.error('[clusters] خطای چرخهٔ خط خبری:', e instanceof Error ? e.message : e);
  }
}

/** شروع زمان‌بند (به‌صورت idempotent — فقط یک نمونه جهانی) */
export function startScheduler(): void {
  const s = state();
  if (s.timer) return;
  s.timer = setInterval(() => {
    tick().catch((e) => console.error('[scheduler tick error]', e?.message || e));
  }, 60_000);
  // اولین tick پس از ۵ ثانیه
  setTimeout(() => tick().catch(() => {}), 5000);
  // بازیابی پس از قطعی: وظایف «در_حال_اجرا» که پروسه‌شان قطع شده صادقانه «ناموفق» ثبت می‌شوند
  setTimeout(() => {
    db.jobRun.updateMany({
      where: { status: 'در_حال_اجرا', startedAt: { lt: new Date(Date.now() - 30 * 60_000) } },
      data: { status: 'ناموفق', finishedAt: new Date(), error: 'پروسه در میانه اجرا قطع شد (بازیابی پس از راه‌اندازی مجدد)' },
    }).catch(() => {});
  }, 3000);
  console.log('[scheduler] started — tick every 60s');
}

export function schedulerInfo() {
  const s = state();
  return {
    started: Boolean(s.timer),
    enabled: s.enabled,
    startedAt: s.startedAt.toISOString(),
    lastTickAt: s.lastTickAt?.toISOString() || null,
    runningJobs: [...s.running],
  };
}

/** تلاش دستی — برای دکمه‌های UI */
export async function runNow(kind: 'ingest' | 'pipeline' | 'report' | 'factcheck' | 'bale' | 'bale-daily'): Promise<void> {
  if (kind === 'ingest') {
    await guarded('manual:fetch', async () => { await ingestAll(); });
  } else if (kind === 'pipeline') {
    await guarded('manual:pipeline', async () => { await processPendingPosts(10); });
  } else if (kind === 'factcheck') {
    await guarded('manual:factcheck', async () => {
      const claims = await db.claim.findMany({ where: { status: 'در_انتظار_بررسی' }, take: 3 });
      for (const c of claims) await evaluateClaim(c.id, { searchWeb: true }).catch(() => {});
    });
  } else if (kind === 'bale') {
    await guarded('manual:bale-digest', async () => { await runBaleDigest({ force: true }); });
  } else if (kind === 'bale-daily') {
    await guarded('manual:bale-daily', async () => { await runBaleDailyReport({ force: true }); });
  } else {
    await guarded('manual:report', async () => {
      const today = isoDateInTz(new Date());
      const categories = await db.category.findMany({ where: { isActive: true } });
      for (const cat of categories) await generateDailyReport(today, cat.id, { force: true });
      await generateDailyReport(today, null, { force: true });
    });
  }
}
