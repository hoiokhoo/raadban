/**
 * زنجیره تأمین‌کنندگان مدل زبانی با انتقال خودکار خطا (failover)
 *
 * الگو برگرفته از پروژه آزاد FCC — free-claude-code (github.com/Alishahryar1):
 * اگر مدلی خطا داد (۴۲۹، تایم‌اوت، خطای شبکه)، به‌صورت خودکار مدل بعدی زنجیره امتحان می‌شود.
 *
 * اصل صراحت: هیچ‌گاه پاسخ ساختگی ساخته نمی‌شود؛ اگر همه مدل‌ها شکست خوردند
 * خطای تجمیعی شفاف با دلیل تک‌تک تأمین‌کنندگان برمی‌گردد.
 * کلیدها هرگز در پاسخ API، لاگ یا پیام خطا برنمی‌گردند.
 */
import { db } from '@/lib/db';
import { decrypt } from '../security/crypto';

export interface ProviderConfig {
  id: string;
  label: string;
  kind: 'zai' | 'openai-compatible';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  enabled: boolean;
  note?: string;
  /** حداقل فاصله بین دو فراخوانی (میلی‌ثانیه) — برای سرویس‌های رایگان با محدودیت نرخ سخت
   *  مثل Pollinations (۱ پاسخ در ۳۰ ثانیه). صفر/نامشخص = بدون محدودیت درون‌فرآیندی */
  minIntervalMs?: number;
  /** در خطای ۴۲۹/۴۰۲ FREE_LIMIT: انتظار به این اندازه و یک تلاش مجدد درون همان فراخوانی */
  rateLimitRetryMs?: number;
  /** سقف تلاش این تأمین‌کننده در زنجیره (پیش‌فرض عمومی ۲) — برای GLM با ۴۲۹ کوتاه‌مدت بیشتر است */
  maxAttempts?: number;
}

export interface ChainAttempt {
  id: string;
  label: string;
  model?: string;
  ok: boolean;
  content?: string;
  error?: string;
}

export interface ProviderCallResult {
  ok: boolean;
  content?: string;
  error?: string;
  /** فقط خطای ۴۲۹ (محدودیت نرخ) — برای تصمیم تلاش مجدد روی همان مدل */
  rateLimited?: boolean;
}

/** آدرس پیش‌فرض سرور محلی FCC (free-claude-code) — با FCC_BASE_URL قابل تغییر است */
export const FCC_DEFAULT_BASE_URL = 'http://127.0.0.1:8787/v1';

/** فاصله‌سنج تأمین‌کننده — تابع خالص و تست‌پذیر:
 *  اگر از آخرین فراخوانی واقعی کمتر از minIntervalMs گذشته باشد، این تلاش رد می‌شود
 *  تا زنجیره بیهوده روی خطای قطعی ۴۰۲/۴۲۹ وقت صرف نکند. */
export function providerCooldownRemaining(
  p: ProviderConfig,
  lastCallTs: number | undefined,
  now: number
): number {
  if (!p.minIntervalMs || !lastCallTs) return 0;
  return Math.max(0, p.minIntervalMs - (now - lastCallTs));
}

// ---------- ساخت زنجیره ----------

interface FreeProviderSpec {
  id: string;
  label: string;
  keyEnv: string;
  modelEnv: string;
  base: string;
  defModel: string;
}

/** Pollinations — سرویس رایگان بدون کلید (تأمین‌کننده جایگزین خودکار بعد از سرویس داخلی).
 *  محدودیت نرخ سخت رایگان: حدوداً ۱ پاسخ در ۳۰ ثانیه برای هر IP → با فاصله‌سنج درونی احترام می‌شود. */
const POLLINATIONS_SPEC = {
  id: 'pollinations',
  label: 'Pollinations — رایگان بدون کلید',
  base: 'https://text.pollinations.ai/openai',
  defModel: 'openai',
  minIntervalMs: 31_000,
} as const;

