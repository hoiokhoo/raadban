'use client';
/**
 * پانل «پیام‌های روزانه» — خواستهٔ کاربر (۱۰ نوامبر ۲۰۲۶):
 * صبحگاهی ۰۵:۰۰ و شبانگاهی ۲۰:۰۰ با حدیث چهارده معصوم + تصویر طبیعت + تاریخ سه‌گانه +
 * مناسبت‌ها + اوقات شرعی فردا. امکانات پانل: فعال/غیرفعال کردن هر پیام، تغییر ساعت ارسال،
 * منطقهٔ زمانی، شهر و مختصات، روش محاسبهٔ اوقات شرعی، مشاهدهٔ حدیث بعدی و احادیث منتشرشده،
 * تاریخچهٔ انتشار، تصاویر استفاده‌شده، خطاهای زمان‌بندی و ارسال آزمایشی (به چت مدیر — بدون مصرف حدیث).
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api, faNum, faDateTime } from '@/lib/client';
import { LoadingCard } from '@/components/panels/dashboard';
import { Sun, Moon, Save, Eye, BookOpen, ImageIcon, History, AlertTriangle, CalendarDays } from 'lucide-react';

interface DailySettings {
  morningEnabled: boolean; eveningEnabled: boolean;
  morningHour: string; eveningHour: string;
  timezone: string; city: string; lat: number; lon: number;
  prayerMethod: 'tehran' | 'mwl' | 'custom';
  fajrAngle: number; ishaAngle: number; maghribMinutes: number;
  qamariBasis: 'umalqura' | 'civil';
}
interface HadithPreview { id: string; narrator: string; arabic: string; persian: string; source: string }
interface RunEntry { dateKey: string; kind: string; slotKey: string; status: string; isTest: boolean; hadithId?: string; error?: string; at: string }
interface BankStatus { total: number; used: number; remaining: number; perInfallible: Array<{ name: string; total: number; used: number }> }
interface DailyStatus {
  settings: DailySettings;
  settingsSource: string;
  bank: BankStatus;
  nextMorning: HadithPreview | null;
  nextEvening: HadithPreview | null;
  runs: RunEntry[];
  images: Array<[string, { dateKey: string; kind: string }]>;
  errors: RunEntry[];
  lastMorningKey: string | null;
  lastEveningKey: string | null;
  lastBundleAt: string | null;
  bundleQueueSize: number;
  carStoreSize: number;
  saleAlertsSeen: number;
  dateKey: string;
  dbMirror: string;
}
interface PreviewResponse {
  ok: boolean; error?: string;
  hadithExhausted?: boolean; note?: string;
  preview?: { text: string; photoUrl: string | null; photoCaption: string | null };
  hadith?: { id: string; narrator: string; source: string };
  sent?: { ok: boolean; error?: string; to?: string };
}

const CITIES = ['تهران', 'مشهد', 'اصفهان', 'شیراز', 'تبریز', 'قم', 'کرج', 'اهواز', 'کرمانشاه', 'ارومیه', 'رشت', 'زاهدان', 'بندرعباس'];

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

export function DailyMessagesPanel() {
  const [data, setData] = useState<DailyStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ kind: string; text: string; photoUrl: string | null; caption: string | null } | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const r = await api<DailyStatus>('/api/daily/status');
    if (r.ok) setData(r);
    else toast({ title: 'خطا در دریافت وضعیت پیام‌های روزانه', description: r.error, variant: 'destructive' });
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<DailySettings>, tag: string) => {
    setBusy(tag);
    const r = await api<{ note: string; repoWritten: boolean; settings: DailySettings }>('/api/daily/settings', { method: 'PUT', body: patch });
    setBusy(null);
    toast({
      title: r.ok ? 'ذخیره شد — ربات در چرخهٔ بعدی اعمال می‌کند (~۱۰ دقیقه)' : 'خطا در ذخیره',
      description: r.ok ? r.note : r.error,
      variant: r.ok && !r.repoWritten ? 'default' : r.ok ? 'default' : 'destructive',
    });
    if (r.ok) setData((d) => (d ? { ...d, settings: r.settings } : d));
  };

  const doPreview = async (kind: 'morning' | 'evening', send: boolean) => {
    setBusy(send ? `${kind}-send` : `${kind}-preview`);
    const r = await api<PreviewResponse>('/api/daily/preview', { method: 'POST', body: { kind, send } });
    setBusy(null);
    if (!r.ok) { toast({ title: 'خطا در ساخت پیام', description: r.error, variant: 'destructive' }); return; }
    if (r.hadithExhausted) { toast({ title: 'بانک احادیث تمام شده است', description: r.note, variant: 'destructive' }); return; }
    if (r.preview) setPreview({ kind, text: stripHtml(r.preview.text), photoUrl: r.preview.photoUrl, caption: r.preview.photoCaption || null });
    if (send) {
      toast({
        title: r.sent?.ok ? 'پیام آزمایشی به چت مدیر ارسال شد' : 'ارسال آزمایشی ناموفق',
        description: r.sent?.ok ? 'حدیث مصرف نشد و نوبت روزانه ثبت نشد' : r.sent?.error,
        variant: r.sent?.ok ? 'default' : 'destructive',
      });
    }
  };

  if (!data) return <LoadingCard title="پیام‌های روزانه" />;

  const s = data.settings;
  const upd = (patch: Partial<DailySettings>): Partial<DailySettings> => patch;

  return (
    <div className="space-y-4" dir="rtl">
      {/* تنظیمات */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5" /> تنظیمات پیام‌های روزانه</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium"><Sun className="h-4 w-4 text-amber-500" /> پیام صبحگاهی</div>
                <Switch checked={s.morningEnabled} onCheckedChange={(v) => save(upd({ morningEnabled: v }), 'm-en')} disabled={busy === 'm-en'} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap text-sm">ساعت ارسال</Label>
                <Input value={s.morningHour} onChange={(e) => setData((d) => d ? { ...d, settings: { ...d.settings, morningHour: e.target.value } } : d)} className="w-24 text-center" dir="ltr" />
                <Button size="sm" variant="outline" disabled={busy === 'm-h'} onClick={() => save(upd({ morningHour: s.morningHour }), 'm-h')}><Save className="h-4 w-4" /> ذخیرهٔ ساعت</Button>
              </div>
              <Button size="sm" variant="outline" className="w-full" disabled={busy === 'm-preview'} onClick={() => doPreview('morning', false)}>
                <Eye className="h-4 w-4" /> پیش‌نمایش صبحگاهی (بدون ارسال)
              </Button>
              <Button size="sm" variant="secondary" className="w-full" disabled={busy === 'm-send'} onClick={() => doPreview('morning', true)}>
                <Sun className="h-4 w-4" /> ارسال آزمایشی به چت مدیر
              </Button>
            </div>
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium"><Moon className="h-4 w-4 text-indigo-500" /> پیام شبانگاهی</div>
                <Switch checked={s.eveningEnabled} onCheckedChange={(v) => save(upd({ eveningEnabled: v }), 'e-en')} disabled={busy === 'e-en'} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap text-sm">ساعت ارسال</Label>
                <Input value={s.eveningHour} onChange={(e) => setData((d) => d ? { ...d, settings: { ...d.settings, eveningHour: e.target.value } } : d)} className="w-24 text-center" dir="ltr" />
                <Button size="sm" variant="outline" disabled={busy === 'e-h'} onClick={() => save(upd({ eveningHour: s.eveningHour }), 'e-h')}><Save className="h-4 w-4" /> ذخیرهٔ ساعت</Button>
              </div>
              <Button size="sm" variant="outline" className="w-full" disabled={busy === 'e-preview'} onClick={() => doPreview('evening', false)}>
                <Eye className="h-4 w-4" /> پیش‌نمایش شبانگاهی (بدون ارسال)
              </Button>
              <Button size="sm" variant="secondary" className="w-full" disabled={busy === 'e-send'} onClick={() => doPreview('evening', true)}>
                <Moon className="h-4 w-4" /> ارسال آزمایشی به چت مدیر
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-sm">شهر اوقات شرعی</Label>
              <Select value={s.city} onValueChange={(v) => save(upd({ city: v }), 'city')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">مختصات (عرض، طول)</Label>
              <div className="flex gap-1" dir="ltr">
                <Input value={String(s.lat)} onChange={(e) => setData((d) => d ? { ...d, settings: { ...d.settings, lat: Number(e.target.value) || 0 } } : d)} className="text-xs" />
                <Input value={String(s.lon)} onChange={(e) => setData((d) => d ? { ...d, settings: { ...d.settings, lon: Number(e.target.value) || 0 } } : d)} className="text-xs" />
              </div>
              <Button size="sm" variant="outline" className="w-full" disabled={busy === 'geo'} onClick={() => save(upd({ lat: s.lat, lon: s.lon }), 'geo')}>ذخیرهٔ مختصات</Button>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">روش اوقات شرعی</Label>
              <Select value={s.prayerMethod} onValueChange={(v) => save(upd({ prayerMethod: v as DailySettings['prayerMethod'] }), 'pm')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tehran">ژئوفیزیک تهران (۱۷٫۷° / ۱۴°)</SelectItem>
                  <SelectItem value="mwl">رابطهٔ جهانی مساجد</SelectItem>
                  <SelectItem value="custom">سفارشی (زاویهٔ دستی)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">مبنای تقویم قمری</Label>
              <Select value={s.qamariBasis} onValueChange={(v) => save(upd({ qamariBasis: v as DailySettings['qamariBasis'] }), 'qb')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="umalqura">ام‌القری (پیش‌فرض)</SelectItem>
                  <SelectItem value="civil">قمری مدنی</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-sm">منطقهٔ زمانی</Label>
              <Input value={s.timezone} onChange={(e) => setData((d) => d ? { ...d, settings: { ...d.settings, timezone: e.target.value } } : d)} dir="ltr" className="text-xs" />
              <Button size="sm" variant="outline" className="w-full" disabled={busy === 'tz'} onClick={() => save(upd({ timezone: s.timezone }), 'tz')}>ذخیرهٔ منطقهٔ زمانی</Button>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">زاویهٔ اذان صبح / عشا</Label>
              <div className="flex gap-1" dir="ltr">
                <Input value={String(s.fajrAngle)} onChange={(e) => setData((d) => d ? { ...d, settings: { ...d.settings, fajrAngle: Number(e.target.value) || 0 } } : d)} className="text-xs" />
                <Input value={String(s.ishaAngle)} onChange={(e) => setData((d) => d ? { ...d, settings: { ...d.settings, ishaAngle: Number(e.target.value) || 0 } } : d)} className="text-xs" />
              </div>
              <Button size="sm" variant="outline" className="w-full" disabled={busy === 'ang'} onClick={() => save(upd({ fajrAngle: s.fajrAngle, ishaAngle: s.ishaAngle }), 'ang')}>ذخیرهٔ زاویه‌ها</Button>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">دقیقهٔ اذان مغرب پس از غروب</Label>
              <Input value={String(s.maghribMinutes)} onChange={(e) => setData((d) => d ? { ...d, settings: { ...d.settings, maghribMinutes: Number(e.target.value) || 0 } } : d)} dir="ltr" className="text-xs" />
              <Button size="sm" variant="outline" className="w-full" disabled={busy === 'mm'} onClick={() => save(upd({ maghribMinutes: s.maghribMinutes }), 'mm')}>ذخیرهٔ دقیقهٔ مغرب</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">منبع تنظیمات: {data.settingsSource === 'repo' ? 'ریپو (عملیاتی)' : data.settingsSource === 'local' ? 'فایل محلی' : 'پیش‌فرض'} — آینهٔ بانک: {data.dbMirror}</p>
        </CardContent>
      </Card>

      {/* پیش‌نمایش */}
      {preview && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Eye className="h-5 w-5" /> پیش‌نمایش پیام {preview.kind === 'morning' ? 'صبحگاهی' : 'شبانگاهی'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm leading-6">{preview.text}</pre>
            {preview.photoUrl && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">تصویر واقعی ویکی‌مدیا:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.photoUrl} alt="تصویر روز" className="max-h-64 rounded-lg" />
                <p className="text-xs text-muted-foreground">{preview.caption}</p>
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>بستن پیش‌نمایش</Button>
          </CardContent>
        </Card>
      )}

      {/* بانک احادیث */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BookOpen className="h-5 w-5" /> بانک احادیث چهارده معصوم (ع)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">کل: {faNum(data.bank.total)}</Badge>
            <Badge variant="secondary">منتشرشده: {faNum(data.bank.used)}</Badge>
            <Badge variant={data.bank.remaining > 10 ? 'secondary' : 'destructive'}>مانده: {faNum(data.bank.remaining)}</Badge>
            <span className="text-xs text-muted-foreground">ضدتکرار مطلق (حتی پس از ری‌استارت) + ضدتکرار معنایی متن عربی</span>
          </div>
          <div className="grid grid-cols-1 gap-1 text-xs md:grid-cols-2">
            {data.bank.perInfallible.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{p.name}</span>
                <span className="text-muted-foreground">{faNum(p.used)} از {faNum(p.total)}</span>
              </div>
            ))}
          </div>
          {data.nextMorning && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="mb-1 font-medium">حدیث بعدی صبحگاهی (پیش‌نمایش — مصرف نشده):</p>
              <p className="text-muted-foreground">{data.nextMorning.arabic}</p>
              <p>{data.nextMorning.persian}</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.nextMorning.narrator} — منبع: {data.nextMorning.source}</p>
            </div>
          )}
          {data.nextEvening && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="mb-1 font-medium">حدیث بعدی شبانگاهی (پیش‌نمایش — مصرف نشده):</p>
              <p className="text-muted-foreground">{data.nextEvening.arabic}</p>
              <p>{data.nextEvening.persian}</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.nextEvening.narrator} — منبع: {data.nextEvening.source}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* تاریخچه و خطاها */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5" /> تاریخچهٔ انتشارها</CardTitle></CardHeader>
          <CardContent>
            {data.runs.length === 0 && <p className="text-sm text-muted-foreground">هنوز نوبتی ثبت نشده است.</p>}
            <div className="space-y-1 text-sm">
              {data.runs.slice(0, 15).map((r, i) => (
                <div key={`${r.slotKey}-${r.status}-${i}`} className="flex items-center justify-between rounded border px-2 py-1">
                  <span>{r.kind === 'morning' ? '🌅 صبحگاهی' : '🌙 شبانگاهی'} — {faDateTime(r.at)}</span>
                  <Badge variant={r.status === 'sent' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>{r.status === 'sent' ? 'ارسال شد' : r.status === 'failed' ? 'ناموفق' : r.status === 'preview' ? 'آزمایشی' : r.status}</Badge>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">آخرین بست نیم‌ساعته: {data.lastBundleAt ? faDateTime(data.lastBundleAt) : '—'} | صف بست: {faNum(data.bundleQueueSize)} | انبار خودرو: {faNum(data.carStoreSize)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5" /> خطاهای اخیر</CardTitle></CardHeader>
          <CardContent>
            {data.errors.length === 0 && <p className="text-sm text-muted-foreground">خطایی ثبت نشده است.</p>}
            <div className="space-y-1 text-sm">
              {data.errors.map((e, i) => (
                <div key={`${e.slotKey}-${i}`} className="rounded border border-destructive/30 px-2 py-1">
                  <span className="font-medium">{e.kind === 'morning' ? 'صبحگاهی' : 'شبانگاهی'} {e.dateKey}:</span> <span className="text-destructive">{e.error}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* تصاویر استفاده‌شده */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ImageIcon className="h-5 w-5" /> تصاویر استفاده‌شده ({faNum(data.images.length)})</CardTitle></CardHeader>
        <CardContent>
          {data.images.length === 0 && <p className="text-sm text-muted-foreground">هنوز تصویری منتشر نشده است.</p>}
          <div className="space-y-1 text-xs">
            {data.images.map(([key, u]) => (
              <div key={key} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                <span className="truncate" dir="ltr">{key.split('/').pop()}</span>
                <span className="whitespace-nowrap text-muted-foreground">{u.kind === 'morning' ? 'صبح' : 'شب'} — {u.dateKey}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
