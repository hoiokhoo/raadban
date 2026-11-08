'use client';
/**
 * آرشیو روزانه/تاریخی + جست‌وجو + مقایسه دو تاریخ (فصل ۱۲ بند ۶، ۷، ۸)
 */
import { useCallback, useEffect, useState } from 'react';
import { api, faNum, faDateTime, statusStyle } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LoadingCard } from './dashboard';
import { TripleDate } from '@/components/triple-date';
import { Search, GitCompareArrows, ClipboardPen, Languages, Loader2, FileText } from 'lucide-react';

interface ArchiveRow {
  id: string; reportDate: string; jDate: string; status: string; postsCount: number;
  eventsCount: number; claimsCount: number; generatedAt: string;
  category?: { name: string } | null;
}

export function ArchivePanel() {
  const [reports, setReports] = useState<ArchiveRow[] | null>(null);
  const load = useCallback(async () => {
    const r = await api<{ reports: ArchiveRow[] }>('/api/reports?take=60');
    if (r.ok) setReports(r.reports);
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">آرشیو روزانه و تاریخی</h2>
      {!reports ? <LoadingCard title="آرشیو" /> : (
        <div className="grid gap-2">
          {reports.length === 0 && <Card><CardContent className="p-6 text-sm text-slate-400">آرشیو خالی است — با گذشت روزها و اجرای گزارش شبانه، آرشیو تاریخ‌دار ساخته می‌شود.</CardContent></Card>}
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono">{r.reportDate}</Badge>
                  <span>{r.category?.name || 'جامع'}</span>
                  <Badge className={statusStyle(r.status)}>{r.status}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>مطالب: {faNum(r.postsCount)}</span>
                  <span>رویدادها: {faNum(r.eventsCount)}</span>
                  <span>ادعاها: {faNum(r.claimsCount)}</span>
                  <span>{faDateTime(r.generatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchPanel() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | 'posts' | 'claims'>('all');
  const [results, setResults] = useState<{ posts: PostRow[]; claims: ClaimLite[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setBusy(true); setError(null);
    const r = await api<{ posts: PostRow[]; claims: ClaimLite[] }>(`/api/search?q=${encodeURIComponent(q)}&type=${type}`);
    setBusy(false);
    if (r.ok) setResults({ posts: r.posts, claims: r.claims });
    else setError(r.error || 'خطا');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">جست‌وجوی خبر و ادعا</h2>
      <ManualEntryForm />
      <div className="flex flex-wrap gap-2">
        <Input className="flex-1 min-w-60" value={q} onChange={(e) => setQ(e.target.value)} placeholder="عبارت مورد جست‌وجو..." onKeyDown={(e) => e.key === 'Enter' && search()} />
        <select className="text-sm border rounded-md px-2 bg-white" value={type} onChange={(e) => setType(e.target.value as 'all')}>
          <option value="all">همه</option><option value="posts">فقط مطالب</option><option value="claims">فقط ادعاها</option>
        </select>
        <Button onClick={search} disabled={busy || q.trim().length < 2}><Search className="h-4 w-4 ml-1" /> {busy ? '...' : 'جست‌وجو'}</Button>
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {results && (
        <div className="space-y-3">
          <Card><CardHeader className="pb-1"><CardTitle className="text-sm">مطالب ({faNum(results.posts.length)})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {results.posts.length === 0 && <div className="text-xs text-slate-400">مطلبی یافت نشد</div>}
              {results.posts.map((p) => (
                <div key={p.id} className="text-sm border-b pb-2 space-y-1">
                  <div className="leading-6">{p.content.slice(0, 220)}...</div>
                  {p.translationFa && (
                    <div className="bg-sky-50 border border-sky-100 rounded p-2 text-xs leading-7 text-slate-800">
                      <b className="text-sky-800">ترجمه فارسی روان:</b> {p.translationFa.slice(0, 600)}{p.translationFa.length > 600 ? '…' : ''}
                      {p.translationSummary && <div className="mt-1 text-slate-600"><b>خلاصه:</b> {p.translationSummary}</div>}
                      {p.translationConclusion && <div className="mt-0.5 text-slate-600"><b>نتیجه‌گیری:</b> {p.translationConclusion}</div>}
                    </div>
                  )}
                  {p.summaryFa && p.analysisFa && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded p-2 text-xs leading-7 text-slate-800">
                      <b className="text-indigo-800">خلاصه:</b> {p.summaryFa.slice(0, 500)}
                      <div className="mt-1"><b className="text-slate-800">تحلیل:</b> {p.analysisFa.slice(0, 800)}{p.analysisFa.length > 800 ? '…' : ''}</div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500 items-center">
                    <Badge variant="outline">{p.source?.name || '—'}</Badge>
                    <TripleDate date={p.publishedAt} className="text-xs" />
                    {p.eventDateISO && <span>وقوع: {p.eventDateISO}</span>}
                    <Badge className={statusStyle(p.processingStatus)}>{p.processingStatus}</Badge>
                    {p.duplicateOfId && <Badge variant="outline" className="text-orange-600">بازنشر شناسایی‌شده</Badge>}
                    <PostTranslateButton post={p} />
                    <PostSummaryButton post={p} />
                  </div>
                </div>
              ))}
            </CardContent></Card>
          <Card><CardHeader className="pb-1"><CardTitle className="text-sm">ادعاها ({faNum(results.claims.length)})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {results.claims.length === 0 && <div className="text-xs text-slate-400">ادعایی یافت نشد</div>}
              {results.claims.map((c) => (
                <div key={c.id} className="text-sm border-b pb-2 space-y-1">
                  <div className="leading-6">{c.text.slice(0, 200)}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge className={statusStyle(c.status)}>{c.status.replace(/_/g, ' ')}</Badge>
                    <Badge variant="outline">اطمینان: {c.confidence}</Badge>
                    <span className="text-slate-400">{faDateTime(c.createdAt)}</span>
                  </div>
                </div>
              ))}
            </CardContent></Card>
        </div>
      )}
    </div>
  );
}

interface PostRow { id: string; content: string; publishedAt: string; processingStatus: string; eventDateISO: string | null; duplicateOfId: string | null; language?: string; translationFa?: string | null; translationSummary?: string | null; translationConclusion?: string | null; summaryFa?: string | null; analysisFa?: string | null; source?: { name: string } | null }
interface ClaimLite { id: string; text: string; status: string; confidence: string; createdAt: string }

/** دکمه ترجمه فارسی روان برای مطالب خارجی (قابلیت ۱٫۱-ب) */
function PostTranslateButton({ post }: { post: PostRow }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const isForeign = post.language ? post.language !== 'fa' : false;
  if (!isForeign && post.translationFa) return null;
  const go = async () => {
    setBusy(true);
    const r = await api(`/api/posts/${post.id}/translate`, { method: 'POST' });
    setBusy(false);
    toast({ title: r.ok ? 'ترجمه ذخیره شد' : 'ترجمه ناموفق', description: r.error, variant: r.ok ? 'default' : 'destructive' });
    if (r.ok) window.location.reload();
  };
  return (
    <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={go} disabled={busy}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Languages className="h-3 w-3 ml-1" />}
      {post.translationFa ? 'ترجمه مجدد' : 'ترجمه فارسی روان'}
    </Button>
  );
}

/** دکمه خلاصه و تحلیل هوشمند برای هر خبر (قابلیت ۱۰ — زنجیرهٔ مدل: جمینی/GLM) */
function PostSummaryButton({ post }: { post: PostRow }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const go = async () => {
    setBusy(true);
    const r = await api<{ summary: string; analysis: string }>(`/api/posts/${post.id}/summarize`, { method: 'POST' });
    setBusy(false);
    toast({ title: r.ok ? 'خلاصه و تحلیل ذخیره شد' : 'تحلیل ناموفق', description: r.error, variant: r.ok ? 'default' : 'destructive' });
    if (r.ok) window.location.reload();
  };
  return (
    <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={go} disabled={busy}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <FileText className="h-3 w-3 ml-1" />}
      {post.summaryFa ? 'تحلیل مجدد' : 'خلاصه و تحلیل'}
    </Button>
  );
}

/** ورود دستی مطلب — مسیر مجاز جایگزین وقتی دسترسی خودکار به منبع ممکن نیست (صادقانه برچسب «ورود دستی» می‌خورد) */
function ManualEntryForm() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && sources.length === 0) {
      (async () => {
        const r = await api<{ sources: Array<{ id: string; name: string; isActive: boolean }> }>('/api/sources');
        if (r.ok) setSources(r.sources.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name })));
      })();
    }
  }, [open, sources.length]);

  const submit = async () => {
    if (content.trim().length < 40) return;
    setBusy(true);
    const r = await api<{ postId: string; note: string }>('/api/posts/manual', {
      method: 'POST',
      body: { content, title: title || undefined, url: url || undefined, sourceId: sourceId || undefined },
    });
    setBusy(false);
    if (r.ok) {
      toast({ title: 'مطلب دستی ثبت شد', description: 'وارد خط لوله پردازش شد؛ با برچسب «ورود دستی» — نه دریافت خودکار.' });
      setContent(''); setTitle(''); setUrl('');
    } else {
      toast({ title: 'ثبت ناموفق', description: r.error, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <button className="flex items-center gap-2 text-sm font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ClipboardPen className="h-4 w-4" />
          ورود دستی مطلب (وقتی دسترسی خودکار به منبع ممکن نیست)
          <Badge variant="outline" className="text-[10px]">مسیر جایگزین مجاز</Badge>
          <span className="text-xs text-slate-400">{open ? 'بستن' : 'باز کردن'}</span>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-500 leading-5">
            این قابلیت جایگزین اتصال‌دهنده نیست؛ مطلبِ اینجا وارد‌شده صراحتاً «ورود دستی» ثبت می‌شود و در خط لوله همانند مطالب دیگر پردازش می‌گردد (نرمال‌سازی، استخراج ادعا، راستی‌آزمایی).
          </p>
          <div><Label className="text-xs">متن مطلب (حداقل ۴۰ نویسه، حداکثر ۲۰هزار نویسه)</Label>
            <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="متن کامل خبر/پیام را دقیقاً همان‌طور که است وارد کنید..." />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label className="text-xs">عنوان (اختیاری)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label className="text-xs">پیوند اصلی (اختیاری)</Label><Input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
            <div><Label className="text-xs">انتساب به منبع موجود (اختیاری)</Label>
              <select className="w-full text-sm border rounded-md px-2 py-2 bg-white" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">— بدون منبع (ورود دستی خالص) —</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={submit} disabled={busy || content.trim().length < 40}>{busy ? 'در حال ثبت...' : 'ثبت و ورود به خط لوله'}</Button>
        </CardContent>
      )}
    </Card>
  );
}

