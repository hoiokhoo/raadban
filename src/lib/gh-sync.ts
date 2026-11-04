/**
 * همگام‌سازی اپلیکیشن ↔ گیت‌هاب برای ربات ۲۴ ساعته:
 * - نوشتن سکرت BALE_CATEGORIES (توکن بات هر بخش خبری) با اسکریپت آزمودهٔ set-gh-secret.sh
 * - خواندن/نوشتن فایل‌های عمومی ریپو (bot/bot-config.json، bot/prompts.json، bot/sources.json) با Contents API
 * - فهرست اجراهای workflow و راه‌اندازی فوری (dispatch)
 * - آمار ربات از bot/state.json (کامیت خودکار ربات در پایان هر چرخه)
 *
 * صراحت: توکن گیت‌هاب از Setting «github_pat» (رمزنگاری‌شده) یا محیط؛ هرگز در پاسخ/لاگ بازنمی‌گردد.
 * هر خطا شفاف و ساختگی‌زدایی‌شده برمی‌گردد.
 */
import { db } from '@/lib/db';
import { decrypt, encrypt } from './security/crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';

const execFileAsync = promisify(execFile);

export const REPO = process.env.RAADBAN_REPO?.trim() || 'hoiokhoo/raadban';
const GH_API = 'https://api.github.com';

export async function getGhPat(): Promise<string | null> {
  try {
    const row = await db.setting.findUnique({ where: { key: 'github_pat' } });
    if (row?.value) return decrypt(row.value) || null;
  } catch { /* بانک در دسترس نیست */ }
  const env = process.env.GITHUB_PAT?.trim() || process.env.GH_PAT?.trim();
  return env || null;
}

export async function saveGhPat(pat: string): Promise<void> {
  await db.setting.upsert({
    where: { key: 'github_pat' },
    create: { key: 'github_pat', value: encrypt(pat) },
    update: { key: 'github_pat', value: encrypt(pat) },
  });
}

async function gh(path: string, init: RequestInit = {}, pat?: string | null): Promise<{ ok: boolean; status: number; data: unknown }> {
  const token = pat ?? (await getGhPat());
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'raadban-app',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${GH_API}${path}`, { ...init, headers, signal: AbortSignal.timeout(25_000) });
  const text = await res.text().catch(() => '');
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

/** نوشتن سکرت ریپو — همان مسیر آزمودهٔ set-gh-secret.sh (libsodium sealed box) */
export async function setRepoSecret(name: string, value: string, pat: string): Promise<void> {
  await execFileAsync('bash', ['scripts/set-gh-secret.sh', name, value, REPO], {
    env: { ...process.env, GH_TOKEN: pat },
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
  });
}

export interface RepoFile { content: string; sha: string }

/** خواندن فایل ریپو (Contents API) — ۴۰۴ = null */
export async function getRepoFile(path: string, ref = 'HEAD'): Promise<RepoFile | null> {
  const r = await gh(`/repos/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`خواندن ${path} ناموفق بود (HTTP ${r.status})`);
  const o = r.data as { content?: string; sha?: string; encoding?: string } | null;
  if (!o?.content || !o.sha) return null;
  const content = o.encoding === 'base64' ? Buffer.from(o.content, 'base64').toString('utf8') : o.content;
  return { content, sha: o.sha };
}

/** نوشتن/به‌روزرسانی فایل ریپو با کامیت — پشتیبان محلی: فایل موجود در نسخهٔ کاری */
export async function putRepoFile(path: string, content: string, message: string, pat?: string): Promise<{ ok: boolean; sha?: string; error?: string }> {
  const existing = await getRepoFile(path).catch(() => null);
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    ...(existing ? { sha: existing.sha } : {}),
  };
  const r = await gh(`/repos/${REPO}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, pat ?? undefined);
  if (!r.ok) {
    const msg = (r.data as { message?: string } | null)?.message || `HTTP ${r.status}`;
    return { ok: false, error: `نوشتن ${path} ناموفق بود: ${msg}` };
  }
  const sha = (r.data as { content?: { sha?: string } } | null)?.content?.sha;
  return { ok: true, sha };
}

/** خواندن فایل ریپو با پشتیبان فایل محلی (نسخهٔ کاری) — برای محیط بدون توکن هم کار می‌کند */
export async function readRepoFileWithFallback(path: string): Promise<{ content: string; source: 'repo' | 'local' } | null> {
  try {
    const f = await getRepoFile(path);
    if (f) return { content: f.content, source: 'repo' };
  } catch { /* بدون توکن یا خطای شبکه → محلی */ }
  try {
    return { content: readFileSync(path, 'utf8'), source: 'local' };
  } catch { return null; }
}

export interface WorkflowRunInfo {
  runNumber: number;
  status: string;
  conclusion: string | null;
  createdAt: string;
  url: string;
  event: string;
}

export async function listBotRuns(perPage = 8): Promise<{ ok: boolean; runs: WorkflowRunInfo[]; error?: string }> {
  try {
    const r = await gh(`/repos/${REPO}/actions/workflows/bale-bot.yml/runs?per_page=${perPage}`);
    if (!r.ok) return { ok: false, runs: [], error: `HTTP ${r.status}` };
    const d = r.data as { workflow_runs?: Array<Record<string, unknown>> } | null;
    const runs = (d?.workflow_runs || []).map((x) => ({
      runNumber: Number(x.run_number) || 0,
      status: String(x.status || '?'),
      conclusion: (x.conclusion as string | null) ?? null,
      createdAt: String(x.created_at || ''),
      url: String(x.html_url || ''),
      event: String(x.event || ''),
    }));
    return { ok: true, runs };
  } catch (e) {
    return { ok: false, runs: [], error: e instanceof Error ? e.message : 'خطای ناشناخته' };
  }
}

export async function dispatchBotRun(discoverChats = false): Promise<{ ok: boolean; error?: string }> {
  const pat = await getGhPat();
  if (!pat) return { ok: false, error: 'برای راه‌اندازی ربات، توکن گیت‌هاب را در بخش «مدل و API» یا پایین همین صفحه ذخیره کنید' };
  try {
    const r = await gh(`/repos/${REPO}/actions/workflows/bale-bot.yml/dispatches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { discover_chats: discoverChats } }),
    }, pat);
    // ۲۰۴ = موفق (dispatch پاسخ بدنه ندارد)
    return r.status === 204 || r.ok ? { ok: true } : { ok: false, error: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطای ناشناخته' };
  }
}

/** آمار آخرین چرخهٔ ربات از bot/state.json — خواندن عمومی، بدون توکن */
export async function readBotState(): Promise<{ lastRunAt?: string; lastRun?: Record<string, unknown>; sentCount?: number } | null> {
  const f = await readRepoFileWithFallback('bot/state.json');
  if (!f) return null;
  try {
    const o = JSON.parse(f.content) as Record<string, unknown>;
    return {
      lastRunAt: typeof o.lastRunAt === 'string' ? o.lastRunAt : undefined,
      lastRun: (o.lastRun && typeof o.lastRun === 'object' ? o.lastRun : undefined) as Record<string, unknown> | undefined,
      sentCount: o.sentIds && typeof o.sentIds === 'object' ? Object.keys(o.sentIds as Record<string, unknown>).length : undefined,
    };
  } catch { return null; }
}
