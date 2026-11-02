'use client';
/**
 * کشف منابع با هوش مصنوعی + پیشنهادها (فصل ۱۲ بند ۵)
 */
import { useCallback, useEffect, useState } from 'react';
import { api, faNum, faDateTime, statusStyle, PLATFORM_LABELS } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Search, Check, X } from 'lucide-react';
import { LoadingCard } from './dashboard';

interface SugRow {
  id: string; name: string; platform: string; identifier: string; url: string | null;
  reason: string | null; evidence: string | null; membersInfo: string; activityInfo: string;
  confidence: string; score: number | null; scoreBreakdown: string | null; status: string;
  evaluatedAt: string | null; createdAt: string;
  category?: { name: string } | null;
}

export function DiscoveryPanel() {
  const [topic, setTopic] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [sugs, setSugs] = useState<SugRow[] | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [autoActivate, setAutoActivate] = useState(false);
  const [lastSearch, setLastSearch] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<{ suggestions: SugRow[] }>('/api/sources/suggestions');
    if (r.ok) setSugs(r.suggestions);
  }, []);
  useEffect(() => {
    (async () => {
      const c = await api<{ categories: Array<{ id: string; name: string }> }>('/api/categories');
      if (c.ok) setCategories(c.categories);
      await load();
    })();
  }, [load]);

  const discover = async () => {
    setBusy(true);
    const r = await api<{ created: number; searchStatus: string; note: string }>('/api/sources/discover', {
      method: 'POST', body: { topic, categoryId: categoryId || null },
    });
    setBusy(false);
    setLastSearch(r.ok ? r.searchStatus : r.error || null);
    toast(r.ok
      ? { title: `${faNum(r.created)} پیشنهاد جدید ثبت شد`, description: 'همه در وضعیت «در انتظار تأیید» هستند' }
      : { title: 'خطا', description: r.error, variant: 'destructive' });
    load();
  };

  const decide = async (id: string, action: 'approve' | 'reject') => {
    const r = await api<{ activated?: boolean }>('/api/sources/suggestions', { method: 'POST', body: { id, action, autoActivate } });
    if (r.ok) {
      toast({ title: action === 'approve' ? (r.activated ? 'منبع تأیید و فعال شد' : 'منبع تأیید شد (غیرفعال)') : 'پیشنهاد رد شد' });
      load();
    } else toast({ title: 'خطا', description: r.error, variant: 'destructive' });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">کشف خودکار منابع با هوش مصنوعی</h2>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs text-slate-500 leading-6">
            سامانه موضوع شما را با جست‌وجوی وب چندمرحله‌ای رصد می‌کند، نامزدها را از شواهد واقعی نتایج استخراج و با معیارهای توضیح‌پذیر امتیاز می‌دهد.
            آمار ناموجود (اعضا/بازدید) صریحاً «نامعلوم» ثبت می‌شود و هرگز ساختگی تولید نمی‌شود.
            همه پیشنهادها پیش‌فرض «در انتظار تأیید» می‌مانند.
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2"><Label>موضوع</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثلاً: اخبار بازار ارز و سکه" /></div>
            <div>
              <Label>دسته</Label>
              <select className="w-full text-sm border rounded-md px-2 py-2 bg-white" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— بدون دسته —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={discover} disabled={busy || topic.trim().length < 3}>
            <Search className="h-4 w-4 ml-1" /> {busy ? 'در حال جست‌وجو و ارزیابی...' : 'کشف منابع'}
          </Button>
          {lastSearch && <div className="text-xs text-slate-500">وضعیت جست‌وجو: {lastSearch}</div>}
        </CardContent>
      </Card>

      {!sugs ? <LoadingCard title="پیشنهادها" /> : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">پیشنهادهای منابع</h3>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={autoActivate} onCheckedChange={setAutoActivate} />
              فعال‌سازی خودکار پس از تأیید
            </label>
          </div>
          {sugs.length === 0 && <Card><CardContent className="p-6 text-sm text-slate-400">هنوز پیشنهادی ثبت نشده است.</CardContent></Card>}
          {sugs.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.name}</span>
                  <Badge variant="outline">{PLATFORM_LABELS[s.platform] || s.platform}</Badge>
                  <Badge className={statusStyle(s.status)}>{s.status.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline" className="bg-slate-50">اطمینان: {s.confidence}</Badge>
                  {s.score !== null && <Badge variant="outline" className="bg-slate-50">امتیاز: {faNum(s.score)}</Badge>}
                </div>
                <div className="text-xs text-slate-500" dir="ltr">{s.identifier}</div>
                {s.reason && <div className="text-sm leading-6">دلیل: {s.reason}</div>}
                {s.evidence && <div className="text-xs text-slate-500 leading-6">شواهد: {s.evidence}</div>}
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">اعضا: {s.membersInfo}</Badge>
                  <Badge variant="outline">فعالیت: {s.activityInfo}</Badge>
                  {s.category && <Badge variant="outline">دسته: {s.category.name}</Badge>}
                  {s.scoreBreakdown && <Badge variant="outline">تفکیک امتیاز: {s.scoreBreakdown}</Badge>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">ارزیابی: {faDateTime(s.evaluatedAt)}</span>
                  {s.status === 'در_انتظار_تأیید' && (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => decide(s.id, 'approve')}><Check className="h-4 w-4 ml-1" /> تأیید</Button>
                      <Button size="sm" variant="outline" className="text-rose-600" onClick={() => decide(s.id, 'reject')}><X className="h-4 w-4 ml-1" /> رد</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
