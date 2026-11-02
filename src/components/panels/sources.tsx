'use client';
/**
 * پنل مدیریت منابع (فصل ۱۲ بند ۴) — همه قابلیت‌های فصل ۴
 */
import { useCallback, useEffect, useState } from 'react';
import { api, faNum, faDateTime, statusStyle, PLATFORM_LABELS } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil, Download, Upload, Radio } from 'lucide-react';
import { LoadingCard } from './dashboard';

interface SourceRow {
  id: string; name: string; platform: string; identifier: string; url: string | null;
  isActive: boolean; status: string; statusDetail: string | null; priority: string;
  language: string; region: string; topic: string | null; trustNote: string | null; notes: string | null;
  entityType: string | null; politicalOrientation: string | null;
  fetchIntervalMin: number; maxItemsPerFetch: number; limitsNote: string | null;
  lastFetchAt: string | null; lastErrorAt: string | null; lastError: string | null; createdAt: string;
  categories: Array<{ category: { id: string; name: string } }>;
  _count: { posts: number };
}
interface CategoryRow { id: string; name: string; }

const emptyForm = {
  name: '', platform: 'telegram', identifier: '', url: '', categoryIds: [] as string[],
  priority: 'عادی', language: 'fa', region: 'ایران', topic: '', trustNote: '', notes: '',
  entityType: 'رسانه', politicalOrientation: '',
  fetchIntervalMin: 60, maxItemsPerFetch: 30,
};

const ENTITY_LABELS: Record<string, string> = { 'رسانه': 'رسانه', 'شخصیت': 'شخصیت', 'نهاد رسمی': 'نهاد رسمی' };

/** رنگ badge نوع گرایش (نشان‌گر قاب‌بندی نه حکم بر درستی خبر) */
function orientationStyle(o: string): string {
  if (/رسمی|دولتی/.test(o)) return 'bg-amber-100 text-amber-800';
  if (/اپوزیسیون/.test(o)) return 'bg-purple-100 text-purple-800';
  if (/اصولگرا/.test(o)) return 'bg-teal-100 text-teal-800';
  if (/اصلاح‌طلب/.test(o)) return 'bg-sky-100 text-sky-800';
  if (/راست|محافظه‌کار|ناسیونالیست|جمهوری‌خواه/.test(o)) return 'bg-red-100 text-red-800';
  if (/چپ|لیبرال|دموکرات|پیشرو/.test(o)) return 'bg-blue-100 text-blue-800';
  if (/هم‌سو|وابسته|نزدیک/.test(o)) return 'bg-orange-100 text-orange-800';
  return 'bg-slate-100 text-slate-700'; // مرکز و سایر
}

