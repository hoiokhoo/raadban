/**
 * دریافت مطالب از منابع — پیوند اتصال‌دهنده‌ها به پایگاه داده
 * - جلوگیری از دریافت مجدد تکراری (externalId یکتا + سقف تلاش)
 * - ثبت وضعیت منبع: دریافت_موفق | خطای_اتصال | نیازمند_احراز | محدود_دسترسی
 * - پردازش اولیه خط لوله (نرمال‌سازی، هش، کیفیت، تاریخ انتشار)
 */
import { db } from '@/lib/db';
import { getConnector, isPlatformSupported } from './connectors';
import { normalizePersian, contentHash, assessContentQuality, detectLanguage } from './pipeline/normalize';
import { extractDates } from './persian';
import { isoDateInTz } from './persian';
import { SYSTEM_TIMEZONE } from './persian';

export interface IngestOutcome {
  sourceId: string; sourceName: string; ok: boolean;
  fetched?: number; inserted?: number; duplicatesSkipped?: number;
  error?: string; needsAuth?: boolean;
  /** پرش هماهنگ‌شده (مدارشکن توییتر) — خطای واقعی شبکه نیست */
  skippedCoordinated?: boolean;
}

// ---------- مدارشکن توییتر (مشترک بین زمان‌بند، digest و دریافت دستی) ----------
// واقعیت: ایکس از IP دیتاسنتر با 429 برخورد می‌کند؛ ۲۱ حساب پشت‌سرهم (~۱۶۵ms فاصله)
// IP را بلافاصله مسدود می‌کند. راه‌حل: بودجهٔ نوبتی + خنک‌شدن هماهنگ همهٔ حساب‌ها.
const TW = globalThis as unknown as {
  __twCooldownUntil?: number; // تا این لحظه همهٔ حساب‌های ایکس خنک هستند
  __twWindowStart?: number;   // پنجرهٔ لغزان
  __twWindowUsed?: number;    // تعداد دریافت توییتر در پنجرهٔ جاری
  __tw429Streak?: number;     // ۴۲۹های پیاپی — خنکی تطبیقی هر بار دوبرابر می‌شود
};
const TWITTER_COOLDOWN_MS = 20 * 60_000;   // پس از 429 — خنکی پایهٔ ۲۰ دقیقه برای «همهٔ» حساب‌ها
const TWITTER_COOLDOWN_MAX_MS = 90 * 60_000; // سقف خنکی تطبیقی — واقعیت سهمیهٔ تنگ ایکس از IP دیتاسنتر
const TWITTER_BUDGET_PER_WINDOW = 1;       // فقط «یک» حساب در هر پنجره — تجربه: دو فراخوانی نزدیک = 429
const TWITTER_WINDOW_MS = 90_000;          // پنجرهٔ نوبت‌دهی ۹۰ ثانیه‌ای
const TWITTER_INNER_DELAY_MS = 2_000;      // مکث کوتاه پیش از دریافت

function twitterCooldownLeft(): number {
  const until = TW.__twCooldownUntil || 0;
  return Math.max(0, until - Date.now());
}

/** خنکی تطبیقی: هر ۴۲۹ پیاپی خنکی را دوبرابر می‌کند (۲۰ → ۴۰ → ۸۰ → سقف ۹۰ دقیقه) */
function armTwitterCooldown(): void {
  const streak = Math.min(TW.__tw429Streak || 0, 3);
  TW.__twCooldownUntil = Date.now() + Math.min(TWITTER_COOLDOWN_MS * 2 ** streak, TWITTER_COOLDOWN_MAX_MS);
  TW.__tw429Streak = streak + 1;
}

/** گیت پیش از فراخوانی ایکس — null یعنی مجاز؛ رشته یعنی پرش صادقانه */
export async function twitterGate(): Promise<string | null> {
  const left = twitterCooldownLeft();
  if (left > 0) {
    const min = Math.ceil(left / 60_000);
    return `مدارشکن ایکس فعال است — پس از محدودیت 429 همهٔ حساب‌ها ${min} دقیقه دیگر تلاش می‌کنند`;
  }
  const now = Date.now();
  if (!TW.__twWindowStart || now - TW.__twWindowStart >= TWITTER_WINDOW_MS) {
    TW.__twWindowStart = now;
    TW.__twWindowUsed = 0;
  }
  if ((TW.__twWindowUsed || 0) >= TWITTER_BUDGET_PER_WINDOW) {
    return 'نوبت دریافت ایکس در پنجرهٔ جاری پر شده است (حداکثر ۱ حساب در ۹۰ ثانیه) — تیک بعدی تلاش می‌کند';
  }
  // مکث پوششی: حتی داخل بودجه، بین دو حساب فاصلهٔ انسانی می‌گذاریم
  if ((TW.__twWindowUsed || 0) > 0 || TW.__twWindowStart !== now) {
    await new Promise((res) => setTimeout(res, TWITTER_INNER_DELAY_MS));
  }
  TW.__twWindowUsed = (TW.__twWindowUsed || 0) + 1;
  return null;
}

