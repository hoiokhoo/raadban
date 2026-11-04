'use client';
/**
 * پانل «ربات ۲۴ ساعته (گیت‌هاب)» — رصد، مدیریت و تغییر ربات از درون اپلیکیشن
 * خواستهٔ کاربر (۵ نوامبر ۲۰۲۶):
 * ۱) توکن بات بلهٔ مخصوص هر بخش خبری (سیاسی/ورزشی/ایران/انرژی/...) + همگام‌سازی خودش با گیت‌هاب
 * ۲) ویرایش پرامپت هوش مصنوعی ربات از اپلیکیشن
 * ۳) آمار ربات در اپلیکیشن — آخرین چرخه، اجراها، اعضای مقصدها
 * ۴) تحلیل محدودیت‌های گیت‌هاب («چند سال بدون لیمیت»)
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { api, faNum, faDateTime } from '@/lib/client';
import { LoadingCard } from '@/components/panels/dashboard';
import { Bot, RefreshCw, Save, Send, Trash2, Users, KeyRound, FileText, Zap, Info, Radio, Rocket, Undo2 } from 'lucide-react';

interface BotCategoryRow {
  id: string; slug: string; title: string; enabled: boolean;
  hasToken: boolean; tokenMask: string | null; targets: string[]; updatedAt: string;
}
interface RunInfo { runNumber: number; status: string; conclusion: string | null; createdAt: string; url: string; event: string }
interface BotData {
  repo: string;
  categories: BotCategoryRow[];
  repoConfigCats: Array<{ slug: string; title: string }>;
  stats: {
    state: { lastRunAt?: string; lastRun?: Record<string, unknown>; sentCount?: number } | null;
    runs: RunInfo[];
    runsError?: string | null;
  };
  prompts: { oneshot?: string; translate?: string; updatedAt?: string; hasOverrides?: boolean };
  sources: { count: number; perCategory: Record<string, number>; list: Array<{ name: string; platform: string; category: string }> };
  limits: Record<string, string>;
  github: { hasPat: boolean; patMasked: string | null };
  defaultBot: { ok: boolean; username: string | null; fromEnv: boolean };
}

const DEFAULT_TABS: Array<{ slug: string; title: string }> = [
  { slug: 'politics', title: 'سیاسی' }, { slug: 'iran', title: 'ایران' }, { slug: 'sports', title: 'ورزشی' },
  { slug: 'energy', title: 'انرژی' }, { slug: 'economy', title: 'اقتصاد' }, { slug: 'world', title: 'جهان' },
  { slug: 'tech', title: 'فناوری' }, { slug: 'general', title: 'عمومی' },
];

export function BotManagePanel() {
  const [data, setData] = useState<BotData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pat, setPat] = useState('');
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<BotData>('/api/bot-manage');
    if (r.ok) setData(r);
    else toast({ title: 'خطا در دریافت وضعیت ربات', description: r.error, variant: 'destructive' });
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const act = async (body: Record<string, unknown>, okMsg: string, tag: string) => {
    setBusy(tag);
    const r = await api<Record<string, unknown>>('/api/bot-manage', { method: 'POST', body });
    setBusy(null);
    toast({
      title: r.ok ? okMsg : 'خطا',
      description: r.ok ? (typeof r.note === 'string' ? r.note : undefined) : r.error,
      variant: r.ok ? 'default' : 'destructive',
    });
    await load();
    return r;
  };

  if (!data) return <LoadingCard title="ربات ۲۴ ساعته" />;

  const lr = (data.stats.state?.lastRun || {}) as Record<string, unknown>;
  const num = (k: string): number => typeof lr[k] === 'number' ? (lr[k] as number) : 0;
  const perCat = (lr.perCategory && typeof lr.perCategory === 'object' ? lr.perCategory : {}) as Record<string, number>;

  return (
    <div className="space-y-4" data-testid="bot-manage">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Bot className="h-5 w-5 text-teal-600" /> ربات ۲۴ ساعته (گیت‌هاب) — رصد و مدیریت
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 ml-1" /> به‌روزرسانی</Button>
          <Button size="sm" onClick={() => act({ action: 'dispatchRun' }, 'چرخهٔ ربات راه‌اندازی شد', 'run')} disabled={busy === 'run'}>
            <Rocket className="h-4 w-4 ml-1" /> اجرای فوری
          </Button>
          <Button variant="outline" size="sm" onClick={() => act({ action: 'dispatchRun', discoverChats: true }, 'اجرای کشف چت‌ها آغاز شد', 'discover')} disabled={busy === 'discover'}>
            <Radio className="h-4 w-4 ml-1" /> کشف چت‌ها
          </Button>
        </div>
      </div>

      {/* ── آمار ── */}
      <div className="grid md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500">آخرین چرخهٔ ربات</div>
          <div className="text-lg font-bold mt-1">{data.stats.state?.lastRunAt ? faDateTime(data.stats.state.lastRunAt) : 'چرخه‌ای ثبت نشده'}</div>
          <div className="text-xs text-slate-400 mt-1">
            {data.stats.runs[0] ? `اجرای #${faNum(data.stats.runs[0].runNumber)}: ${data.stats.runs[0].status === 'completed' ? (data.stats.runs[0].conclusion === 'success' ? 'موفق' : 'ناموفق') : 'در حال اجرا'}` : data.stats.runsError || '—'}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500">ارسال در آخرین چرخه</div>
          <div className="text-lg font-bold mt-1">{faNum(num('sent'))} خبر + {faNum(num('tweetsSent'))} توییت</div>
          <div className="text-xs text-slate-400 mt-1">{faNum(num('images'))} با عکس خود خبر — مدل: {String(lr.aiProvider || (lr.aiFailed ? 'ناموفق' : '—'))}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500">جریان آخرین چرخه</div>
          <div className="text-xs mt-1 leading-6">
            {faNum(num('sources'))} منبع → {faNum(num('fetched'))} مطلب → {faNum(num('inWindow'))} در پنجرهٔ ۳ ساعته → {faNum(num('fresh'))} تازه
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500">بات پیش‌فرض (چت شخصی + کانال اصلی)</div>
          <Badge className={`mt-2 ${data.defaultBot.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {data.defaultBot.ok ? `فعال @${data.defaultBot.username || '?'}` : 'غیرفعال'}
          </Badge>
        </CardContent></Card>
      </div>

      {/* ارسال به تفکیک دسته + اجراهای اخیر */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">ارسال آخرین چرخه به تفکیک بخش خبری</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {Object.keys(perCat).length === 0 && <span className="text-slate-400">ارسالی در آخرین چرخه ثبت نشده</span>}
            {Object.entries(perCat).map(([slug, n]) => (
              <Badge key={slug} variant="outline">{data.categories.find((c) => c.slug === slug)?.title || slug}: {faNum(n)}</Badge>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">اجراهای اخیر workflow</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            {data.stats.runs.length === 0 && <span className="text-slate-400">{data.stats.runsError || 'اجرایی یافت نشد'}</span>}
            {data.stats.runs.map((r) => (
              <div key={r.runNumber} className="flex flex-wrap items-center gap-2 border-b py-1">
                <Badge className={r.status !== 'completed' ? 'bg-amber-100 text-amber-800' : r.conclusion === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>
                  #{faNum(r.runNumber)} {r.status === 'completed' ? (r.conclusion === 'success' ? 'موفق' : 'ناموفق') : 'در حال اجرا'}
                </Badge>
                <span className="text-slate-400">{faDateTime(r.createdAt)}</span>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-teal-700 underline mr-auto">مشاهده</a>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── توکن گیت‌هاب برای همگام‌سازی ── */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <KeyRound className="h-4 w-4 text-teal-600" />
            <b>توکن گیت‌هاب (PAT)</b>
            {data.github.hasPat
              ? <Badge className="bg-emerald-100 text-emerald-800">ذخیره‌شده: {data.github.patMasked}</Badge>
              : <Badge className="bg-amber-100 text-amber-800">ذخیره نشده — برای همگام‌سازی لازم است</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Input dir="ltr" type="password" value={pat} onChange={(e) => setPat(e.target.value)} placeholder="github_pat_... یا ghp_..." className="max-w-md" />
            <Button variant="outline" onClick={async () => { await act({ action: 'savePat', pat: pat.trim() }, 'توکن گیت‌هاب ذخیره شد', 'savePat'); setPat(''); }} disabled={busy === 'savePat' || pat.trim().length < 20}>
              <Save className="h-4 w-4 ml-1" /> ذخیره توکن
            </Button>
            <p className="text-xs text-slate-400 leading-6 basis-full">
              توکن با محدودهٔ <b>repo</b> (خواندن/نوشتن سکرت‌ها و فایل‌ها) کافی است. توکن رمزنگاری‌شده ذخیره می‌شود و هرگز نمایش داده نمی‌شود.
              دسته‌ای که توکن باتش عوض شود یا تازه تعریف شود، با دکمهٔ «همگام‌سازی با گیت‌هاب» به سکرت‌های ربات منتقل می‌شود.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── مدیریت دسته‌ها و توکن‌ها ── */}
      <CategoryManager data={data} act={act} busy={busy} />

      {/* ── ویرایش پرامپت ── */}
      <PromptEditor data={data} act={act} busy={busy} />

      {/* ── دسته‌بندی منابع ── */}
      <SourcesTagger data={data} act={act} busy={busy} />

      {/* ── تحلیل محدودیت‌ها ── */}
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4 text-teal-600" /> آیا ربات در گیت‌هاب لیمیت می‌خورد؟ (تحلیل مستند)</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-1.5 leading-6">
          {Object.entries(data.limits).map(([k, v]) => (
            <div key={k} className="border-b pb-1.5"><b className="text-slate-600">• </b>{v}</div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- مدیریت دسته‌ها + توکن بات هر بخش ----------
function CategoryManager({ data, act, busy }: {
  data: BotData;
  act: (body: Record<string, unknown>, okMsg: string, tag: string) => Promise<Record<string, unknown>>;
  busy: string | null;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<{ id: string | null; slug: string; title: string; token: string; targets: string; enabled: boolean }>(
    { id: null, slug: '', title: '', token: '', targets: '', enabled: true },
  );
  const [members, setMembers] = useState<Record<string, { username?: string | null; tokenOk?: boolean; members?: Array<{ target: string; ok: boolean; count?: number; error?: string }> }>>({});

  const startEdit = (c: BotCategoryRow) => setForm({ id: c.id, slug: c.slug, title: c.title, token: '', targets: c.targets.join('، '), enabled: c.enabled });
  const reset = () => setForm({ id: null, slug: '', title: '', token: '', targets: '', enabled: true });

  const save = async () => {
    if (!form.slug.trim() || !form.title.trim()) { toast({ title: 'شناسه و عنوان دسته لازم است', variant: 'destructive' }); return; }
    const r = await act({
      action: 'saveCategory', id: form.id, slug: form.slug.trim(), title: form.title.trim(),
      token: form.token.trim() || undefined, targets: form.targets, enabled: form.enabled,
    }, form.id ? 'دسته به‌روزرسانی شد' : 'دستهٔ جدید ثبت شد', 'saveCat');
    if (r.ok) reset();
  };

  const probe = async (c: BotCategoryRow) => {
    const r = await act({ action: 'probeMembers', id: c.id }, `آمار اعضای «${c.title}» گرفته شد`, `probe-${c.id}`);
    if (r.ok) setMembers((m) => ({ ...m, [c.id]: r as typeof m[string] }));
  };

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Users className="h-4 w-4 text-teal-600" /> بخش‌های خبری و توکن بات هر بخش</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => act({ action: 'syncSecrets' }, 'توکن دسته‌ها به سکرت‌های گیت‌هاب همگام شد', 'syncSecrets')} disabled={busy === 'syncSecrets'}>
              <KeyRound className="h-4 w-4 ml-1" /> همگام‌سازی توکن‌ها با گیت‌هاب
            </Button>
            <Button size="sm" variant="outline" onClick={() => act({ action: 'syncConfig' }, 'فهرست دسته‌ها در ریپو به‌روز شد', 'syncConfig')} disabled={busy === 'syncConfig'}>
              <Save className="h-4 w-4 ml-1" /> همگام‌سازی فهرست دسته‌ها
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500 leading-6">
          هر بخش می‌تواند بات و کانال بلهٔ خودش را داشته باشد؛ خبر همان بخش فقط به مقصدهای همان بخش می‌رود.
          بخش بدون توکن (و بخش «عمومی») به مقصد پیش‌فرض می‌رود — چت شخصی + کانال اصلی.
          شناسهٔ کانال را می‌توانید با دکمهٔ «کشف چت‌ها» در سربرگ پیدا کنید (نوع channel).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 border-b">
              <th className="py-1.5 text-right">بخش</th><th className="text-right">شناسه</th><th className="text-right">توکن بات</th>
              <th className="text-right">مقصدها</th><th className="text-right">فعال</th><th className="text-right">عملیات</th>
            </tr></thead>
            <tbody>
              {data.categories.map((c) => (
                <tr key={c.id} className="border-b align-top">
                  <td className="py-2 font-medium">{c.title}</td>
                  <td dir="ltr" className="text-slate-500">{c.slug}</td>
                  <td>{c.hasToken ? <Badge className="bg-emerald-100 text-emerald-800" dir="ltr">{c.tokenMask}</Badge> : <span className="text-slate-400">پیش‌فرض</span>}</td>
                  <td dir="ltr" className="text-slate-500 max-w-56 truncate">{c.targets.length ? c.targets.join(' ، ') : 'پیش‌فرض'}</td>
                  <td><Switch checked={c.enabled} onCheckedChange={(v) => act({ action: 'saveCategory', id: c.id, slug: c.slug, title: c.title, targets: c.targets.join('، '), enabled: v }, 'وضعیت دسته به‌روز شد', `en-${c.id}`)} disabled={busy === `en-${c.id}`} /></td>
                  <td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>ویرایش</Button>
                      <Button size="sm" variant="outline" onClick={() => probe(c)} disabled={!c.hasToken || busy === `probe-${c.id}`}>اعضا</Button>
                      {c.slug !== 'general' && (
                        <Button size="sm" variant="ghost" onClick={() => act({ action: 'deleteCategory', id: c.id }, `دستهٔ «${c.title}» حذف شد`, `del-${c.id}`)} disabled={busy === `del-${c.id}`}>
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        </Button>
                      )}
                    </div>
                    {members[c.id]?.members && (
                      <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                        <span>بات: {members[c.id].tokenOk ? `@${members[c.id].username || '?'}` : 'توکن نامعتبر'}</span>
                        {members[c.id].members?.map((m) => (
                          <div key={m.target} className={m.ok ? 'text-emerald-700' : 'text-rose-600'}>
                            {m.target}: {m.ok ? `${faNum(m.count || 0)} عضو` : m.error}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* فرم افزودن/ویرایش */}
        <div className="border rounded-lg p-3 space-y-2 bg-slate-50">
          <div className="text-xs font-medium text-slate-600">{form.id ? `ویرایش «${form.title}»` : 'افزودن بخش جدید'}</div>
          <div className="grid md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">عنوان فارسی</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثل: انرژی" />
            </div>
            <div>
              <Label className="text-xs">شناسه (لاتین)</Label>
              <Input dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="energy" disabled={Boolean(form.id)} />
            </div>
            <div>
              <Label className="text-xs">توکن بات بله (خالی = بدون تغییر)</Label>
              <Input dir="ltr" type="password" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder={form.id ? 'بدون تغییر' : 'مثل ۲۱۱۵۳۹۷۹۳۷:AA...'} />
            </div>
            <div>
              <Label className="text-xs">مقصدها (چت/کانال، با ویرگول)</Label>
              <Input dir="ltr" value={form.targets} onChange={(e) => setForm({ ...form, targets: e.target.value })} placeholder="@channel یا -1001234567" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs"><Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} /> فعال</label>
            <Button size="sm" onClick={save} disabled={busy === 'saveCat'}><Save className="h-4 w-4 ml-1" /> {form.id ? 'ذخیرهٔ تغییرات' : 'افزودن بخش'}</Button>
            {form.id && <Button size="sm" variant="ghost" onClick={reset}>انصراف</Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- ویرایش پرامپت هوش مصنوعی ربات ----------
function PromptEditor({ data, act, busy }: {
  data: BotData;
  act: (body: Record<string, unknown>, okMsg: string, tag: string) => Promise<Record<string, unknown>>;
  busy: string | null;
}) {
  const [oneshot, setOneshot] = useState('');
  const [translate, setTranslate] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!loaded) { setOneshot(data.prompts.oneshot || ''); setTranslate(data.prompts.translate || ''); setLoaded(true); }
  }, [data.prompts, loaded]);

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-teal-600" /> پرامپت هوش مصنوعی ربات</span>
          <span className="flex items-center gap-2 text-xs font-normal">
            {data.prompts.hasOverrides ? <Badge className="bg-amber-100 text-amber-800">نسخهٔ ویرایش‌شده فعال</Badge> : <Badge variant="outline">پیش‌فرض سوپر حرفه‌ای</Badge>}
            {data.prompts.updatedAt && <span className="text-slate-400">به‌روزرسانی: {faDateTime(data.prompts.updatedAt)}</span>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500 leading-6">
          پرامپت اصلی رفتار سردبیر ربات است (گزینش خبر، دسته‌بندی به بخش‌ها، تجمیع چند خبرگزاری در یک پیام «خبرگزاری‌های A و B: متن»،
          ترجمهٔ کامل بدون خلاصه‌سازی، حکم ایموجی فقط با شواهد، بی‌طرفی مطلق). پرامپت ترجمه مخصوص توییت‌ها و تیترهای خارجی است.
          خالی گذاشتن هر کادر = همان بخش از پیش‌فرض درونی ربات استفاده می‌کند. پس از ذخیره، چرخهٔ بعدی ربات (حداکثر ~۱۰ دقیقه بعد) آن را اعمال می‌کند.
        </p>
        <div>
          <Label className="text-xs">پرامپت اصلی (سردبیر)</Label>
          <Textarea dir="rtl" value={oneshot} onChange={(e) => setOneshot(e.target.value)} rows={10} className="text-xs leading-6 font-mono" placeholder="(خالی = پیش‌فرض درونی ربات)" />
        </div>
        <div>
          <Label className="text-xs">پرامپت ترجمه (توییت‌ها و تیترها — ترجمهٔ کامل بدون خلاصه‌سازی)</Label>
          <Textarea dir="rtl" value={translate} onChange={(e) => setTranslate(e.target.value)} rows={6} className="text-xs leading-6 font-mono" placeholder="(خالی = پیش‌فرض درونی ربات)" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => act({ action: 'syncPrompts', oneshot, translate }, 'پرامپت‌ها ذخیره و به ریپو همگام شد', 'prompts')} disabled={busy === 'prompts'}>
            <Save className="h-4 w-4 ml-1" /> ذخیره و همگام‌سازی
          </Button>
          <Button size="sm" variant="outline" onClick={() => act({ action: 'resetPrompts' }, 'پرامپت‌ها به پیش‌فرض بازگشت', 'promptsReset')} disabled={busy === 'promptsReset'}>
            <Undo2 className="h-4 w-4 ml-1" /> بازگشت به پیش‌فرض
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- دسته‌بندی منابع ربات ----------
function SourcesTagger({ data, act, busy }: {
  data: BotData;
  act: (body: Record<string, unknown>, okMsg: string, tag: string) => Promise<Record<string, unknown>>;
  busy: string | null;
}) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const catOptions = data.categories.length ? data.categories.map((c) => ({ slug: c.slug, title: c.title })) : DEFAULT_TABS;
  const changedCount = Object.keys(edits).length;

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Radio className="h-4 w-4 text-teal-600" /> دسته‌بندی منابع ربات ({faNum(data.sources.count)} منبع)</span>
          {changedCount > 0 && (
            <Button size="sm" onClick={() => act({ action: 'syncSources', assignments: Object.entries(edits).map(([name, category]) => ({ name, category })) }, `${changedCount} منبع همگام شد`, 'syncSources')} disabled={busy === 'syncSources'}>
              <Send className="h-4 w-4 ml-1" /> ذخیرهٔ {changedCount} تغییر
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(data.sources.perCategory).map(([slug, n]) => (
            <Badge key={slug} variant="outline">{catOptions.find((c) => c.slug === slug)?.title || slug}: {faNum(n)}</Badge>
          ))}
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="sources">
            <AccordionTrigger className="text-xs">فهرست منابع و دستهٔ هر منبع (پیش‌فرض مسیریابی — دسته‌بندی دقیق هر خبر با مدل انجام می‌شود)</AccordionTrigger>
            <AccordionContent>
              <div className="grid md:grid-cols-2 gap-2">
                {data.sources.list.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 border rounded p-2 text-xs">
                    <span className="truncate flex-1" title={s.name}>{s.name}</span>
                    <Select
                      value={edits[s.name] ?? s.category}
                      onValueChange={(v) => setEdits((e) => {
                        const next = { ...e };
                        if (v === s.category) delete next[s.name]; else next[s.name] = v;
                        return next;
                      })}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {catOptions.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
