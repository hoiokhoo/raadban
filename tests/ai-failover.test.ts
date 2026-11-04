/**
 * تست‌های واحد زنجیره مدل‌ها و انتقال خودکار خطا (failover) — بدون شبکه واقعی
 * اجرا: bun test tests/ai-failover.test.ts
 */
import { describe, test, expect, afterEach } from 'bun:test';
import {
  buildDefaultChain,
  applyCustomProviders,
  runChain,
  openAiCompatibleCall,
  providerCooldownRemaining,
  FCC_DEFAULT_BASE_URL,
  type ProviderConfig,
} from '../src/lib/ai/providers';
import { noteAttemptOutcome, isBackgroundPaused } from '../src/lib/ai/client';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// ---------- ساخت زنجیره پیش‌فرض ----------

describe('buildDefaultChain — ساخت زنجیره پیش‌فرض', () => {
  test('جمینی با کلید اولِ زنجیره است و GLM پشتیبان اول', () => {
    const chain = buildDefaultChain({ GEMINI_API_KEY: 'AQ.test-key-123' }, undefined);
    expect(chain[0].id).toBe('gemini');
    expect(chain[0].enabled).toBe(true);
    expect(chain[0].kind).toBe('openai-compatible');
    expect(chain[0].baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
    expect(chain[0].model).toBe('gemini-3.5-flash');
    expect(chain[1].id).toBe('zai');
    expect(chain[1].enabled).toBe(true);
    expect(chain[1].kind).toBe('zai');
  });

  test('بدون کلید جمینی، GLM اولین فعال است و جمینی غیرفعال اما حاضر در زنجیره', () => {
    const chain = buildDefaultChain({}, undefined);
    expect(chain[0].id).toBe('gemini');
    expect(chain[0].enabled).toBe(false);
    expect(chain[1].id).toBe('zai');
    expect(chain[1].enabled).toBe(true);
    const gem = chain.find((p) => p.id === 'gemini')!;
    expect(gem.note).toContain('GEMINI_API_KEY');
  });

  test('کلید افزوده‌شده از تنظیمات (providerKeys) بر محیط اولویت دارد و مدل با GEMINI_MODEL بازنویسی می‌شود', () => {
    const chain = buildDefaultChain({ GEMINI_API_KEY: 'env-key-12345678' }, undefined, { gemini: 'settings-key-98765' });
    const gem = chain.find((p) => p.id === 'gemini')!;
    expect(gem.apiKey).toBe('settings-key-98765');
    expect(gem.enabled).toBe(true);

    const withModel = buildDefaultChain({ GEMINI_API_KEY: 'k-1234567890', GEMINI_MODEL: 'gemini-2.5-flash' }, undefined);
    expect(withModel.find((p) => p.id === 'gemini')!.model).toBe('gemini-2.5-flash');
  });

  test('FCC بدون آدرس و کلید غیرفعال است و با FCC_BASE_URL فعال می‌شود', () => {
    const off = buildDefaultChain({}, undefined);
    const fccOff = off.find((p) => p.id === 'fcc')!;
    expect(fccOff.enabled).toBe(false);
    expect(fccOff.baseUrl).toBe(FCC_DEFAULT_BASE_URL);

    const on = buildDefaultChain({ FCC_BASE_URL: 'http://192.168.1.5:9000/v1' }, undefined);
    const fccOn = on.find((p) => p.id === 'fcc')!;
    expect(fccOn.enabled).toBe(true);
    expect(fccOn.baseUrl).toBe('http://192.168.1.5:9000/v1');
  });

  test('کلید رمزنگاری‌شده تنظیمات FCC را فعال می‌کند', () => {
    const chain = buildDefaultChain({}, 'sk-test-123');
    expect(chain.find((p) => p.id === 'fcc')!.enabled).toBe(true);
  });

  test('تأمین‌کننده‌های رایگان فقط با کلید محیطی فعال می‌شوند', () => {
    const chain = buildDefaultChain({ GROQ_API_KEY: 'gkey', OPENROUTER_API_KEY: '   ' }, undefined);
    const groq = chain.find((p) => p.id === 'groq')!;
    const openrouter = chain.find((p) => p.id === 'openrouter')!;
    const nvidia = chain.find((p) => p.id === 'nvidia')!;
    expect(groq.enabled).toBe(true);
    expect(groq.apiKey).toBe('gkey');
    expect(groq.model).toBe('llama-3.3-70b-versatile');
    expect(openrouter.enabled).toBe(false); // کلید خالی/فاصله
    expect(nvidia.enabled).toBe(false);
  });

  test('OpenRouter با کلید فعال است اما دیگر سرِ زنجیره نیست — اولویت اول کاربر جمینی است (۴ نوامبر ۲۰۲۶)', () => {
    const chain = buildDefaultChain(
      { OPENROUTER_API_KEY: 'sk-or-v1-test-123', GEMINI_API_KEY: 'gem-key-123' }, undefined
    );
    expect(chain[0].id).toBe('gemini');
    expect(chain[0].enabled).toBe(true);
    expect(chain[0].label).toContain('پیش‌فرض');
    const or = chain.find((p) => p.id === 'openrouter')!;
    expect(or.enabled).toBe(true);
    expect(or.maxAttempts).toBe(1); // در ۴۲۹ بی‌درنگ به مدل بعدی — سهمیهٔ رایگان روزانه تمام‌شدنی است
    const ids = chain.map((p) => p.id);
    expect(ids.indexOf('zai')).toBeLessThan(ids.indexOf('openrouter'));
  });

  test('استخر چندکلید جمینی — هر کلید یک ورودی مستقل به ترتیب و بعد از همه GLM', () => {
    const chain = buildDefaultChain({ GEMINI_API_KEY: 'env-key' }, undefined, {}, ['pool-key-1', 'pool-key-2']);
    const gem = chain.filter((p) => p.id.startsWith('gemini'));
    expect(gem.map((p) => p.apiKey)).toEqual(['pool-key-1', 'pool-key-2', 'env-key']);
    expect(gem[0].id).toBe('gemini');
    expect(gem[1].id).toBe('gemini-2');
    expect(gem[2].id).toBe('gemini-3');
    expect(chain[gem.length].id).toBe('zai');
  });

  test('ذکر gemini در تعریف سفارشی، کل استخر جمینی را جابه‌جا می‌کند', () => {
    const defaults = buildDefaultChain({}, undefined, {}, ['k1', 'k2']);
    const out = applyCustomProviders(defaults, JSON.stringify([{ id: 'zai' }, { id: 'gemini' }]));
    expect(out[0].id).toBe('zai');
    expect(out[1].id).toBe('gemini');
    expect(out[2].id).toBe('gemini-2');
  });

  test('بدون کلید OpenRouter — ترتیب سابق حفظ می‌شود (gemini، zai، pollinations)', () => {
    const chain = buildDefaultChain({ GEMINI_API_KEY: 'gem-key-123' }, undefined);
    const ids = chain.map((p) => p.id);
    expect(ids.indexOf('gemini')).toBe(0);
    expect(ids.indexOf('zai')).toBe(1);
    expect(ids.indexOf('pollinations')).toBe(2);
    expect(ids.indexOf('openrouter')).toBeGreaterThan(2); // غیرفعال، در انتهای زنجیرهٔ رایگان
  });

  test('Pollinations بدون کلید همیشه فعال است — بعد از GLM', () => {
    const chain = buildDefaultChain({}, undefined);
    const ids = chain.map((p) => p.id);
    expect(ids.indexOf('gemini')).toBe(0); // غیرفعال اما حاضر
    expect(ids.indexOf('zai')).toBe(1);
    expect(ids.indexOf('pollinations')).toBe(2);
    const pol = chain.find((p) => p.id === 'pollinations')!;
    expect(pol.enabled).toBe(true);
    expect(pol.apiKey).toBeUndefined(); // بدون کلید
    expect(pol.baseUrl).toBe('https://text.pollinations.ai/openai');
    expect(pol.minIntervalMs).toBeGreaterThanOrEqual(30000); // محدودیت سخت رایگان
  });

  test('ترتیب کامل با کلید جمینی: gemini ← zai ← pollinations', () => {
    const ids = buildDefaultChain({ GEMINI_API_KEY: 'AQ.full-order-key' }, undefined).map((p) => p.id);
    expect(ids.slice(0, 3)).toEqual(['gemini', 'zai', 'pollinations']);
  });

  test('تعریف سفارشی، پشتیبان رایگان همیشه‌فعال را از زنجیره حذف نمی‌کند', () => {
    const defaults = buildDefaultChain({}, undefined);
    const out = applyCustomProviders(defaults, JSON.stringify([{ id: 'groq', enabled: true, apiKey: 'k' }]));
    expect(out.find((p) => p.id === 'pollinations')).toBeDefined(); // به انتهای زنجیره اضافه می‌شود
    expect(out.find((p) => p.id === 'pollinations')!.enabled).toBe(true);
    expect(out[out.length - 1].id).toBe('pollinations');
  });

  test('مدل پیش‌فرض هر تأمین‌کننده با متغیر MODEL قابل بازنویسی است', () => {
    const chain = buildDefaultChain({ GROQ_API_KEY: 'k', GROQ_MODEL: 'llama-3.1-8b-instant' }, undefined);
    expect(chain.find((p) => p.id === 'groq')!.model).toBe('llama-3.1-8b-instant');
  });
});

// ---------- تعریف سفارشی ----------

describe('applyCustomProviders — تعریف سفارشی زنجیره', () => {
  test('JSON نامعتبر یا خالی → زنجیره پیش‌فرض', () => {
    const defaults = buildDefaultChain({}, undefined);
    expect(applyCustomProviders(defaults, 'نه-جیسون')).toEqual(defaults);
    expect(applyCustomProviders(defaults, '')).toEqual(defaults);
    expect(applyCustomProviders(defaults, '{"id":1}')).toEqual(defaults); // آرایه نیست
  });

  test('zai همیشه در دسترس می‌ماند مگر صریحاً غیرفعال شود', () => {
    const defaults = buildDefaultChain({}, undefined);
    const kept = applyCustomProviders(defaults, JSON.stringify([{ id: 'groq', enabled: true, apiKey: 'k' }]));
    expect(kept[0].id).toBe('zai');
    expect(kept.map((p) => p.id)).toContain('groq');

    const disabled = applyCustomProviders(defaults, JSON.stringify([{ id: 'zai', enabled: false }, { id: 'groq', enabled: true }]));
    expect(disabled[0].id).toBe('groq');
    expect(disabled.find((p) => p.id === 'zai')!.enabled).toBe(false);
  });

  test('تعریف سفارشی می‌تواند جمینی را بازنویسی کند و پشتیبان رایگان حذف نمی‌شود', () => {
    const defaults = buildDefaultChain({ GEMINI_API_KEY: 'AQ.custom-override' }, undefined);
    const out = applyCustomProviders(defaults, JSON.stringify([
      { id: 'gemini', model: 'gemini-2.5-pro', apiKey: 'AQ.brand-new-key' },
    ]));
    const gem = out.find((p) => p.id === 'gemini')!;
    expect(gem.model).toBe('gemini-2.5-pro');
    expect(gem.apiKey).toBe('AQ.brand-new-key');
    expect(gem.enabled).toBe(true);
    expect(out[0].id).toBe('gemini');
    expect(out.find((p) => p.id === 'pollinations')!.enabled).toBe(true);
  });

  test('id شناخته‌شده تنظیم همان تأمین‌کننده را بازنویسی می‌کند', () => {
    const defaults = buildDefaultChain({}, undefined);
    const out = applyCustomProviders(defaults, JSON.stringify([{ id: 'fcc', baseUrl: 'http://myhost:1234/v1', model: 'claude-sonnet-4-5' }]));
    const fcc = out.find((p) => p.id === 'fcc')!;
    expect(fcc.baseUrl).toBe('http://myhost:1234/v1');
    expect(fcc.model).toBe('claude-sonnet-4-5');
    expect(fcc.enabled).toBe(true); // ذکر در فهرست یعنی فعال
  });

  test('تأمین‌کننده تازه فقط با baseUrl معتبر پذیرفته می‌شود', () => {
    const defaults = buildDefaultChain({}, undefined);
    const out = applyCustomProviders(defaults, JSON.stringify([
      { id: 'my-local', baseUrl: 'http://127.0.0.1:5000/v1', label: 'سرور من' },
      { id: 'broken', model: 'x' }, // بدون baseUrl — رد می‌شود
    ]));
    const mine = out.find((p) => p.id === 'my-local')!;
    expect(mine.label).toBe('سرور من');
    expect(mine.kind).toBe('openai-compatible');
    expect(out.find((p) => p.id === 'broken')).toBeUndefined();
  });
});

// ---------- هسته انتقال خطا ----------

function fakeChain(ids: string[]): ProviderConfig[] {
  return ids.map((id) => ({ id, label: id.toUpperCase(), kind: 'openai-compatible' as const, baseUrl: 'http://x/v1', enabled: true }));
}

describe('runChain — انتقال خودکار خطا', () => {
  test('مدل اول خطا داد → مدل دوم خودکار پاسخ می‌دهد', async () => {
    const calls: string[] = [];
    const r = await runChain(fakeChain(['a', 'b']), async (p) => {
      calls.push(p.id);
      return p.id === 'a' ? { ok: false, error: 'HTTP 500: internal' } : { ok: true, content: 'پاسخ مدل B' };
    }, { on429WaitMs: 1 });
    expect(r.ok).toBe(true);
    expect(r.providerId).toBe('b');
    expect(r.content).toBe('پاسخ مدل B');
    expect(calls).toEqual(['a', 'b']);
  });

  test('خطای ۴۲۹ دوباره همان مدل را امتحان می‌کند و سپس می‌رود مدل بعدی', async () => {
    const calls: string[] = [];
    const r = await runChain(fakeChain(['a', 'b']), async (p) => {
      calls.push(p.id);
      return p.id === 'a' ? { ok: false, rateLimited: true, error: 'HTTP 429' } : { ok: true, content: 'ok' };
    }, { on429WaitMs: 1 });
    expect(r.ok).toBe(true);
    expect(r.providerId).toBe('b');
    expect(calls).toEqual(['a', 'a', 'b']); // دو تلاش روی a، سپس b
  });

  test('maxAttempts اختصاصی تأمین‌کننده بر پیش‌فرض عمومی مقدم است', async () => {
    const calls: string[] = [];
    const chain = fakeChain(['zai', 'b']);
    chain[0].maxAttempts = 3;
    const r = await runChain(chain, async (p) => {
      calls.push(p.id);
      return p.id === 'zai' ? { ok: false, rateLimited: true, error: 'HTTP 429' } : { ok: true, content: 'ok' };
    }, { on429WaitMs: 1 });
    expect(r.ok).toBe(true);
    expect(r.providerId).toBe('b');
    expect(calls).toEqual(['zai', 'zai', 'zai', 'b']); // ۳ تلاش روی GLM، سپس مدل بعدی
  });

  test('همه مدل‌ها شکست خوردند → خطای تجمیعی صادقانه با دلیل هرکدام', async () => {
    const r = await runChain(fakeChain(['a', 'b']), async (p) => ({
      ok: false,
      error: p.id === 'a' ? 'HTTP 429: Too many requests' : 'HTTP 401: bad key',
    }), { on429WaitMs: 1 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('همه مدل‌های زنجیره خطا دادند');
    expect(r.error).toContain('a');
    expect(r.error).toContain('HTTP 429');
    expect(r.error).toContain('b');
    expect(r.error).toContain('HTTP 401');
  });

  test('تأمین‌کننده غیرفعال رد می‌شود', async () => {
    const calls: string[] = [];
    const chain = fakeChain(['off', 'on']);
    chain[0].enabled = false;
    const r = await runChain(chain, async (p) => {
      calls.push(p.id);
      return { ok: true, content: 'x' };
    }, { on429WaitMs: 1 });
    expect(r.ok).toBe(true);
    expect(r.providerId).toBe('on');
    expect(calls).toEqual(['on']);
  });

  test('زنجیره خالی/کاملاً غیرفعال → خطای شفاف', async () => {
    const r = await runChain([], async () => ({ ok: true, content: 'x' }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('هیچ تأمین‌کننده فعالی');
  });

  test('استثنای پرتاب‌شده در فراخوانی، مثل خطا مدیریت می‌شود', async () => {
    const r = await runChain(fakeChain(['boom', 'good']), async (p) => {
      if (p.id === 'boom') throw new Error('network down');
      return { ok: true, content: 'سلام' };
    }, { on429WaitMs: 1 });
    expect(r.ok).toBe(true);
    expect(r.providerId).toBe('good');
    const boomAttempt = r.attempts.find((a) => a.id === 'boom')!;
    expect(boomAttempt.ok).toBe(false);
    expect(boomAttempt.error).toContain('network down');
  });
});

// ---------- فراخوانی سازگار با OpenAI ----------

describe('openAiCompatibleCall — فراخوانی سازگار با OpenAI', () => {
  test('پاسخ ۲۰۰ استاندارد → محتوا استخراج می‌شود', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | null = null;
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init || null;
      return new Response(JSON.stringify({ choices: [{ message: { content: 'پاسخ آزمایشی' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await openAiCompatibleCall({ baseUrl: 'http://test/v1/', model: 'm1', systemPrompt: 'sys', userContent: 'usr', apiKey: 'key123' });
    expect(r.ok).toBe(true);
    expect(r.content).toBe('پاسخ آزمایشی');
    // آدرس بدون اسلش اضافه و هدر کلید
    expect(capturedUrl).toBe('http://test/v1/chat/completions');
    const init = capturedInit as unknown as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key123');
    // نقش پیام سیستم در بدنه درست است
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('m1');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
  });

  test('خطای ۴۲۹ → rateLimited برای تلاش مجدد', async () => {
    globalThis.fetch = (async () => new Response('{"error":"Too many requests"}', { status: 429 })) as unknown as typeof fetch;
    const r = await openAiCompatibleCall({ baseUrl: 'http://test/v1', model: 'm1', systemPrompt: 's', userContent: 'u' });
    expect(r.ok).toBe(false);
    expect(r.rateLimited).toBe(true);
    expect(r.error).toContain('429');
  });

  test('خطای ۵۰۰ → rateLimited نیست → زنجیره مستقیم می‌رود مدل بعدی', async () => {
    globalThis.fetch = (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch;
    const r = await openAiCompatibleCall({ baseUrl: 'http://test/v1', model: 'm1', systemPrompt: 's', userContent: 'u' });
    expect(r.ok).toBe(false);
    expect(r.rateLimited).toBe(false);
  });

  test('اتصال برقرار نشد → خطای واضح، بدون استثنا', async () => {
    globalThis.fetch = (async () => { throw new TypeError('fetch failed: ECONNREFUSED'); }) as unknown as typeof fetch;
    const r = await openAiCompatibleCall({ baseUrl: 'http://dead.local/v1', model: 'm1', systemPrompt: 's', userContent: 'u', timeoutMs: 1000 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('fetch failed');
  });
});

// ---------- فاصله‌سنج تأمین‌کننده ----------

describe('providerCooldownRemaining — فاصله‌سنج هر تأمین‌کننده', () => {
  const pol: ProviderConfig = { id: 'pollinations', label: 'p', kind: 'openai-compatible', enabled: true, minIntervalMs: 31000 };
  const plain: ProviderConfig = { id: 'groq', label: 'g', kind: 'openai-compatible', enabled: true };

  test('بدون سابقه فراخوانی → صفر (مجاز)', () => {
    expect(providerCooldownRemaining(pol, undefined, Date.now())).toBe(0);
  });

  test('تأمین‌کننده بدون minInterval → همیشه صفر', () => {
    expect(providerCooldownRemaining(plain, Date.now(), Date.now())).toBe(0);
  });

  test('تازه فراخوانی‌شده → مانده فاصله مثبت؛ پس از گذر زمان → صفر', () => {
    const now = 1_000_000;
    expect(providerCooldownRemaining(pol, now - 5_000, now)).toBe(26_000);
    expect(providerCooldownRemaining(pol, now - 31_000, now)).toBe(0);
    expect(providerCooldownRemaining(pol, now - 40_000, now)).toBe(0);
  });
});

// ---------- قطع‌کن مدار ----------

describe('قطع‌کن مدار — توقف تلاش پس‌زمینه هنگام ۴۲۹ پیاپی', () => {
  test('تلاش موفق قطع‌کن را صفر می‌کند', () => {
    noteAttemptOutcome(true, 'x');
    // اگر قبلاً باز شده بود، موفقیت بسته‌اش می‌کند
    noteAttemptOutcome(false, 'HTTP 429: Too many requests');
    noteAttemptOutcome(false, 'HTTP 429: Too many requests');
    noteAttemptOutcome(true, undefined);
    expect(isBackgroundPaused()).toBe(false);
  });

  test('۶ خطای ۴۲۹ پیاپی → قطع‌کن باز می‌شود؛ خطای غیر۴۲۹ باز نمی‌کند', () => {
    for (let i = 0; i < 5; i++) noteAttemptOutcome(false, 'HTTP 429: rate limit');
    expect(isBackgroundPaused()).toBe(false); // هنوز به آستانه نرسیده
    noteAttemptOutcome(false, 'HTTP 429: rate limit'); // ششمین
    expect(isBackgroundPaused()).toBe(true); // باز شد
    noteAttemptOutcome(true, undefined); // بسته شدن
    expect(isBackgroundPaused()).toBe(false);
  });

  test('خطاهای غیر۴۲۹ روی قطع‌کن اثر نمی‌گذارند', () => {
    for (let i = 0; i < 10; i++) noteAttemptOutcome(false, 'HTTP 500: internal');
    expect(isBackgroundPaused()).toBe(false);
  });
});