/** ریست وضعیت مدارشکن — فقط برای تست‌های واحد */
export function resetTwitterGateForTests(): void {
  TW.__twCooldownUntil = 0;
  TW.__twWindowStart = undefined;
  TW.__twWindowUsed = 0;
  TW.__tw429Streak = 0;
}

/** فعال‌سازی دستی خنکی ایکس — همان مسیر تطبیقی 429 واقعی */
export function triggerTwitterCooldownForTests(): void {
  armTwitterCooldown();
}

/** دریافت مطالب تازه از یک منبع */
export async function ingestSource(sourceId: string): Promise<IngestOutcome> {
  const source = await db.source.findUnique({ where: { id: sourceId } });
  if (!source) return { sourceId, sourceName: '?', ok: false, error: 'منبع یافت نشد' };
  if (!source.isActive) return { sourceId, sourceName: source.name, ok: false, error: 'منبع غیرفعال است' };
  if (!isPlatformSupported(source.platform)) {
    await db.source.update({
      where: { id: sourceId },
      data: { status: 'پشتیبانی‌نشده', statusDetail: `اتصال‌دهنده برای «${source.platform}» هنوز پیاده‌سازی نشده است` },
    });
    return { sourceId, sourceName: source.name, ok: false, error: 'پلتفرم پشتیبانی‌نشده' };
  }

  const connector = getConnector(source.platform);
  if (!connector) {
    return { sourceId, sourceName: source.name, ok: false, error: 'اتصال‌دهنده یافت نشد' };
  }

  // مدارشکن ایکس: پیش از هر فراخوانی توییتر، بودجه و خنکی هماهنگ بررسی می‌شود
  if (source.platform === 'twitter') {
    const gateMsg = await twitterGate();
    if (gateMsg) {
      return {
        sourceId, sourceName: source.name, ok: false, skippedCoordinated: true,
        error: gateMsg,
      };
    }
  }

  let result;
  try {
    result = await connector.fetchRecent(source.identifier, { maxItems: source.maxItemsPerFetch });
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : 'خطای ناشناخته اتصال';
    if (source.platform === 'twitter' && /429/.test(err)) {
      armTwitterCooldown(); // خنکی تطبیقی هماهنگ همهٔ حساب‌ها
    }
    await db.source.update({
      where: { id: sourceId },
      data: { status: 'خطای_اتصال', statusDetail: err, lastErrorAt: new Date(), lastError: err },
    });
    return { sourceId, sourceName: source.name, ok: false, error: err };
  }

  if (!result.ok) {
    // 429 ایکس → مدارشکن: همهٔ حساب‌ها هم‌زمان خنک می‌شوند تا IP داغ نکند
    if (source.platform === 'twitter' && /429/.test(result.error || '')) {
      armTwitterCooldown(); // خنکی تطبیقی هماهنگ همهٔ حساب‌ها
    }
    const status = result.needsAuth ? 'نیازمند_احراز' : 'خطای_اتصال';
    await db.source.update({
      where: { id: sourceId },
      data: { status, statusDetail: result.error, lastErrorAt: new Date(), lastError: result.error },
    });
    return { sourceId, sourceName: source.name, ok: false, error: result.error, needsAuth: result.needsAuth };
  }

  // ذخیره مطالب با جلوگیری از تکرار
  let inserted = 0, duplicatesSkipped = 0;
  for (const p of result.posts) {
    // دریافت مجدد تکراری: هم externalId و هم هش محتوا
    const exists = await db.post.findUnique({
      where: { sourceId_externalId: { sourceId, externalId: p.externalId } },
    });
    if (exists) {
      // بهبود تدریجی: پست قدیمیِ بدون عکس، وقتی اتصال‌دهنده اکنون عکس دارد تکمیل می‌شود
      // (تلگرام/RSS عکس را دیرتر استخراج کرده باشند — محتوا دست نمی‌خورد)
      if (p.imageUrl && !exists.imageUrl) {
        await db.post.update({ where: { id: exists.id }, data: { imageUrl: p.imageUrl } }).catch(() => {});
      }
      duplicatesSkipped++;
      continue;
    }

    const normalized = normalizePersian(p.content);
    const hash = contentHash(p.content);
    const hashDup = await db.post.findFirst({ where: { contentHash: hash } });
    if (hashDup) { duplicatesSkipped++; continue; }

    const quality = assessContentQuality(p.content);
    const lang = detectLanguage(p.content);
    const pubDate = p.publishedAt || new Date();

    await db.post.create({
      data: {
        sourceId,
        externalId: p.externalId,
        content: p.content.slice(0, 20000),
        normalized,
        url: p.url,
        imageUrl: p.imageUrl || null,
        publishedAt: pubDate,
        publishedDateOnly: isoDateInTz(pubDate, SYSTEM_TIMEZONE),
        fetchedAt: new Date(),
        metadata: JSON.stringify(p.metadata || {}),
        language: lang,
        contentHash: hash,
        isForwarded: Boolean(p.isForwarded),
        isAd: quality.isAd,
        processingStatus: quality.isAd ? 'حذف_تبلیغات' : (quality.isTruncated ? 'ناقص' : 'خام'),
        processingError: quality.isTruncated ? quality.qualityNote : null,
      },
    });
    inserted++;
  }

  await db.source.update({
    where: { id: sourceId },
    data: {
      status: 'دریافت_موفق',
      statusDetail: `${inserted} مطلب جدید، ${duplicatesSkipped} تکراری رد شد. ${result.coverageNote}`,
      lastFetchAt: new Date(),
      lastErrorAt: null,
      lastError: null,
      limitsNote: result.limits,
    },
  });
  // موفقیت ایکس → خنکی پایان می‌یابد و زنجیرهٔ ۴۲۹ صفر می‌شود؛ IP سالم است
  if (source.platform === 'twitter') { TW.__twCooldownUntil = 0; TW.__tw429Streak = 0; }

  return { sourceId, sourceName: source.name, ok: true, fetched: result.posts.length, inserted, duplicatesSkipped };
}