/** Gemini — تأمین‌کنندهٔ پیش‌فرض کاربر.
 *  نقطهٔ پایانی سازگار با OpenAI گوگل؛ کلید از GEMINI_API_KEY یا تنظیمات بانک اطلاعاتی.
 *  صراحت: گوگل درخواست از برخی زیرساخت‌های ابری را تحریم جغرافیایی می‌کند
 *  (400 FAILED_PRECONDITION «User location is not supported»)؛ در آن حالت زنجیره
 *  بی‌درنگ به مدل بعدی (GLM) منتقل می‌شود و خطا شفاف ثبت می‌گردد. */
const GEMINI_SPEC = {
  id: 'gemini',
  label: 'Gemini — پیش‌فرض',
  keyEnv: 'GEMINI_API_KEY',
  modelEnv: 'GEMINI_MODEL',
  base: 'https://generativelanguage.googleapis.com/v1beta/openai',
  defModel: 'gemini-3.8-flash',
} as const;

const FREE_PROVIDERS: FreeProviderSpec[] = [
  { id: 'groq', label: 'Groq', keyEnv: 'GROQ_API_KEY', modelEnv: 'GROQ_MODEL', base: 'https://api.groq.com/openai/v1', defModel: 'llama-3.3-70b-versatile' },
  { id: 'openrouter', label: 'OpenRouter — مدل‌های رایگان', keyEnv: 'OPENROUTER_API_KEY', modelEnv: 'OPENROUTER_MODEL', base: 'https://openrouter.ai/api/v1', defModel: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
  { id: 'nvidia', label: 'NVIDIA NIM', keyEnv: 'NVIDIA_API_KEY', modelEnv: 'NVIDIA_MODEL', base: 'https://integrate.api.nvidia.com/v1', defModel: 'meta/llama-3.3-70b-instruct' },
  { id: 'github-models', label: 'GitHub Models', keyEnv: 'GITHUB_TOKEN', modelEnv: 'GITHUB_MODEL', base: 'https://models.github.ai/inference', defModel: 'openai/gpt-4o-mini' },
  { id: 'together', label: 'Together AI', keyEnv: 'TOGETHER_API_KEY', modelEnv: 'TOGETHER_MODEL', base: 'https://api.together.xyz/v1', defModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
];

/**
 * زنجیره پیش‌فرض — تابع خالص (برای تست):
 * اگر کلید OpenRouter موجود باشد، OpenRouter پیش‌فرض (سرِ زنجیره) است؛
 * وگرنه gemini اول؛ zai/GLM همیشه پشتیبان اولِ پس از پیش‌فرض؛ Pollinations رایگان؛ بقیه فقط با کلید.
 * providerKeys: کلیدهای افزوده‌شده از رابط کاربری (رمزگشایی‌شده) — بر محیط اولویت دارند.
 */
export function buildDefaultChain(
  env: Record<string, string | undefined>,
  settingsApiKey?: string,
  providerKeys: Record<string, string> = {}
): ProviderConfig[] {
  const geminiKey = providerKeys[GEMINI_SPEC.id]?.trim() || env[GEMINI_SPEC.keyEnv]?.trim();
  const chain: ProviderConfig[] = [
    {
      id: GEMINI_SPEC.id,
      label: GEMINI_SPEC.label,
      kind: 'openai-compatible',
      baseUrl: GEMINI_SPEC.base,
      apiKey: geminiKey || undefined,
      model: env[GEMINI_SPEC.modelEnv]?.trim() || GEMINI_SPEC.defModel,
      enabled: Boolean(geminiKey),
      note: geminiKey
        ? 'تأمین‌کنندهٔ پیش‌فرض — در خطا (۴۲۹/تحریم جغرافیایی/تایم‌اوت) خودکار به GLM منتقل می‌شود'
        : `غیرفعال تا ${GEMINI_SPEC.keyEnv} تنظیم شود`,
    },
    {
      id: 'zai',
      label: 'سرویس داخلی GLM (z-ai)',
      kind: 'zai',
      enabled: true,
      maxAttempts: 3,
      note: 'پشتیبان اول — همیشه فعال؛ در ۴۲۹ با فاصله تدریجی تا ۳ تلاش می‌کند',
    },
  ];

  // Pollinations — همیشه فعال، بدون کلید؛ خطای ۴۲۹ مدل اول را خودکار جبران می‌کند
  chain.push({
    id: POLLINATIONS_SPEC.id,
    label: POLLINATIONS_SPEC.label,
    kind: 'openai-compatible',
    baseUrl: POLLINATIONS_SPEC.base,
    model: env.POLLINATIONS_MODEL?.trim() || POLLINATIONS_SPEC.defModel,
    enabled: true,
    minIntervalMs: POLLINATIONS_SPEC.minIntervalMs,
    rateLimitRetryMs: 31_500,
    note: 'رایگان بدون کلید — محدودیت رایگان حدود ۱ پاسخ در ۳۰ ثانیه؛ زنجیره خودکار صبر و تلاش مجدد می‌کند',
  });

  const fccBase = env.FCC_BASE_URL?.trim();
  const fccKey = env.FCC_API_KEY?.trim() || settingsApiKey || undefined;
  chain.push({
    id: 'fcc',
    label: 'FCC — Free Claude Code',
    kind: 'openai-compatible',
    baseUrl: fccBase || FCC_DEFAULT_BASE_URL,
    apiKey: fccKey,
    model: env.FCC_MODEL?.trim() || undefined,
    enabled: Boolean(fccBase || fccKey),
    note: fccBase || fccKey
      ? 'سرور محلی free-claude-code (github.com/Alishahryar1/free-claude-code)'
      : 'غیرفعال تا FCC_BASE_URL (یا کلید API تنظیمات) مشخص شود',
  });

  for (const f of FREE_PROVIDERS) {
    // کلید از رابط کاربری (رمزنگاری‌شده در بانک) بر محیط اولویت دارد — محیط پس از
    // راه‌اندازی مجدد سرور پاک می‌شود؛ پیش‌فرض بودن OpenRouter نباید به آن وابسته بماند.
    const key = providerKeys[f.id]?.trim() || env[f.keyEnv]?.trim();
    const model = env[f.modelEnv]?.trim() || f.defModel;
    chain.push({
      id: f.id,
      label: f.label,
      kind: 'openai-compatible',
      baseUrl: f.base,
      apiKey: key || undefined,
      model,
      enabled: Boolean(key),
      note: key ? undefined : `غیرفعال تا ${f.keyEnv} تنظیم شود`,
    });
  }

  // پیش‌فرض کاربر (۳۱ اکتبر ۲۰۲۶): با وجود کلید OpenRouter، OpenRouter سرِ زنجیره است —
  // مدل‌های رایگان واقعی با ماندهٔ قابل‌نمایش؛ در خطا/محدودیت نرخ، زنجیره به GLM و بقیه منتقل می‌شود.
  const orIdx = chain.findIndex((p) => p.id === 'openrouter');
  if (orIdx > 0 && chain[orIdx].enabled) {
    const [or] = chain.splice(orIdx, 1);
    chain.unshift({
      ...or,
      label: 'OpenRouter — پیش‌فرض (رایگان)',
      maxAttempts: 1, // سهمیهٔ رایگان روزانه (۵۰ درخواست) تمام‌شدنی است — در ۴۲۹ بی‌درنگ به مدل بعدی
      note: `تأمین‌کنندهٔ پیش‌فرض (${or.model}) — سهمیهٔ رایگان روزانه ۵۰ درخواست؛ در ۴۲۹ بی‌درنگ به GLM و بقیهٔ زنجیره منتقل می‌شود`,
    });
    // GLM پشتیبان اول می‌ماند — بلافاصله پس از پیش‌فرض؛ gemini پشتیبان دوم
    const zaiIdx = chain.findIndex((p) => p.id === 'zai');
    if (zaiIdx > 1) {
      const [z] = chain.splice(zaiIdx, 1);
      chain.splice(1, 0, z);
    }
    const gem = chain.find((p) => p.id === 'gemini');
    if (gem && gem.enabled) {
      gem.label = 'Gemini';
      gem.note = 'پشتیبان دوم پس از GLM — تحریم جغرافیایی/سهمیهٔ گوگل از این سرور: گذر سریع ۵/۴ دقیقه‌ای';
    }
  }

  return chain;
}

// ---------- تعریف سفارشی کاربر (Setting «ai_providers») ----------

/** معناشناسی: فهرست سفارشی «جایگزین کامل» زنجیره است؛ تأمین‌کنندهٔ پیشرو (openrouter فعال،
 *  وگرنه gemini فعال، وگرنه zai) اگر در فهرست ذکر نشده باشد به صدر بازمی‌گردد. id شناخته‌شده تنظیم همان
 *  تأمین‌کننده پیش‌فرض را بازنویسی می‌کند؛ id تازه باید baseUrl معتبر داشته باشد. */
export function applyCustomProviders(
  defaults: ProviderConfig[],
  raw: string | null | undefined
): ProviderConfig[] {
  if (!raw || !raw.trim()) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults; // JSON خراب → زنجیره پیش‌فرض
  }
  if (!Array.isArray(parsed)) return defaults;

  const byId = new Map(defaults.map((p) => [p.id, { ...p }]));
  const out: ProviderConfig[] = [];
  const mentioned = new Set<string>();
  let zaiDisabled: ProviderConfig | null = null;

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const e = item as Record<string, unknown>;
    const id = typeof e.id === 'string' ? e.id.trim().slice(0, 60) : '';
    if (!id) continue;

    if (id === 'zai') {
      mentioned.add('zai');
      const z = byId.get('zai')!;
      if (e.enabled === false) {
        z.enabled = false;
        zaiDisabled = z; // غیرفعال → انتهای زنجیره (فقط برای نمایش وضعیت)
      } else {
        out.push(z); // ذکر صریح → در جایگاه دلخواه کاربر می‌ماند
      }
      continue;
    }

    const existing = byId.get(id);
    if (existing) {
      mentioned.add(id);
      const p = { ...existing };
      if (typeof e.baseUrl === 'string' && e.baseUrl.trim()) p.baseUrl = e.baseUrl.trim();
      if (typeof e.apiKey === 'string' && e.apiKey.trim()) p.apiKey = e.apiKey.trim();
      if (typeof e.model === 'string' && e.model.trim()) p.model = e.model.trim();
      if (typeof e.label === 'string' && e.label.trim()) p.label = e.label.trim();
      // ذکر در فهرست یعنی فعال — مگر صریحاً enabled:false باشد
      p.enabled = e.enabled !== false;
      out.push(p);
    } else if (typeof e.baseUrl === 'string' && /^https?:\/\//.test(e.baseUrl.trim())) {
      // تأمین‌کننده تازه — هر نقطه پایانی سازگار با OpenAI
      mentioned.add(id);
      out.push({
        id,
        label: typeof e.label === 'string' && e.label.trim() ? e.label.trim() : id,
        kind: 'openai-compatible',
        baseUrl: e.baseUrl.trim(),
        apiKey: typeof e.apiKey === 'string' && e.apiKey.trim() ? e.apiKey.trim() : undefined,
        model: typeof e.model === 'string' && e.model.trim() ? e.model.trim() : 'default',
        enabled: e.enabled !== false,
      });
    }
  }

  // تأمین‌کنندهٔ پیشرو (openrouter فعال، وگرنه gemini، وگرنه zai) اگر ذکر نشده باشد به صدر زنجیره بازمی‌گردد
  const lead = defaults.find((p) => (p.id === 'openrouter' || p.id === 'gemini' || p.id === 'zai') && p.enabled);
  if (lead && !mentioned.has(lead.id)) out.unshift(byId.get(lead.id)!);

  if (zaiDisabled) out.push(zaiDisabled);

  // تاب‌آوری زنجیره: تأمین‌کنندگان پیش‌فرضِ فعالِ ذکرنشده (مثل pollinations بدون کلید)
  // به انتهای زنجیره اضافه می‌شوند تا ترتیب دلخواه کاربر حفظ شود ولی پشتیبان رایگان از دست نرود.
  for (const d of defaults) {
    if (mentioned.has(d.id)) continue;
    if (out.some((o) => o.id === d.id)) continue;
    if (d.enabled) out.push(d);
  }
  return out;
}

