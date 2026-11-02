'use client';
/**
 * خط لحظه‌ای اخبار — تب زندهٔ همهٔ مطالب گردآوری‌شده
 *
 * خواستهٔ کاربر (۳ نوامبر ۲۰۲۶): «میخوام کل اخبار لحظه‌ای رو در یه تب برنامه ببینم
 * حتی اگر اتصال بله فعلا نباشه» — این پانل:
 *  - مستقل از بات بله است (فقط /api/live را می‌خواند؛ هیچ تماسی با بله ندارد)
 *  - هر ۲۵ ثانیه با polling تدریجی (since) به‌روز می‌شود و مطالب تازه را بالای فید می‌آورد
 *  - فیلتر خارجی/داخلی، جست‌وجوی متنی، توقف/ادامهٔ جریان و «بارگذاری بیشتر» دارد
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, faNum, PLATFORM_LABELS } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Activity, Pause, Play, RefreshCw, ExternalLink, Search, ChevronDown, RadioTower } from 'lucide-react';
import { LoadingCard } from './dashboard';
import { verdictBadge, faRelative } from '@/lib/live';
import { jalaliFull } from '@/lib/persian';

interface LivePost {
  id: string;
  title: string;
  isTranslated: boolean;
  url: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  language: string;
  sourceName: string | null;
  sourcePlatform: string | null;
  scope: 'داخلی' | 'خارجی' | 'بدون منبع';
  claims: { verified: number; disputed: number; refuted: number; pending: number; total: number } | null;
}

interface LiveData {
  posts: LivePost[];
  counts: { total: number; today: number; foreign: number; domestic: number };
  serverTime: string;
}

const SCOPE_CHIPS: Array<{ key: 'all' | 'foreign' | 'domestic'; label: string }> = [
  { key: 'all', label: 'همه' },
  { key: 'foreign', label: 'خارجی' },
  { key: 'domestic', label: 'داخلی' },
];

function scopeBadgeClass(s: LivePost['scope']): string {
  if (s === 'خارجی') return 'bg-indigo-100 text-indigo-800';
  if (s === 'داخلی') return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-600';
}

export function LiveNewsPanel() {
  const [posts, setPosts] = useState<LivePost[]>([]);
  const [counts, setCounts] = useState<LiveData['counts'] | null>(null);
  const [scope, setScope] = useState<'all' | 'foreign' | 'domestic'>('all');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [live, setLive] = useState(true); // جریان خودکار روشن
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [freshFlash, setFreshFlash] = useState(false);

  const seenIds = useRef<Set<string>>(new Set());
  const sinceRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // جست‌وجوی تاخیری — هر کلید، درخواست نمی‌زند
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 500);
    return () => clearTimeout(t);
  }, [qInput]);

  const merge = useCallback((incoming: LivePost[]) => {
    const fresh = incoming.filter((p) => !seenIds.current.has(p.id));
    for (const p of fresh) seenIds.current.add(p.id);
    if (fresh.length > 0) {
      setPosts((prev) => {
        const merged = [...fresh, ...prev].sort((a, b) =>
          a.fetchedAt === b.fetchedAt ? (a.id < b.id ? 1 : -1) : (a.fetchedAt < b.fetchedAt ? 1 : -1)
        );
        return merged;
      });
      setFreshIds(new Set(fresh.map((p) => p.id)));
      setFreshFlash(true);
      setTimeout(() => setFreshFlash(false), 12000);
    }
    return fresh.length;
  }, []);

  // بارگذاری کامل (اولین بار یا تغییر فیلتر)
  const reload = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    const sp = new URLSearchParams({ take: '60' });
    if (scope !== 'all') sp.set('scope', scope);
    if (q) sp.set('q', q);
    const r = await api<LiveData>(`/api/live?${sp.toString()}`);
    if (r.ok) {
      seenIds.current = new Set(r.posts.map((p) => p.id));
      setPosts(r.posts);
      setCounts(r.counts);
      sinceRef.current = r.serverTime;
      setLastRefresh(r.serverTime);
      setFreshIds(new Set());
    } else {
      setError(r.error || 'خطای خواندن خط لحظه‌ای');
    }
    setLoading(false);
  }, [scope, q]);

  // واکشی تدریجی — فقط مطالبِ جدیدتر از آخرین سرورمن (since)
  const poll = useCallback(async () => {
    const sp = new URLSearchParams({ take: '40' });
    if (sinceRef.current) sp.set('since', sinceRef.current);
    if (scope !== 'all') sp.set('scope', scope);
    if (q) sp.set('q', q);
    const r = await api<LiveData>(`/api/live?${sp.toString()}`);
    if (r.ok) {
      merge(r.posts);
      setCounts(r.counts);
      sinceRef.current = r.serverTime;
      setLastRefresh(r.serverTime);
    }
  }, [merge, scope, q]);

  useEffect(() => { reload(); }, [reload]); // با تغییر scope/q دوباره کامل می‌خواند

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      // وقتی تب پنهان است درخواست مزاحم نمی‌زنیم
      if (typeof document !== 'undefined' && document.hidden) return;
      poll();
    }, 25000);
    return () => clearInterval(id);
  }, [live, poll]);

  const loadMore = useCallback(async () => {
    const oldest = posts[posts.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    const sp = new URLSearchParams({ take: '50', before: oldest.fetchedAt });
    if (scope !== 'all') sp.set('scope', scope);
    if (q) sp.set('q', q);
    const r = await api<LiveData>(`/api/live?${sp.toString()}`);
    if (r.ok) {
      const extra = r.posts.filter((p) => !seenIds.current.has(p.id));
      for (const p of extra) seenIds.current.add(p.id);
      setPosts((prev) => [...prev, ...extra]);
      setCounts(r.counts);
    }
    setLoadingMore(false);
  }, [posts, scope, q]);

  const freshCount = useMemo(() => posts.filter((p) => freshIds.has(p.id)).length, [posts, freshIds]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-teal-600" /> خط لحظه‌ای اخبار
              {live ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  زنده
                </span>
              ) : (
                <Badge variant="outline" className="text-slate-500">متوقف</Badge>
              )}
            </CardTitle>
            {counts && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">امروز: {faNum(counts.today)} خبر تازه</Badge>
                <Badge variant="outline">مجموع: {faNum(counts.total)}</Badge>
                <Badge variant="outline" className="bg-indigo-50">خارجی: {faNum(counts.foreign)}</Badge>
                <Badge variant="outline" className="bg-emerald-50">داخلی: {faNum(counts.domestic)}</Badge>
              </div>
            )}
            <div className="ms-auto flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLive((v) => !v)}>
                {live ? <><Pause className="h-3.5 w-3.5" /> توقف جریان</> : <><Play className="h-3.5 w-3.5" /> ادامهٔ جریان</>}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => poll()} title="به‌روزرسانی همین حالا">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-xs space-y-3">
          <p className="text-slate-500 leading-5">
            همهٔ اخبار گردآوری‌شده از منابع فعال — بدون واسطه و بدون انتظار برای بات بله؛
            حتی اگر اتصال بله فعلاً قطع باشد این خط به نمایش ادامه می‌دهد.
            برچسب‌های راستی‌آزمایی همان نتیجه‌ای است که در کانال بله می‌رود.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {SCOPE_CHIPS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setScope(c.key)}
                  className={`text-xs rounded-lg px-3 py-1.5 border transition ${
                    scope === c.key ? 'bg-teal-700 text-white border-teal-700 font-medium' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute top-2.5 end-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="جست‌وجو در متن اخبار و ترجمه‌ها…"
                className="h-8 text-xs ps-3 pe-8"
              />
            </div>
          </div>
          {lastRefresh && (
            <p className="text-[11px] text-slate-400">
              آخرین به‌روزرسانی: {faRelative(lastRefresh)} ({jalaliFull(lastRefresh)})
              {live && ' — هر ۲۵ ثانیه خودکار'}
            </p>
          )}
        </CardContent>
      </Card>

      {loading && <LoadingCard title="خط لحظه‌ای" />}
      {error && !loading && <p className="text-rose-600 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="space-y-2" ref={listRef}>
          {freshFlash && freshCount > 0 && (
            <div className="text-xs bg-teal-50 border border-teal-200 text-teal-800 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <RadioTower className="h-3.5 w-3.5" /> {faNum(freshCount)} خبر تازه به فید اضافه شد
            </div>
          )}
          {posts.length === 0 && (
            <Card><CardContent className="py-10 text-center text-slate-400 text-sm">
              هنوز خبری در این فیلتر نیست — از تب «مدیریت منابع» چرخهٔ جمع‌آوری را اجرا کنید.
            </CardContent></Card>
          )}
          {posts.map((p) => {
            const badge = verdictBadge(p.claims);
            const isNew = freshIds.has(p.id);
            return (
              <Card key={p.id} className={`transition ${isNew ? 'ring-2 ring-teal-400 bg-teal-50/40' : ''}`}>
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    {p.imageUrl && (
                      <img
                        src={p.imageUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 object-cover rounded border bg-slate-100 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {isNew && <Badge className="bg-teal-700 text-white">جدید</Badge>}
                        <Badge className={scopeBadgeClass(p.scope)}>{p.scope}</Badge>
                        <b className="text-[12px]">{p.sourceName || 'بدون منبع'}</b>
                        {p.sourcePlatform && <Badge variant="outline">{PLATFORM_LABELS[p.sourcePlatform] || p.sourcePlatform}</Badge>}
                        {p.isTranslated && <Badge variant="outline" className="text-[10px]">ترجمه‌شده</Badge>}
                        {badge && <Badge variant="outline" className={`text-[10px] border ${badge.className}`}>{badge.label}</Badge>}
                        <span className="ms-auto text-[11px] text-slate-400 whitespace-nowrap" title={jalaliFull(p.fetchedAt)}>
                          {faRelative(p.fetchedAt)}
                        </span>
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-teal-700 shrink-0" title="متن اصلی">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-[13px] leading-6 whitespace-pre-wrap break-words">{p.title}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        دریافت: {faRelative(p.fetchedAt)}
                        {p.publishedAt ? ` — انتشار اصلی: ${faRelative(p.publishedAt)}` : ''}
                        {p.claims ? ` — ادعا: ${faNum(p.claims.total)}` : ''}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {posts.length >= 60 && (
            <div className="text-center pt-1">
              <Button size="sm" variant="outline" onClick={loadMore} disabled={loadingMore} className="text-xs">
                <ChevronDown className="h-3.5 w-3.5" /> {loadingMore ? '…' : 'بارگذاری مطالب قدیمی‌تر'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
