'use client';
/**
 * پنل خط زمانی انتشار — مأموریت ۳ و ۴ پرامپت سودر
 * خوشه‌های خبر مشابه + خط گره‌دار: کی اول منتشر کرد، چه کسی از چه کسی نقل کرد
 * + شفافیت دسته‌بندی قانون‌محور و صف ترجمه
 */
import { useCallback, useEffect, useState } from 'react';
import { api, faNum, PLATFORM_LABELS } from '@/lib/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TripleDate } from '@/components/triple-date';
import { Share2, Crown, ArrowUp, Languages, FolderTree, Loader2, RefreshCw, Link2, FileSearch } from 'lucide-react';
import { LoadingCard } from './dashboard';

interface ClusterRow {
  eventId: string; title: string; size: number;
  originSourceName: string | null; originNote: string | null;
  firstAt: string | null; lastAt: string | null; spanMin: number | null; importance: number;
}
interface NodeRow {
  postId: string; sourceName: string; platform: string; url: string | null;
  publishedAt: string | null; language: string; isOrigin: boolean; delayMin: number | null;
  quoteFromPostId: string | null; quoteFromSourceName: string | null; quoteSim: number | null;
}
interface Timeline { eventId: string; title: string; originNote: string | null; nodes: NodeRow[] }
interface RefRow {
  id: string; refType: string; refText: string; target: string | null; status: string;
  matchCount: number; note: string | null; checkedAt: string;
  post: { url: string | null; publishedAt: string | null; source?: { name: string } | null } | null;
  bestEvent: { id: string; title: string } | null;
}

const NODE_COLORS: Record<string, string> = {
  telegram: 'bg-sky-600', eitaa: 'bg-orange-600', bale: 'bg-violet-600',
  rss: 'bg-teal-700', twitter: 'bg-slate-800', web: 'bg-emerald-700',
};

