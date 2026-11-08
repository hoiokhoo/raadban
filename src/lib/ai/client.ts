/**
 * لایه هوش مصنوعی — فصل ۱۱ سند + زنجیره انتقال خطا (failover)
 * - مدل اول: z-ai-web-dev-sdk (فقط سمت سرور)
 * - اگر مدل اول خطا داد (۴۲۹/تایم‌اوت/شبکه) → به‌صورت خودکار مدل بعدی زنجیره
 *   (FCC، Groq، OpenRouter، NVIDIA، GitHub Models، Together) — الگوی free-claude-code
 * - سیستم‌پرامپت ضد تزریق الزامی
 * - خروجی ساختاریافته JSON با اعتبارسنجی پیش از ذخیره
 * - ثبت مصرف (AiUsage) و کنترل سقف هزینه روزانه
 */
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { ANTI_INJECTION_DIRECTIVE } from '../security/guard';
import { getProviderChain, openAiCompatibleCall, runChain, providerCooldownRemaining, type ProviderConfig, type ProviderCallResult } from './providers';

export const PROMPT_VERSION = 'v1.0';

export type AiPriority = 'interactive' | 'background';

export interface AiCallInput {
  purpose: string; // استخراج_ادعا | راستی_آزمایی | گزارش | کشف_منبع | تحلیل
  systemPrompt: string;
  userContent: string;
  maxChars?: number; // سقف طول متن ورودی
  temperature?: number;
  thinking?: boolean;
  /** interactive = فراخوانی مستقیم کاربر (ارزیابی و...) — صف را پیشی می‌گیرد
   *  background = خط تولید پس‌زمینه — نرمال */
  priority?: AiPriority;
  /** حذف برخی تأمین‌کنندگان از زنجیره فقط برای همین فراخوانی — مثلاً ترجمه‌های پرتکرار
   *  بدون مصرف سهمیهٔ روزانهٔ ۵۰تایی OpenRouter (سهمیه محفوظ می‌ماند برای گزارش اصلی) */
  skipProviderIds?: string[];
  /** سقف توکن خروجی (فقط تأمین‌کنندگان سازگار با OpenAI) — بدون آن سرویس‌های رایگان
   *  مثل Pollinations روی پاسخ‌های بلند با خطای قطعی output_token_limit شکست می‌خورند */
  maxTokens?: number;
}

export interface AiCallResult {
  ok: boolean;
  content?: string;
  error?: string;
  model: string;
  promptVersion: string;
  inputChars: number;
  outputChars: number;
  estTokens: number;
  refusedByBudget?: boolean;
  /** تأمین‌کننده‌ای که واقعاً پاسخ داد — برای شفافیت در رابط کاربری */
  providerId?: string;
}

const DEFAULT_MODEL = 'glm-4.5-air';
const CHARS_PER_TOKEN = 3.2; // برآورد تقریبی برای فارسی

// ---------- سدیمانت هم‌زمانی (فصل ۱۱: کنترل تعداد درخواست‌های هم‌زمان) ----------
const MAX_CONCURRENT_AI = 2;
/** سهمیهٔ خط تولید پس‌زمینه — حداکثر یک کار سنگین هم‌زمان؛
 *  درخواست کاربر (interactive) هرگز پشت دو کار پس‌زمینه قفل نمی‌ماند و
 *  فراخوانی‌های موازی GLM (منشأ ۴۲۹های پراکنده) نیز سریال می‌شوند. */
const MAX_BACKGROUND_AI = 1;
interface AiQueueEntry { priority: AiPriority; resolve: () => void }
interface AiQueueState { active: number; activeBackground: number; queue: AiQueueEntry[] }
const g = globalThis as unknown as { __aiQueue?: AiQueueState; __aiBreaker?: BreakerState };

function aiQueue(): AiQueueState {
  if (!g.__aiQueue) g.__aiQueue = { active: 0, activeBackground: 0, queue: [] };
  return g.__aiQueue;
}

