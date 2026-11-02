/**
 * پش‌گیری ترجمهٔ فارسی مطالب غیرفارسی — خواستهٔ کاربر (۲ نوامبر ۲۰۲۶):
 * «بعضی از اخبار خوشه‌ها به فارسی ترجمه نشدن، درستشون کن»
 *
 * اولویت: ۱) تیتر نخستِ هر خوشهٔ خط خبری (همان چیزی که در تب «خط خبری» دیده می‌شود)
 *         ۲) مطالب غیرفارسی ۴۸ ساعت اخیر (ورودی گزارش بله)
 * سپس نوبتی: هر بار اجرا سقف N دستهٔ ۲۵تایی ترجمه می‌کند (بدون OpenRouter — فقط GLM/رایگان).
 * اجرا: bun scripts/backfill-translations.ts [maxBatches]
 */
import { PrismaClient } from '@prisma/client';
import { aiCall } from '../src/lib/ai/client';
import { SYSTEM_BALE_BATCH_TRANSLATE, validateBatchTranslation } from '../src/lib/bale-digest';
import { extractJson } from '../src/lib/ai/client';

const db = new PrismaClient();
const BATCH = 25;

interface Target { id: string; content: string }

async function pickTargets(limit: number): Promise<Target[]> {
  // ۱) تیتر نخست خوشه‌های غیرفارسی — بدون ترجمه
  const clusters = await db.newsCluster.findMany({
    where: { language: { not: 'fa' } },
    include: { members: { where: { isFirst: true }, select: { post: { select: { id: true, content: true, translationFa: true } } } } },
    take: 400,
  });
  const out: Target[] = [];
  const seen = new Set<string>();
  for (const c of clusters) {
    const p = c.members[0]?.post;
    if (!p || (p.translationFa || '').trim() || seen.has(p.id)) continue;
    if (p.content.trim().length < 15) continue;
    seen.add(p.id);
    out.push({ id: p.id, content: p.content.slice(0, 300) });
  }
  // ۲) مطالب غیرفارسی ۴۸ ساعت اخیر — بدون ترجمه
  const recent = await db.post.findMany({
    where: {
      language: { not: 'fa' },
      isAd: false, isIrrelevant: false,
      OR: [{ translationFa: null }, { translationFa: '' }],
      publishedAt: { gte: new Date(Date.now() - 48 * 3600_000) },
    },
    select: { id: true, content: true },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
  for (const p of recent) {
    if (seen.has(p.id) || p.content.trim().length < 15) continue;
    seen.add(p.id);
    out.push({ id: p.id, content: p.content.slice(0, 300) });
  }
  return out;
}

async function main(): Promise<void> {
  const maxBatches = Math.max(1, Number(process.argv[2]) || 8);
  const targets = await pickTargets(maxBatches * BATCH);
  console.log(`هدف: ${targets.length} مطلب بدون ترجمه (سقف ${maxBatches} دسته × ${BATCH})`);
  if (targets.length === 0) { console.log('کاری برای انجام نیست — همه ترجمه دارند.'); await db.$disconnect(); return; }

  let done = 0;
  /** ترجمهٔ یک دسته؛ در شکست (فیلتر محتوا/پاسخ ناقص) دسته نصف می‌شود تا تنها مطلب مشکل‌دار حذف شود */
  const translateBatch = async (slice: Target[], depth: number, label: string): Promise<void> => {
    if (slice.length === 0) return;
    const corpus = slice.map((t, i) => `[${i + 1}] ${t.content.replace(/\s+/g, ' ')}`).join('\n');
    const call = (): ReturnType<typeof aiCall> => aiCall({
      purpose: 'ترجمه',
      systemPrompt: SYSTEM_BALE_BATCH_TRANSLATE,
      userContent: corpus,
      maxChars: 9000,
      maxTokens: 2500,
      temperature: 0,
      priority: 'interactive',
      skipProviderIds: ['openrouter'], // سهمیهٔ روزانهٔ OpenRouter فقط برای گزارش بله
    });
    let r = await call();
    if (!r.ok || !r.content) {
      await new Promise((res) => setTimeout(res, 4000)); // یک تلاش مجدد پس از خنکی کوتاه
      r = await call();
    }
    const entries = r.ok && r.content ? extractJson(r.content, validateBatchTranslation) : null;
    if (!entries) {
      if (slice.length === 1 || depth >= 4) {
        console.log(`${label}: ناموفق — ${(r.error || r.content || 'بدون پاسخ').slice(0, 70)} (ردِ ${slice.length} مطلب)`);
        return;
      }
      const mid = Math.ceil(slice.length / 2);
      await translateBatch(slice.slice(0, mid), depth + 1, `${label}·الف`);
      await translateBatch(slice.slice(mid), depth + 1, `${label}·ب`);
      return;
    }
    let ok = 0;
    for (const e of entries) {
      const t = slice[e.n - 1];
      if (!t) continue;
      try {
        await db.post.update({ where: { id: t.id }, data: { translationFa: e.fa, translatedAt: new Date() } });
        ok++; done++;
      } catch { /* یک مطلب شکست خورد — بقیه ادامه می‌یابند */ }
    }
    console.log(`${label}: ${ok}/${slice.length} ترجمه ثبت شد (مجموع ${done})`);
  };

  for (let b = 0; b * BATCH < targets.length && b < maxBatches; b++) {
    await translateBatch(targets.slice(b * BATCH, (b + 1) * BATCH), 0, `دستهٔ ${b + 1}`);
    await new Promise((res) => setTimeout(res, 1500)); // فاصلهٔ محترمانه بین فراخوانی‌ها
  }
  console.log(`پایان — مجموع ترجمه‌های ثبت‌شده: ${done}`);
  await db.$disconnect();
}

await main();
