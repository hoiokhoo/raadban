'use client';
/**
 * رصد‌بان — سامانه هوشمند رصد، راستی‌آزمایی و تحلیل تاریخ‌محور اخبار
 * رابط تک‌صفحه‌ای فارسی راست‌چین با ۱۴ بخش (فصل ۱۲ سند مأموریت)
 */
import { useState } from 'react';
import { DashboardPanel } from '@/components/panels/dashboard';
import { DailyReportPanel } from '@/components/panels/report';
import { SourcesPanel } from '@/components/panels/sources';
import { CategoriesPanel } from '@/components/panels/categories';
import { DiscoveryPanel } from '@/components/panels/discovery';
import { FactcheckPanel } from '@/components/panels/factcheck';
import { ArchivePanel, SearchPanel, ComparePanel } from '@/components/panels/archive';
import { AiSettingsPanel, SchedulePanel, CostsPanel, ErrorsPanel, ProviderKeysPanel, BaleBotPanel } from '@/components/panels/settings';
import { ChannelReaderPanel } from '@/components/panels/channel-reader';
import { EventsPanel } from '@/components/panels/events';
import { AnalysisPanel, ClustersTab } from '@/components/panels/analysis';
import { Radar, Newspaper, FolderTree, Radio, Sparkles, Archive, Search, GitCompareArrows, ShieldCheck, MessageSquareCode, Bot, Timer, Coins, AlertTriangle, MessagesSquare, CalendarClock, Network, Send, Waypoints, Activity } from 'lucide-react';
import { LiveNewsPanel } from '@/components/panels/live';

const TABS = [
  { key: 'dashboard', label: 'داشبورد امروز', icon: Radar },
  { key: 'live', label: 'اخبار لحظه‌ای', icon: Activity },
  { key: 'newsline', label: 'خط خبری', icon: Waypoints },
  { key: 'report', label: 'گزارش روزانه', icon: Newspaper },
  { key: 'categories', label: 'دسته‌بندی‌ها', icon: FolderTree },
  { key: 'sources', label: 'مدیریت منابع', icon: Radio },
  { key: 'discovery', label: 'کشف منابع با AI', icon: Sparkles },
  { key: 'archive', label: 'آرشیو تاریخی', icon: Archive },
  { key: 'search', label: 'جست‌وجو', icon: Search },
  { key: 'compare', label: 'مقایسه دو تاریخ', icon: GitCompareArrows },
  { key: 'factcheck', label: 'راستی‌آزمایی', icon: ShieldCheck },
  { key: 'channels', label: 'خوانش کانال‌ها', icon: MessagesSquare },
  { key: 'events', label: 'رویدادهای پیش رو', icon: CalendarClock },
  { key: 'analysis', label: 'تحلیل پیشرفته', icon: Network },
  { key: 'prompts', label: 'پرامپت دسته‌ها', icon: MessageSquareCode },
  { key: 'ai', label: 'مدل و API', icon: Bot },
  { key: 'bale', label: 'ربات بله', icon: Send },
  { key: 'schedule', label: 'زمان‌بندی', icon: Timer },
  { key: 'costs', label: 'هزینه و مصرف', icon: Coins },
  { key: 'errors', label: 'خطاها و سرویس‌ها', icon: AlertTriangle },
];

export default function Home() {
  const [tab, setTab] = useState('dashboard');
  const active = TABS.find((t) => t.key === tab);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* سربرگ */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-teal-700 text-white p-2 rounded-xl"><Radar className="h-6 w-6" /></div>
            <div>
              <h1 className="text-lg font-bold leading-6">رصد‌بان</h1>
              <p className="text-[11px] text-slate-500 leading-4">سامانه هوشمند رصد، راستی‌آزمایی و تحلیل تاریخ‌محور اخبار</p>
            </div>
          </div>
          <div className="hidden md:block text-xs text-slate-400 leading-5 text-left">
            اخبار داده است، نه دستور — راستی‌آزمایی شفاف، تاریخ‌محور و قابل حسابرسی
          </div>
        </div>
        {/* ناوبری */}
        <nav className="max-w-7xl mx-auto px-2 overflow-x-auto" aria-label="بخش‌های سامانه">
          <div className="flex gap-1 pb-1.5 min-w-max">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-2 transition whitespace-nowrap ${
                    isActive ? 'bg-teal-700 text-white shadow-sm font-medium' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* محتوا */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        {tab === 'dashboard' && <DashboardPanel />}
        {tab === 'live' && <LiveNewsPanel />}
        {tab === 'newsline' && <ClustersTab />}
        {tab === 'report' && <DailyReportPanel />}
        {tab === 'categories' && <CategoriesPanel />}
        {tab === 'sources' && <SourcesPanel />}
        {tab === 'discovery' && <DiscoveryPanel />}
        {tab === 'archive' && <ArchivePanel />}
        {tab === 'search' && <SearchPanel />}
        {tab === 'compare' && <ComparePanel />}
        {tab === 'factcheck' && <FactcheckPanel />}
        {tab === 'channels' && <ChannelReaderPanel />}
        {tab === 'events' && <EventsPanel />}
        {tab === 'analysis' && <AnalysisPanel />}
        {tab === 'prompts' && <CategoriesPanel promptFocus />}
        {tab === 'ai' && <AiSettingsPanel />}
        {tab === 'bale' && <BaleBotPanel />}
        {tab === 'schedule' && <SchedulePanel />}
        {tab === 'costs' && <CostsPanel />}
        {tab === 'errors' && <ErrorsPanel />}
      </main>

      {/* پانویس چسبان */}
      <footer className="mt-auto bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 py-3 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>رصد‌بان نسخه ۱٫۰ — رابط‌های نتیجه تحلیلی همیشه با برچسب «تحلیل/محتمل» جدا از خبر قطعی نمایش داده می‌شوند.</span>
          <span>{active ? `بخش فعال: ${active.label}` : ''}</span>
        </div>
      </footer>
    </div>
  );
}