/** واگذاری اسلات آزاد به صف‌دار بعدیِ مجاز — interactive سرِ صف؛ true اگر کسی پذیرفته شد */
function admitNext(q: AiQueueState): boolean {
  for (let i = 0; i < q.queue.length; i++) {
    const w = q.queue[i];
    const isInteractive = w.priority === 'interactive';
    if (q.active < MAX_CONCURRENT_AI && (isInteractive || q.activeBackground < MAX_BACKGROUND_AI)) {
      q.queue.splice(i, 1);
      q.active++;
      if (!isInteractive) q.activeBackground++;
      w.resolve();
      return true;
    }
    if (isInteractive) return false; // interactive سرِ صف است — هیچ‌کس از آن جلو نمی‌زند
  }
  return false;
}

/** درخواست interactive سرِ صف می‌ایستد تا کاربر پشت خط تولید پس‌زمینه گرسنه نماند */
async function acquireSlot(priority: AiPriority = 'background'): Promise<void> {
  const q = aiQueue();
  const isInteractive = priority === 'interactive';
  if (q.active < MAX_CONCURRENT_AI && (isInteractive || q.activeBackground < MAX_BACKGROUND_AI)) {
    q.active++;
    if (!isInteractive) q.activeBackground++;
    return;
  }
  await new Promise<void>((resolve) => {
    const entry: AiQueueEntry = { priority, resolve };
    if (isInteractive) q.queue.unshift(entry);
    else q.queue.push(entry);
    admitNext(q); // اگر میان بررسی و صف‌شدن اسلاتی آزاد شد
  });
}

function releaseSlot(priority: AiPriority = 'background'): void {
  const q = aiQueue();
  if (priority !== 'interactive') q.activeBackground = Math.max(0, q.activeBackground - 1);
  if (!admitNext(q)) q.active = Math.max(0, q.active - 1); // اسلات منتقل نشد → آزادسازی واقعی
}

// ---------- قطع‌کن مدار (circuit breaker) برای محدودیت نرخ ۴۲۹ ----------
interface BreakerState { consecutive429: number; openUntil: number }
const BREAKER_THRESHOLD = 6;
const BREAKER_COOLDOWN_MS = 5 * 60 * 1000;

// ---------- فاصله‌سنج هر تأمین‌کننده (پایدار بین فراخوانی‌ها در همان فرآیند) ----------
const g2 = globalThis as unknown as { __provLastCall?: Record<string, number> };
function provLastCall(): Record<string, number> {
  if (!g2.__provLastCall) g2.__provLastCall = {};
  return g2.__provLastCall;
}

function breaker(): BreakerState {
  if (!g.__aiBreaker) g.__aiBreaker = { consecutive429: 0, openUntil: 0 };
  return g.__aiBreaker;
}

function isRateLimitedError(error?: string): boolean {
  return !!error && /429|Too many requests|نرخ/i.test(error);
}

/** استخراج فاصلهٔ انتظار سهمیه از پیام خطای گوگل — تابع خالص تست‌پذیر
 *  «Please retry in 10h25m3.1s» یا «"retryDelay": "37503s"» → میلی‌ثانیه؛ سقف پیش‌فرض ۱۲ ساعت
 *  خواستهٔ کاربر: «سهمی‌اش تمام شد بره بعدی» — کلید خالی تا بازسازی سهمیه کنار گذاشته می‌شود. */
export function quotaCooldownMsFromError(error: string, capMs = 12 * 3600_000): number | null {
  const human = error.match(/retry in\s*(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+(?:\.\d+)?)m)?\s*(?:(\d+(?:\.\d+)?)s)?/i);
  if (human) {
    const h = Number(human[1] || 0);
    const m = Number(human[2] || 0);
    const s = Number(human[3] || 0);
    const ms = Math.round((h * 3600 + m * 60 + s) * 1000);
    if (ms > 0) return Math.min(ms, capMs);
  }
  const json = error.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (json) {
    const ms = Math.round(Number(json[1]) * 1000);
    if (ms > 0) return Math.min(ms, capMs);
  }
  return null;
}

/** برای تست نیز صادر شده — ثبت پیامد یک تلاش روی قطع‌کن */
export function noteAttemptOutcome(ok: boolean, error?: string): void {
  const b = breaker();
  if (ok) { b.consecutive429 = 0; b.openUntil = 0; return; }
  if (isRateLimitedError(error)) {
    b.consecutive429++;
    if (b.consecutive429 >= BREAKER_THRESHOLD) b.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
  }
}