function delayFa(min: number | null): string {
  if (min === null) return '—';
  if (min === 0) return 'همان لحظه';
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${faNum(m)} دقیقه بعد`;
  if (m === 0) return `${faNum(h)} ساعت بعد`;
  return `${faNum(h)} ساعت و ${faNum(m)} دقیقه بعد`;
}

function ClusterTimeline({ timeline }: { timeline: Timeline }) {
  const nodeById = new Map(timeline.nodes.map((n) => [n.postId, n]));
  return (
    <div className="relative pr-6" dir="rtl">
      {/* خط اصلی */}
      <div className="absolute right-2 top-2 bottom-2 w-0.5 bg-teal-300" />
      <div className="grid gap-4">
        {timeline.nodes.map((n, i) => {
          const color = NODE_COLORS[n.platform] || 'bg-slate-600';
          return (
            <div key={n.postId} className="relative">
              {/* گره */}
              <span className={`absolute -right-[1.55rem] top-3 h-4 w-4 rounded-full border-2 border-white shadow ${n.isOrigin ? 'bg-amber-500 ring-4 ring-amber-200' : color}`} />
              <Card className={n.isOrigin ? 'border-amber-400 bg-amber-50/60' : ''}>
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {n.isOrigin && (
                      <Badge className="bg-amber-500 text-white gap-1">
                        <Crown className="h-3 w-3" /> ناشر اول (گره منشأ)
                      </Badge>
                    )}
                    <span className={`h-2.5 w-2.5 rounded-full inline-block ${color}`} />
                    <b>{n.sourceName}</b>
                    <span className="text-slate-400">({PLATFORM_LABELS[n.platform] || n.platform})</span>
                    <TripleDate date={n.publishedAt} className="text-xs text-slate-600" />
                    {!n.isOrigin && <Badge variant="outline" className="text-[10px]">{delayFa(n.delayMin)}</Badge>}
                    {n.language !== 'fa' && (
                      <Badge variant="outline" className="text-[10px] gap-1"><Languages className="h-2.5 w-2.5" /> {n.language}</Badge>
                    )}
                  </div>
                  {/* یال نقل */}
                  {n.quoteFromSourceName && (
                    <div className="text-[11px] text-teal-800 bg-teal-50 border border-teal-100 rounded px-2 py-1 flex items-center gap-1">
                      <ArrowUp className="h-3 w-3" />
                      محتمل‌ترین مبدأ نقل: <b>{n.quoteFromSourceName}</b>
                      {n.quoteSim !== null && <span> · شباهت {faNum(Math.round(n.quoteSim * 100))}٪</span>}
                    </div>
                  )}
                  {!n.isOrigin && !n.quoteFromSourceName && (
                    <div className="text-[11px] text-slate-400">پوشش مشابه درون‌خوشه؛ مبدأ نقل با اطمینان قابل شناسایی نبود.</div>
                  )}
                  {n.url && (
                    <a href={n.url} target="_blank" rel="noreferrer" className="text-[11px] text-teal-700 inline-flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> مطلب اصلی
                    </a>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
      {timeline.originNote && (
        <div className="mt-3 text-[11px] leading-6 bg-slate-50 border rounded-lg p-2 text-slate-600">
          ⚖ {timeline.originNote}
        </div>
      )}
    </div>
  );
}

export function ClustersPanel() {
  const [clusters, setClusters] = useState<ClusterRow[] | null>(null);
  const [meta, setMeta] = useState<{ uncategorizedPosts: number; translationQueue: number } | null>(null);
  const [active, setActive] = useState<Timeline | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [showRefs, setShowRefs] = useState(false);
  const [refs, setRefs] = useState<RefRow[] | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<{ clusters: ClusterRow[]; meta: { uncategorizedPosts: number; translationQueue: number } }>('/api/clusters?min=2&days=14');
    if (r.ok) { setClusters(r.clusters); setMeta(r.meta); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openTimeline = async (eventId: string) => {
    setActive(null);
    const r = await api<Timeline>(`/api/clusters/${eventId}`);
    if (r.ok) setActive(r);
  };

  const rebuild = async () => {
    setRebuilding(true);
    const r = await api<{ scanned: number; clustersFound: number; eventsCreated: number; eventsLinked: number }>('/api/clusters', { method: 'POST', body: { days: 14 } });
    setRebuilding(false);
    toast({
      title: r.ok ? `بازسازی انجام شد: ${faNum(r.clustersFound)} خوشه از ${faNum(r.scanned)} مطلب` : 'بازسازی ناموفق',
      description: r.ok ? `${faNum(r.eventsCreated)} خوشه جدید · ${faNum(r.eventsLinked)} پیوند` : r.error,
      variant: r.ok ? 'default' : 'destructive',
    });
    if (r.ok) await load();
  };

  const loadRefs = useCallback(async () => {
    const r = await api<{ refs: RefRow[] }>('/api/references?take=50');
    if (r.ok) setRefs(r.refs);
  }, []);
  useEffect(() => { if (showRefs) loadRefs(); }, [showRefs, loadRefs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2"><Share2 className="h-6 w-6 text-teal-700" /> خط زمانی انتشار اخبار مشابه</h2>
        <Button variant="outline" size="sm" onClick={rebuild} disabled={rebuilding}>
          {rebuilding ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RefreshCw className="h-4 w-4 ml-1" />}
          بازسازی خوشه‌ها
        </Button>
      </div>

      <Card className="border-teal-200 bg-teal-50">
        <CardContent className="p-3 text-xs text-teal-900 leading-6">
          اخبار مشابه (بازنشر/بازگویی یک خبر) به‌صورت قطعی و بدون هوش مصنوعی خوشه‌بندی می‌شوند؛
          کهن‌ترین انتشار «ناشر اول» و بقیه با فاصله زمانی و محتمل‌ترین مبدأ نقل نمایش داده می‌شوند.
          کهن‌ترین انتشار «در این سامانه» است — ممکن است انتشار زودتر بیرون از پوشش سامانه وجود داشته باشد.
          {meta && <> — صف‌ها: دسته‌بندی‌نشده {faNum(meta.uncategorizedPosts)} مطلب · ترجمه {faNum(meta.translationQueue)} مطلب</>}
        </CardContent>
      </Card>

      {/* تحلیل رفرنس‌ها */}
      <Card>
        <CardContent className="p-3">
          <button className="text-sm font-semibold flex items-center gap-2 text-teal-800" onClick={() => setShowRefs(!showRefs)}>
            <FileSearch className="h-4 w-4" /> تحلیل رفرنس‌ها (ارجاع به واقعه تاریخی/منبع نقل‌قول)
            <Badge variant="outline" className="text-[10px]">{showRefs ? 'بستن' : 'نمایش'}</Badge>
          </button>
          {showRefs && (
            <div className="mt-2 grid gap-2 max-h-96 overflow-y-auto">
              {!refs ? <LoadingCard title="رفرنس‌ها" /> : refs.length === 0 ? (
                <div className="text-xs text-slate-400">هنوز رفرثی تحلیل نشده — دکمه بازسازی خط لوله را بزنید یا منتظر tick بعدی بمانید.</div>
              ) : refs.map((rf) => (
                <div key={rf.id} className="text-xs border rounded-lg p-2 space-y-1">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge className={rf.status === 'در_سامانه_یافت_شد' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{rf.refType}</Badge>
                    <Badge variant="outline" className="text-[10px]">{rf.status.replace(/_/g, ' ')}</Badge>
                    {rf.matchCount > 0 && <span className="text-slate-500">{faNum(rf.matchCount)} رویداد هم‌پوشان</span>}
                    <span className="text-slate-400">{rf.post?.source?.name || '—'}</span>
                  </div>
                  <div className="leading-6 text-slate-700">«{rf.refText.slice(0, 180)}»</div>
                  {rf.bestEvent && <div className="text-[11px] text-teal-700">نزدیک‌ترین رویداد: {rf.bestEvent.title.slice(0, 100)}</div>}
                  {rf.note && <div className="text-[11px] text-slate-500 leading-5">{rf.note}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* فهرست خوشه‌ها */}
      {!clusters ? <LoadingCard title="خوشه‌ها" /> : clusters.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-slate-400">
          خوشه‌ای با ۲ مطلب یا بیشتر یافت نشد — دکمه «بازسازی خوشه‌ها» را بزنید.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {clusters.map((c) => (
            <Card key={c.eventId} className={active?.eventId === c.eventId ? 'border-teal-500' : ''}>
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-6">{c.title}</div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-1 items-center">
                      <Badge className="bg-teal-700 text-white">{faNum(c.size)} مطلب مشابه</Badge>
                      {c.originSourceName && <Badge variant="outline" className="gap-1"><Crown className="h-3 w-3" /> ناشر اول: {c.originSourceName}</Badge>}
                      {c.spanMin !== null && c.spanMin > 0 && <span>بازه انتشار: {delayFa(c.spanMin)}</span>}
                      <TripleDate date={c.firstAt} className="text-xs" />
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openTimeline(c.eventId)}>
                    {active?.eventId === c.eventId ? 'در حال نمایش' : 'خط زمانی'}
                  </Button>
                </div>
                {active?.eventId === c.eventId && <ClusterTimeline timeline={active} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
