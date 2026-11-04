/**
 * مدیریت ربات ۲۴ ساعتهٔ گیت‌هاب از اپلیکیشن — خواستهٔ کاربر (۵ نوامبر ۲۰۲۶):
 * «ربات توسط اپلیکیشن قابل رصد و تغییر و مدیریت باشه»
 *
 * GET  — همه‌چیز برای پانل: دسته‌ها + توکن‌های ماسک‌شده، آمار آخرین چرخه (state)،
 *        اجراهای workflow، پرامپت فعال، دسته‌بندی منابع، تحلیل محدودیت‌های گیت‌هاب.
 * POST — اکشن‌ها: saveCategory/deleteCategory/probeMembers/syncSecrets/syncConfig/
 *        syncPrompts/resetPrompts/syncSources/dispatchRun/savePat/testDefaultBot
 *
 * صراحت: توکن بات و PAT هرگز ماسک‌نشده بازنمی‌گردند؛ خطای هر عملیات شفاف است؛ هیچ نتیجهٔ ساختگی نیست.
 */
import { ok, fail, err500 } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { encrypt, decrypt, maskKey } from '@/lib/security/crypto';
import { getBaleToken, baleApiWith, getChatMemberCount } from '@/lib/bale-bot';
import {
  REPO, getGhPat, saveGhPat, setRepoSecret, putRepoFile,
  readRepoFileWithFallback, listBotRuns, dispatchBotRun, readBotState,
} from '@/lib/gh-sync';

const SLUG_RE = /^[a-z0-9_]{2,30}$/;

interface CatTargets { token: string; targets: string[] }

function parseTargetsJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) return arr.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim());
  } catch { /* خطی */ }
  return raw.split(/[\n,]+/).map((t) => t.trim()).filter(Boolean);
}

function buildCategoriesPayload(rows: Array<{ slug: string; tokenEnc: string | null; targets: string | null }>): string {
  const out: Record<string, CatTargets> = {};
  for (const r of rows) {
    if (!r.tokenEnc) continue;
    const token = decrypt(r.tokenEnc);
    const targets = parseTargetsJson(r.targets);
    if (token && targets.length > 0) out[r.slug] = { token, targets };
  }
  return JSON.stringify(out);
}

/** تحلیل محدودیت‌های گیت‌هاب — پاسخ مستند به پرسش «آیا ربات در آینده لیمیت می‌خورد؟» */
const GH_LIMITS = {
  runnerMinutes: 'ریپوی عمومی: دقایق رانر استاندارد رایگان و نامحدود — ۲۸۸ اجرا در روز (هر ~۱۰ دقیقه) ≈ ۹۰۰ دقیقه/روز بدون هزینه',
  scheduleStop: 'زمان‌بندی فقط بعد از ۶۰ روز بی‌فعالیتی ریپو متوقف می‌شود؛ هر کامیت state ربات «فعالیت» است — ربات خودش ریپو را زنده نگه می‌دارد',
  jobLimit: 'سقف هر job شش ساعت است؛ چرخهٔ ربات ۳۰ دقیقه است — فاصلهٔ امن ۱۲ برابری',
  apiRate: 'API گیت‌هاب ۵٬۰۰۰ در ساعت با توکن — ربات در هر چرخه چند فراخوانی مصرف می‌کند',
  privateWarning: 'اگر ریپو خصوصی شود، سقف رایگان ۲٬۰۰۰ دقیقه/ماه است — ربات فعلی ~۹۰۰ دقیقه/روز مصرف می‌کند؛ ریپو باید عمومی بماند',
  dispatchToken: 'چرخهٔ خودادامه با BOT_DISPATCH_TOKEN (GITHUB_TOKEN قادر به dispatch نیست) — سکرت تنظیم شده است',
  realBottleneck: 'تنگنای واقعی سهمیهٔ مدل است، نه گیت‌هاب — استخر چندکلیدهٔ جمینی (بخش «کلیدهای جمینی») پاسخ «چند سال بدون لیمیت» است',
};

