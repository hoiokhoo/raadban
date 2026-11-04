/**
 * مدیریت کلیدهای جمینی — خواستهٔ کاربر (۴ نوامبر ۲۰۲۶):
 * بخش افزودن/حذف چند کلید API جمینی + اتصال به ربات (همگام‌سازی سکرت GEMINI_API_KEYS گیت‌هاب)
 * - کلیدها رمزنگاری‌شده در Setting «gemini_api_keys» ذخیره می‌شوند و هرگز به مرورگر برنمی‌گردند
 * - زنجیرهٔ سامانه استخر را می‌خواند (loadGeminiKeyPool) — سرِ زنجیره با چرخش خودکار بین کلیدها
 * - همگام‌سازی ربات: با توکن گیت‌هابِ ذخیره‌شده (Setting «github_pat» — رمزنگاری‌شده) اسکریپت
 *   scripts/set-gh-secret.sh سکرت‌های GEMINI_API_KEYS و GEMINI_API_KEY را در ریپو ربات به‌روز می‌کند
 */
import { ok, fail, err500 } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { encrypt, decrypt, maskKey } from '@/lib/security/crypto';
import { loadGeminiKeyPool } from '@/lib/ai/providers';

const execFileAsync = promisify(execFile);
const MAX_KEYS = 20;
const REPO = process.env.RAADBAN_REPO?.trim() || 'hoiokhoo/raadban';

interface PoolEntry { enc: string; masked: string; label?: string; addedAt: string }

async function readPool(): Promise<PoolEntry[]> {
  try {
    const row = await db.setting.findUnique({ where: { key: 'gemini_api_keys' } });
    if (!row?.value) return [];
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is PoolEntry => {
      if (typeof e !== 'object' || e === null) return false;
      const o = e as Record<string, unknown>;
      return typeof o.enc === 'string' && o.enc.length > 0 && typeof o.masked === 'string';
    });
  } catch {
    return [];
  }
}

async function writePool(pool: PoolEntry[]): Promise<void> {
  await db.setting.upsert({
    where: { key: 'gemini_api_keys' },
    create: { key: 'gemini_api_keys', value: JSON.stringify(pool) },
    update: { key: 'gemini_api_keys', value: JSON.stringify(pool) },
  });
}

async function getPat(): Promise<string | null> {
  try {
    const row = await db.setting.findUnique({ where: { key: 'github_pat' } });
    return row?.value ? (decrypt(row.value) || null) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const pool = await readPool();
    const pat = await getPat();
    return ok({
      keys: pool.map((e) => ({ masked: e.masked, label: e.label || null, addedAt: e.addedAt })),
      keysCount: pool.length,
      maxKeys: MAX_KEYS,
      envKeyMasked: process.env.GEMINI_API_KEY?.trim() ? maskKey(process.env.GEMINI_API_KEY.trim()) : null,
      hasPat: Boolean(pat),
      patMasked: pat ? maskKey(pat) : null,
      repo: REPO,
      note: 'سرِ زنجیرهٔ مدل استخر جمینی است — کلید اول اولویت دارد؛ در خطا/سهمیه کلید بعدی چرخش می‌شود',
    });
  } catch (e) { return err500(e, 'مدیریت کلیدهای جمینی'); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    // ذخیرهٔ توکن گیت‌هاب برای همگام‌سازی سکرت ربات (رمزنگاری‌شده — هرگز برنمی‌گردد)
    if (body.pat !== undefined) {
      const pat = String(body.pat || '').trim();
      if (pat.length < 20 || pat.length > 200) return fail('توکن گیت‌هاب نامعتبر است (طول لازم ≥ ۲۰ نویسه)', 422);
      await db.setting.upsert({
        where: { key: 'github_pat' },
        create: { key: 'github_pat', value: encrypt(pat) },
        update: { key: 'github_pat', value: encrypt(pat) },
      });
      return ok({ savedPat: maskKey(pat) });
    }

    const pool = await readPool();

    // حذف کلید با اندیس
    if (typeof body.removeIndex === 'number') {
      const idx = body.removeIndex;
      if (!Number.isInteger(idx) || idx < 0 || idx >= pool.length) return fail('اندیس کلید نامعتبر است', 422);
      pool.splice(idx, 1);
      await writePool(pool);
      return ok({ removed: idx, keysCount: pool.length });
    }

    // همگام‌سازی با سکرت‌های گیت‌هابِ ربات
    if (body.syncToBot === true) {
      const plaintext = await loadGeminiKeyPool();
      if (plaintext.length === 0) {
        const envKey = process.env.GEMINI_API_KEY?.trim();
        if (!envKey) return fail('هیچ کلید جمینی موجود نیست — نه در تنظیمات، نه در محیط', 422);
        plaintext.push(envKey);
      }
      const pat = await getPat();
      if (!pat) return fail('برای همگام‌سازی، توکن گیت‌هاب را در همین بخش ذخیره کنید', 422);
      const runSet = async (name: string, value: string) =>
        execFileAsync('bash', ['scripts/set-gh-secret.sh', name, value, REPO], {
          env: { ...process.env, GH_TOKEN: pat },
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
        });
      try {
        await runSet('GEMINI_API_KEYS', JSON.stringify(plaintext));
        await runSet('GEMINI_API_KEY', plaintext[0]);
        return ok({ synced: plaintext.length, repo: REPO, detail: `سکرت‌های GEMINI_API_KEYS و GEMINI_API_KEY در ${REPO} به‌روزرسانی شدند` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(`همگام‌سازی ناموفق بود: ${msg.slice(0, 200)}`, 500);
      }
    }

    // افزودن کلید تازه
    const key = String(body.apiKey || '').trim();
    if (key.length < 20 || key.length > 500) return fail('کلید جمینی باید بین ۲۰ تا ۵۰۰ نویسه باشد', 422);
    if (pool.length >= MAX_KEYS) return fail(`حداکثر ${MAX_KEYS} کلید مجاز است`, 422);
    if (pool.some((e) => e.masked === maskKey(key))) return fail('این کلید قبلاً افزوده شده است', 422);
    const label = String(body.label || '').trim().slice(0, 60);
    const entry: PoolEntry = { enc: encrypt(key), masked: maskKey(key), label: label || undefined, addedAt: new Date().toISOString() };
    pool.push(entry);
    await writePool(pool);
    return ok({ added: entry.masked, keysCount: pool.length });
  } catch (e) { return err500(e, 'ذخیره کلید جمینی'); }
}
