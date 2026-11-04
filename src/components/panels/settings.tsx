'use client';
/**
 * تنظیمات مدل و API + زمان‌بندی + هزینه و مصرف + خطاها (فصل ۱۲ بند ۱۱-۱۴)
 */
import { useCallback, useEffect, useState } from 'react';
import { api, faNum, faDateTime, statusStyle, PLATFORM_LABELS } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Save, PlugZap, AlertTriangle, Coins, Timer, Bot, Send } from 'lucide-react';
import { LoadingCard } from './dashboard';

// ---------- تنظیمات مدل و API ----------
interface ProviderRow {
  id: string; label: string; kind: string; enabled: boolean; hasKey: boolean;
  baseUrl: string | null; model: string; note: string | null;
  lastError: { error: string; at: string } | null; lastSuccessAt: string | null;
}

export function AiSettingsPanel() {
  const [model, setModel] = useState('glm-4.5-air');
  const [apiKey, setApiKey] = useState('');
  const [keyInfo, setKeyInfo] = useState<{ exists: boolean; masked?: string; updatedAt?: string }>({ exists: false });
  const [budget, setBudget] = useState(200000);
  const [testResult, setTestResult] = useState<{ status: string; detail: string } | null>(null);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const loadProviders = useCallback(async () => {
    const r = await api<{ providers: ProviderRow[] }>('/api/ai/providers');
    if (r.ok) setProviders(r.providers || []);
  }, []);

  useEffect(() => {
    (async () => {
      const r = await api<{ settings: Record<string, unknown>; apiKey: { exists: boolean; masked?: string; updatedAt?: string } }>('/api/settings');
      if (r.ok) {
        if (r.settings.ai_model) setModel(String(r.settings.ai_model));
        if (r.settings.ai_budget) setBudget(Number((r.settings.ai_budget as { dailyTokenLimit?: number }).dailyTokenLimit || 200000));
        setKeyInfo(r.apiKey);
      }
    })();
    loadProviders();
  }, [loadProviders]);

  const save = async () => {
    setBusy(true);
    const r = await api('/api/settings', {
      method: 'POST',
      body: {
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        settings: { ai_model: model, ai_budget: { dailyTokenLimit: budget } },
      },
    });
    setBusy(false);
    toast({ title: r.ok ? 'تنظیمات ذخیره شد' : 'خطا', description: r.ok ? 'کلید رمزنگاری‌شده سمت سرور ذخیره می‌شود' : r.error, variant: r.ok ? 'default' : 'destructive' });
    if (r.ok) { setApiKey(''); const g = await api<{ apiKey: { exists: boolean; masked?: string } }>('/api/settings'); if (g.ok) setKeyInfo(g.apiKey); }
  };

  const test = async () => {
    setBusy(true);
    const r = await api<{ status: string; detail: string; model: string }>('/api/settings/ai/test', { method: 'POST' });
    setBusy(false);
    if (r.ok) setTestResult({ status: r.status, detail: r.detail });
    else setTestResult({ status: 'ناموفق', detail: r.error || 'خطا' });
    loadProviders();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">تنظیمات مدل و API</h2>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>مدل پیش‌فرض</Label>
              <Input dir="ltr" value={model} onChange={(e) => setModel(e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">نام مدل در هر اجرا ثبت می‌شود تا خروجی‌ها قابل ردیابی باشند.</p>
            </div>
            <div>
              <Label>سقف مصرف روزانه (توکن تقریبی)</Label>
              <Input type="number" value={budget} min={1000} onChange={(e) => setBudget(Number(e.target.value))} dir="ltr" />
              <p className="text-xs text-slate-400 mt-1">در عبور از سقف، فراخوانی‌های جدید با پیام صریح رد می‌شوند و داده ساختگی تولید نمی‌شود.</p>
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1"><KeyRound className="h-4 w-4" /> کلید API سرور مدل</Label>
            <div className="flex gap-2 mt-1">
              <Input dir="ltr" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={keyInfo.exists ? `ذخیره شده: ${keyInfo.masked}` : 'کلید سرور سازگار-OpenAI مثل FCC (اختیاری)'} />
              <Button variant="outline" onClick={() => api('/api/settings', { method: 'POST', body: { clearApiKey: true } }).then(() => { setKeyInfo({ exists: false }); toast({ title: 'کلید حذف شد' }); })} disabled={!keyInfo.exists}>حذف</Button>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-6">
              این کلید برای تأمین‌کننده FCC (free-claude-code) استفاده می‌شود. برای فعال‌شدن FCC آدرس سرور را در FCC_BASE_URL یا تعریف زنجیره تنظیم کنید؛ بدون کلید و آدرس، FCC به‌صورت شفاف رد می‌شود.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}><Save className="h-4 w-4 ml-1" /> ذخیره</Button>
            <Button variant="outline" onClick={test} disabled={busy}><PlugZap className="h-4 w-4 ml-1" /> تست اتصال</Button>
          </div>
          {testResult && (
            <div className={`text-sm rounded-lg p-3 border ${testResult.status === 'موفق' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              <b>تست اتصال: {testResult.status}</b> — {testResult.detail}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4" /> زنجیره مدل‌ها — انتقال خودکار خطا (fallback)</CardTitle></CardHeader>
        <CardContent className="grid gap-1.5">
          <p className="text-xs text-slate-500 leading-6">
            اگر مدل اول خطا داد (مثل محدودیت نرخ ۴۲۹ یا تحریم جغرافیایی)، به‌صورت خودکار مدل بعدی امتحان می‌شود — الگوی پروژه free-claude-code. تأمین‌کنندهٔ اول زنجیره «Gemini» است و پشتیبان اول سرویس داخلی GLM؛ مدل‌های Groq، OpenRouter، NVIDIA، GitHub Models و Together با کلیدشان فعال می‌شوند.
          </p>
          {providers.map((p, i) => (
            <div key={p.id} className="text-xs border rounded p-2 flex flex-wrap items-center gap-2">
              <span className="text-slate-400 w-5 text-center">{i + 1}</span>
              <Badge className={p.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-600'}>{p.enabled ? 'فعال' : 'غیرفعال'}</Badge>
              <b>{p.label}</b>
              <span dir="ltr" className="text-slate-400">{p.model}</span>
              {p.lastSuccessAt && <Badge variant="outline" className="text-emerald-700">آخرین موفقیت: {faDateTime(p.lastSuccessAt)}</Badge>}
              {p.lastError && <span className="text-rose-600 truncate max-w-72">آخرین خطا: {p.lastError.error}</span>}
              {p.note && <span className="text-slate-400">{p.note}</span>}
            </div>
          ))}
        </CardContent>
      </Card>

      <GeminiKeysPanel />
      <ProviderKeysPanel />
    </div>
  );
}

// ---------- مدیریت کلید تأمین‌کنندگان + مانده توکن ----------
interface KeysProviderRow {
  id: string; label: string; kind: string; enabled: boolean; model: string | null;
  baseUrl: string | null; note: string | null; hasKey: boolean; keyMasked: string | null;
  keySource: string | null; isDefault: boolean; known: boolean;
  usageToday: { tokens: number; ok: number; fail: number };
}

export function ProviderKeysPanel() {
  const [providers, setProviders] = useState<KeysProviderRow[]>([]);
  const [openrouter, setOpenrouter] = useState<{ remainingUSD?: number | null; usedUSD?: number; limitUSD?: number | null; note?: string }>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<{ providers: KeysProviderRow[]; openrouter: { remainingUSD?: number | null; usedUSD?: number; limitUSD?: number | null; note?: string } }>('/api/ai/keys');
    if (r.ok) { setProviders(r.providers || []); setOpenrouter(r.openrouter || {}); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveKey = async (id: string) => {
    const key = (inputs[id] || '').trim();
    if (!key) return;
    setBusyId(id);
    const r = await api<{ masked: string }>('/api/ai/keys', { method: 'POST', body: { providerId: id, apiKey: key } });
    setBusyId(null);
    toast({ title: r.ok ? 'کلید ذخیره شد (رمزنگاری‌شده)' : 'خطا', description: r.ok ? r.masked : r.error, variant: r.ok ? 'default' : 'destructive' });
    if (r.ok) { setInputs({ ...inputs, [id]: '' }); load(); }
  };
  const removeKey = async (id: string) => {
    setBusyId(id);
    const r = await api('/api/ai/keys', { method: 'POST', body: { providerId: id, remove: true } });
    setBusyId(null);
    if (r.ok) { toast({ title: 'کلید حذف شد' }); load(); }
  };

  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> کلیدهای تأمین‌کنندگان و مانده/مصرف توکن</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        <p className="text-xs text-slate-500 leading-6">
          کلید هر تأمین‌کننده را جداگانه اضافه کنید — ذخیره‌سازی سمت سرور و رمزنگاری‌شده است و کلید هرگز به مرورگر برنمی‌گردد.
          مصرف توکن از فراخوانی‌های واقعی امروز ثبت می‌شود. سرِ زنجیره «Gemini» است (اولویت اول کاربر)؛ برای استخر چندکلید جمینی از بخش «کلیدهای جمینی» بالای همین جدول استفاده کنید.
        </p>
        {providers.map((p, i) => (
          <div key={p.id} className="text-xs border rounded-lg p-2.5 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 w-5 text-center">{faNum(i + 1)}</span>
              <Badge className={p.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-600'}>{p.enabled ? 'فعال' : 'غیرفعال'}</Badge>
              <b>{p.label}</b>
              {p.isDefault && <Badge className="bg-teal-100 text-teal-800">پیش‌فرض</Badge>}
              {p.keyMasked && <span dir="ltr" className="text-slate-400">{p.keyMasked}</span>}
              {p.keySource && <Badge variant="outline">{p.keySource === 'settings' ? 'کلید از تنظیمات' : 'کلید از محیط'}</Badge>}
              <span className="ml-auto text-slate-500">
                مصرف امروز: {faNum(p.usageToday.tokens)} توکن · موفق {faNum(p.usageToday.ok)} · ناموفق {faNum(p.usageToday.fail)}
              </span>
            </div>
            {p.id === 'openrouter' && openrouter && (openrouter.note || openrouter.usedUSD !== undefined) && (
              <div className="text-[11px] text-slate-500">
                ماندهٔ حساب OpenRouter: {openrouter.remainingUSD !== null && openrouter.remainingUSD !== undefined
                  ? `${faNum(Math.round(openrouter.remainingUSD * 100) / 100)} دلار باقی‌مانده از ${openrouter.limitUSD === null || openrouter.limitUSD === undefined ? 'نامحدود' : faNum(openrouter.limitUSD) + ' دلار'}`
                  : (openrouter.note || 'نامشخص')}
              </div>
            )}
            {p.id !== 'zai' && p.id !== 'pollinations' && (
              <div className="flex gap-2">
                <Input dir="ltr" type="password" className="h-8 text-xs" placeholder={p.keyMasked ? `ذخیره‌شده: ${p.keyMasked} — کلید تازه را وارد کنید` : 'کلید API...'}
                  value={inputs[p.id] || ''} onChange={(e) => setInputs({ ...inputs, [p.id]: e.target.value })} />
                <Button size="sm" className="h-8" onClick={() => saveKey(p.id)} disabled={busyId === p.id || !(inputs[p.id] || '').trim()}>ذخیره</Button>
                {p.keySource === 'settings' && <Button size="sm" variant="outline" className="h-8" onClick={() => removeKey(p.id)} disabled={busyId === p.id}>حذف</Button>}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------- کلیدهای جمینی — افزودن/حذف چند کلید + اتصال به ربات (خواستهٔ کاربر ۴ نوامبر ۲۰۲۶) ----------
interface GeminiKeysData {
  keys: Array<{ masked: string; label: string | null; addedAt: string }>;
  keysCount: number;
  maxKeys: number;
  envKeyMasked: string | null;
  hasPat: boolean;
  patMasked: string | null;
  repo: string;
}

export function GeminiKeysPanel() {
  const [data, setData] = useState<GeminiKeysData | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [pat, setPat] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<GeminiKeysData>('/api/gemini-keys');
    if (r.ok) setData(r);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const key = newKey.trim();
    if (!key) return;
    setBusy('add');
    const r = await api<{ added: string }>('/api/gemini-keys', { method: 'POST', body: { apiKey: key, label: newLabel.trim() } });
    setBusy(null);
    toast({ title: r.ok ? 'کلید جمینی افزوده شد (رمزنگاری‌شده)' : 'خطا', description: r.ok ? r.added : r.error, variant: r.ok ? 'default' : 'destructive' });
    if (r.ok) { setNewKey(''); setNewLabel(''); load(); }
  };
  const remove = async (idx: number) => {
    setBusy(`rm-${idx}`);
    const r = await api('/api/gemini-keys', { method: 'POST', body: { removeIndex: idx } });
    setBusy(null);
    if (r.ok) { toast({ title: 'کلید حذف شد' }); load(); }
    else toast({ title: 'خطا', description: r.error, variant: 'destructive' });
  };
  const savePat = async () => {
    const p = pat.trim();
    if (!p) return;
    setBusy('pat');
    const r = await api<{ savedPat: string }>('/api/gemini-keys', { method: 'POST', body: { pat: p } });
    setBusy(null);
    toast({ title: r.ok ? 'توکن گیت‌هاب ذخیره شد (رمزنگاری‌شده)' : 'خطا', description: r.ok ? r.savedPat : r.error, variant: r.ok ? 'default' : 'destructive' });
    if (r.ok) { setPat(''); load(); }
  };
  const sync = async () => {
    setBusy('sync');
    const r = await api<{ synced: number; detail: string }>('/api/gemini-keys', { method: 'POST', body: { syncToBot: true } });
    setBusy(null);
    toast({ title: r.ok ? 'با ربات همگام شد' : 'خطا', description: r.ok ? r.detail : r.error, variant: r.ok ? 'default' : 'destructive' });
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> کلیدهای جمینی — استخر چندکلید (اولویت اول زنجیره) و اتصال به ربات</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-xs">
        <p className="text-slate-500 leading-6">
          هر کلید یک ورودی مستقل زنجیره است: کلید اول اولویت اول دارد؛ در خطا یا سهمیهٔ روزانه (۴۲۹) کلید بعدی خودکار چرخش می‌شود —
          با هر کلید اضافه، سهمیهٔ روزانهٔ جمینی چندبرابر می‌شود. همین استخر با «همگام‌سازی با ربات» در سکرت
          <code dir="ltr"> GEMINI_API_KEYS </code>ریپو ربات نوشته می‌شود تا ربات بله هم از همین کلیدها (اولویت اول) استفاده کند.
        </p>
        {data?.envKeyMasked && (
          <p className="text-slate-400">کلید محیط (<code dir="ltr">GEMINI_API_KEY</code>): <span dir="ltr">{data.envKeyMasked}</span> — پس از کلیدهای افزوده‌شده به‌کار می‌رود.</p>
        )}
        <div className="space-y-1.5">
          {data?.keys.map((k, i) => (
            <div key={i} className="border rounded p-2 flex flex-wrap items-center gap-2">
              <span className="text-slate-400 w-5 text-center">{faNum(i + 1)}</span>
              <Badge className="bg-teal-100 text-teal-800">اولویت {faNum(i + 1)}</Badge>
              <b>{k.label || 'کلید جمینی'}</b>
              <span dir="ltr" className="text-slate-400">{k.masked}</span>
              <span className="text-slate-400">افزوده: {faDateTime(k.addedAt)}</span>
              <Button size="sm" variant="outline" className="h-7 text-xs ms-auto" onClick={() => remove(i)} disabled={busy === `rm-${i}`}>حذف</Button>
            </div>
          ))}
          {data && data.keysCount === 0 && <p className="text-slate-400 py-1">هنوز کلیدی افزوده نشده — زنجیره از کلید محیط استفاده می‌کند.</p>}
        </div>
        <div className="grid md:grid-cols-[1fr_2fr_auto] gap-2 items-end">
          <div>
            <Label>عنوان (اختیاری)</Label>
            <Input className="h-8 text-xs" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="مثل کلید دوم استودیو" />
          </div>
          <div>
            <Label>کلید API جمینی</Label>
            <Input dir="ltr" type="password" className="h-8 text-xs" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="AQ.... یا AIza..." />
          </div>
          <Button size="sm" className="h-8" onClick={add} disabled={busy === 'add' || !newKey.trim()}>افزودن</Button>
        </div>
        <div className="border-t pt-2 space-y-1.5">
          <p className="text-slate-500 leading-6">
            اتصال به ربات: توکن گیت‌هاب با دسترسی repo ذخیره کنید تا «همگام‌سازی» کلیدها را در سکرت‌های ریپو
            <span dir="ltr"> {data?.repo || 'hoiokhoo/raadban'} </span>بنویسد. توکن رمزنگاری‌شده سمت سرور می‌ماند و هرگز نمایش داده نمی‌شود.
          </p>
          <div className="grid md:grid-cols-[2fr_auto_auto] gap-2 items-end">
            <Input dir="ltr" type="password" className="h-8 text-xs" value={pat} onChange={(e) => setPat(e.target.value)} placeholder={data?.patMasked ? `ذخیره‌شده: ${data.patMasked}` : 'ghp_... (توکن با دسترسی repo)'} />
            <Button size="sm" variant="outline" className="h-8" onClick={savePat} disabled={busy === 'pat' || !pat.trim()}>ذخیره توکن</Button>
            <Button size="sm" className="h-8" onClick={sync} disabled={busy === 'sync'}>همگام‌سازی با ربات</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- بات بله ----------
interface BaleStatus {
  bot: { hasToken: boolean; masked: string | null; ok?: boolean; username?: string; error?: string };
  chatId: string | null;
  digest: { enabled: boolean; intervalMin: number; maxPosts: number; sendOnEmpty: boolean; lastSentAt: string | null; lastTryAt: string | null };
  daily: { enabled: boolean; dailyTime: string; lastSentDate: string | null; lastTryAt: string | null };
  lastJobs: Array<{ status: string; startedAt: string; error: string | null; durationMs: number | null; targetId?: string }>;
}

// ---------- پیش‌نمایش لیست نهایی ارسال به بله ----------
interface PreviewItem {
  order: number;
  scope: 'خارجی' | 'داخلی';
  sourceName: string;
  platform?: string;
  message: string;
  text: string;
  imageUrl: string | null;
  sourcesCount: number;
  sourceNames: string[];
  isTweet: boolean;
  isTranslated: boolean;
  publishedAt: string | null;
  url: string | null;
}

interface BalePreviewData {
  windowFrom: string;
  windowTo: string;
  totalInWindow: number;
  alreadySent: number;
  pendingGroups: number;
  items: PreviewItem[];
  note: string;
}

function BalePreviewCard() {
  const [preview, setPreview] = useState<BalePreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImages, setShowImages] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await api<BalePreviewData>('/api/bale/preview');
    if (r.ok) setPreview(r);
    else setError(r.error || 'پیش‌نمایش ناموفق بود');
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Send className="h-4 w-4 text-teal-600" /> پیش‌نمایش لیست نهایی ارسال به بله</CardTitle>
          <Badge variant="outline">صف بعدی: {faNum(preview?.items.length ?? 0)} خبر</Badge>
          {preview && (
            <>
              <Badge variant="outline">در بازه: {faNum(preview.totalInWindow)}</Badge>
              {preview.alreadySent > 0 && <Badge variant="outline">قبلاً ارسال‌شده (حذف‌شده): {faNum(preview.alreadySent)}</Badge>}
            </>
          )}
          <div className="ms-auto flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={load} disabled={loading}>
              {loading ? '...' : 'به‌روزرسانی'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        {loading && <LoadingCard title="پیش‌نمایش" />}
        {error && <p className="text-rose-600">{error}</p>}
        {preview && !loading && (
          <>
            <p className="text-slate-500 leading-5">
              بازه: از {faDateTime(preview.windowFrom)} تا {faDateTime(preview.windowTo)} — ترتیب واقعی: خارجی اول، داخلی بعد.
              همین پیام‌ها در چرخهٔ بعدی جداگانه (هر خبر یک پیام) به کانال بله می‌رود؛ عکسِ هر خبر بالای همان پیام.
            </p>
            {preview.items.length === 0 && (
              <p className="text-slate-400 py-2">در این بازه خبر تازه‌ای در صف ارسال نیست — چرخهٔ بعدی بعد از دریافت منابع دوباره پُر می‌شود.</p>
            )}
            <div className="space-y-2">
              {preview.items.map((it) => (
                <div key={it.order} className="border rounded-lg p-2.5 bg-slate-50 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="bg-teal-700 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-[10px]">{faNum(it.order)}</span>
                    <Badge className={it.scope === 'خارجی' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}>{it.scope}</Badge>
                    <b>{it.sourceName}</b>
                    {it.platform && <Badge variant="outline">{PLATFORM_LABELS[it.platform] || it.platform}</Badge>}
                    {it.isTweet && <Badge className="bg-sky-100 text-sky-800">توییت</Badge>}
                    {it.isTweet && !it.isTranslated && <Badge className="bg-amber-100 text-amber-800">بدون ترجمهٔ ثبت‌شده</Badge>}
                    {it.sourcesCount > 1 && <Badge className="bg-violet-100 text-violet-800">تجمیع: {faNum(it.sourcesCount)} منبع</Badge>}
                  </div>
                  <div className="flex gap-2">
                    {showImages && it.imageUrl && (
                      <img src={it.imageUrl} alt="" className="w-20 h-20 object-cover rounded border shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] leading-6 whitespace-pre-wrap break-words">{it.text}</p>
                      {it.sourceNames.length > 1 && (
                        <p className="text-[11px] text-slate-400 mt-1">منابع این رویداد: {it.sourceNames.join('، ')}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 pt-1"><Switch checked={showImages} onCheckedChange={setShowImages} /> نمایش بندانگشتی عکس‌ها</label>
            <p className="text-slate-400 leading-5 border-t pt-2">{preview.note}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function BaleBotPanel() {
  const [st, setSt] = useState<BaleStatus | null>(null);
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [intervalMin, setIntervalMin] = useState(30);
  const [enabled, setEnabled] = useState(true);
  const [sendOnEmpty, setSendOnEmpty] = useState(false);
  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [dailyTime, setDailyTime] = useState('23:00');
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<BaleStatus>('/api/bale');
    if (r.ok) {
      setSt(r);
      setChatId(r.chatId || '');
      if (r.digest) { setIntervalMin(r.digest.intervalMin); setEnabled(r.digest.enabled); setSendOnEmpty(r.digest.sendOnEmpty); }
      if (r.daily) { setDailyEnabled(r.daily.enabled); setDailyTime(r.daily.dailyTime || '23:00'); }
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(String(body.action));
    const r = await api<Record<string, unknown>>('/api/bale', { method: 'POST', body });
    setBusy(null);
    toast({ title: r.ok ? okMsg : 'خطا', description: r.ok ? undefined : r.error, variant: r.ok ? 'default' : 'destructive' });
    load();
    return r;
  };

  if (!st) return <LoadingCard title="ربات بله" />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2"><Send className="h-5 w-5 text-teal-600" /> بات بله — گزارش خودکار</h2>
      <BalePreviewCard />
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className={st.bot.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>
              {st.bot.ok ? `بات @${st.bot.username} فعال` : 'بات غیرفعال'}
            </Badge>
            {st.bot.masked && <span dir="ltr" className="text-slate-400">توکن: {st.bot.masked}</span>}
            {st.chatId && <Badge variant="outline">شناسه چت: {st.chatId}</Badge>}
            {st.digest.lastSentAt && <Badge variant="outline">آخرین ارسال نیم‌ساعته: {faDateTime(st.digest.lastSentAt)}</Badge>}
            {st.daily.lastSentDate && <Badge variant="outline">آخرین گزارش روزانه: {st.daily.lastSentDate}</Badge>}
          </div>
          {!st.bot.ok && st.bot.error && <p className="text-xs text-rose-600">{st.bot.error}</p>}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>توکن بات بله (در صورت تغییر)</Label>
              <Input dir="ltr" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={st.bot.masked ? `ذخیره‌شده: ${st.bot.masked}` : 'مثل ۱۱۶۸۲۶۸۶۴۵:AA...'} />
            </div>
            <div>
              <Label>شناسه عددی چت (خالی = کشف خودکار با getUpdates)</Label>
              <div className="flex gap-2">
                <Input dir="ltr" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="مثل ۱۲۳۴۵۶۷۸۹ یا -۱۰۰..." />
                <Button variant="outline" onClick={() => act({ action: 'discover' }, 'شناسه چت کشف شد')} disabled={busy === 'discover'}>کشف خودکار</Button>
              </div>
              <p className="text-xs text-slate-400 mt-1">برای کشف خودکار، یک بار در بله بات را باز کنید و Start بزنید — بات فقط به شناسه عددی ارسال می‌کند.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3 items-end">
            <label className="flex items-center gap-2 text-sm"><Switch checked={enabled} onCheckedChange={setEnabled} /> گزارش خودکار فعال</label>
            <div>
              <Label>بازه گزارش (دقیقه)</Label>
              <Input type="number" min={5} max={720} value={intervalMin} onChange={(e) => setIntervalMin(Number(e.target.value))} dir="ltr" />
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={sendOnEmpty} onCheckedChange={setSendOnEmpty} /> پیام حتی بدون خبر تازه</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={dailyEnabled} onCheckedChange={setDailyEnabled} /> گزارش جامع روزانه</label>
            <div>
              <Label>ساعت گزارش روزانه (تهران)</Label>
              <Input type="time" value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} dir="ltr" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => act({ action: 'save', token: token.trim() || undefined, chatId: chatId.trim() || undefined, digest: { enabled, intervalMin, sendOnEmpty, dailyEnabled, dailyTime } }, 'تنظیمات بله ذخیره شد')} disabled={busy === 'save'}>
              <Save className="h-4 w-4 ml-1" /> ذخیره
            </Button>
            <Button variant="outline" onClick={() => act({ action: 'test' }, 'پیام تستی به بله ارسال شد')} disabled={busy === 'test'}><PlugZap className="h-4 w-4 ml-1" /> تست اتصال و ارسال</Button>
            <Button variant="outline" onClick={() => act({ action: 'digest' }, 'چرخه گزارش اجرا شد')} disabled={busy === 'digest'}><Send className="h-4 w-4 ml-1" /> اجرای فوری گزارش</Button>
            <Button variant="outline" onClick={() => act({ action: 'daily' }, 'گزارش جامع روزانه اجرا شد')} disabled={busy === 'daily'}><Send className="h-4 w-4 ml-1" /> اجرای گزارش روزانه</Button>
          </div>
          <p className="text-xs text-slate-500 leading-6">
            هر {faNum(intervalMin)} دقیقه: فقط اخبار سیاسی سراسر جهان و اظهارات شخصیت‌های سیاسی ← حذف کامل خبر تکراری ← هر خبر یک پیام جدا با عکس بالای خبر (در صورت وجود) و خلاصهٔ ۲-۳ خطی فارسی روان بدون هیچ حرف اضافه ← در پایان همهٔ اخبار، پیام راستی‌آزمایی با جست‌وجوی وب و نتیجه‌گیری منطقی.
            در پایان هر روز (ساعت {faNum(dailyTime)} تهران) گزارش جامع کل اخبار آن روز ارسال می‌شود. اگر مدل در دسترس نباشد، فهرست خام تیترها با یادداشت صریح خطا ارسال می‌شود — گزارش ساختگی هرگز ساخته نمی‌شود.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">آخرین چرخه‌های گزارش</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-1">
          {st.lastJobs.length === 0 && <span className="text-slate-400">چرخه‌ای ثبت نشده</span>}
          {st.lastJobs.map((j, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 border-b py-1">
              <Badge className={j.status === 'موفق' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>{j.status.replace(/_/g, ' ')}</Badge>
              <span className="text-slate-400">{faDateTime(j.startedAt)}</span>
              {j.durationMs && <span dir="ltr" className="text-slate-400">{faNum(Math.round(j.durationMs / 1000))} ثانیه</span>}
              {j.error && <span className="text-rose-600 truncate max-w-96">{j.error}</span>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- زمان‌بندی ----------
export function SchedulePanel() {
  const [enabled, setEnabled] = useState(true);
  const [reportTime, setReportTime] = useState('22:30');
  const [catchUp, setCatchUp] = useState(true);
  const [autoFactcheck, setAutoFactcheck] = useState(true);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const dayNames = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const r = await api<{ schedule: { enabled?: boolean; reportTime: string; activeDays: number[]; catchUp?: boolean; autoFactcheck?: boolean } }>('/api/schedule');
      if (r.ok) {
        setEnabled(r.schedule.enabled !== false);
        setReportTime(r.schedule.reportTime || '22:30');
        setDays(r.schedule.activeDays || [0, 1, 2, 3, 4, 5, 6]);
        setCatchUp(r.schedule.catchUp !== false);
        setAutoFactcheck(r.schedule.autoFactcheck !== false);
      }
    })();
  }, []);

  const save = async () => {
    const r = await api('/api/schedule', { method: 'POST', body: { enabled, reportTime, activeDays: days, catchUp, autoFactcheck } });
    toast({ title: r.ok ? 'زمان‌بندی ذخیره شد' : 'خطا', description: r.ok ? 'زمان‌بند درون‌پردازشی تنظیمات جدید را در tick بعدی اعمال می‌کند' : r.error });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2"><Timer className="h-5 w-5 text-teal-600" /> زمان‌بندی اجرای خودکار</h2>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm"><Switch checked={enabled} onCheckedChange={setEnabled} /> زمان‌بند فعال</label>
              <div>
                <Label>ساعت گزارش شبانه (به‌وقت تهران)</Label>
                <Input type="time" value={reportTime} onChange={(e) => setReportTime(e.target.value)} dir="ltr" className="w-36" />
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={catchUp} onCheckedChange={setCatchUp} /> جبران گزارش‌های ازدست‌رفته پس از قطعی</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={autoFactcheck} onCheckedChange={setAutoFactcheck} /> راستی‌آزمایی خودکار ادعاها</label>
            </div>
            <div>
              <Label>روزهای فعال هفته</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {dayNames.map((d, i) => {
                  const idx = i === 6 ? 6 : i; // یکشنبه=0
                  const active = days.includes(i);
                  return (
                    <button key={i} type="button" onClick={() => setDays(active ? days.filter((x) => x !== i) : [...days, i])}
                      className={`text-xs rounded-full px-3 py-1.5 border transition ${active ? 'bg-teal-600 text-white border-teal-600' : 'bg-white'}`}>{d}</button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-6">
                بازه هر روز از نیمه‌شب تا نیمه‌شب بعدی به‌وقت تهران محاسبه می‌شود.
                اجرای هم‌زمان چند گزارش تکراری با قفل کارها جلوگیری می‌شود.
              </p>
            </div>
          </div>
          <Button onClick={save}><Save className="h-4 w-4 ml-1" /> ذخیره</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- هزینه و مصرف ----------
export function CostsPanel() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    (async () => {
      const r = await api<Record<string, unknown>>('/api/costs');
      if (r.ok) setData(r);
    })();
  }, []);
  if (!data) return <LoadingCard title="هزینه و مصرف" />;
  const today = data.today as { estTokens: number; calls: number };
  const month = data.month as { estTokens: number };
  const budget = data.budget as { dailyTokenLimit: number };
  const byPurpose = (data.byPurpose || []) as Array<{ purpose: string; status: string; _sum: { estTokens: number | null }; _count: number }>;
  const recent = (data.recent || []) as Array<{ id: string; purpose: string; model: string; estTokens: number; status: string; createdAt: string; error: string | null }>;
  const pct = Math.min(100, Math.round((today.estTokens / budget.dailyTokenLimit) * 100));
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2"><Coins className="h-5 w-5 text-teal-600" /> هزینه و مصرف</h2>
      <div className="grid md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{faNum(today.estTokens)}</div><div className="text-xs text-slate-500">توکن تقریبی امروز (از سقف {faNum(budget.dailyTokenLimit)})</div>
          <div className="h-2 bg-slate-100 rounded mt-2"><div className={`h-2 rounded ${pct > 90 ? 'bg-rose-500' : 'bg-teal-600'}`} style={{ width: `${pct}%` }} /></div>
          <div className="text-xs text-slate-400 mt-1">{faNum(pct)}٪ سقف روزانه — {faNum(today.calls)} فراخوانی</div>
        </CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{faNum(month.estTokens)}</div><div className="text-xs text-slate-500">توکن تقریبی این ماه</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs leading-6 text-slate-500">{String(data.note)}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">مصرف به تفکیک هدف (این ماه)</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {byPurpose.length === 0 && <span className="text-xs text-slate-400">مصرفی ثبت نشده</span>}
          {byPurpose.map((p, i) => (
            <Badge key={i} variant="outline">{p.purpose.replace(/_/g, ' ')} ({p.status.replace(/_/g, ' ')}): {faNum(p._sum.estTokens || 0)} توکن — {faNum(p._count)} بار</Badge>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">آخرین فراخوانی‌ها</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-1">
          {recent.map((r) => (
            <div key={r.id} className="flex items-center gap-2 border-b py-1">
              <Badge className={statusStyle(r.status === 'موفق' ? 'کامل' : 'ناموفق')}>{r.status.replace(/_/g, ' ')}</Badge>
              <span>{r.purpose.replace(/_/g, ' ')}</span>
              <span dir="ltr" className="text-slate-400">{r.model}</span>
              <span className="text-slate-400">{faNum(r.estTokens)} توکن</span>
              <span className="text-slate-400 ml-auto">{faDateTime(r.createdAt)}</span>
              {r.error && <span className="text-rose-600 truncate max-w-40">{r.error}</span>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- خطاها و وضعیت سرویس‌ها ----------
export function ErrorsPanel() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const load = useCallback(async () => {
    const r = await api<Record<string, unknown>>('/api/errors');
    if (r.ok) setData(r);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  if (!data) return <LoadingCard title="خطاها" />;
  const failedJobs = (data.failedJobs || []) as Array<{ id: string; jobType: string; targetId: string | null; startedAt: string; error: string | null; durationMs: number | null }>;
  const errorSources = (data.errorSources || []) as Array<{ id: string; name: string; platform: string; status: string; statusDetail: string | null; lastErrorAt: string | null }>;
  const aiFailures = (data.aiFailures || []) as Array<{ id: string; purpose: string; model: string; error: string | null; createdAt: string; status: string }>;
  const catalog = (data.connectorCatalog || []) as Array<{ key: string; label: string; implemented: boolean; limits: string; auth: string }>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> خطاها و وضعیت سرویس‌ها</h2>

      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4" /> اتصال‌دهنده‌های پلتفرم (وضعیت واقعی پشتیبانی)</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {catalog.map((c) => (
            <div key={c.key} className="text-xs border rounded-lg p-2.5 space-y-1">
              <div className="flex items-center gap-2">
                <b>{c.label}</b>
                <Badge className={c.implemented ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-600'}>
                  {c.implemented ? 'پیاده‌سازی‌شده' : 'در انتظار پیاده‌سازی'}
                </Badge>
              </div>
              <div className="text-slate-500 leading-5">محدودیت‌ها: {c.limits}</div>
              <div className="text-slate-500">احراز هویت: {c.auth}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">منابع دارای مشکل</CardTitle></CardHeader>
        <CardContent className="grid gap-1.5">
          {errorSources.length === 0 && <span className="text-xs text-slate-400">منبعی با خطای جاری وجود ندارد</span>}
          {errorSources.map((s) => (
            <div key={s.id} className="text-xs flex flex-wrap items-center gap-2 border rounded p-2">
              <Badge className={statusStyle(s.status)}>{s.status.replace(/_/g, ' ')}</Badge>
              <b>{s.name}</b>
              <span className="text-slate-400">({PLATFORM_LABELS[s.platform] || s.platform})</span>
              <span className="text-slate-500">{s.statusDetail}</span>
              <span className="text-slate-400 ml-auto">{s.lastErrorAt ? faDateTime(s.lastErrorAt) : ''}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">وظایف ناموفق اخیر</CardTitle></CardHeader>
        <CardContent className="grid gap-1.5">
          {failedJobs.length === 0 && <span className="text-xs text-slate-400">وظیفه ناموفقی ثبت نشده</span>}
          {failedJobs.map((j) => (
            <div key={j.id} className="text-xs border rounded p-2 space-y-0.5">
              <div className="flex gap-2 items-center"><Badge className="bg-rose-100 text-rose-800">{j.jobType}</Badge><span dir="ltr" className="text-slate-400">{j.durationMs ? `${j.durationMs}ms` : ''}</span><span className="text-slate-400 ml-auto">{faDateTime(j.startedAt)}</span></div>
              {j.error && <div className="text-rose-700 leading-5">{j.error.slice(0, 300)}</div>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">خطاهای فراخوانی هوش مصنوعی</CardTitle></CardHeader>
        <CardContent className="grid gap-1.5">
          {aiFailures.length === 0 && <span className="text-xs text-slate-400">خطایی ثبت نشده</span>}
          {aiFailures.map((a) => (
            <div key={a.id} className="text-xs border rounded p-2 flex flex-wrap gap-2 items-center">
              <Badge className={a.status === 'سقف_هزینه' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}>{a.status.replace(/_/g, ' ')}</Badge>
              <span>{a.purpose.replace(/_/g, ' ')}</span>
              <span dir="ltr" className="text-slate-400">{a.model}</span>
              <span className="text-rose-700">{a.error?.slice(0, 150)}</span>
              <span className="text-slate-400 ml-auto">{faDateTime(a.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
