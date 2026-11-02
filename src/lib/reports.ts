/**
 * گزارش شبانه تاریخ‌دار — فصل ۹ و ۱۰ سند
 * - ساختار ۱۴ بخشی استاندارد
 * - تفکیک تاریخ گزارش / تاریخ انتشار / تاریخ وقوع
 * - جلوگیری از گزارش تکراری (unique reportDate+categoryId)
 * - وضعیت کامل/ناقص با هشدار صریح
 */
import { db } from '@/lib/db';
import { aiCall, extractJson, PROMPT_VERSION } from './ai/client';
import { SYSTEM_DAILY_REPORT } from './ai/prompts';
import { shieldUntrustedContent } from './security/guard';
import { isoDateInTz, jalaliISO, jalaliDisplay, SYSTEM_TIMEZONE, addDaysISO } from './persian';
import { buildMemoryContext, MemoryContext } from './memory';

export interface ReportSection {
  executiveSummary: string;
  topEvents: Array<{ title: string; detail: string; sourceRefs: string[]; eventDate?: string }>;
  verifiedFacts: string[];
  unverifiedClaims: Array<{ text: string; status: string; confidence: string; note?: string }>;
  newToday: string[];
  corrections: Array<{ text: string; previous: string }>;
  analysis: string;
  implications: Array<{ scenario: string; likelihood: string; condition: string }>;
  dataGaps: string[];
  incompleteWarning: string;
  /** گزیده اخبار موثق — خارج از مدل و به‌صورت قطعی از داده‌های راستی‌آزمایی‌شده ساخته می‌شود (T9) */
  crediblePicks?: Array<{ text: string; sourceName: string; kind: string; status: string; url?: string }>;
  /** آمار توازن منابع — شمارش مطلب بر اساس پلتفرم؛ صرفاً توصیفی */
  sourceBalance?: string;
}

const EMPTY: ReportSection = {
  executiveSummary: '', topEvents: [], verifiedFacts: [], unverifiedClaims: [],
  newToday: [], corrections: [], analysis: '', implications: [], dataGaps: [], incompleteWarning: '',
};

