'use client';
/**
 * پنل رویدادهای مهم پیش رو — قابلیت ۱٫۱-د (سراسری، نه فقط آمریکا/اسرائیل/ایران)
 * هر رویداد: توضیح + سه‌تقویم + شمارش معکوس + اخبار مرتبط + نظرسنجی مستند + نقشه آرا + تحلیل AI
 */
import { useCallback, useEffect, useState } from 'react';
import { api, faNum } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TripleDate } from '@/components/triple-date';
import { CalendarClock, Sparkles, ExternalLink, Loader2, BarChart3, Map as MapIcon, Newspaper, Clock } from 'lucide-react';
import { LoadingCard } from './dashboard';

interface PollRow { label: string; value: number; unit: string; color: string; source: string; sourceUrl?: string; asOf?: string }
interface MapRow { label: string; value: number; color: string; note?: string }
interface SourceRow { name: string; url: string }
interface EventRow {
  id: string; slug: string; title: string; scope: string; category: string;
  eventDateISO: string | null; eventDateEndISO: string | null; dateNote: string | null;
  dateCertainty: string; description: string; importance: number; status: string;
  pollsJson: string | null; mapJson: string | null; liveMapUrl: string | null;
  sourcesJson: string | null; analysisJson: string | null; analysisGeneratedAt: string | null;
  daysUntil: number | null;
}
interface Analysis {
  explanation: string; whyImportant: string;
  scenarios: Array<{ title: string; detail: string; likelihood: string; condition?: string }>;
  whatToWatch: string[]; dataGaps?: string[];
  model?: string; generatedAt?: string; disclaimer?: string;
}

const LIKELIHOOD_STYLE: Record<string, string> = {
  'محتمل‌تر': 'bg-emerald-100 text-emerald-800', 'محتمل': 'bg-teal-100 text-teal-800',
  'کمتر محتمل': 'bg-amber-100 text-amber-800', 'نامطمئن': 'bg-slate-100 text-slate-700',
};

function Countdown({ days }: { days: number | null }) {
  if (days === null) return <Badge variant="outline" className="text-[11px]">تاریخ نامشخص</Badge>;
  if (days === 0) return <Badge className="bg-rose-600 text-white text-[11px]">امروز!</Badge>;
  if (days < 0) return <Badge variant="outline" className="text-[11px]">{faNum(Math.abs(days))} روز پیش</Badge>;
  if (days <= 7) return <Badge className="bg-rose-600 text-white text-[11px]">{faNum(days)} روز مانده</Badge>;
  if (days <= 45) return <Badge className="bg-amber-500 text-white text-[11px]">{faNum(days)} روز مانده</Badge>;
  return <Badge variant="outline" className="text-[11px]">{faNum(days)} روز مانده</Badge>;
}