/** آیا تلاش‌های پس‌زمینه موقتاً متوقف‌اند؟ (درخواست کاربر همیشه تلاش می‌کند) */
export function isBackgroundPaused(): boolean {
  return Date.now() < breaker().openUntil;
}

/** برآورد مصرف روز — بر مبنای کاراکترها (سقف هزینه به «واحد مصرف تقریبی») */
export async function checkBudget(): Promise<{ allowed: boolean; usedToday: number; limit: number }> {
  const setting = await db.setting.findUnique({ where: { key: 'ai_budget' } });
  const limit = setting ? Number(JSON.parse(setting.value).dailyTokenLimit || 200000) : 200000;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const usage = await db.aiUsage.aggregate({
    _sum: { estTokens: true },
    where: { createdAt: { gte: startOfDay }, status: 'موفق' },
  });
  const usedToday = usage._sum.estTokens || 0;
  return { allowed: usedToday < limit, usedToday, limit };
}

/** فراخوانی مدل داخلی GLM با محافظ زمانی — تایمر پس از پایان پاک می‌شود
 *  تلاش مجدد کوتاه فقط برای خطاهای گذرای گیت‌وی داخلی (۴۰۱ «missing X-Token»، شبکه، ۵xx):
 *  همین پیکربندی لحظاتی بعد جواب می‌دهد؛ بدون این تلاش، زنجیره به سرویس‌های کندِ رایگان می‌افتد.
 *  خطای ۴۲۹/سهمیه اینجا تلاش مجدد نمی‌شود — runChain خودش سیاست ۴۲۹ را اعمال می‌کند. */
const ZAI_TRANSIENT_RE = /missing X-Token|status 5\d\d|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|network/i;

export async function callZaiModel(
  model: string,
  systemPrompt: string,
  userContent: string,
  thinking: boolean,
  timeoutMs = 75000
): Promise<ProviderCallResult> {
  const MAX_TRIES = 3;
  let last: ProviderCallResult = { ok: false, error: 'خطای ناشناخته' };
  for (let tries = 1; tries <= MAX_TRIES; tries++) {
    last = await callZaiModelOnce(model, systemPrompt, userContent, thinking, timeoutMs);
    if (last.ok) return last;
    if (tries === MAX_TRIES || !ZAI_TRANSIENT_RE.test(last.error || '')) return last;
    await new Promise((res) => setTimeout(res, 2000 * tries)); // ۲ث سپس ۴ث
  }
  return last;
}

async function callZaiModelOnce(
  model: string,
  systemPrompt: string,
  userContent: string,
  thinking: boolean,
  timeoutMs: number
): Promise<ProviderCallResult> {
  const zai = await ZAI.create();
  let rejectTimeout!: (e: Error) => void;
  const timer = setTimeout(
    () => rejectTimeout(new Error(`پاسخ مدل بیش از ${Math.round(timeoutMs / 1000)} ثانیه طول کشید (timeout)`)),
    timeoutMs
  );
  try {
    const completion = await Promise.race([
      zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        thinking: { type: thinking ? 'enabled' : 'disabled' },
      }),
      new Promise<never>((_, reject) => { rejectTimeout = reject; }),
    ]);
    const content = completion.choices[0]?.message?.content || '';
    if (!content) return { ok: false, error: 'پاسخ مدل خالی بود' };
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطای ناشناخته' };
  } finally {
    clearTimeout(timer);
  }
}

/** برچسب مدل هر تأمین‌کننده برای ثبت در AiUsage */
export function modelLabelOf(p: ProviderConfig, primaryModel: string): string {
  return p.kind === 'zai' ? primaryModel : `${p.id}/${p.model || 'default'}`;
}