/** تولید گزارش یک دسته برای یک روز مشخص (میلادی ISO بر مبنای TZ سامانه) */
export async function generateDailyReport(
  reportDate: string,
  categoryId: string | null,
  opts: { force?: boolean } = {}
): Promise<{ ok: boolean; reportId?: string; status?: string; error?: string; skipped?: boolean }> {
  // جلوگیری از گزارش تکراری (گزارش جامع = categoryId خالی/null)
  const existing = await db.dailyReport.findFirst({
    where: { reportDate, categoryId: categoryId ?? null },
  });
  if (existing && !opts.force) {
    return { ok: true, reportId: existing.id, status: existing.status, skipped: true };
  }

  const category = categoryId ? await db.category.findUnique({ where: { id: categoryId } }) : null;
  const { start, end } = { start: new Date(reportDate + 'T00:00:00Z'), end: new Date(reportDate + 'T23:59:59Z') };

  // مطالب این روز در این دسته (تاریخ انتشار در TZ تهران)
  const posts = await db.post.findMany({
    where: {
      publishedDateOnly: reportDate,
      processingStatus: 'پردازش‌شده',
      isAd: false,
      isIrrelevant: false,
      categories: categoryId ? { some: { categoryId } } : {},
    },
    include: { source: true, categories: { include: { category: true } } },
    orderBy: [{ importanceScore: 'desc' }, { fetchedAt: 'asc' }],
    take: 40,
  });

  const sources = await db.source.findMany({
    where: { isActive: true, categories: categoryId ? { some: { categoryId } } : {} },
  });

  // وضعیت پوشش
  const failedSources = sources.filter((s) => s.lastErrorAt && (!s.lastFetchAt || s.lastErrorAt > s.lastFetchAt));
  const coverageNote = [
    `منابع فعال: ${sources.length}`,
    `منابع با خطای اخیر: ${failedSources.length ? failedSources.map((s) => s.name).join('، ') : 'ندارد'}`,
    `مطالب پردازش‌شده این روز: ${posts.length}`,
    sources.some((s) => s.limitsNote) ? `محدودیت‌های شناخته‌شده: ${[...new Set(sources.filter((s) => s.limitsNote).map((s) => s.limitsNote))].join(' | ')}` : '',
  ].filter(Boolean).join(' — ');

  const incomplete = posts.length === 0 || failedSources.length === sources.length;

  // ادعاهای این روز
  const claims = await db.claim.findMany({
    where: { post: { publishedDateOnly: reportDate } },
    take: 40,
  });

  // حافظه تاریخی
  const memory: MemoryContext = await buildMemoryContext(
    categoryId, reportDate, 7, posts.map((p) => p.content)
  );

  const model = 'glm-4.5-air';

  if (posts.length === 0) {
    // گزارش خالی — صادقانه ناقص ثبت می‌شود بدون فراخوانی مدل
    const content = { ...EMPTY, incompleteWarning: 'هیچ مطلب پردازش‌شده‌ای برای این روز و این دسته وجود ندارد.', dataGaps: ['دریافت داده در این روز انجام نشده یا ناموفق بوده است.'] };
    const saved = await upsertReport(reportDate, categoryId, 'ناقص', content, {
      coverageNote: coverageNote + ' — بدون داده ورودی؛ گزارش هوش مصنوعی تولید نشد.',
      sourcesCount: sources.length, postsCount: 0, eventsCount: 0, claimsCount: 0,
      model: null as unknown as string, jDate: jalaliISO(reportDate),
    });
    return { ok: true, reportId: saved.id, status: 'ناقص' };
  }

  // آماده‌سازی داده برای مدل — فقط مطالب مرتبط، متن‌های بریده
  const postsBlock = posts.slice(0, 30).map((p, i) => [
    `مطلب ${i + 1}:`,
    `منبع: ${p.source?.name || 'نامشخص'} | انتشار: ${p.publishedAt?.toISOString().slice(0, 16).replace('T', ' ') || 'نامشخص'} | وقوع ثبت‌شده: ${p.eventDateISO || 'نامشخص'} | اهمیت: ${p.importanceScore ?? '-'}`,
    shieldUntrustedContent(p.content.slice(0, 1200), 'متن مطلب').wrapped,
  ].join('\n')).join('\n\n');

  const claimsBlock = claims.length
    ? claims.map((c) => `- «${c.text.slice(0, 200)}» | وضعیت: ${c.status} | اطمینان: ${c.confidence} | منبع: ${c.publisherName || '-'}`).join('\n')
    : 'ادعایی ثبت نشده.';

  const memoryBlock = JSON.stringify({
    رویدادهای_روزهای_قبل: memory.pastEvents.slice(0, 12),
    ادعاهای_ارزیابی‌شده_قبل: memory.pastClaims,
    تناقض‌های_احتمالی: memory.contradictions.slice(0, 5),
    محدودیت‌های_حافظه: memory.gaps,
  }, null, 1);

  const userContent = [
    `تاریخ گزارش (مبنای منطقه زمانی ${SYSTEM_TIMEZONE}): ${reportDate} میلادی (${jalaliISO(reportDate)} شمسی)`,
    `محدوده زمانی این گزارش: از نیمه‌شب ${reportDate} تا نیمه‌شب ${addDaysISO(reportDate, 1)} به‌وقت ${SYSTEM_TIMEZONE}`,
    `وضعیت پوشش: ${coverageNote}`,
    `دسته: ${category?.name || 'همه دسته‌ها'}`,
    `\n=== مطالب امروز (${posts.length}) ===\n${postsBlock}`,
    `\n=== ادعاهای استخراج‌شده امروز ===\n${claimsBlock}`,
    `\n=== حافظه تاریخی بازیابی‌شده (روزهای اخیر) ===\n${memoryBlock}`,
    `\nوظیفه: بر اساس «فقط این داده‌ها»، گزارش JSON ساختار تعریف‌شده را تولید کن.`,
  ].join('\n');

  // لایه پرامپت تخصصی دسته (ویرایش‌شدنی از پنل دسته‌ها) — روی پرامپت عمومی سوار می‌شود
  const categoryPrompt = category?.promptTemplate?.trim();
  const systemPrompt = categoryPrompt
    ? `${SYSTEM_DAILY_REPORT}\n\n««« پرامپت تخصصی این دسته (نسخه ثبت‌شده کاربر) »»»\n${categoryPrompt.slice(0, 6000)}\n\nتوجه: چارچوب تحلیل، نقش‌های کارشناسی و قواعد قطعیِ متن بالا الزامی است؛ اما ساختار خروجی همچنان دقیقاً همان JSON تعریف‌شده در این دستورالعمل می‌ماند. تحلیل‌ها فقط بر داده‌های همین درخواست استوار باشند.`
    : SYSTEM_DAILY_REPORT;

  const res = await aiCall({
    purpose: 'گزارش',
    systemPrompt,
    userContent,
    maxChars: 24000,
    thinking: true,
  });

  if (!res.ok || !res.content) {
    return { ok: false, error: res.error };
  }

  const parsed = extractJson<ReportSection>(res.content, (x) => {
    if (typeof x !== 'object' || x === null) return null;
    const o = x as Record<string, unknown>;
    return typeof o.executiveSummary === 'string' ? (x as never) : null;
  });
  if (!parsed) return { ok: false, error: 'خروجی گزارش JSON معتبر نبود' };

  // پالایش خروجی — حد و حصر و نوع
  const section: ReportSection = {
    executiveSummary: parsed.executiveSummary.slice(0, 2000),
    topEvents: (parsed.topEvents || []).slice(0, 8).map((e) => ({
      title: String(e?.title || '').slice(0, 200),
      detail: String(e?.detail || '').slice(0, 1200),
      sourceRefs: Array.isArray(e?.sourceRefs) ? e.sourceRefs.slice(0, 5).map(String) : [],
      eventDate: e?.eventDate ? String(e.eventDate).slice(0, 60) : undefined,
    })).filter((e) => e.title),
    verifiedFacts: (parsed.verifiedFacts || []).slice(0, 10).map(String).filter(Boolean),
    unverifiedClaims: (parsed.unverifiedClaims || []).slice(0, 12).map((c) => ({
      text: String(c?.text || '').slice(0, 400),
      status: String(c?.status || 'تأییدنشده'),
      confidence: String(c?.confidence || 'نامعلوم'),
      note: c?.note ? String(c.note).slice(0, 400) : undefined,
    })).filter((c) => c.text),
    newToday: (parsed.newToday || []).slice(0, 10).map(String).filter(Boolean),
    corrections: (parsed.corrections || []).slice(0, 6).map((c) => ({
      text: String(c?.text || '').slice(0, 600), previous: String(c?.previous || '').slice(0, 600),
    })).filter((c) => c.text),
    analysis: parsed.analysis?.slice(0, 4000) || '',
    implications: (parsed.implications || []).slice(0, 6).map((c) => ({
      scenario: String(c?.scenario || '').slice(0, 400),
      likelihood: String(c?.likelihood || 'نامشخص').slice(0, 40),
      condition: String(c?.condition || '').slice(0, 400),
    })).filter((c) => c.scenario),
    dataGaps: (parsed.dataGaps || []).slice(0, 8).map(String).filter(Boolean),
    incompleteWarning: incomplete
      ? `هشدار پوشش ناقص: ${coverageNote}`
      : (parsed.incompleteWarning || ''),
  };

  const eventsCount = await db.eventPost.count({
    where: { post: { publishedDateOnly: reportDate } },
  });

  // ---------- گزیده اخبار موثق + آمار توازن — قطعی، خارج از مدل (T9: گزارش بدون جانب‌داری) ----------
  const verifiedClaims = await db.claim.findMany({
    where: { post: { publishedDateOnly: reportDate }, status: { in: ['تأییدشده_با_شواهد_کافی', 'عمدتاً_تأییدشده'] } },
    take: 12,
    include: { post: { select: { url: true, source: { select: { name: true, platform: true } } } } },
  });
  const dayStart = new Date(reportDate + 'T00:00:00Z');
  const dayEnd = new Date(reportDate + 'T23:59:59Z');
  const credibleMessages = await db.messageFactcheck.findMany({
    where: { overallVerdict: 'عموماً_درست', createdAt: { gte: dayStart, lte: dayEnd }, status: 'کامل' },
    take: 12,
    include: { message: { select: { content: true, channel: { select: { displayName: true, platform: true } } } } },
  });
  const crediblePicks: NonNullable<ReportSection['crediblePicks']> = [
    ...verifiedClaims.map((c) => ({
      text: c.text.slice(0, 300),
      sourceName: c.publisherName || c.post?.source?.name || 'نامشخص',
      kind: 'ادعای راستی‌آزمایی‌شده',
      status: c.status,
      url: c.post?.url || undefined,
    })),
    ...credibleMessages.map((m) => ({
      text: (m.summary || m.message.content).slice(0, 300),
      sourceName: m.message.channel.displayName || m.message.channel.platform,
      kind: 'پیام کانال (راستی‌آزمایی خودکار)',
      status: m.overallVerdict || '',
    })),
  ];
  const platformCounts = new Map<string, number>();
  for (const p of posts) {
    const plat = p.source?.platform || 'نامشخص';
    platformCounts.set(plat, (platformCounts.get(plat) || 0) + 1);
  }
  const sourceBalance = `توازن پوشش این گزارش (صرفاً شمارش توصیفی، بدون ارزش‌گذاری): ${[...platformCounts.entries()].map(([p, n]) => `${p}: ${n}`).join('، ')}`;

  const saved = await upsertReport(reportDate, categoryId, incomplete ? 'ناقص' : 'کامل', { ...section, crediblePicks, sourceBalance }, {
    coverageNote,
    sourcesCount: sources.length,
    postsCount: posts.length,
    eventsCount,
    claimsCount: claims.length,
    model: res.model,
    promptVersion: categoryPrompt ? `${PROMPT_VERSION}+cat:${category?.slug || ''}` : PROMPT_VERSION,
    jDate: jalaliISO(reportDate),
  });

  return { ok: true, reportId: saved.id, status: incomplete ? 'ناقص' : 'کامل' };
}

