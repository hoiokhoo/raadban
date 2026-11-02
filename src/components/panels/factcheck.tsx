'use client';
/**
 * پنل راستی‌آزمایی: شواهد، وضعیت ادعاها، ارزیابی دستی (فصل ۱۲ بند ۹)
 */
import { useCallback, useEffect, useState } from 'react';
import { api, faNum, faDateTime, statusStyle, PLATFORM_LABELS } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, ExternalLink, GitBranch } from 'lucide-react';
import { LoadingCard } from './dashboard';

interface EvidenceRow { id: string; url: string | null; title: string | null; snippet: string | null; stance: string; sourceType: string; retrievedAt: string; }
interface ClaimRow {
  id: string; text: string; kind: string; status: string; confidence: string; confidenceNote: string | null;
  publisherName: string | null; publishedAt: string | null; eventDate: string | null;
  supportingEvidenceNotes: string | null; contradictingEvidenceNotes: string | null;
  primarySourcesNotes: string | null; dependencyNote: string | null; notVerifiableNote: string | null;
  evidenceSearchedAt: string | null; model: string | null; promptVersion: string | null; createdAt: string;
  post?: { url: string | null; source?: { name: string; platform: string } | null } | null;
  evidence: EvidenceRow[];
  factcheckReports?: Array<{ content: string; model: string | null; generatedAt: string }>;
}

const STATUSES = ['در_انتظار_بررسی', 'تأییدشده_با_شواهد_کافی', 'عمدتاً_تأییدشده', 'تأییدنشده', 'مورد_اختلاف', 'گمراه‌کننده', 'ردشده_با_شواهد_کافی', 'منسوخ_یا_اصلاح‌شده'];

export function FactcheckPanel() {
  const [claims, setClaims] = useState<ClaimRow[] | null>(null);
  const [status, setStatus] = useState<string>('all');
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<{ claims: ClaimRow[] }>(`/api/claims${status !== 'all' ? `?status=${status}` : ''}`);
    if (r.ok) setClaims(r.claims);
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const evaluate = async (id: string) => {
    setEvaluating(id);
    const r = await api(`/api/claims/${id}/evaluate`, { method: 'POST', body: { searchWeb: true } });
    setEvaluating(null);
    toast({
      title: r.ok ? `ارزیابی انجام شد: ${(r as unknown as { status?: string }).status?.replace(/_/g, ' ')}` : 'خطا در ارزیابی',
      description: r.error, variant: r.ok ? 'default' : 'destructive',
    });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">شواهد راستی‌آزمایی</h2>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-teal-200 bg-teal-50">
        <CardContent className="p-3 text-xs text-teal-900 leading-6">
          <ShieldCheck className="inline h-4 w-4 ml-1" />
          اصل روش‌شناسی: نبود شواهد به‌معنای نادرستی ادعا نیست. بازنشر یک خبر توسط چند کانال وابسته، منبع مستقل شمرده نمی‌شود.
          مدل فقط بر شواهد ارائه‌شده حکم می‌دهد و اگر امکان تأیید مستقل فراهم نشود صریحاً اعلام می‌شود.
        </CardContent>
      </Card>

      {!claims ? <LoadingCard title="ادعاها" /> : (
        <div className="grid gap-3">
          {claims.length === 0 && <Card><CardContent className="p-6 text-sm text-slate-400">ادعایی با این وضعیت ثبت نشده است.</CardContent></Card>}
          {claims.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="leading-7 font-medium">{c.text}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge className={statusStyle(c.status)}>{c.status.replace(/_/g, ' ')}</Badge>
                      <Badge variant="outline">اطمینان: {c.confidence}</Badge>
                      <Badge variant="outline">{c.kind.replace(/_/g, ' ')}</Badge>
                      <span className="text-slate-400">منبع: {c.publisherName || '—'}</span>
                      <span className="text-slate-400">انتشار: {faDateTime(c.publishedAt)}</span>
                      <span className="text-slate-400">وقوع ادعاشده: {c.eventDate ? faDateTime(c.eventDate) : '—'}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => evaluate(c.id)} disabled={evaluating !== null}>
                    {evaluating === c.id ? '...' : <><GitBranch className="h-4 w-4 ml-1" /> ارزیابی مجدد</>}
                  </Button>
                </div>

                {c.confidenceNote && <div className="text-xs text-slate-600">دلیل اطمینان: {c.confidenceNote}</div>}
                {c.notVerifiableNote && (
                  <div className="text-xs bg-amber-50 text-amber-900 rounded p-2 border border-amber-200">
                    ⚠ {c.notVerifiableNote}
                  </div>
                )}
                {c.dependencyNote && (
                  <div className="text-xs bg-orange-50 text-orange-900 rounded p-2 border border-orange-200 whitespace-pre-wrap">
                    <GitBranch className="inline h-3.5 w-3.5 ml-1" />{c.dependencyNote}
                  </div>
                )}
                {c.supportingEvidenceNotes && <div className="text-xs leading-6"><b>شواهد موافق:</b> {c.supportingEvidenceNotes}</div>}
                {c.contradictingEvidenceNotes && <div className="text-xs leading-6"><b>شواهد مخالف:</b> {c.contradictingEvidenceNotes}</div>}
                {c.primarySourcesNotes && <div className="text-xs leading-6"><b>منابع اولیه احتمالی:</b> {c.primarySourcesNotes}</div>}

                {c.evidence.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold mb-1">شواهد ثبت‌شده ({faNum(c.evidence.length)}):</div>
                    <div className="grid gap-1">
                      {c.evidence.map((e) => (
                        <div key={e.id} className="text-xs flex items-center gap-2 bg-slate-50 rounded px-2 py-1.5">
                          <Badge variant="outline" className="text-[10px]">{e.sourceType}</Badge>
                          <span className="truncate flex-1">{e.title || e.url || '—'}</span>
                          {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="text-teal-700 shrink-0"><ExternalLink className="h-3 w-3" /></a>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {c.factcheckReports?.[0] && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-teal-700">گزارش کامل راستی‌آزمایی ({c.factcheckReports[0].model || '—'}، {faDateTime(c.factcheckReports[0].generatedAt)})</summary>
                    <p className="mt-1 leading-6 text-slate-700 whitespace-pre-wrap bg-slate-50 p-2 rounded">{c.factcheckReports[0].content}</p>
                  </details>
                )}

                {c.post?.url && (
                  <a href={c.post.url} target="_blank" rel="noreferrer" className="text-xs text-teal-700 inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> مطلب اصلی ({c.post.source?.name || ''} — {PLATFORM_LABELS[c.post.source?.platform || ''] || ''})
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
