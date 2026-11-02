'use client';
/**
 * پنل تحلیل — قابلیت‌های T9
 * تب‌ها: دسته‌بندی موضوعی | خوشه‌ها و تایم‌لاین گره‌دار | ترجمه فارسی | ارجاع‌ها (رفرنس)
 * همه دکمه‌ها عملیات واقعی روی API صدا می‌زنند و خطاها صادقانه نمایش داده می‌شوند.
 */
import { useCallback, useEffect, useState } from 'react';
import { api, faNum, faDateTime } from '@/lib/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tags, Network, Languages, Quote, Loader2, Play, Clock, ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { LoadingCard } from './dashboard';

// ---------- انواع ----------
interface TopicStat { name: string; slug: string; categoryId: string | null; count: number }
interface TopicsPayload { topics: TopicStat[]; uncategorized: number }
interface CategorizeResult { processed: number; categorized: number; fallback: number; aiErrors: string[] }

interface ClusterMember {
  postId: string; isFirst: boolean; publishedAt: string; similarity: number;
  sourceName: string; sourcePlatform: string; minutesAfterFirst: number;
  url: string | null; snippet: string;
}
interface ClusterRow {
  id: string; title: string; firstSourceName: string; firstPublishedAt: string;
  memberCount: number; outletsCount?: number; language: string; members: ClusterMember[];
}
interface ClustersPayload { total: number; page: number; sort?: string; clusters: ClusterRow[] }

interface RefRow {
  id: string; postId: string; refKind: string; refText: string; refDescription: string | null;
  matchedTitle: string | null; similarity: number | null; verdict: string; analysis: string | null;
  model: string | null; createdAt: string;
  post: { snippet: string; url: string | null; publishedAt: string | null; sourceName: string; platform: string };
}
interface RefsPayload { total: number; byVerdict: Array<{ verdict: string; count: number }>; references: RefRow[] }

// ---------- رنگ‌بندی ----------
const TOPIC_COLORS = ['bg-teal-600', 'bg-amber-600', 'bg-rose-600', 'bg-indigo-600', 'bg-emerald-600', 'bg-fuchsia-600', 'bg-sky-600', 'bg-violet-600', 'bg-pink-600', 'bg-lime-600', 'bg-orange-600', 'bg-slate-500'];
const VERDICT_STYLE: Record<string, string> = {
  'مرتبط_و_معتبر': 'bg-emerald-600 text-white',
  'مرتبط_اما_تأییدنشده': 'bg-amber-500 text-white',
  'بی‌ارتباط': 'bg-rose-600 text-white',
  'یافت_نشده': 'bg-slate-500 text-white',
};
const KIND_LABELS: Record<string, string> = {
  'خبر_دیگر': 'خبر دیگر', 'واقعه_تاریخی': 'واقعه تاریخی', 'نقل_قول_مستقیم': 'نقل‌قول مستقیم',
};