export function ComparePanel() {
  const [a, setA] = useState(''); const [b, setB] = useState('');
  const [cats, setCats] = useState<Array<{ id: string; name: string }>>([]);
  const [catId, setCatId] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const c = await api<{ categories: Array<{ id: string; name: string }> }>('/api/categories');
      if (c.ok) setCats(c.categories);
    })();
  }, []);

  const compare = async () => {
    setErr(null); setResult(null);
    const r = await api(`/api/reports/compare?a=${a}&b=${b}${catId ? `&categoryId=${catId}` : ''}`);
    if (r.ok) setResult(r as unknown as Record<string, unknown>);
    else setErr(r.error || 'خطا');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">مقایسه گزارش‌های دو تاریخ</h2>
      <div className="flex flex-wrap items-end gap-2">
        <div><div className="text-xs text-slate-500 mb-1">تاریخ مبنا</div><Input type="date" value={a} onChange={(e) => setA(e.target.value)} dir="ltr" /></div>
        <div><div className="text-xs text-slate-500 mb-1">تاریخ مقایسه</div><Input type="date" value={b} onChange={(e) => setB(e.target.value)} dir="ltr" /></div>
        <div>
          <div className="text-xs text-slate-500 mb-1">دسته</div>
          <select className="text-sm border rounded-md px-2 py-2 bg-white" value={catId} onChange={(e) => setCatId(e.target.value)}>
            <option value="">گزارش جامع</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Button onClick={compare} disabled={!a || !b}><GitCompareArrows className="h-4 w-4 ml-1" /> مقایسه</Button>
      </div>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      {result && <CompareResult data={result} />}
    </div>
  );
}