/** دریافت از همه منابع فعال و سپس اجرای پردازش برای مطالب خام جدید */
export async function ingestAll(): Promise<IngestOutcome[]> {
  const sources = await db.source.findMany({ where: { isActive: true } });
  const outcomes: IngestOutcome[] = [];
  for (const s of sources) {
    outcomes.push(await ingestSource(s.id));
  }
  return outcomes;
}

/** پردازش مطالب خام (نرمال + تکراری‌یابی سراسری + رویداد + ادعا + دسته) */
export async function processPendingPosts(limit = 12): Promise<{ processed: number; skipped: number }> {
  const pending = await db.post.findMany({
    where: { processingStatus: 'خام' },
    include: { source: true },
    orderBy: { fetchedAt: 'desc' },
    take: limit,
  });
  let processed = 0, skipped = 0;

  for (const post of pending) {
    const steps = JSON.parse(post.processingSteps || '[]') as Array<Record<string, unknown>>;
    try {
      // تشخیص ناهنجاری: فوروارد بدون متن کافی
      if (post.content.trim().length < 40) {
        await db.post.update({
          where: { id: post.id },
          data: { processingStatus: 'ناقص', processingError: 'متن بسیار کوتاه برای پردازش' },
        });
        skipped++;
        continue;
      }

      // تکراری‌یابی سراسری (شباهت با مطالب اخیر)
      const { jaccardSimilarity } = await import('./pipeline/normalize');
      const recent = await db.post.findMany({
        where: { id: { not: post.id }, fetchedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
        take: 200,
        orderBy: { fetchedAt: 'desc' },
      });
      for (const r of recent) {
        const sim = jaccardSimilarity(post.content, r.content);
        if (sim >= 0.72) {
          await db.post.update({
            where: { id: post.id },
            data: {
              duplicateOfId: r.id,
              processingStatus: 'پردازش‌شده',
              processingSteps: JSON.stringify([...steps, { step: 'تکراری‌یابی', ok: true, duplicateOf: r.id, sim }]),
            },
          });
          skipped++;
          break;
        }
      }
      if (post.duplicateOfId) continue;

      // استخراج تاریخ وقوع از متن (در برابر تاریخ انتشار)
      const dates = extractDates(post.content, post.publishedAt || undefined);
      const eventDateISO = dates.find((d) => d.iso)?.iso || null;

      await db.post.update({
        where: { id: post.id },
        data: {
          eventDateISO,
          processingSteps: JSON.stringify([
            ...steps,
            { step: 'نرمال‌سازی', ok: true },
            { step: 'استخراج_تاریخ', ok: true, found: dates.length, eventDateISO },
          ]),
        },
      });

      // دسته‌بندی و اهمیت (با AI) — در نبود کلید، خطا ثبت و بعداً قابل تلاش مجدد است
      const { categorizeAndRatePost } = await import('./pipeline/claims');
      await categorizeAndRatePost(post.id);

      // رویداد یکتا
      const { assignEventToPost } = await import('./pipeline/events');
      const refreshed = await db.post.findUnique({ where: { id: post.id } });
      if (refreshed) {
        const { eventId } = await assignEventToPost(post.id);
        // اتصال رویداد به دسته غالب مطالب رویداد
        const cat = await db.postCategory.findFirst({ where: { postId: post.id, isMain: true } });
        if (cat) {
          await db.event.update({ where: { id: eventId }, data: { categoryId: cat.categoryId } }).catch(() => {});
        }
      }

      // استخراج ادعا (با AI)
      const { extractClaimsFromPost } = await import('./pipeline/claims');
      await extractClaimsFromPost(post.id);

      processed++;
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'خطای پردازش';
      await db.post.update({
        where: { id: post.id },
        data: {
          processingStatus: 'خطا',
          processingError: err.slice(0, 500),
          processingSteps: JSON.stringify([...steps, { step: 'خطا', ok: false, error: err, at: new Date().toISOString() }]),
        },
      }).catch(() => {});
      skipped++;
    }
  }
  return { processed, skipped };
}