function EventCard({ ev }: { ev: EventRow }) {
  const polls: PollRow[] = ev.pollsJson ? JSON.parse(ev.pollsJson) : [];
  const mapData: { rows: MapRow[]; note: string | null } | null = ev.mapJson ? JSON.parse(ev.mapJson) : null;
  const sources: SourceRow[] = ev.sourcesJson ? JSON.parse(ev.sourcesJson) : [];
  const analysis: Analysis | null = ev.analysisJson ? JSON.parse(ev.analysisJson) : null;
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    setGenerating(true);
    const r = await api(`/api/events/${ev.id}/analyze`, { method: 'POST' });
    setGenerating(false);
    toast({ title: r.ok ? 'تحلیل کامل تولید شد' : 'تولید تحلیل ناموفق', description: r.error, variant: r.ok ? 'default' : 'destructive' });
    if (r.ok) window.location.reload();
  };

  const maxMap = mapData?.rows ? Math.max(...mapData.rows.map((r) => r.value), 1) : 1;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-l from-teal-50 to-white border-b py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base leading-7">{ev.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
              <Badge variant="outline" className="text-[10px]">{ev.category}</Badge>
              <Badge variant="outline" className="text-[10px]">{ev.scope}</Badge>
              <Badge className={`text-[10px] ${ev.dateCertainty === 'قطعی' ? 'bg-emerald-100 text-emerald-800' : ev.dateCertainty === 'تقریبی' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                قطعیت تاریخ: {ev.dateCertainty}
              </Badge>
              <Countdown days={ev.daysUntil} />
              <span>اهمیت: {'★'.repeat(ev.importance) || '—'}</span>
            </div>
          </div>
          <div className="text-left text-xs text-slate-600">
            {ev.eventDateISO ? (
              <TripleDate date={ev.eventDateISO + 'T00:00:00Z'} variant="stacked" />
            ) : (
              <div className="max-w-52 leading-6">{ev.dateNote || 'نامشخص — صادقانه ثبت شده'}</div>
            )}
            {ev.eventDateEndISO && (
              <div className="text-[10px] text-slate-400 mt-1">تا: <TripleDate date={ev.eventDateEndISO + 'T00:00:00Z'} /></div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <p className="text-sm leading-7 text-slate-700">{ev.description}</p>

        <div className="grid md:grid-cols-2 gap-3">
          {/* نظرسنجی‌های مستند */}
          {polls.length > 0 && (
            <div className="rounded-xl border p-3">
              <div className="text-xs font-bold flex items-center gap-1.5 mb-2"><BarChart3 className="h-4 w-4 text-teal-700" /> آخرین نظرسنجی‌ها (مستند)</div>
              <div className="grid gap-2">
                {polls.map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span>{p.label}</span>
                      <b>{faNum(p.value)}{p.unit}</b>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.value)}%`, background: p.color }} />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{p.source}{p.asOf ? ` · تا ${p.asOf}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* نقشه آرا — داده ساختارمند واقعی */}
          {mapData?.rows && mapData.rows.length > 0 && (
            <div className="rounded-xl border p-3">
              <div className="text-xs font-bold flex items-center gap-1.5 mb-2"><MapIcon className="h-4 w-4 text-teal-700" /> نقشه/ترکیب آرا</div>
              <div className="grid gap-2">
                {mapData.rows.map((r, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span>{r.label}</span>
                      <b>{faNum(r.value)}</b>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(r.value / maxMap) * 100}%`, background: r.color }} />
                    </div>
                    {r.note && <div className="text-[10px] text-slate-400 mt-0.5">{r.note}</div>}
                  </div>
                ))}
              </div>
              {mapData.note && <div className="text-[10px] text-slate-500 mt-2 leading-5">{mapData.note}</div>}
              {ev.liveMapUrl && (
                <a href={ev.liveMapUrl} target="_blank" rel="noreferrer" className="text-[11px] text-teal-700 inline-flex items-center gap-1 mt-2">
                  <ExternalLink className="h-3 w-3" /> نقشه و ردیاب زنده
                </a>
              )}
            </div>
          )}
        </div>

        {/* تحلیل AI */}
        <div className="rounded-xl border-2 border-teal-200 bg-teal-50/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-xs font-bold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-teal-700" /> تحلیل کامل با هوش مصنوعی
              <Badge className="bg-violet-100 text-violet-800 text-[10px]">تحلیل AI — جدا از خبر قطعی</Badge>
            </div>
            <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Sparkles className="h-4 w-4 ml-1" />}
              {analysis ? 'تولید مجدد تحلیل' : 'تولید تحلیل کامل'}
            </Button>
          </div>
          {analysis ? (
            <div className="space-y-2.5 text-sm leading-7">
              <div><b>رویداد چیست:</b> {analysis.explanation}</div>
              <div><b>چرا مهم است:</b> {analysis.whyImportant}</div>
              <div>
                <b>مقایسه نتایج نهایی ممکن:</b>
                <div className="grid gap-2 mt-1.5">
                  {analysis.scenarios.map((s, i) => (
                    <div key={i} className="bg-white rounded-lg border p-2.5">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <b className="text-xs">{s.title}</b>
                        <Badge className={`text-[10px] ${LIKELIHOOD_STYLE[s.likelihood] || ''}`}>{s.likelihood}</Badge>
                      </div>
                      <div className="text-xs leading-6 text-slate-700">{s.detail}</div>
                      {s.condition && <div className="text-[11px] text-slate-500 mt-1">شرط تحقق: {s.condition}</div>}
                    </div>
                  ))}
                </div>
              </div>
              {analysis.whatToWatch.length > 0 && (
                <div className="text-xs">
                  <b className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> چه چیزهایی را رصد کنیم:</b>
                  <ul className="list-disc pr-5 mt-1 grid gap-1 leading-6 text-slate-700">
                    {analysis.whatToWatch.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {analysis.dataGaps && analysis.dataGaps.length > 0 && (
                <div className="text-xs text-slate-500">خلأ داده: {analysis.dataGaps.join(' | ')}</div>
              )}
              <div className="text-[10px] text-slate-400">
                {analysis.model ? `مدل: ${analysis.model} · ` : ''}{analysis.generatedAt ? new Date(analysis.generatedAt).toLocaleString('fa-IR') : ''}
                {analysis.disclaimer ? ` · ${analysis.disclaimer}` : ''}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 leading-6">
              هنوز تحلیلی تولید نشده است. با دکمه «تولید تحلیل کامل»، هوش مصنوعی توضیح رویداد، دلایل اهمیت و مقایسه سناریوهای پایان ممکن را بر اساس داده ثبت‌شده می‌سازد.
            </p>
          )}
        </div>

        {/* منابع */}
        {sources.length > 0 && (
          <div className="text-[11px] text-slate-500">
            <b>منابع مستند داده:</b>
            <ul className="list-disc pr-5 mt-1 grid gap-0.5">
              {sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline inline-flex items-center gap-1">
                    {s.name} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EventsPanel() {
  const [events, setEvents] = useState<EventRow[] | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ events: EventRow[] }>('/api/events');
    if (r.ok) setEvents(r.events);
  }, []);
  useEffect(() => { load(); }, [load]);

  const upcoming = events?.filter((e) => e.daysUntil === null || e.daysUntil >= 0) || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2"><CalendarClock className="h-6 w-6 text-teal-700" /> رویدادهای مهم پیش رو</h2>
        <div className="text-xs text-slate-500 flex items-center gap-1"><Newspaper className="h-4 w-4" /> سراسری — انتخابات، اجلاس‌ها و کنفرانس‌های مهم جهان</div>
      </div>

      <Card className="border-teal-200 bg-teal-50">
        <CardContent className="p-3 text-xs text-teal-900 leading-6">
          همه تاریخ‌ها و اعداد این صفحه فقط از منابع مستند ثبت می‌شوند؛ تاریخ‌های اعلام‌نشده صادقانه «تقریبی/نامشخص» علامت می‌خورند.
          نظرسنجی‌ها لقطه زمانی ذخیره‌شده‌اند (به‌روزرسانی زنده را از پیوند ردیاب‌ها ببینید). تحلیل‌های هوش مصنوعی همیشه با برچسب جدا از خبر قطعی نمایش داده می‌شوند.
        </CardContent>
      </Card>

      {!events ? <LoadingCard title="رویدادها" /> : (
        <div className="grid gap-4">
          {upcoming.length === 0 && <Card><CardContent className="p-6 text-sm text-slate-400">رویداد پیش‌روی ثبت‌شده‌ای نیست — scripts/seed-events.ts را اجرا کنید.</CardContent></Card>}
          {upcoming.map((ev) => <EventCard key={ev.id} ev={ev} />)}
        </div>
      )}
    </div>
  );
}