/** کلیدهای افزوده‌شده از رابط کاربری — Setting «ai_provider_keys»: {providerId: رمزنگاری‌شده} */
export async function loadProviderKeys(): Promise<Record<string, string>> {
  try {
    const row = await db.setting.findUnique({ where: { key: 'ai_provider_keys' } });
    if (!row?.value) return {};
    const parsed = JSON.parse(row.value) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [id, enc] of Object.entries(parsed)) {
      if (typeof enc !== 'string' || !enc) continue;
      const dec = decrypt(enc);
      if (dec) out[id] = dec;
    }
    return out;
  } catch {
    return {}; // تنظیم کلید سفارشی در دسترس نیست — زنجیره با کلید محیطی ادامه می‌دهد
  }
}

/** زنجیره نهایی — از تنظیمات بانک اطلاعاتی و محیط ساخته می‌شود */
export async function getProviderChain(): Promise<ProviderConfig[]> {
  let settingsApiKey: string | undefined;
  try {
    const keyRow = await db.setting.findUnique({ where: { key: 'ai_api_key' } });
    if (keyRow) settingsApiKey = decrypt(keyRow.value) || undefined;
  } catch {
    // کلید رمزنگاری‌شده قابل خواندن نبود — بدون کلید ادامه می‌دهیم
  }
  const providerKeys = await loadProviderKeys();
  let customRaw: string | null | undefined;
  try {
    const row = await db.setting.findUnique({ where: { key: 'ai_providers' } });
    customRaw = row?.value;
  } catch {
    // تنظیم سفارشی در دسترس نیست — زنجیره پیش‌فرض
  }
  const defaults = buildDefaultChain(process.env as Record<string, string | undefined>, settingsApiKey, providerKeys);
  // کلید تنظیماتی کاربر بر کلید محیطی اولویت دارد
  const withKeys = defaults.map((p) =>
    providerKeys[p.id] ? { ...p, apiKey: providerKeys[p.id], enabled: true, note: p.note } : p
  );
  return applyCustomProviders(withKeys, customRaw);
}