export async function GET() {
  try {
    // دسته‌ها از بانک
    const rows = await db.botCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }] });
    const categories = rows.map((r) => ({
      id: r.id, slug: r.slug, title: r.title, enabled: r.enabled,
      hasToken: Boolean(r.tokenEnc), tokenMask: r.tokenMask || null,
      targets: parseTargetsJson(r.targets), updatedAt: r.updatedAt,
    }));

    // پیکربندی عمومی ریپو (فایل مدیریت‌شدهٔ اپلیکیشن)
    const configFile = await readRepoFileWithFallback('bot/bot-config.json');
    let repoCats: Array<{ slug: string; title: string }> = [];
    if (configFile) {
      try {
        const o = JSON.parse(configFile.content) as { categories?: Array<{ slug: string; title: string }> };
        repoCats = Array.isArray(o.categories) ? o.categories : [];
      } catch { /* خراب → تهی */ }
    }

    // آمار ربات — state (کامیت خودکار ربات) + اجراهای workflow
    const state = await readBotState();
    const runs = await listBotRuns(8);

    // پرامپت فعال — فایل ریپو با پشتیبان محلی
    const promptFile = await readRepoFileWithFallback('bot/prompts.json');
    let prompts: { oneshot?: string; translate?: string; updatedAt?: string } = {};
    if (promptFile) {
      try {
        const o = JSON.parse(promptFile.content) as Record<string, unknown>;
        prompts = {
          oneshot: typeof o.oneshot === 'string' ? o.oneshot : undefined,
          translate: typeof o.translate === 'string' ? o.translate : undefined,
          updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
        };
      } catch { /* خراب → پیش‌فرض درونی ربات */ }
    }

    // دسته‌بندی منابع از sources.json ریپو
    const sourcesFile = await readRepoFileWithFallback('bot/sources.json');
    const perCategory: Record<string, number> = {};
    let sourcesCount = 0;
    let sourcesList: Array<{ name: string; platform: string; category: string }> = [];
    if (sourcesFile) {
      try {
        const arr = JSON.parse(sourcesFile.content) as Array<{ name?: string; platform?: string; category?: string }>;
        sourcesCount = arr.length;
        sourcesList = arr
          .filter((s) => typeof s.name === 'string')
          .map((s) => ({ name: String(s.name), platform: String(s.platform || '?'), category: s.category || 'general' }));
        for (const s of sourcesList) {
          perCategory[s.category] = (perCategory[s.category] || 0) + 1;
        }
      } catch { /* خراب → تهی */ }
    }

    const pat = await getGhPat();
    const envToken = await getBaleToken();
    const envMe = envToken ? await baleApiWith(envToken, 'getMe') : null;
    const envUser = envMe?.ok ? (envMe.data as { result?: { username?: string } } | null)?.result?.username : undefined;

    return ok({
      repo: REPO,
      categories,
      repoConfigCats: repoCats,
      stats: { state, runs: runs.runs, runsError: runs.error || null },
      prompts: { ...prompts, hasOverrides: Boolean(prompts.oneshot || prompts.translate) },
      sources: { count: sourcesCount, perCategory, list: sourcesList },
      limits: GH_LIMITS,
      github: { hasPat: Boolean(pat), patMasked: pat ? maskKey(pat) : null },
      defaultBot: { ok: Boolean(envToken), username: envUser || null, fromEnv: Boolean(process.env.BALE_BOT_TOKEN?.trim()) },
    });
  } catch (e) { return err500(e, 'وضعیت ربات ۲۴ ساعته'); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || '');

    // ── توکن گیت‌هاب (مشترک با بخش کلیدهای جمینی) ──
    if (action === 'savePat') {
      const pat = String(body.pat || '').trim();
      if (pat.length < 20 || pat.length > 200) return fail('توکن گیت‌هاب نامعتبر است (طول لازم ≥ ۲۰ نویسه)', 422);
      await saveGhPat(pat);
      return ok({ savedPat: maskKey(pat) });
    }

    // ── ذخیره/ویرایش دستهٔ خبری + توکن بات آن ──
    if (action === 'saveCategory') {
      const id = typeof body.id === 'string' && body.id ? body.id : null;
      const slug = String(body.slug || '').trim();
      const title = String(body.title || '').trim().slice(0, 60);
      if (!SLUG_RE.test(slug)) return fail('شناسهٔ دسته باید ۲ تا ۳۰ نویسهٔ لاتین کوچک/عدد/زیرخط باشد', 422);
      if (!title) return fail('عنوان فارسی دسته لازم است', 422);
      const targets = Array.isArray(body.targets)
        ? (body.targets as unknown[]).map((t) => String(t).trim()).filter(Boolean)
        : parseTargetsJson(String(body.targets || ''));
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      const enabled = body.enabled !== false;

      const dup = await db.botCategory.findUnique({ where: { slug } });
      if (dup && dup.id !== id) return fail('این شناسهٔ دسته قبلاً ثبت شده است', 422);

      const data = {
        slug, title, enabled,
        targets: JSON.stringify(targets),
        ...(token ? { tokenEnc: encrypt(token), tokenMask: maskKey(token) } : {}),
      };
      const row = id
        ? await db.botCategory.update({ where: { id }, data })
        : await db.botCategory.create({ data });
      return ok({ saved: { id: row.id, slug: row.slug, title: row.title }, targetsCount: targets.length, tokenSaved: Boolean(token) });
    }

    if (action === 'deleteCategory') {
      const id = String(body.id || '');
      const row = await db.botCategory.findUnique({ where: { id } });
      if (!row) return fail('دسته یافت نشد', 404);
      if (row.slug === 'general') return fail('دستهٔ عمومی (مقصد پیش‌فرض) حذف نمی‌شود', 422);
      await db.botCategory.delete({ where: { id } });
      return ok({ deleted: row.slug });
    }

    // ── آمار اعضا: getMe + getChatMemberCount برای هر مقصد دسته ──
    if (action === 'probeMembers') {
      const id = String(body.id || '');
      const row = await db.botCategory.findUnique({ where: { id } });
      if (!row) return fail('دسته یافت نشد', 404);
      const token = row.tokenEnc ? decrypt(row.tokenEnc) : null;
      if (!token) return fail('این دسته توکن بات ندارد', 422);
      const me = await baleApiWith(token, 'getMe');
      const username = me.ok ? (me.data as { result?: { username?: string } } | null)?.result?.username : undefined;
      const targets = parseTargetsJson(row.targets);
      const members: Array<{ target: string; ok: boolean; count?: number; error?: string }> = [];
      for (const t of targets.slice(0, 5)) {
        const c = await getChatMemberCount(token, t);
        members.push({ target: t, ok: c.ok, count: c.count, error: c.error });
      }
      return ok({ slug: row.slug, username: username || null, tokenOk: me.ok, tokenError: me.ok ? null : me.error, members });
    }

    // ── همگام‌سازی سکرت BALE_CATEGORIES (توکن هر بخش → گیت‌هاب) ──
    if (action === 'syncSecrets') {
      const pat = await getGhPat();
      if (!pat) return fail('برای همگام‌سازی، توکن گیت‌هاب را ذخیره کنید', 422);
      const rows = await db.botCategory.findMany({ where: { enabled: true } });
      const payload = buildCategoriesPayload(rows);
      const slugs = Object.keys(JSON.parse(payload) as Record<string, unknown>);
      if (slugs.length === 0) return fail('هیچ دستهٔ فعالی با توکن و مقصد کامل وجود ندارد — توکن و شناسهٔ چت هر بخش را کامل کنید', 422);
      await setRepoSecret('BALE_CATEGORIES', payload, pat);
      return ok({ synced: slugs, secret: 'BALE_CATEGORIES', repo: REPO, note: 'چرخهٔ بعدی ربات (حداکثر ~۱۰ دقیقه بعد) از توکن‌های جدید استفاده می‌کند' });
    }

    // ── همگام‌سازی فایل عمومی دسته‌ها (bot/bot-config.json) ──
    if (action === 'syncConfig') {
      const pat = await getGhPat();
      if (!pat) return fail('برای همگام‌سازی، توکن گیت‌هاب را ذخیره کنید', 422);
      const rows = await db.botCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }] });
      const config = {
        categories: rows.map((r) => ({ slug: r.slug, title: r.title })),
        note: 'این فایل توسط اپلیکیشن رصدبان مدیریت می‌شود — ویرایش دستی در چرخهٔ بعدی همگام‌سازی بازنویسی می‌شود. دستهٔ عمومی مقصد پیش‌فرض است (چت شخصی + کانال اصلی).',
        updatedAt: new Date().toISOString(),
      };
      const r = await putRepoFile('bot/bot-config.json', JSON.stringify(config, null, 1), 'همگام‌سازی دسته‌های خبری ربات از اپلیکیشن', pat);
      if (!r.ok) return fail(r.error || 'نوشتن bot-config.json ناموفق بود', 500);
      return ok({ written: 'bot/bot-config.json', categories: config.categories.length });
    }

    // ── ذخیرهٔ پرامپت‌های ویرایش‌شده (پرامپت اصلی/ترجمه) → bot/prompts.json ──
    if (action === 'syncPrompts' || action === 'resetPrompts') {
      const pat = await getGhPat();
      if (!pat) return fail('برای همگام‌سازی، توکن گیت‌هاب را ذخیره کنید', 422);
      let content: string;
      if (action === 'resetPrompts') {
        const local = await readRepoFileWithFallback('bot/prompts.json');
        // بازگشت به پیش‌فرض: فایل محلی همان پیش‌فرض‌های درونی ربات است
        const fallback = local?.content || JSON.stringify({ note: 'پیش‌فرض درونی ربات' });
        let base: Record<string, unknown> = {};
        try { base = JSON.parse(fallback) as Record<string, unknown>; } catch { /* تهی */ }
        delete base.oneshot;
        delete base.translate;
        base.note = 'پرامپت‌ها به پیش‌فرض درونی ربات بازگشت — ربات از پرامپت سوپر حرفه‌ای ساخته‌شده در bot.ts استفاده می‌کند.';
        base.updatedAt = new Date().toISOString();
        content = JSON.stringify(base, null, 1);
      } else {
        const oneshot = String(body.oneshot || '').trim();
        const translate = String(body.translate || '').trim();
        if (oneshot && oneshot.length < 400) return fail('پرامپت اصلی خیلی کوتاه است (حداقل ۴۰۰ نویسه — ربات با پرامپت ناقص خراب می‌شود)', 422);
        if (translate && translate.length < 200) return fail('پرامپت ترجمه خیلی کوتاه است (حداقل ۲۰۰ نویسه)', 422);
        const local = await readRepoFileWithFallback('bot/prompts.json');
        let base: Record<string, unknown> = {};
        if (local) { try { base = JSON.parse(local.content) as Record<string, unknown>; } catch { /* تهی */ } }
        if (oneshot) base.oneshot = oneshot;
        if (translate) base.translate = translate;
        base.updatedAt = new Date().toISOString();
        content = JSON.stringify(base, null, 1);
      }
      const r = await putRepoFile('bot/prompts.json', content, action === 'resetPrompts' ? 'بازگشت پرامپت‌های ربات به پیش‌فرض' : 'ویرایش پرامپت‌های ربات از اپلیکیشن', pat);
      if (!r.ok) return fail(r.error || 'نوشتن prompts.json ناموفق بود', 500);
      return ok({ written: 'bot/prompts.json', mode: action === 'resetPrompts' ? 'reset' : 'override' });
    }

    // ── دسته‌بندی منابع ربات → bot/sources.json ──
    if (action === 'syncSources') {
      const pat = await getGhPat();
      if (!pat) return fail('برای همگام‌سازی، توکن گیت‌هاب را ذخیره کنید', 422);
      const assignments = Array.isArray(body.assignments) ? body.assignments as Array<{ name?: unknown; category?: unknown }> : [];
      const clean = assignments
        .map((a) => ({ name: String(a.name || '').trim(), category: String(a.category || '').trim() }))
        .filter((a) => a.name && SLUG_RE.test(a.category));
      if (clean.length === 0) return fail('هیچ تغییر دسته‌بندی معتبری ارسال نشد', 422);
      const src = await readRepoFileWithFallback('bot/sources.json');
      if (!src) return fail('bot/sources.json در ریپو یافت نشد', 404);
      let arr: Array<Record<string, unknown>>;
      try { arr = JSON.parse(src.content) as Array<Record<string, unknown>>; } catch { return fail('sources.json قابل تجزیه نبود', 500); }
      let changed = 0;
      const map = new Map(clean.map((a) => [a.name, a.category]));
      for (const s of arr) {
        const name = String(s.name || '').trim();
        if (!map.has(name)) continue;
        const cat = map.get(name) as string;
        if (cat === 'general' || cat === '') delete s.category;
        else s.category = cat;
        changed++;
      }
      const r = await putRepoFile('bot/sources.json', JSON.stringify(arr, null, 1), `دسته‌بندی ${changed} منبع ربات از اپلیکیشن`, pat);
      if (!r.ok) return fail(r.error || 'نوشتن sources.json ناموفق بود', 500);
      return ok({ written: 'bot/sources.json', changed });
    }

    // ── راه‌اندازی فوری ربات ──
    if (action === 'dispatchRun') {
      const r = await dispatchBotRun(body.discoverChats === true);
      if (!r.ok) return fail(r.error || 'راه‌اندازی ناموفق بود', 500);
      return ok({ dispatched: true, discoverChats: body.discoverChats === true, note: body.discoverChats ? 'اجرای کشف چت‌ها — نتیجه در Actions قابل مشاهده است' : 'چرخهٔ خبررسان شروع شد' });
    }

    // ── تست بات پیش‌فرض (env) ──
    if (action === 'testDefaultBot') {
      const token = await getBaleToken();
      if (!token) return fail('توکن بات پیش‌فرض تنظیم نشده است', 422);
      const me = await baleApiWith(token, 'getMe');
      if (!me.ok) return fail(`getMe ناموفق: ${me.error}`, 502);
      const username = (me.data as { result?: { username?: string } } | null)?.result?.username;
      return ok({ username: username || null });
    }

    return fail(`اکشن ناشناخته: ${action || '(خالی)'}`, 400);
  } catch (e) { return err500(e, 'عملیات ربات ۲۴ ساعته'); }
}
