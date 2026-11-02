'use client';
/**
 * کامپوننت سه‌تقویم — شمسی + قمری + میلادی هم‌زمان (قابلیت ۱٫۱-ج)
 * دو حالت: خطی برای فضاهای کم / سه‌بخشی با برچسب
 */
import { tripleDateParts } from '@/lib/persian';

export function TripleDate({
  date, tz, variant = 'inline', className = '',
}: {
  date: Date | string | null | undefined;
  tz?: string;
  variant?: 'inline' | 'stacked';
  className?: string;
}) {
  if (!date) return <span className={className}>—</span>;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return <span className={className}>—</span>;
  const p = tripleDateParts(d, tz);
  if (variant === 'inline') {
    return (
      <span className={`inline-flex flex-wrap items-center gap-x-1.5 ${className}`} title="شمسی — قمری — میلادی">
        <span>{p.shamsi}</span>
        <span className="text-slate-300" aria-hidden>|</span>
        <span className="text-slate-500">{p.qamari}</span>
        <span className="text-slate-300" aria-hidden>|</span>
        <span className="text-slate-500">{p.miladi}</span>
      </span>
    );
  }
  return (
    <span className={`grid gap-0.5 text-xs ${className}`}>
      <span><span className="inline-block w-12 text-slate-400">شمسی:</span> {p.shamsi}</span>
      <span><span className="inline-block w-12 text-slate-400">قمری:</span> {p.qamari}</span>
      <span><span className="inline-block w-12 text-slate-400">میلادی:</span> {p.miladi}</span>
    </span>
  );
}