function CompareResult({ data }: { data: Record<string, unknown> }) {
  const a = data.a as { date: string; jDate: string; status: string; summary: string; events: string[]; claimsCount: number; postsCount: number };
  const b = data.b as typeof a;
  const newInB = data.newInB as string[];
  const goneInB = data.goneInB as string[];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[a, b].map((r, i) => (
        <Card key={i}>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{i === 0 ? 'مبنا' : 'مقایسه'}: {r.jDate} ({r.date}) — {r.status}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="text-xs text-slate-500">مطالب: {faNum(r.postsCount)} | ادعاها: {faNum(r.claimsCount)}</div>
            <p className="leading-6 text-xs">{r.summary || '—'}</p>
          </CardContent>
        </Card>
      ))}
      <Card className="md:col-span-2">
        <CardHeader className="pb-1"><CardTitle className="text-sm">تفاوت‌ها</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>
            <div className="font-semibold text-emerald-700 text-xs mb-1">رویدادهای جدید در تاریخ دوم:</div>
            {newInB.length ? <ul className="list-disc pr-5 text-xs space-y-0.5">{newInB.map((t, i) => <li key={i}>{t}</li>)}</ul> : <div className="text-xs text-slate-400">—</div>}
          </div>
          <div>
            <div className="font-semibold text-rose-700 text-xs mb-1">رویدادهایی که در تاریخ دوم تکرار نشدند:</div>
            {goneInB.length ? <ul className="list-disc pr-5 text-xs space-y-0.5">{goneInB.map((t, i) => <li key={i}>{t}</li>)}</ul> : <div className="text-xs text-slate-400">—</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
