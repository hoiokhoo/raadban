/**
 * خط لحظه‌ای اخبار — فید زندهٔ همهٔ مطالب گردآوری‌شده
 *
 * خواستهٔ کاربر (۳ نوامبر ۲۰۲۶): دیدن کل اخبار لحظه‌ای در یک تب برنامه،
 * حتی اگر اتصال بله فعلاً برقرار نباشد. بنابراین این مسیر:
 *  - کاملاً مستقل از بات بله است (هیچ فراخوانی بله، بدون عوارض جانبی)
 *  - فقط‌خواندنی است و با polling مرورگر به‌روز می‌شود
 *
 * پارامترها:
 *   take    — سقف نتایج (پیش‌فرض ۶۰، بیشینهٔ ۱۰۰)
 *   since   — ISO: فقط مطالبِ دریافتیِ جدیدتر از این لحظه (برای polling تدریجی)
 *   before  — ISO: فقط مطالبِ قدیمی‌تر (برای «بارگذاری بیشتر»)
 *   scope   — all | foreign | domestic
 *   q       — جست‌وجوی متنی در متن نرمال یا ترجمهٔ فارسی
 */
import { db } from '@/lib/db';
import { ok, fail, err500 } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { FOREIGN_REGION, summarizeClaims, scopeOf, displayTitle, clampTake } from '@/lib/live';
import { isoDateInTz, dayRangeUTC } from '@/lib/persian';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const take = clampTake(sp.get('take'));
    const scope = sp.get('scope');
    const q = (sp.get('q') || '').trim().slice(0, 100);

    const sinceRaw = sp.get('since');
    const beforeRaw = sp.get('before');
    const since = sinceRaw ? new Date(sinceRaw) : null;
    const before = beforeRaw ? new Date(beforeRaw) : null;
    if (since && isNaN(since.getTime())) return fail('پارامتر since نامعتبر است (ISO لازم است)');
    if (before && isNaN(before.getTime())) return fail('پارامتر before نامعتبر است (ISO لازم است)');

    // شرط پایه: تکرارها، آگهی و بی‌ربط‌ها در خط لحظه‌ای نمی‌آیند
    const base = {
      duplicateOfId: null as string | null,
      isAd: false,
      isIrrelevant: false,
    };
    const fetchedCond =
      since || before ? { ...(since ? { gt: since } : {}), ...(before ? { lt: before } : {}) } : undefined;

    const where = {
      ...base,
      ...(fetchedCond ? { fetchedAt: fetchedCond } : {}),
      ...(scope === 'foreign' ? { source: { region: { not: FOREIGN_REGION } } } : {}),
      ...(scope === 'domestic' ? { source: { region: FOREIGN_REGION } } : {}),
      ...(q ? { OR: [{ normalized: { contains: q } }, { translationFa: { contains: q } }] } : {}),
    };

    // شمارش‌های سربرگ — همیشه سراسری (بدون q/scope) تا مقیاس کار مشخص بماند
    const todayISO = isoDateInTz(new Date());
    const { start: todayStart } = dayRangeUTC(todayISO);

    const [posts, total, todayCount, foreignCount, domesticCount] = await Promise.all([
      db.post.findMany({
        where,
        select: {
          id: true, content: true, normalized: true, translationFa: true,
          url: true, imageUrl: true, publishedAt: true, fetchedAt: true, language: true,
          source: { select: { name: true, platform: true, region: true } },
          claims: { select: { status: true } },
        },
        // ترتیب لحظه‌ای: زمانِ دریافت (ورود به سامانه) نزولی
        orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
        take,
      }),
      db.post.count({ where: base }),
      db.post.count({ where: { ...base, fetchedAt: { gte: todayStart } } }),
      db.post.count({ where: { ...base, source: { region: { not: FOREIGN_REGION } } } }),
      db.post.count({ where: { ...base, source: { region: FOREIGN_REGION } } }),
    ]);

    return ok({
      posts: posts.map((p) => ({
        id: p.id,
        title: displayTitle(p),
        isTranslated: !!(p.translationFa && p.language && p.language !== 'fa'),
        url: p.url,
        imageUrl: p.imageUrl,
        publishedAt: p.publishedAt,
        fetchedAt: p.fetchedAt,
        language: p.language,
        sourceName: p.source?.name ?? null,
        sourcePlatform: p.source?.platform ?? null,
        scope: scopeOf(p.source?.region),
        claims: summarizeClaims(p.claims.map((c) => c.status)),
      })),
      counts: { total, today: todayCount, foreign: foreignCount, domestic: domesticCount },
      serverTime: new Date().toISOString(),
    });
  } catch (e) { return err500(e, 'خط لحظه‌ای اخبار'); }
}