async function upsertReport(
  reportDate: string, categoryId: string | null, status: string, content: ReportSection,
  meta: { coverageNote: string; sourcesCount: number; postsCount: number; eventsCount: number; claimsCount: number; model: string | null; promptVersion?: string; jDate: string }
) {
  const data = {
    reportDate,
    jDate: meta.jDate,
    categoryId: categoryId || null,
    status,
    content: JSON.stringify(content),
    coverageNote: meta.coverageNote,
    model: meta.model,
    promptVersion: meta.promptVersion || PROMPT_VERSION,
    timezone: SYSTEM_TIMEZONE,
    sourcesCount: meta.sourcesCount,
    postsCount: meta.postsCount,
    eventsCount: meta.eventsCount,
    claimsCount: meta.claimsCount,
    generatedAt: new Date(),
  };
  const existing = await db.dailyReport.findFirst({
    where: { reportDate, categoryId: categoryId ?? null },
  });
  if (existing) {
    return db.dailyReport.update({ where: { id: existing.id }, data });
  }
  return db.dailyReport.create({ data });
}

/** امروز در TZ سامانه */
export function todayISO(): string {
  return isoDateInTz(new Date());
}

/** مقایسه دو گزارش */
export function diffReports(a: ReportSection & { date: string }, b: ReportSection & { date: string }) {
  const eventsA = new Set(a.topEvents.map((e) => e.title));
  const eventsB = new Set(b.topEvents.map((e) => e.title));
  return {
    newInB: [...eventsB].filter((t) => !eventsA.has(t)),
    goneFromB: [...eventsA].filter((t) => !eventsB.has(t)),
    summaryShift: { from: a.executiveSummary, to: b.executiveSummary },
    claimsChange: {
      a: a.unverifiedClaims.length + a.verifiedFacts.length,
      b: b.unverifiedClaims.length + b.verifiedFacts.length,
    },
  };
}

export function jalaliLabel(reportDate: string): string {
  return `${jalaliDisplay(reportDate)} (${jalaliISO(reportDate)})`;
}