export function SourcesPanel() {
  const [sources, setSources] = useState<SourceRow[] | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [bulk, setBulk] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // فیلترهای منابع: کشور/گرایش/نوع/دسته/جست‌وجو
  const [fRegion, setFRegion] = useState('همه');
  const [fOrient, setFOrient] = useState('همه');
  const [fType, setFType] = useState('همه');
  const [fQuery, setFQuery] = useState('');
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<{ sources: SourceRow[] }>('/api/sources');
    if (r.ok) setSources(r.sources);
  }, []);
  useEffect(() => {
    (async () => {
      const c = await api<{ categories: CategoryRow[] }>('/api/categories');
      if (c.ok) setCategories(c.categories);
      await load();
    })();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    const payload = { ...form, url: form.url || undefined };
    const r = editId
      ? await api('/api/sources/manage', { method: 'PATCH', body: { id: editId, ...payload } })
      : await api('/api/sources', { method: 'POST', body: payload });
    setBusy(false);
    if (r.ok) {
      toast({ title: editId ? 'منبع ویرایش شد' : 'منبع ثبت شد' });
      setForm(emptyForm); setEditId(null); setOpen(false); load();
    } else {
      toast({ title: 'خطا', description: r.error, variant: 'destructive' });
    }
  };

  const addBulk = async () => {
    setBusy(true);
    const r = await api('/api/sources', { method: 'POST', body: { bulk, categoryIds: [] } });
    setBusy(false);
    if (r.ok) {
      const results = (r as unknown as { results: Array<{ ok: boolean; error?: string; name?: string }> }).results || [];
      const okCount = results.filter((x) => x.ok).length;
      toast({ title: `${faNum(okCount)} منبع اضافه شد`, description: results.filter((x) => !x.ok).map((x) => x.error).join(' | ') || undefined });
      setBulk(''); setOpen(false); load();
    }
  };

  const toggleActive = async (s: SourceRow) => {
    await api('/api/sources/manage', { method: 'PATCH', body: { id: s.id, isActive: !s.isActive } });
    load();
  };
  const remove = async (s: SourceRow) => {
    if (!confirm(`حذف منبع «${s.name}»؟ مطالب آن باقی می‌ماند.`)) return;
    const r = await api(`/api/sources/manage?id=${s.id}`, { method: 'DELETE' });
    if (r.ok) { toast({ title: 'منبع حذف شد' }); load(); }
  };
  const fetchOne = async (s: SourceRow) => {
    setBusy(true);
    const r = await api<{ results: Array<{ ok: boolean; error?: string; inserted?: number; duplicatesSkipped?: number }> }>('/api/sources/fetch', { method: 'POST', body: { sourceId: s.id } });
    setBusy(false);
    const res = r.results?.[0];
    toast({
      title: res?.ok ? `دریافت موفق: ${faNum(res.inserted || 0)} مطلب جدید` : 'دریافت ناموفق',
      description: res?.ok ? `${faNum(res.duplicatesSkipped || 0)} تکراری رد شد` : res?.error,
      variant: res?.ok ? 'default' : 'destructive',
    });
    load();
  };

  // گزینه‌های فیلتر از داده واقعی
  const regions = ['همه', ...Array.from(new Set((sources || []).map((s) => s.region).filter(Boolean)))];
  const orientations = ['همه', ...Array.from(new Set((sources || []).map((s) => s.politicalOrientation).filter(Boolean) as string[]))];
  const filtered = (sources || []).filter((s) => {
    if (fRegion !== 'همه' && s.region !== fRegion) return false;
    if (fType !== 'همه' && (s.entityType || 'رسانه') !== fType) return false;
    if (fOrient !== 'همه') {
      const o = s.politicalOrientation || '';
      if (fOrient === 'میانه') { if (!/مرکز|میانه|مستقل/.test(o)) return false; }
      else if (fOrient === 'راست') { if (!/راست|محافظه‌کار|ناسیونالیست|جمهوری‌خواه|اصولگرا/.test(o)) return false; }
      else if (fOrient === 'چپ') { if (!/چپ|لیبرال|دموکرات|پیشرو|اصلاح‌طلب/.test(o)) return false; }
      else if (fOrient === 'رسمی/دولتی') { if (!/رسمی|دولتی/.test(o)) return false; }
      else if (fOrient === 'اپوزیسیون') { if (!/اپوزیسیون/.test(o)) return false; }
      else if (fOrient === 'هم‌سو با حاکمیت') { if (!/هم‌سو|وابسته|نزدیک/.test(o)) return false; }
      else if (fOrient === 'نهاد بین‌المللی') { if (!/نهاد/.test(o)) return false; }
    }
    if (fQuery.trim()) {
      const q = fQuery.trim().toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.identifier.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const exportJson = () => { window.location.href = '/api/sources/import-export'; };
  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const r = await api<{ imported: number; skipped: number }>('/api/sources/import-export', { method: 'POST', body: data });
      if (r.ok) {
        toast({ title: `${faNum(r.imported)} منبع وارد شد`, description: `${faNum(r.skipped)} مورد رد شد (تکراری یا نامعتبر)` });
        load();
      } else toast({ title: 'خطا در وارد کردن', description: r.error, variant: 'destructive' });
    } catch { toast({ title: 'فایل JSON نامعتبر است', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">مدیریت منابع</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportJson}><Download className="h-4 w-4 ml-1" /> صادر کردن</Button>
          <label className="cursor-pointer inline-flex">
            <Button size="sm" variant="outline" onClick={(e) => { (e.currentTarget.previousElementSibling as HTMLInputElement)?.click(); }}>
              <Upload className="h-4 w-4 ml-1" /> وارد کردن
            </Button>
            <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </label>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => { setEditId(null); setForm(emptyForm); }}><Plus className="h-4 w-4 ml-1" /> افزودن منبع</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? 'ویرایش منبع' : 'افزودن منبع جدید'}</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>نام منبع *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً: خبرگزاری میزان" /></div>
                  <div>
                    <Label>پلتفرم *</Label>
                    <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PLATFORM_LABELS).filter(([k]) => k !== 'instagram' && k !== 'aparat').map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>شناسه/نشانی * (نام کانال بدون @ یا نشانی کامل)</Label><Input dir="ltr" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="@example_channel یا https://t.me/s/example" /></div>
                <div><Label>پیوند اصلی (اختیاری)</Label><Input dir="ltr" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
                <div>
                  <Label>دسته‌بندی‌ها (چندگانه)</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {categories.map((c) => {
                      const active = form.categoryIds.includes(c.id);
                      return (
                        <button key={c.id} type="button"
                          className={`text-xs rounded-full px-2.5 py-1 border transition ${active ? 'bg-teal-600 text-white border-teal-600' : 'bg-white hover:bg-slate-50'}`}
                          onClick={() => setForm({
                            ...form,
                            categoryIds: active ? form.categoryIds.filter((x) => x !== c.id) : [...form.categoryIds, c.id],
                          })}>
                          {c.name}
                        </button>
                      );
                    })}
                    {categories.length === 0 && <span className="text-xs text-slate-400">هنوز دسته‌ای ساخته نشده — ابتدا در بخش «دسته‌بندی‌ها» دسته بسازید</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>اولویت</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="بالا">بالا</SelectItem><SelectItem value="عادی">عادی</SelectItem><SelectItem value="پایین">پایین</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>بازه دریافت (دقیقه)</Label><Input type="number" min={5} max={1440} value={form.fetchIntervalMin} onChange={(e) => setForm({ ...form, fetchIntervalMin: Number(e.target.value) })} /></div>
                  <div><Label>سقف مطالب هر دریافت</Label><Input type="number" min={1} max={60} value={form.maxItemsPerFetch} onChange={(e) => setForm({ ...form, maxItemsPerFetch: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>موضوع</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="مثلاً: اقتصاد ایران" /></div>
                  <div><Label>کشور/قلمرو</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="مثلاً: قطر، چین، آمریکا" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>نوع منبع</Label>
                    <Select value={form.entityType} onValueChange={(v) => setForm({ ...form, entityType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="رسانه">رسانه</SelectItem>
                        <SelectItem value="شخصیت">شخصیت اثرگذار</SelectItem>
                        <SelectItem value="نهاد رسمی">نهاد رسمی</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>گرایش سیاسی (توصیف قابل ویرایش)</Label>
                    <Input value={form.politicalOrientation} onChange={(e) => setForm({ ...form, politicalOrientation: e.target.value })} placeholder="مثلاً: مرکز — رسانه عمومی بریتانیا" />
                  </div>
                </div>
                <div><Label>یادداشت دلیل اعتماد / عدم اعتماد</Label><Input value={form.trustNote} onChange={(e) => setForm({ ...form, trustNote: e.target.value })} placeholder="مثلاً: وابسته به نهاد رسمی؛ سابقه خطای گزارشی در ..." /></div>
                <div><Label>یادداشت سایر</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

                <div className="border rounded-lg p-3 bg-slate-50 text-xs text-slate-600">
                  <Label className="text-xs">افزودن گروهی (هر سطر یک نشانی/شناسه)</Label>
                  <textarea
                    className="w-full mt-1 h-20 text-xs border rounded p-2 bg-white" dir="ltr"
                    value={bulk} onChange={(e) => setBulk(e.target.value)}
                    placeholder={'t.me/s/xyz_news\neitaa.com/abc_channel\nhttps://example.ir/feed'}
                  />
                  <Button size="sm" variant="secondary" className="mt-2" onClick={addBulk} disabled={busy || !bulk.trim()}>افزودن گروهی</Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={busy || !form.name.trim() || !form.identifier.trim()}>
                  {busy ? '...' : editId ? 'ذخیره تغییرات' : 'ثبت منبع'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!sources ? <LoadingCard title="منابع" /> : (
        <div className="space-y-3">
          {/* فیلترها */}
          <div className="flex flex-wrap items-center gap-2 p-3 border rounded-lg bg-slate-50">
            <Input className="w-40 h-9" value={fQuery} onChange={(e) => setFQuery(e.target.value)} placeholder="جست‌وجوی نام/شناسه…" />
            <Select value={fRegion} onValueChange={setFRegion}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {regions.map((r) => <SelectItem key={r} value={r}>{r === 'همه' ? 'همه کشورها' : r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fOrient} onValueChange={setFOrient}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="همه">همه گرایش‌ها</SelectItem>
                <SelectItem value="میانه">مرکز/میانه</SelectItem>
                <SelectItem value="راست">راست/محافظه‌کار</SelectItem>
                <SelectItem value="چپ">چپ/لیبرال</SelectItem>
                <SelectItem value="رسمی/دولتی">رسمی/دولتی</SelectItem>
                <SelectItem value="اپوزیسیون">اپوزیسیون</SelectItem>
                <SelectItem value="هم‌سو با حاکمیت">هم‌سو با حاکمیت</SelectItem>
                <SelectItem value="نهاد بین‌المللی">نهاد بین‌المللی</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fType} onValueChange={setFType}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="همه">همه انواع</SelectItem>
                <SelectItem value="رسانه">رسانه</SelectItem>
                <SelectItem value="شخصیت">شخصیت</SelectItem>
                <SelectItem value="نهاد رسمی">نهاد رسمی</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-slate-500">{faNum(filtered.length)} منبع از {faNum(sources.length)}</span>
          </div>
          {sources.length === 0 && (
            <Card><CardContent className="p-6 text-sm text-slate-400">هیچ منبعی ثبت نشده است. با «افزودن منبع» شروع کنید یا از پیشنهادهای هوش مصنوعی در بخش «کشف منابع» استفاده کنید.</CardContent></Card>
          )}
          {sources.length > 0 && filtered.length === 0 && (
            <Card><CardContent className="p-6 text-sm text-slate-400">هیچ منبعی با این فیلترها یافت نشد.</CardContent></Card>
          )}
          {filtered.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{s.name}</span>
                      <Badge variant="outline">{PLATFORM_LABELS[s.platform] || s.platform}</Badge>
                      <Badge className={statusStyle(s.status)}>{s.status.replace(/_/g, ' ')}</Badge>
                      {s.entityType && s.entityType !== 'رسانه' && <Badge variant="outline" className="text-violet-700 border-violet-300">{ENTITY_LABELS[s.entityType] || s.entityType}</Badge>}
                      {s.politicalOrientation && <Badge className={`${orientationStyle(s.politicalOrientation)} font-normal`} title="توصیف مالکیت/خط تحریریه — قابل ویرایش توسط کاربر؛ حکم بر درستی خبر نیست">{s.politicalOrientation.length > 48 ? s.politicalOrientation.slice(0, 48) + '…' : s.politicalOrientation}</Badge>}
                      {s.priority === 'بالا' && <Badge className="bg-teal-600 text-white">اولویت بالا</Badge>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1" dir="ltr">{s.identifier}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      کشور: {s.region} | دسته‌ها: {s.categories.map((c) => c.category.name).join('، ') || '—'} | مطالب: {faNum(s._count.posts)} | بازه: {faNum(s.fetchIntervalMin)} دقیقه | سقف: {faNum(s.maxItemsPerFetch)}
                    </div>
                    {s.statusDetail && <div className="text-xs text-slate-600 mt-1">{s.statusDetail}</div>}
                    {s.lastError && <div className="text-xs text-rose-600 mt-1">آخرین خطا: {s.lastError}</div>}
                    {s.trustNote && <div className="text-xs text-amber-700 mt-1">اعتماد: {s.trustNote}</div>}
                    {s.limitsNote && <div className="text-xs text-slate-400 mt-1">محدودیت: {s.limitsNote}</div>}
                    <div className="text-xs text-slate-400 mt-1">
                      آخرین دریافت: {s.lastFetchAt ? faDateTime(s.lastFetchAt) : 'هرگز'} | آخرین خطا: {s.lastErrorAt ? faDateTime(s.lastErrorAt) : '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={s.isActive} onCheckedChange={() => toggleActive(s)} aria-label="فعال/غیرفعال" />
                    <Button size="icon" variant="outline" onClick={() => fetchOne(s)} disabled={busy} title="دریافت فوری"><Radio className="h-4 w-4" /></Button>
                    <Button size="icon" variant="outline" onClick={() => {
                      setEditId(s.id);
                      setForm({
                        ...emptyForm,
                        name: s.name, platform: s.platform, identifier: s.identifier, url: s.url || '',
                        categoryIds: s.categories.map((c) => c.category.id), priority: s.priority, language: s.language,
                        region: s.region, topic: s.topic || '', trustNote: s.trustNote || '', notes: s.notes || '',
                        entityType: s.entityType || 'رسانه', politicalOrientation: s.politicalOrientation || '',
                        fetchIntervalMin: s.fetchIntervalMin, maxItemsPerFetch: s.maxItemsPerFetch,
                      });
                      setOpen(true);
                    }} title="ویرایش"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="outline" className="text-rose-600" onClick={() => remove(s)} title="حذف"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