// ---------- فراخوانی سازگار با OpenAI ----------

/** POST {baseUrl}/chat/completions — بدون وابستگی به SDK؛ برای FCC، Groq،
 *  OpenRouter، NVIDIA، GitHub Models، Together و هر سرویس سازگار دیگر.
 *  اگر rateLimitRetryMs مثبت باشد: خطای ۴۲۹ یا ۴۰۲ FREE_LIMIT → انتظار کوتاه و یک تلاش مجدد
 *  (برای سرویس‌های رایگان با پنجره زمانی مثل Pollinations — ۳۱ ثانیه). */
export async function openAiCompatibleCall(input: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  systemPrompt: string;
  userContent: string;
  timeoutMs?: number;
  temperature?: number;
  rateLimitRetryMs?: number;
  /** سقف توکن خروجی — بدنهٔ max_tokens برای سرویس‌های رایگانی که بدون آن
   *  با خطای قطعی «output_token_limit_exceeded» شکست می‌خورند (مثل Pollinations) */
  maxTokens?: number;
}): Promise<ProviderCallResult> {
  const attempt = (): Promise<ProviderCallResult> => rawOpenAiCall(input);
  const first = await attempt();
  const retryable = first.rateLimited || (first.error?.includes('FREE_LIMIT') ?? false);
  const retryMs = input.rateLimitRetryMs;
  if (first.ok || !retryable || !retryMs) return first;
  await new Promise((res) => setTimeout(res, Math.min(retryMs, 35_000)));
  return attempt();
}

