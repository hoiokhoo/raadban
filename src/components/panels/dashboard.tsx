'use client';
/**
 * پنل داشبورد وضعیت امروز (فصل ۱۲ بند ۱)
 */
import { useEffect, useState } from 'react';
import { api, faNum, faDateTime, statusStyle, PLATFORM_LABELS } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TripleDate } from '@/components/triple-date';
import { Activity, RefreshCw, Database, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';

interface StatusData {
  today: string;
  sources: { active: number; total: number; withRecentErrors: number };
  todayPosts: number;
  todayEvents: number;
  totalEvents: number;
  todayClaims: number;
  claimsByStatus: Array<{ status: string; _count: number }>;
  reportsToday: Array<{ id: string; status: string; category: string; jDate: string; generatedAt: string }>;
  scheduler: { started: boolean; lastTickAt: string | null; runningJobs: string[]; enabled: boolean };
  schedule: { reportTime?: string; catchUp?: boolean };
  upcomingFetches: Array<{ id: string; name: string; platform: string; lastFetchAt: string | null; status: string }>;
  timezone: string;
}

export function DashboardPanel() {
  const [data, setData] = useState<StatusData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    const r = await api<StatusData>('/api/status');
    if (r.ok) setData(r);
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const run = async (kind: string) => {
    setBusy(kind);
    const r = await api('/api/system/run', { method: 'POST', body: { kind } });
    setBusy(null);
    toast({ title: r.ok ? 'اجرا پایان یافت' : 'خطا در اجرا', description: r.ok ? 'جزئیات در بخش خطاها و سوابق' : r.error });
    load();
  };

  if (!data) return <LoadingCard title="داشبورد وضعیت امروز" />;

  const cards = [
    { label: 'منابع فعال', value: `${faNum(data.sources.active)} از ${faNum(data.sources.total)}`, icon: <Database className="h-5 w-5" />, color: 'text-teal-700' },
    { label: 'مطالب دریافتی امروز', value: faNum(data.todayPosts), icon: <Activity className="h-5 w-5" />, color: 'text-sky-700' },
    { label: 'رویدادهای یکتای امروز', value: faNum(data.todayEvents), icon: <RefreshCw className="h-5 w-5" />, color: 'text-violet-700' },
    { label: 'ادعاهای امروز', value: faNum(data.todayClaims), icon: <ShieldCheck className="h-5 w-5" />, color: 'text-emerald-700' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">داشبورد وضعیت امروز</h2>
        <div className="text-sm text-slate-500 flex flex-col items-end gap-0.5">
          <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> امروز (میلادی): {faDate(data.today)} (منطقه زمانی {data.timezone})</span>
          <TripleDate date={new Date()} className="text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-full bg-slate-100 ${c.color}`}>{c.icon}</div>
              <div>
                <div className="text-2xl font-bold">{c.value}</div>
                <div className="text-xs text-slate-500">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.sources.withRecentErrors > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="p-4 flex items-center gap-2 text-rose-800 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {faNum(data.sources.withRecentErrors)} منبع در ۲۴ ساعت اخیر خطا یا محدودیت دسترسی داشته‌اند — جزئیات در «گزارش خطاها».
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">اجراهای دستی</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => run('ingest')} disabled={busy !== null}>
              {busy === 'ingest' ? '...' : 'دریافت از همه منابع'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => run('pipeline')} disabled={busy !== null}>
              {busy === 'pipeline' ? '...' : 'پردازش مطالب خام'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => run('factcheck')} disabled={busy !== null}>
              {busy === 'factcheck' ? '...' : 'راستی‌آزمایی ادعاهای در انتظار'}
            </Button>
            <Button size="sm" onClick={() => run('report')} disabled={busy !== null}>
              {busy === 'report' ? '...' : 'تولید گزارش امروز'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">وضعیت زمان‌بند</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${data.scheduler.started ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {data.scheduler.started ? 'زمان‌بند فعال است (tick هر دقیقه)' : 'زمان‌بند غیرفعال'}
            </div>
            <div className="text-slate-500">گزارش شبانه: ساعت {faNum(data.schedule.reportTime || '22:30')} — جبران بازه ازدست‌رفته: {data.schedule.catchUp === false ? 'خاموش' : 'روشن'}</div>
            <div className="text-slate-500">آخرین tick: {data.scheduler.lastTickAt ? faDateTime(data.scheduler.lastTickAt) : 'هنوز اجرا نشده'}</div>
            {data.scheduler.runningJobs.length > 0 && (
              <div className="text-amber-700">در حال اجرا: {data.scheduler.runningJobs.join('، ')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-3 [&>*]:min-w-0">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-base">وضعیت ادعاها (کل)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.claimsByStatus.length === 0 && <span className="text-sm text-slate-400">هنوز ادعایی ثبت نشده</span>}
            {data.claimsByStatus.map((s) => (
              <Badge key={s.status} className={statusStyle(s.status)}>
                {s.status.replace(/_/g, ' ')}: {faNum(s._count)}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-base">آخرین دریافت‌ها</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {data.upcomingFetches.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 min-w-0">
                <span className="truncate">{s.name} <span className="text-xs text-slate-400">({PLATFORM_LABELS[s.platform] || s.platform})</span></span>
                <span className="flex items-center gap-2 shrink-0">
                  <Badge className={statusStyle(s.status)}>{s.status.replace(/_/g, ' ')}</Badge>
                  <span className="text-xs text-slate-400">{s.lastFetchAt ? faDateTime(s.lastFetchAt) : 'هرگز'}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {data.reportsToday.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">گزارش‌های امروز</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.reportsToday.map((r) => (
              <Badge key={r.id} className={statusStyle(r.status)}>
                {r.category}: {r.status} — {r.jDate}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function LoadingCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-6 text-sm text-slate-400 flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" /> در حال بارگذاری...
      </CardContent>
    </Card>
  );
}

// اصلاح تابع تاریخ ساده
function faDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
      .format(new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso));
  } catch { return iso; }
}
