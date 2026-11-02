'use client';
/**
 * پنل گزارش جامع روزانه (فصل ۱۲ بند ۲) — نمایش ساختار ۱۴ بخشی استاندارد فصل ۱۰
 */
import { useCallback, useEffect, useState } from 'react';
import { api, faNum, faDateTime, statusStyle } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileText, AlertTriangle, ExternalLink } from 'lucide-react';
import { LoadingCard } from './dashboard';

interface ReportSection {
  executiveSummary: string;
  topEvents: Array<{ title: string; detail: string; sourceRefs: string[]; eventDate?: string }>;
  verifiedFacts: string[];
  unverifiedClaims: Array<{ text: string; status: string; confidence: string; note?: string }>;
  newToday: string[];
  corrections: Array<{ text: string; previous: string }>;
  analysis: string;
  implications: Array<{ scenario: string; likelihood: string; condition: string }>;
  dataGaps: string[];
  incompleteWarning: string;
}
interface ReportRow {
  id: string; reportDate: string; jDate: string; status: string; categoryId: string | null;
  category?: { name: string } | null; coverageNote: string | null; model: string | null;
  promptVersion: string | null; generatedAt: string; postsCount: number; eventsCount: number; claimsCount: number;
}

export function DailyReportPanel() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selected, setSelected] = useState<{ report: ReportRow; content: ReportSection } | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async (d?: string) => {
    setLoading(true);
    const r = await api<{ reports: ReportRow[] }>(`/api/reports${d ? `?date=${d}` : ''}`);
    if (r.ok) setReports(r.reports);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const c = await api<{ categories: Array<{ id: string; name: string }> }>('/api/categories');
      if (c.ok) setCategories(c.categories);
      await load();
    })();
  }, [load]);

  const openReport = async (id: string) => {
    const r = await api<{ report: ReportRow; content: ReportSection }>(`/api/reports?id=${id}`);
    if (r.ok) setSelected({ report: r.report, content: r.content });
  };

  const generate = async (categoryId: string | null, force = false) => {
    setGenerating(true);
    const r = await api('/api/reports/generate', { method: 'POST', body: { date: date || undefined, categoryId, force } });
    setGenerating(false);
    toast({ title: r.ok ? 'گزارش تولید شد' : 'خطا', description: r.ok ? `وضعیت: ${(r as unknown as { status?: string }).status || '—'}` : r.error });
    await load(date || undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">گزارش جامع روزانه</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date" value={date} onChange={(e) => { setDate(e.target.value); load(e.target.value || undefined); }}
            className="text-sm border rounded-md px-2 py-1.5 bg-white" dir="ltr"
          />
          <Button size="sm" variant="outline" onClick={() => generate(null)} disabled={generating}>
            {generating ? '...' : 'تولید گزارش جامع'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => generate(null, true)} disabled={generating}>
            تولید مجدد
          </Button>
        </div>
      </div>

      {loading ? <LoadingCard title="گزارش‌ها" /> : (
        <div className="grid gap-2">
          {reports.length === 0 && (
            <Card><CardContent className="p-6 text-sm text-slate-400">گزارشی ثبت نشده است. با دکمه «تولید گزارش جامع» یا انتظار برای گزارش شبانه خودکار، گزارش ساخته می‌شود.</CardContent></Card>
          )}
          {reports.map((r) => (
            <Card key={r.id} className="cursor-pointer hover:border-teal-300 transition" onClick={() => openReport(r.id)}>
              <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{r.category?.name || 'گزارش جامع همه دسته‌ها'}</div>
                  <div className="text-xs text-slate-500">
                    {r.jDate} — مطالب: {faNum(r.postsCount)} | رویدادها: {faNum(r.eventsCount)} | ادعاها: {faNum(r.claimsCount)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusStyle(r.status)}>{r.status}</Badge>
                  <span className="text-xs text-slate-400">{faDateTime(r.generatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && <ReportDetail report={selected.report} content={selected.content} />}
    </div>
  );
}

function ReportDetail({ report, content }: { report: ReportRow; content: ReportSection }) {
  return (
    <div className="space-y-3">
      <Card className="border-teal-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            {report.category?.name || 'گزارش جامع'} — {report.jDate}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="text-xs text-slate-500 space-y-0.5">
            <div>تاریخ گزارش: {report.jDate} (میلادی: {report.reportDate}) | منطقه زمانی: Asia/Tehran</div>
            <div>مدل: {report.model || '—'} | نسخه پرامپت: {report.promptVersion || '—'} | تولید: {faDateTime(report.generatedAt)}</div>
            <div>پوشش منابع: {report.coverageNote || '—'}</div>
          </div>

          {content.incompleteWarning && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900">{content.incompleteWarning}</AlertDescription>
            </Alert>
          )}

          <Section title="خلاصه اجرایی" n={4}>
            <p className="leading-7 whitespace-pre-wrap">{content.executiveSummary || '—'}</p>
          </Section>

          <Section title="مهم‌ترین رویدادها" n={5}>
            {content.topEvents.length === 0 && <Muted>رویدادی ثبت نشده</Muted>}
            <div className="space-y-3">
              {content.topEvents.map((e, i) => (
                <div key={i} className="border-r-2 border-teal-300 pr-3 space-y-1">
                  <div className="font-semibold">{e.title}</div>
                  <p className="leading-7 text-slate-700">{e.detail}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    {e.eventDate && <span>تاریخ وقوع: {e.eventDate}</span>}
                    {e.sourceRefs.map((s, j) => <span key={j} className="bg-slate-100 rounded px-1.5 py-0.5">{s}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="واقعیت‌ها و ادعاهای تأییدشده" n={6}>
            {content.verifiedFacts.length === 0 && <Muted>در داده‌های این روز، ادعای تأییدشده‌ای وجود ندارد</Muted>}
            <ul className="list-disc pr-5 space-y-1 leading-7">
              {content.verifiedFacts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </Section>

          <Section title="ادعاهای تأییدنشده یا مورد اختلاف" n={7}>
            {content.unverifiedClaims.length === 0 && <Muted>موردی ثبت نشده</Muted>}
            <div className="space-y-2">
              {content.unverifiedClaims.map((c, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-1">
                  <div className="leading-7">{c.text}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge className={statusStyle(c.status)}>{c.status.replace(/_/g, ' ')}</Badge>
                    <Badge variant="outline">اطمینان: {c.confidence}</Badge>
                  </div>
                  {c.note && <div className="text-xs text-slate-500">{c.note}</div>}
                </div>
              ))}
            </div>
          </Section>

          <Section title="اطلاعات جدید نسبت به روزهای گذشته" n={8}>
            {content.newToday.length === 0 && <Muted>موردی ثبت نشده</Muted>}
            <ul className="list-disc pr-5 space-y-1 leading-7">{content.newToday.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </Section>

          <Section title="اصلاح یا ابطال اطلاعات قبلی" n={9}>
            {content.corrections.length === 0 && <Muted>موردی ثبت نشده</Muted>}
            <div className="space-y-2">
              {content.corrections.map((c, i) => (
                <div key={i} className="bg-violet-50 rounded-lg p-3 leading-7">
                  <div><span className="font-semibold text-violet-800">اصلاح:</span> {c.text}</div>
                  <div className="text-slate-500 text-xs">قبلاً: {c.previous}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="تحلیل تخصصی" n={10}>
            <p className="leading-7 whitespace-pre-wrap">{content.analysis || '—'}</p>
          </Section>

          <Section title="پیامدهای محتمل و سناریوهای جایگزین" n={11}>
            {content.implications.length === 0 && <Muted>سناریویی ثبت نشده</Muted>}
            <div className="space-y-2">
              {content.implications.map((s, i) => (
                <div key={i} className="border rounded-lg p-3 leading-7">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{s.likelihood}</Badge>
                    <span>{s.scenario}</span>
                  </div>
                  {s.condition && <div className="text-xs text-slate-500 mt-1">شرط تحقق: {s.condition}</div>}
                </div>
              ))}
            </div>
          </Section>

          <Section title="موارد نیازمند داده بیشتر" n={12}>
            {content.dataGaps.length === 0 && <Muted>موردی ثبت نشده</Muted>}
            <ul className="list-disc pr-5 space-y-1 leading-7">{content.dataGaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
          </Section>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, n, children }: { title: string; n: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 font-semibold mb-1.5">
        <span className="bg-teal-100 text-teal-800 text-xs rounded-full px-2 py-0.5">{faNum(n)}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div className="text-slate-400 text-sm">{children}</div>;
}