async function rawOpenAiCall(input: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  systemPrompt: string;
  userContent: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}): Promise<ProviderCallResult> {
  const base = input.baseUrl.replace(/\/+$/, '');
  const timeoutMs = input.timeoutMs ?? 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userContent },
        ],
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        rateLimited: res.status === 429,
        error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      };
    }
    const data = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    const content = data?.choices?.[0]?.message?.content || '';
    if (!content) return { ok: false, error: 'پاسخ مدل خالی بود' };
    return { ok: true, content };
  } catch (e) {
    let msg: string;
    if (e instanceof Error) {
      msg =
        e.name === 'AbortError'
          ? `timeout پس از ${timeoutMs} میلی‌ثانیه`
          : e.message || 'خطای ناشناخته';
    } else msg = 'خطای ناشناخته';
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- هسته انتقال خطا ----------

export type ChainCaller = (
  p: ProviderConfig,
  attempt: number
) => Promise<ProviderCallResult>;

export interface ChainResult {
  ok: boolean;
  content?: string;
  providerId?: string;
  model?: string;
  error?: string;
  attempts: ChainAttempt[];
}

/** قلب failover — تابع خالص و قابل تست:
 *  - هر تأمین‌کننده فعال حداکثر `maxAttemptsPerProvider` تلاش
 *  - خطای ۴۲۹ → تأخیر کوتاه و تلاش دوباره روی همان مدل؛ سپس مدل بعدی
 *  - سایر خطاها → بی‌درنگ مدل بعدی
 *  - گذر از سقف زمانی deadline → توقف زنجیره
 *  - شکست کامل → خطای تجمیعی صادقانه با دلیل هر تلاش */
export async function runChain(
  chain: ProviderConfig[],
  caller: ChainCaller,
  opts: { maxAttemptsPerProvider?: number; on429WaitMs?: number; deadlineMs?: number } = {}
): Promise<ChainResult> {
  const baseAttempts = opts.maxAttemptsPerProvider ?? 2;
  const wait429 = opts.on429WaitMs ?? 4000;
  const deadline = Date.now() + (opts.deadlineMs ?? 180000);
  const attempts: ChainAttempt[] = [];

  for (const p of chain) {
    if (!p.enabled) continue;
    // maxAttempts اختصاصی تأمین‌کننده بر پیش‌فرض عمومی مقدم است — هم افزایش (GLM با ۴۲۹ کوتاه‌مدت)
    // و هم کاهش (OpenRouter با سهمیهٔ روزانهٔ تمام‌شده — شکست سریع به مدل بعدی)
    const maxAttempts = p.maxAttempts ?? baseAttempts;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let r: ProviderCallResult;
      try {
        r = await caller(p, attempt);
      } catch (e) {
        r = { ok: false, error: e instanceof Error ? e.message : 'خطای ناشناخته' };
      }
      attempts.push({ id: p.id, label: p.label, model: p.model, ok: r.ok, content: r.content, error: r.error });
      if (r.ok) {
        return { ok: true, content: r.content, providerId: p.id, model: p.model, attempts };
      }
      if (r.rateLimited && attempt < maxAttempts) {
        await new Promise((res) => setTimeout(res, wait429 * attempt));
        continue;
      }
      break; // سایر خطاها → مدل بعدی
    }
    if (Date.now() > deadline) break;
  }

  const summary = attempts.length
    ? attempts.map((a) => `${a.id}${a.model ? `/${a.model}` : ''}: ${(a.error || 'نامشخص').slice(0, 120)}`).join(' | ')
    : 'هیچ تأمین‌کننده فعالی در زنجیره نبود';
  return { ok: false, error: `همه مدل‌های زنجیره خطا دادند — ${summary}`, attempts };
}