/** فراخوانی با زنجیره مدل‌ها — اگر مدلی خطا داد خودکار مدل بعدی امتحان می‌شود */
export async function aiCall(input: AiCallInput): Promise<AiCallResult> {
  const primaryModel = (await db.setting.findUnique({ where: { key: 'ai_model' } }))?.value || DEFAULT_MODEL;
  const inputChars = input.userContent.slice(0, input.maxChars ?? 12000).length;
  const estTokens = Math.ceil(inputChars / CHARS_PER_TOKEN);

  const budget = await checkBudget();
  if (!budget.allowed) {
    await db.aiUsage.create({
      data: { purpose: input.purpose, model: primaryModel, promptVersion: PROMPT_VERSION, inputChars, outputChars: 0, estTokens: 0, status: 'سقف_هزینه', error: 'سقف مصرف روزانه تکمیل شد' },
    });
    return { ok: false, error: 'سقف مصرف روزانه هوش مصنوعی تکمیل شد. می‌توانید سقف را در تنظیمات تغییر دهید.', model: primaryModel, promptVersion: PROMPT_VERSION, inputChars, outputChars: 0, estTokens: 0, refusedByBudget: true };
  }

  // قطع‌کن مدار: وقتی مدل‌ها پیاپی ۴۲۹ می‌دهند، خط تولید پس‌زمینه ۵ دقیقه عقب کشیده می‌شود
  // تا منابع و صف اشغال نشود؛ درخواست کاربر (interactive) همیشه تلاش واقعی می‌کند.
  const priority = input.priority || 'background';
  if (priority === 'background' && isBackgroundPaused()) {
    return {
      ok: false,
      error: 'مدل‌ها موقتاً در محدودیت نرخ‌اند — تلاش پس‌زمینه ۵ دقیقه معلق شد (قطع‌کن مدار).',
      model: primaryModel, promptVersion: PROMPT_VERSION, inputChars, outputChars: 0, estTokens: 0,
    };
  }

  // خط دفاعی: دستور ضد تزریق همیشه بخشی از سیستم‌پرامپت است
  const systemPrompt = `${input.systemPrompt}\n\n${ANTI_INJECTION_DIRECTIVE}`;
  const userContent = input.userContent.slice(0, input.maxChars ?? 12000);
  const chain = (await getProviderChain()).filter(
    (p) => !(input.skipProviderIds || []).includes(p.id)
  );

  await acquireSlot(priority);
  try {
    const caller = async (p: ProviderConfig, attempt: number): Promise<ProviderCallResult> => {
      // فاصله‌سنج درونی: برای سرویس‌های رایگان با پنجره زمانی (مثل pollinations ۱/۳۰ث)
      // تا سقف ۳۵ ثانیه صبر می‌کنیم — بهتر از شکست قطعی؛ بالاتر از آن، مدل بعدی امتحان می‌شود.
      const remaining = providerCooldownRemaining(p, provLastCall()[p.id], Date.now());
      if (remaining > 0) {
        if (remaining <= 35_000) {
          await new Promise((res) => setTimeout(res, remaining + 500));
        } else {
          return { ok: false, error: `${p.id} در فاصله‌سنج خودکار است (${Math.ceil(remaining / 1000)} ثانیه)` };
        }
      }
      const label = modelLabelOf(p, primaryModel);
      let r: ProviderCallResult;
      try {
        // سد زمانی سخت برای هر تلاش — اگر SDK/شبکه بی‌نهایت هنگ کند، اسلات زنجیره برای همیشه قفل نمی‌شود
        const ATTEMPT_TIMEOUT_MS = 95_000;
        const attemptCall =
          p.kind === 'zai'
            ? callZaiModel(primaryModel, systemPrompt, userContent, !!input.thinking)
            : openAiCompatibleCall({
                baseUrl: p.baseUrl!, apiKey: p.apiKey, model: p.model || 'default',
                systemPrompt, userContent, timeoutMs: 60000, temperature: input.temperature,
                rateLimitRetryMs: p.rateLimitRetryMs, maxTokens: input.maxTokens,
              });
        r = await Promise.race([
          attemptCall,
          new Promise<ProviderCallResult>((_, reject) => {
            setTimeout(() => reject(new Error(`تلاش بیش از ${Math.round(ATTEMPT_TIMEOUT_MS / 1000)} ثانیه طول کشید و کنار گذاشته شد`)), ATTEMPT_TIMEOUT_MS);
          }),
        ]);
      } catch (e) {
        r = { ok: false, error: e instanceof Error ? e.message : 'خطای ناشناخته' };
      }
      if (r.ok) provLastCall()[p.id] = Date.now(); // فقط فراخوانی واقعیِ رسیده به سرویس ثبت می‌شود
      // حافظهٔ مسدودی جغرافیایی گوگل: خطای قطعی ۴۰۰ FAILED_PRECONDITION وابسته به IP سرور است،
      // نه گذرا — ۵ دقیقه گذر سریع تا زنجیره هر بار معطل آن نشود؛ خطا همچنان در AiUsage ثبت و در UI نشان داده می‌شود.
      if (!r.ok && r.error && /User location is not supported|FAILED_PRECONDITION/i.test(r.error)) {
        provLastCall()[p.id] = Date.now() + 300_000;
      }
      // سهمیهٔ تمام‌شدهٔ جمینی (۴۲۹ quota): کلید بعدی فوراً امتحان می‌شود؛ اگر گوگل «retry in XhYm»
      // داده باشد همان فاصله (تا سقف ۱۲ ساعت) گذر سریع است — سهمیهٔ روزانه تا بازسازی دوباره امتحان نمی‌شود
      if (!r.ok && r.error && /You exceeded your current quota|RESOURCE_EXHAUSTED/i.test(r.error)) {
        const cd = quotaCooldownMsFromError(r.error) ?? 240_000;
        provLastCall()[p.id] = Math.max(provLastCall()[p.id] || 0, Date.now() + cd);
      }
      // خنک‌کننده مدل رایگان: دو شکست متوالی محدودیت نرخ (۴۲۹/۴۰۲ FREE_LIMIT)
      // → حدود ۴ دقیقه ردّ سریع (بدون صبر) تا سهمیه رایگان فرصت بازسازی داشته باشد
      if (!r.ok && p.rateLimitRetryMs && attempt >= 2 && (r.rateLimited || (r.error?.includes('FREE_LIMIT') ?? false))) {
        provLastCall()[p.id] = Date.now() + 240_000;
      }
      // ثبت پیامد روی قطع‌کن مدار
      noteAttemptOutcome(r.ok, r.error);
      // ثبت مصرف هر تلاش — موفق و ناموفق، برای شفافیت کامل
      try {
        await db.aiUsage.create({
          data: {
            purpose: input.purpose, model: label, promptVersion: PROMPT_VERSION,
            inputChars,
            outputChars: r.ok ? r.content!.length : 0,
            estTokens: r.ok ? estTokens + Math.ceil(r.content!.length / CHARS_PER_TOKEN) : 0,
            status: r.ok ? 'موفق' : 'ناموفق',
            error: r.ok ? null : (r.error || 'خطای ناشناخته').slice(0, 500),
          },
        });
      } catch { // ثبت مصرف نباید پاسخ مدل را مسدود کند
      }
      return r;
    };

    const result = await runChain(chain, caller, { maxAttemptsPerProvider: 2, on429WaitMs: 4000, deadlineMs: 180000 });
    if (result.ok) {
      return {
        ok: true,
        content: result.content,
        model: result.providerId === 'zai' ? primaryModel : `${result.providerId}/${result.model || 'default'}`,
        promptVersion: PROMPT_VERSION,
        inputChars,
        outputChars: result.content!.length,
        estTokens: estTokens + Math.ceil(result.content!.length / CHARS_PER_TOKEN),
        providerId: result.providerId,
      };
    }
    return {
      ok: false,
      error: result.error || 'خطای ناشناخته در زنجیره مدل‌ها',
      model: primaryModel, promptVersion: PROMPT_VERSION, inputChars, outputChars: 0, estTokens: 0,
    };
  } finally {
    releaseSlot(priority);
  }
}

/** استخراج JSON از پاسخ مدل با حذف بسته‌بندی‌های رایج و اعتبارسنجی */
export function extractJson<T>(raw: string, validate: (x: unknown) => T | null): T | null {
  if (!raw) return null;
  let text = raw.trim();
  // حذف ```json ... ``` — و حالت ناقص: محصورکنندهٔ باز بدون بسته (پاسخ بریده‌شدهٔ مدل)
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  else text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  // اولین بلوک JSON متعادل
  const start = text.indexOf('{');
  const startArr = text.indexOf('[');
  const from = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (from === -1) return null;
  const openCh = text[from];
  const closeCh = openCh === '{' ? '}' : ']';
  let depth = 0;
  let end = -1;
  for (let i = from; i < text.length; i++) {
    if (text[i] === openCh) depth++;
    else if (text[i] === closeCh) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;
  try {
    const parsed = JSON.parse(text.slice(from, end + 1));
    return validate(parsed);
  } catch {
    return null;
  }
}
