'use client';
/**
 * پنل دسته‌بندی‌ها + تنظیمات پرامپت هر دسته (فصل ۱۲ بند ۳ و ۱۰)
 */
import { useCallback, useEffect, useState } from 'react';
import { api, faNum } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { LoadingCard } from './dashboard';

interface CatRow {
  id: string; name: string; slug: string; description: string | null; color: string;
  isActive: boolean; promptTemplate: string | null;
  sources: Array<{ source: { name: string } }>;
  _count: { posts: number; events: number; reports: number };
}

const empty = { name: '', slug: '', description: '', color: '#0f766e', promptTemplate: '', isActive: true };

export function CategoriesPanel(_props?: { promptFocus?: boolean }) {
  const [cats, setCats] = useState<CatRow[] | null>(null);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<{ categories: CatRow[] }>('/api/categories');
    if (r.ok) setCats(r.categories);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true);
    const payload = { ...form, description: form.description || undefined };
    const r = editId
      ? await api('/api/categories', { method: 'PATCH', body: { id: editId, ...payload } })
      : await api('/api/categories', { method: 'POST', body: payload });
    setBusy(false);
    if (r.ok) { toast({ title: editId ? 'دسته ویرایش شد' : 'دسته ساخته شد' }); setForm(empty); setEditId(null); setOpen(false); load(); }
    else toast({ title: 'خطا', description: r.error, variant: 'destructive' });
  };

  const remove = async (c: CatRow) => {
    if (!confirm(`حذف دسته «${c.name}»؟ منابع و مطالب حفظ می‌شوند.`)) return;
    await api(`/api/categories?id=${c.id}`, { method: 'DELETE' });
    load();
  };

  const savePrompt = async (c: CatRow, promptTemplate: string) => {
    const r = await api('/api/categories', { method: 'PATCH', body: { id: c.id, promptTemplate } });
    toast({ title: r.ok ? 'پرامپت دسته ذخیره شد' : 'خطا', variant: r.ok ? 'default' : 'destructive' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">دسته‌بندی‌ها</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" onClick={() => { setEditId(null); setForm(empty); }}><Plus className="h-4 w-4 ml-1" /> دسته جدید</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? 'ویرایش دسته' : 'ساخت دسته'}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>نام دسته *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً: سیاست خارجی" /></div>
              <div><Label>شناسه لاتین (slug) *</Label><Input dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="foreign-policy" /></div>
              <div><Label>توضیح</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>رنگ</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10" /></div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={busy || !form.name.trim() || !form.slug.trim()}>{busy ? '...' : 'ذخیره'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!cats ? <LoadingCard title="دسته‌ها" /> : (
        <div className="grid md:grid-cols-2 gap-3">
          {cats.length === 0 && <Card><CardContent className="p-6 text-sm text-slate-400">دسته‌ای وجود ندارد. دسته‌ها چارچوب گزارش‌های تخصصی شما هستند.</CardContent></Card>}
          {cats.map((c) => (
            <CatCard key={c.id} cat={c} onRemove={remove} onEdit={() => {
              setEditId(c.id);
              setForm({ name: c.name, slug: c.slug, description: c.description || '', color: c.color, promptTemplate: c.promptTemplate || '', isActive: c.isActive });
              setOpen(true);
            }} onSavePrompt={savePrompt} />
          ))}
        </div>
      )}
    </div>
  );
}

function CatCard({ cat, onRemove, onEdit, onSavePrompt }: {
  cat: CatRow; onRemove: (c: CatRow) => void; onEdit: () => void; onSavePrompt: (c: CatRow, p: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(cat.promptTemplate || '');
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="h-3 w-3 rounded-full inline-block" style={{ background: cat.color }} />
            {cat.name}
            {!cat.isActive && <Badge variant="outline">غیرفعال</Badge>}
          </CardTitle>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => onRemove(cat)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {cat.description && <div className="text-slate-600">{cat.description}</div>}
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <Badge variant="outline">منابع: {faNum(cat.sources.length)}</Badge>
          <Badge variant="outline">مطالب: {faNum(cat._count.posts)}</Badge>
          <Badge variant="outline">رویدادها: {faNum(cat._count.events)}</Badge>
          <Badge variant="outline">گزارش‌ها: {faNum(cat._count.reports)}</Badge>
        </div>
        <div className="text-xs text-slate-400" dir="ltr">{cat.slug}</div>
        {editing ? (
          <div className="space-y-2">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-28 text-xs"
              placeholder="راهنمای اختصاصی تحلیل‌گر برای این دسته: واژگان تخصصی، منابع مرجع، نکات حساس، آنچه را نباید نتیجه‌گیری کند..." />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { onSavePrompt(cat, prompt); setEditing(false); }}>ذخیره پرامپت</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>لغو</Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-slate-500 line-clamp-2">{cat.promptTemplate || 'پرامپت اختصاصی تنظیم نشده — از پرامپت عمومی سامانه استفاده می‌شود.'}</div>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setEditing(true)}>ویرایش پرامپت دسته</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