// ---------- تب دسته‌بندی موضوعی ----------
function TopicsTab() {
  const [data, setData] = useState<TopicsPayload | null>(null);
  const [running, setRunning] = useState(false);
  const [limit, setLimit] = useState(100);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [topicPosts, setTopicPosts] = useState<Array<{ id: string; content: string; translationFa: string | null; publishedAt: string | null; source?: { name: string } }> | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<TopicsPayload>('/api/topics');
    if (r.ok) setData(r);
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    const r = await api<CategorizeResult>('/api/posts/categorize', { method: 'POST', body: { limit } });
    setRunning(false);
    if (r.ok) {
      const d = r as unknown as CategorizeResult;
      toast({
        title: `دسته‌بندی انجام شد: ${faNum(d.categorized)} خبر از ${faNum(d.processed)}`,
        description: d.aiErrors.length ? `خطاهای AI: ${d.aiErrors.length} دسته` : d.fallback ? `${faNum(d.fallback)} مورد «سایر/نامشخص»` : 'بدون خطا',
        variant: d.aiErrors.length ? 'destructive' : 'default',
      });
      load();
    } else toast({ title: 'خطا در دسته‌بندی', description: r.error, variant: 'destructive' });
  };

  const openTopic = async (slug: string, categoryId: string | null) => {
    if (!categoryId) return;
    setExpanded(expanded === slug ? null : slug);
    setTopicPosts(null);
    const r = await api<{ posts: Array<{ id: string; content: string; translationFa: string | null; publishedAt: string | null; source?: { name: string } }> }>(`/api/posts?categoryId=${categoryId}&take=8`);
    if (r.ok) setTopicPosts(r.posts);
  };

  return (
    <div className="space-y-4">
      <Card className="border-teal-200 bg-teal-50">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-teal-900">
          <span>طبقه‌بندی هوشمند همه اخبار به ۱۲ موضوع ثابت فارسی — دسته‌ها همیشه در فهرست ثابت می‌مانند و مدل نمی‌تواند دسته خودسرانه بسازد.</span>
          <div className="flex items-center gap-2">
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="text-xs border rounded px-2 py-1 bg-white">
              <option value={50}>۵۰ خبر</option>
              <option value={100}>۱۰۰ خبر</option>
              <option value={200}>۲۰۰ خبر</option>
              <option value={300}>۳۰۰ خبر</option>
            </select>
            <Button size="sm" onClick={run} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Play className="h-4 w-4 ml-1" />}
              دسته‌بندی هوشمند
            </Button>
          </div>
        </CardContent>
      </Card>

      {!data ? <LoadingCard title="آمار موضوعی" /> : (
        <div className="grid gap-2">
          {data.uncategorized > 0 && (
            <Card><CardContent className="p-2.5 text-xs text-amber-800 bg-amber-50 border-amber-200">
              {faNum(data.uncategorized)} خبر هنوز بی‌موضوع است — با دکمه بالا دسته‌بندی کنید (هر بار قدیمی‌ترین‌ها).
            </CardContent></Card>
          )}
          {data.topics.map((t, i) => (
            <Card key={t.slug} className={expanded === t.slug ? 'border-teal-400' : ''}>
              <CardContent className="p-2.5">
                <button className="w-full flex items-center gap-3 text-right" onClick={() => openTopic(t.slug, t.categoryId)}>
                  <span className={`text-white text-[10px] rounded px-2 py-0.5 ${TOPIC_COLORS[i]}`}>{t.name}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${TOPIC_COLORS[i]}`} style={{ width: `${data.topics.reduce((m, x) => Math.max(m, x.count), 1) ? Math.max(2, (t.count / data.topics.reduce((m, x) => Math.max(m, x.count), 1)) * 100) : 0}%` }} />
                  </div>
                  <span className="text-xs font-medium tabular-nums">{faNum(t.count)}</span>
                </button>
                {expanded === t.slug && (
                  <div className="mt-2 space-y-1.5 border-t pt-2">
                    {!topicPosts ? <div className="text-xs text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> در حال بارگذاری...</div>
                      : topicPosts.length === 0 ? <div className="text-xs text-slate-400">خبری در این موضوع نیست.</div>
                      : topicPosts.map((p) => (
                        <div key={p.id} className="text-xs bg-slate-50 rounded p-2 leading-6">
                          <span className="text-slate-400">{p.source?.name} — {faDateTime(p.publishedAt)}</span>
                          <div className="line-clamp-2">{(p.translationFa || p.content).slice(0, 200)}</div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- تب خوشه‌ها و تایم‌لاین (همچنین به‌صورت تب مستقل «خط خبری» در ناوبری اصلی) ----------
export function ClustersTab() {
  const [data, setData] = useState<ClustersPayload | null>(null);
  const [building, setBuilding] = useState(false);
  const [days, setDays] = useState(7);
  const [sort, setSort] = useState<'outlets' | 'recent'>('outlets');
  const { toast } = useToast();

  const load = useCallback(async (sortMode: 'outlets' | 'recent' = 'outlets') => {
    const r = await api<ClustersPayload>(`/api/clusters?take=20&sort=${sortMode}`);
    if (r.ok) setData(r);
  }, []);
  useEffect(() => { load(sort); }, [load, sort]);

  const build = async () => {
    setBuilding(true);
    toast({ title: 'خوشه‌بندی در حال اجرا...', description: 'ممکن است تا یک دقیقه طول بکشد' });
    const r = await api<{ scannedPosts: number; totalInWindow: number; clustersCreated: number; topExample: { firstSource: string; republishers: string[] } | null }>('/api/clusters/build', { method: 'POST', body: { days }, timeoutMs: 170000 });
    setBuilding(false);
    if (r.ok) {
      const d = r as unknown as { scannedPosts: number; totalInWindow: number; clustersCreated: number };
      toast({
        title: `${faNum(d.clustersCreated)} خوشه از ${faNum(d.scannedPosts)} خبر ساخته شد`,
        description: d.totalInWindow > d.scannedPosts
          ? `پوشش: تازه‌ترین ${faNum(d.scannedPosts)} خبر از ${faNum(d.totalInWindow)} خبرِ این بازه — برای پوشش کامل، بازه را کوتاه‌تر کنید`
          : undefined,
      });
      load();
    } else toast({ title: 'خطا در خوشه‌بندی', description: r.error, variant: 'destructive' });
  };

  return (
    <div className="space-y-4">
      <Card className="border-indigo-200 bg-indigo-50">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-900">
          <span>خط خبری: اخبار مشابه خوشه می‌شوند و «خط گره‌دار» نشان می‌دهد چه‌کسی اول منتشر کرده و چه‌رسانه‌هایی به‌ترتیب زمان بازنشر/بازگویی کرده‌اند. بازسازی خودکار هر ۲ ساعت + دکمهٔ دستی.</span>
          <div className="flex items-center gap-2">
            <select value={sort} onChange={(e) => setSort(e.target.value as 'outlets' | 'recent')} className="text-xs border rounded px-2 py-1 bg-white">
              <option value="outlets">بیشترین رسانه‌ها</option>
              <option value="recent">تازه‌ترین‌ها</option>
            </select>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="text-xs border rounded px-2 py-1 bg-white">
              <option value={3}>۳ روز اخیر</option>
              <option value={7}>۷ روز اخیر</option>
              <option value={14}>۱۴ روز اخیر</option>
            </select>
            <Button size="sm" onClick={build} disabled={building}>
              {building ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RefreshCw className="h-4 w-4 ml-1" />}
              ساخت خوشه‌ها
            </Button>
          </div>
        </CardContent>
      </Card>

      {!data ? <LoadingCard title="خوشه‌ها" /> : data.clusters.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-slate-400">هنوز خوشه‌ای ساخته نشده — دکمه «ساخت خوشه‌ها» را بزنید.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          <div className="text-xs text-slate-400">{faNum(data.total)} خوشه — {sort === 'outlets' ? 'بیشترین رسانهٔ متمایز اول' : 'تازه‌ترین اولین‌انتشار اول'}</div>
          {data.clusters.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-medium leading-7">{c.title}</div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <Badge className="bg-emerald-600 text-white">{faNum(c.outletsCount ?? new Set(c.members.map((m) => m.sourceName)).size)} رسانه</Badge>
                  <span>اولین انتشار: {faDateTime(c.firstPublishedAt)} — {c.firstSourceName}</span>
                </div>
                {/* خط گره‌دار RTL — گره اول راست */}
                <div className="overflow-x-auto py-2">
                  <div className="flex items-stretch gap-0 min-w-max">
                    {c.members.map((m, i) => (
                      <div key={m.postId} className="flex items-center">
                        {i > 0 && <ArrowLeft className="h-4 w-4 mx-1 text-slate-300 shrink-0" />}
                        <div className={`rounded-xl border-2 p-2.5 min-w-[150px] max-w-[210px] ${m.isFirst ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="flex items-center gap-1 mb-1">
                            {m.isFirst
                              ? <span className="text-[10px] bg-emerald-600 text-white rounded px-1.5 py-0.5 font-bold">اولین انتشار</span>
                              : <span className="text-[10px] bg-slate-500 text-white rounded px-1.5 py-0.5">بازنشر</span>}
                            {m.similarity > 0 && !m.isFirst && <span className="text-[9px] text-slate-400">{faNum(Math.round(m.similarity * 100))}٪ شباهت</span>}
                          </div>
                          <div className="text-xs font-bold text-slate-800">{m.sourceName}</div>
                          <div className="text-[10px] text-slate-400">{m.sourcePlatform}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />{faDateTime(m.publishedAt)}
                          </div>
                          {!m.isFirst && m.minutesAfterFirst >= 0 && (
                            <div className="text-[10px] text-amber-700 mt-0.5">+{faNum(m.minutesAfterFirst)} دقیقه پس از اولین</div>
                          )}
                          {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-[10px] text-teal-700 inline-flex items-center gap-0.5 mt-1"><ExternalLink className="h-3 w-3" />اصل مطلب</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 bg-slate-50 rounded p-2 leading-5">
                  <b>خط زمانی:</b> {c.members[0]?.sourceName} ساعت {faDateTime(c.members[0]?.publishedAt)} اولین بار منتشر کرد
                  {c.members.slice(1).map((m) => ` → ${m.sourceName} (+${faNum(m.minutesAfterFirst)} دقیقه)`).join('')}.
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- تب ترجمه ----------
function TranslateTab() {
  const [running, setRunning] = useState(false);
  const [limit, setLimit] = useState(25);
  const [result, setResult] = useState<{ targeted: number; translated: number; failed: number; remaining: number; errors: Array<{ postId: string; error: string }> } | null>(null);
  const { toast } = useToast();

  const run = async () => {
    setRunning(true);
    const r = await api<{ targeted: number; translated: number; failed: number; remaining: number; errors: Array<{ postId: string; error: string }> }>('/api/posts/translate-pending', { method: 'POST', body: { limit }, timeoutMs: 170000 });
    setRunning(false);
    if (r.ok) {
      setResult(r as unknown as typeof result);
      const d = r as unknown as NonNullable<typeof result>;
      toast({
        title: `${faNum(d.translated)} خبر ترجمه شد`,
        description: d.failed ? `${faNum(d.failed)} خطا — باقی‌مانده: ${faNum(d.remaining)}` : `باقی‌مانده: ${faNum(d.remaining)}`,
        variant: d.failed && !d.translated ? 'destructive' : 'default',
      });
    } else toast({ title: 'خطا در ترجمه', description: r.error, variant: 'destructive' });
  };

  return (
    <div className="space-y-4">
      <Card className="border-sky-200 bg-sky-50">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-900">
          <span>ترجمه فارسی روان همه اخبار خارجی (انگلیسی، عبری، فرانسوی، عربی و...) با خلاصه و نتیجه‌گیری بی‌طرف — ترجمه در کارت خود خبر و در خوشه‌ها استفاده می‌شود.</span>
          <div className="flex items-center gap-2">
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="text-xs border rounded px-2 py-1 bg-white">
              <option value={10}>۱۰ خبر</option>
              <option value={25}>۲۵ خبر</option>
              <option value={50}>۵۰ خبر</option>
            </select>
            <Button size="sm" onClick={run} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Languages className="h-4 w-4 ml-1" />}
              ترجمه دسته‌جمعی
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card><CardContent className="p-3 text-xs space-y-1.5">
          <div>هدف: <b>{faNum(result.targeted)}</b> — ترجمه‌شده: <b className="text-emerald-700">{faNum(result.translated)}</b> — ناموفق: <b className={result.failed ? 'text-rose-700' : ''}>{faNum(result.failed)}</b> — باقی‌مانده کل: <b>{faNum(result.remaining)}</b></div>
          {result.errors.length > 0 && (
            <div className="bg-rose-50 text-rose-800 rounded p-2 space-y-1">
              {result.errors.map((e, i) => <div key={i} className="truncate">• {e.error}</div>)}
            </div>
          )}
        </CardContent></Card>
      )}
    </div>
  );
}

// ---------- تب ارجاع‌ها ----------
function ReferencesTab() {
  const [data, setData] = useState<RefsPayload | null>(null);
  const [running, setRunning] = useState(false);
  const [limit, setLimit] = useState(10);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<RefsPayload>('/api/references?take=25');
    if (r.ok) setData(r);
  }, []);
  useEffect(() => { load(); }, [load]);

  const scan = async () => {
    setRunning(true);
    toast({ title: 'اسکن ارجاع‌ها در حال اجرا...', description: 'استخراج + تطبیق + داوری — چند دقیقه ممکن است طول بکشد' });
    const r = await api<{ scanned: number; withReferences: number; aiErrors: number }>('/api/references/scan', { method: 'POST', body: { limit }, timeoutMs: 170000 });
    setRunning(false);
    if (r.ok) {
      const d = r as unknown as { scanned: number; withReferences: number; aiErrors: number };
      toast({ title: `${faNum(d.withReferences)} خبر دارای ارجاع از ${faNum(d.scanned)} خبر`, description: d.aiErrors ? `${faNum(d.aiErrors)} خطای AI` : undefined, variant: d.aiErrors && !d.withReferences ? 'destructive' : 'default' });
      load();
    } else toast({ title: 'خطا در اسکن', description: r.error, variant: 'destructive' });
  };

  return (
    <div className="space-y-4">
      <Card className="border-fuchsia-200 bg-fuchsia-50">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-fuchsia-900">
          <span>خبرهایی که به واقعه تاریخی، خبر دیگر یا نقل‌قول ارجاع می‌دهند: ارجاع استخراج، در پایگاه تطبیق و ارتباط/صحت آن راستی‌آزمایی می‌شود. عدم یافتن همیشه صادقانه اعلام می‌شود.</span>
          <div className="flex items-center gap-2">
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="text-xs border rounded px-2 py-1 bg-white">
              <option value={5}>۵ خبر</option>
              <option value={10}>۱۰ خبر</option>
              <option value={25}>۲۵ خبر</option>
            </select>
            <Button size="sm" onClick={scan} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Quote className="h-4 w-4 ml-1" />}
              اسکن ارجاع‌ها
            </Button>
          </div>
        </CardContent>
      </Card>

      {!data ? <LoadingCard title="ارجاع‌ها" /> : data.references.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-slate-400">هنوز ارجاعی تحلیل نشده — دکمه «اسکن ارجاع‌ها» را بزنید.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            {data.byVerdict.map((v) => (
              <Badge key={v.verdict} className={VERDICT_STYLE[v.verdict] || 'bg-slate-500 text-white'}>{v.verdict.replace(/_/g, ' ')}: {faNum(v.count)}</Badge>
            ))}
          </div>
          {data.references.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={VERDICT_STYLE[r.verdict] || 'bg-slate-500 text-white'}>{r.verdict.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline">{KIND_LABELS[r.refKind] || r.refKind}</Badge>
                  {r.similarity != null && <Badge variant="outline">{faNum(Math.round(r.similarity * 100))}٪ تطبیق</Badge>}
                  <span className="text-slate-400">{r.post.sourceName} — {faDateTime(r.post.publishedAt)}</span>
                </div>
                <div className="bg-slate-50 rounded p-2 leading-6"><b>متن خبر:</b> {r.post.snippet}</div>
                <div className="bg-fuchsia-50 rounded p-2 leading-6 border border-fuchsia-100"><b>ارجاع ({r.refKind.replace(/_/g, ' ')}):</b> «{r.refText}»{r.refDescription ? <div className="mt-1 text-slate-600">{r.refDescription}</div> : null}</div>
                {r.matchedTitle && <div className="bg-emerald-50 rounded p-2 leading-6 border border-emerald-100"><b>تطبیق در پایگاه:</b> {r.matchedTitle}</div>}
                {r.analysis && <div className="leading-6 text-slate-700"><b>داوری راستی‌آزمایی:</b> {r.analysis}</div>}
                {r.model && <div className="text-[10px] text-slate-400">مدل داور: {r.model}</div>}
                {r.post.url && <a href={r.post.url} target="_blank" rel="noreferrer" className="text-teal-700 inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />خبر اصلی</a>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- پنل اصلی ----------
type TabKey = 'topics' | 'clusters' | 'translate' | 'references';
const SUBTABS: Array<{ key: TabKey; label: string; icon: typeof Tags }> = [
  { key: 'topics', label: 'دسته‌بندی موضوعی', icon: Tags },
  { key: 'clusters', label: 'خوشه‌ها و تایم‌لاین', icon: Network },
  { key: 'translate', label: 'ترجمه فارسی', icon: Languages },
  { key: 'references', label: 'ارجاع‌ها (رفرنس)', icon: Quote },
];

export function AnalysisPanel() {
  const [tab, setTab] = useState<TabKey>('topics');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">تحلیل پیشرفته اخبار</h2>
        <div className="flex gap-1 flex-wrap">
          {SUBTABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 transition ${tab === t.key ? 'bg-teal-700 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Icon className="h-3.5 w-3.5" />{t.label}
              </button>
            );
          })}
        </div>
      </div>
      {tab === 'topics' && <TopicsTab />}
      {tab === 'clusters' && <ClustersTab />}
      {tab === 'translate' && <TranslateTab />}
      {tab === 'references' && <ReferencesTab />}
    </div>
  );
}
