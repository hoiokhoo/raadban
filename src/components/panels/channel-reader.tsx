'use client';
/**
 * پنل خوانش کانال‌ها — قابلیت ۱٫۱-الف
 * - سنجاق کانال عمومی تلگرام/ایتا/بله و خواندن پیام‌ها مثل خود پیام‌رسان
 * - کلیک روی هر پیام → دکمه راستی‌آزمایی AI → سگمنت‌های رنگی (درست/نادرست/...) + خلاصه + نتیجه‌گیری
 * - ترجمه فارسی روان برای پیام‌های خارجی
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, faNum, PLATFORM_LABELS } from '@/lib/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { TripleDate } from '@/components/triple-date';
import { MessagesSquare, ShieldCheck, RefreshCw, Trash2, Plus, Languages, Loader2, Link2 } from 'lucide-react';
import { LoadingCard } from './dashboard';

interface ChannelRow {
  id: string; platform: string; identifier: string; displayName: string | null;
  url: string | null; lastSyncAt: string | null; lastSyncError: string | null;
  limitsNote: string | null; messageCount: number;
}
interface SegmentRow { text: string; verdict: string; explanation?: string; basis?: string }
interface FactcheckRow {
  id: string; status: string; segmentsJson: string; overallVerdict: string | null;
  summary: string | null; conclusion: string | null; evidenceNotes: string | null;
  injectionWarnings: string | null; model: string | null; error: string | null; createdAt: string;
}
interface MessageRow {
  id: string; externalId: string; content: string; url: string | null;
  publishedAt: string | null; isForwarded: boolean; language: string;
  translationFa: string | null; translatedAt: string | null;
  factcheck: FactcheckRow | null;
}
interface MessagesPayload {
  channel: ChannelRow; messages: MessageRow[]; total: number; oldestExternalId: string | null; hasMore: boolean;
}

// رنگ‌بندی حکم‌ها — سبز/قرمز/کهربایی/طوسی/بنفش
const VERDICT_STYLE: Record<string, { box: string; chip: string }> = {
  'درست': { box: 'bg-emerald-50 border-emerald-400 decoration-emerald-500', chip: 'bg-emerald-600 text-white' },
  'نادرست': { box: 'bg-rose-50 border-rose-400 decoration-rose-500', chip: 'bg-rose-600 text-white' },
  'گمراه‌کننده': { box: 'bg-amber-50 border-amber-400 decoration-amber-500', chip: 'bg-amber-500 text-white' },
  'تأییدناپذیر': { box: 'bg-slate-100 border-slate-400 decoration-slate-400', chip: 'bg-slate-500 text-white' },
  'نظر/تحلیل': { box: 'bg-violet-50 border-violet-400 decoration-violet-500', chip: 'bg-violet-600 text-white' },
  'خنثی': { box: '', chip: '' },
};
const OVERALL_LABELS: Record<string, string> = {
  'عموماً_درست': 'عموماً درست', 'عموماً_نادرست': 'عموماً نادرست', 'آمیخته': 'آمیخته از درست و نادرست',
  'عمدتاً_نظر/تحلیل': 'عمدتاً نظر/تحلیل', 'نامشخص': 'نامشخص',
};

function FactcheckView({ fc }: { fc: FactcheckRow }) {
  let segments: SegmentRow[] = [];
  let warnings: string[] = [];
  try {
    segments = (JSON.parse(fc.segmentsJson) as SegmentRow[]).filter((s) => s && typeof s.text === 'string');
  } catch { /* خروجی قدیمی */ }
  try { warnings = fc.injectionWarnings ? JSON.parse(fc.injectionWarnings) : []; } catch { /* — */ }

  return (
    <div className="mt-2 rounded-xl border-2 border-teal-300 bg-white shadow-sm overflow-hidden">
      <div className="bg-teal-700 text-white px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
        <ShieldCheck className="h-4 w-4" />
        <b>راستی‌آزمایی خودکار هوش مصنوعی</b>
        <Badge className="bg-white/20 text-white text-[10px]">ممکن است خطا داشته باشد — جایگزین بررسی سردبیری نیست</Badge>
        {fc.model && <span className="text-white/70 text-[10px]">مدل: {fc.model}</span>}
      </div>
      <div className="p-3 space-y-3">
        {fc.status !== 'کامل' && <div className="text-sm text-rose-700 bg-rose-50 rounded p-2">بررسی ناموفق: {fc.error || 'خطای نامشخص'}</div>}
        {fc.overallVerdict && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 text-xs">حکم کلی:</span>
            <Badge className={fc.overallVerdict === 'عموماً_نادرست' ? 'bg-rose-600 text-white' : fc.overallVerdict === 'عموماً_درست' ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'}>
              {OVERALL_LABELS[fc.overallVerdict] || fc.overallVerdict}
            </Badge>
          </div>
        )}
        {fc.summary && (
          <div className="text-sm leading-7 bg-sky-50 border border-sky-200 rounded-lg p-2.5">
            <b className="text-sky-800">خلاصه پیام:</b> {fc.summary}
          </div>
        )}
        <div>
          <div className="text-xs text-slate-500 mb-1.5">متن پیام با تفکیک درستی/نادرستی هر بخش:</div>
          <div className="leading-9 text-sm whitespace-pre-wrap">
            {segments.map((s, i) => {
              const st = VERDICT_STYLE[s.verdict] || VERDICT_STYLE['خنثی'];
              return (
                <span key={i}>
                  <span className={st.box ? `${st.box} border-b-2 rounded-sm px-0.5` : ''}>{s.text}</span>
                  {s.explanation && (
                    <span className={`inline-block align-middle mx-1 mb-1 rounded-full px-2 py-0.5 text-[10px] ${st.chip || 'bg-slate-200'}`}>
                      {s.verdict}
                      {s.basis ? ` · ${s.basis}` : ''}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          <div className="mt-2 grid gap-1.5">
            {segments.filter((s) => s.explanation).map((s, i) => {
              const st = VERDICT_STYLE[s.verdict] || VERDICT_STYLE['خنثی'];
              return (
                <div key={i} className={`text-xs rounded-lg border-r-4 p-2 leading-6 ${st.box || 'bg-slate-50'}`}>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ml-1 ${st.chip || ''}`}>{s.verdict}</span>
                  «{s.text.slice(0, 120)}{s.text.length > 120 ? '…' : ''}» — {s.explanation}
                  {s.basis && <span className="text-slate-400"> ({s.basis})</span>}
                </div>
              );
            })}
          </div>
        </div>
        {fc.conclusion && (
          <div className="text-sm leading-7 bg-slate-50 border rounded-lg p-2.5">
            <b>نتیجه‌گیری:</b> {fc.conclusion}
          </div>
        )}
        {fc.evidenceNotes && <div className="text-xs text-slate-500 leading-6">شواهد و محدودیت‌ها: {fc.evidenceNotes}</div>}
        {warnings.length > 0 && (
          <div className="text-xs bg-orange-50 text-orange-900 rounded p-2 border border-orange-200">
            ⚠ هشدار تزریق پرامپت: {warnings.join(' | ')}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChannelReaderPanel() {
  const [channels, setChannels] = useState<ChannelRow[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [payload, setPayload] = useState<MessagesPayload | null>(null);
  const [platform, setPlatform] = useState('telegram');
  const [identifier, setIdentifier] = useState('');
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadChannels = useCallback(async () => {
    const r = await api<{ channels: ChannelRow[] }>('/api/channels');
    if (r.ok) setChannels(r.channels);
  }, []);
  useEffect(() => { loadChannels(); }, [loadChannels]);

  const openChannel = useCallback(async (id: string) => {
    setActiveId(id);
    setSelected(null);
    const r = await api<MessagesPayload>(`/api/channels/${id}/messages?take=40`);
    if (r.ok) setPayload(r);
    else setPayload(null);
  }, []);

  const loadOlder = async () => {
    if (!payload?.hasMore || !payload.oldestExternalId) return;
    const r = await api<MessagesPayload>(`/api/channels/${activeId}/messages?take=40&before=${encodeURIComponent(payload.oldestExternalId)}`);
    if (r.ok) {
      setPayload({ ...r, messages: [...r.messages, ...payload.messages], oldestExternalId: r.oldestExternalId, hasMore: r.hasMore });
    }
  };

  const addChannel = async () => {
    if (!identifier.trim()) return;
    setAdding(true);
    const r = await api<{ channelId: string; messageCount: number; limits: string }>('/api/channels', {
      method: 'POST', body: { platform, identifier },
    });
    setAdding(false);
    toast({
      title: r.ok ? `کانال اضافه شد — ${faNum((r as unknown as { messageCount: number }).messageCount)} پیام اولیه دریافت شد` : 'افزودن کانال ناموفق',
      description: r.ok ? (r as unknown as { limits?: string }).limits : r.error,
      variant: r.ok ? 'default' : 'destructive',
    });
    if (r.ok) {
      setIdentifier('');
      await loadChannels();
      await openChannel((r as unknown as { channelId: string }).channelId);
    }
  };

  const syncChannel = async () => {
    if (!activeId) return;
    setSyncing(true);
    const r = await api<{ added: number; total: number }>(`/api/channels/${activeId}/sync`, { method: 'POST' });
    setSyncing(false);
    toast({
      title: r.ok ? `همگام‌سازی انجام شد — ${faNum((r as unknown as { added: number }).added)} پیام جدید` : 'همگام‌سازی ناموفق',
      description: r.error, variant: r.ok ? 'default' : 'destructive',
    });
    if (r.ok) { await loadChannels(); await openChannel(activeId); }
  };

  const runFactcheck = async (messageId: string) => {
    setChecking(messageId);
    const r = await api<{ status?: string }>(`/api/messages/${messageId}/factcheck`, { method: 'POST' });
    setChecking(null);
    toast({
      title: r.ok ? `بررسی کامل شد — حکم کلی: ${OVERALL_LABELS[(r as unknown as { status: string }).status] || 'نامشخص'}` : 'راستی‌آزمایی ناموفق',
      description: r.error, variant: r.ok ? 'default' : 'destructive',
    });
    if (r.ok && activeId) await openChannel(activeId);
  };

  const runTranslate = async (messageId: string) => {
    setTranslating(messageId);
    const r = await api(`/api/messages/${messageId}/translate`, { method: 'POST' });
    setTranslating(null);
    toast({ title: r.ok ? 'ترجمه انجام شد' : 'ترجمه ناموفق', description: r.error, variant: r.ok ? 'default' : 'destructive' });
    if (r.ok && activeId) await openChannel(activeId);
  };

  const removeChannel = async (id: string) => {
    const r = await api(`/api/channels/${id}`, { method: 'DELETE' });
    if (r.ok) {
      if (activeId === id) { setActiveId(null); setPayload(null); }
      await loadChannels();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2"><MessagesSquare className="h-6 w-6 text-teal-700" /> خوانش کانال‌ها</h2>
      </div>

      <Card className="border-teal-200 bg-teal-50">
        <CardContent className="p-3 text-xs text-teal-900 leading-6">
          کانال عمومی تلگرام یا ایتا را سنجاق کنید تا پیام‌هایش مثل خود پیام‌رسان خوانده شود.
          با کلیک روی هر پیام، دکمه راستی‌آزمایی ظاهر می‌شود و هوش مصنوعی هر بخش متن را رنگ‌بندی می‌کند:
          <span className="mx-1 rounded bg-emerald-600 px-1.5 py-0.5 text-white">درست</span>
          <span className="mx-1 rounded bg-rose-600 px-1.5 py-0.5 text-white">نادرست</span>
          <span className="mx-1 rounded bg-amber-500 px-1.5 py-0.5 text-white">گمراه‌کننده</span>
          <span className="mx-1 rounded bg-slate-500 px-1.5 py-0.5 text-white">تأییدناپذیر</span>
          <span className="mx-1 rounded bg-violet-600 px-1.5 py-0.5 text-white">نظر</span>
          — محدودیت: فقط کانال‌های عمومی با صفحه وب فعال؛ سابقه قبل از پیام‌های نمایش‌داده‌شده در دسترس نیست.
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-[280px_1fr] gap-4 items-start">
        {/* ستون کانال‌ها */}
        <div className="space-y-3">
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="text-sm font-semibold">افزودن کانال</div>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram">تلگرام</SelectItem>
                  <SelectItem value="eitaa">ایتا</SelectItem>
                  <SelectItem value="bale">بله</SelectItem>
                </SelectContent>
              </Select>
              <Input
                dir="ltr" placeholder="@channel_name" value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChannel()}
              />
              <Button className="w-full" onClick={addChannel} disabled={adding || !identifier.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Plus className="h-4 w-4 ml-1" />}
                سنجاق و دریافت پیام‌ها
              </Button>
            </CardContent>
          </Card>

          {!channels ? <LoadingCard title="کانال‌ها" /> : channels.length === 0 ? (
            <Card><CardContent className="p-4 text-xs text-slate-400 text-center">هنوز کانالی سنجاق نشده است.</CardContent></Card>
          ) : channels.map((c) => (
            <button
              key={c.id}
              onClick={() => openChannel(c.id)}
              className={`w-full text-right rounded-xl border p-3 transition ${activeId === c.id ? 'border-teal-600 bg-teal-50 shadow-sm' : 'bg-white border-slate-200 hover:border-teal-300'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-full bg-teal-700 text-white grid place-items-center text-sm font-bold shrink-0">
                      {(c.displayName || c.identifier || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div dir="ltr" className="text-sm font-semibold truncate text-left">{c.displayName || c.identifier}</div>
                      <div className="text-[10px] text-slate-500">{PLATFORM_LABELS[c.platform] || c.platform} · {faNum(c.messageCount)} پیام</div>
                    </div>
                  </div>
                </div>
                <span
                  role="button" tabIndex={0} aria-label="حذف کانال"
                  onClick={(e) => { e.stopPropagation(); removeChannel(c.id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeChannel(c.id); } }}
                  className="text-slate-300 hover:text-rose-600 shrink-0 cursor-pointer"
                ><Trash2 className="h-4 w-4" /></span>
              </div>
              {c.lastSyncError && <div className="text-[10px] text-rose-600 mt-1">آخرین همگام‌سازی: خطا</div>}
            </button>
          ))}
        </div>

        {/* ستون پیام‌ها — نمای پیام‌رسان */}
        <div>
          {!activeId ? (
            <Card><CardContent className="p-10 text-center text-sm text-slate-400">
              یک کانال را از فهرست انتخاب کنید یا کانال جدیدی سنجاق کنید.
            </CardContent></Card>
          ) : !payload ? (
            <LoadingCard title="پیام‌ها" />
          ) : (
            <div className="rounded-2xl border bg-slate-100 overflow-hidden">
              {/* سربرگ کانال */}
              <div className="bg-white border-b px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-10 w-10 rounded-full bg-teal-700 text-white grid place-items-center font-bold">
                    {(payload.channel.displayName || payload.channel.identifier || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div dir="ltr" className="font-bold text-sm text-left">{payload.channel.displayName || payload.channel.identifier}</div>
                    <div className="text-[10px] text-slate-500">
                      {PLATFORM_LABELS[payload.channel.platform]} · {faNum(payload.total)} پیام ذخیره‌شده
                      {payload.channel.lastSyncAt && <> · آخرین همگام‌سازی: <TripleDate date={payload.channel.lastSyncAt} className="text-[10px]" /></>}
                    </div>
                  </div>
                  {payload.channel.url && (
                    <a href={payload.channel.url} target="_blank" rel="noreferrer" className="text-teal-700 shrink-0"><Link2 className="h-4 w-4" /></a>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={syncChannel} disabled={syncing}>
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RefreshCw className="h-4 w-4 ml-1" />}
                  همگام‌سازی
                </Button>
              </div>
              {payload.channel.limitsNote && (
                <div className="bg-amber-50 text-amber-900 text-[10px] px-4 py-1.5 border-b border-amber-100">محدودیت دسترسی: {payload.channel.limitsNote}</div>
              )}

              {/* پیام‌ها */}
              <div className="p-3 grid gap-2.5 max-h-[70vh] overflow-y-auto">
                {payload.hasMore && (
                  <button onClick={loadOlder} className="text-xs text-teal-700 bg-white border rounded-lg py-1.5 hover:bg-teal-50">
                    پیام‌های قدیمی‌تر…
                  </button>
                )}
                {payload.messages.map((m) => {
                  const isSel = selected === m.id;
                  return (
                    <div key={m.id} className="flex gap-2 items-end" dir="rtl">
                      <span className="h-7 w-7 rounded-full bg-teal-600/80 text-white grid place-items-center text-[11px] font-bold shrink-0 mb-1">
                        {(payload.channel.displayName || payload.channel.identifier || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => setSelected(isSel ? null : m.id)}
                          className={`w-full text-right rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow-sm transition border ${isSel ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-300' : 'border-slate-200 bg-white hover:border-teal-200'}`}
                        >
                          <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400 mb-1">
                            <span dir="ltr" className="font-semibold text-teal-800">{payload.channel.displayName || payload.channel.identifier}</span>
                            <span>·</span>
                            <TripleDate date={m.publishedAt} className="text-[10px]" />
                            {m.isForwarded && <Badge variant="outline" className="text-[9px] py-0">فورواردشده</Badge>}
                            {m.language !== 'fa' && <Badge variant="outline" className="text-[9px] py-0">{m.language}</Badge>}
                            {m.factcheck?.status === 'کامل' && (
                              <Badge className={`text-[9px] py-0 ${m.factcheck.overallVerdict === 'عموماً_نادرست' ? 'bg-rose-100 text-rose-800' : m.factcheck.overallVerdict === 'عموماً_درست' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                                بررسی‌شده: {OVERALL_LABELS[m.factcheck.overallVerdict || ''] || 'نامشخص'}
                              </Badge>
                            )}
                            {m.factcheck?.status === 'ناموفق' && <Badge className="text-[9px] py-0 bg-rose-100 text-rose-700">بررسی ناموفق</Badge>}
                          </div>
                          <div className="text-sm leading-7 whitespace-pre-wrap">{m.content}</div>
                          {m.translationFa && (
                            <details className="mt-1.5 text-xs" open>
                              <summary className="cursor-pointer text-teal-700 flex items-center gap-1"><Languages className="h-3 w-3" /> ترجمه فارسی روان</summary>
                              <div className="mt-1 bg-sky-50 rounded p-2 leading-7 text-slate-800 whitespace-pre-wrap border border-sky-100">{m.translationFa}</div>
                            </details>
                          )}
                          {m.factcheck?.status === 'کامل' && <FactcheckView fc={m.factcheck} />}
                        </button>

                        {/* دکمه‌های عملیات — بعد از کلیک روی پیام */}
                        {isSel && (
                          <div className="flex flex-wrap gap-2 mt-1.5 px-2">
                            <Button
                              size="sm" className="bg-teal-700 hover:bg-teal-800 text-white"
                              onClick={() => runFactcheck(m.id)} disabled={checking !== null}
                            >
                              {checking === m.id ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <ShieldCheck className="h-4 w-4 ml-1" />}
                              {m.factcheck ? 'بررسی مجدد با هوش مصنوعی' : 'راستی‌آزمایی کامل با هوش مصنوعی'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => runTranslate(m.id)} disabled={translating !== null}>
                              {translating === m.id ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Languages className="h-4 w-4 ml-1" />}
                              ترجمه فارسی روان
                            </Button>
                            {m.url && (
                              <a href={m.url} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="ghost"><Link2 className="h-4 w-4 ml-1" /> پیام در پیام‌رسان</Button>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
