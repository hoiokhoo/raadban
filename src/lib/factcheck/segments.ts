/**
 * سگمنت‌سازی متن بر اساس نقل‌قول‌های مدل — خالص و قابل‌تست
 * ورودی: متن اصلی پیام + آرایه quote (بخش‌های عین متن با حکم)
 * خروجی: توالی قطعه‌ها برای رنگ‌آمیزی؛ بخش‌های بدون حکم verdict «خنثی» می‌گیرند
 */

export const SEGMENT_VERDICTS = ['درست', 'نادرست', 'گمراه‌کننده', 'تأییدناپذیر', 'نظر/تحلیل'] as const;
export type SegmentVerdict = (typeof SEGMENT_VERDICTS)[number] | 'خنثی';

export interface RawSegment {
  quote: string;
  verdict: string;
  explanation?: string;
  basis?: string;
}

export interface RenderedSegment {
  text: string;
  verdict: SegmentVerdict;
  explanation?: string;
  basis?: string;
}

const VERDICT_ALIASES: Record<string, SegmentVerdict> = {
  'درست': 'درست', 'صحیح': 'درست', 'تأییدشده': 'درست', 'تایید شده': 'درست',
  'نادرست': 'نادرست', 'دروغ': 'نادرست', 'غلط': 'نادرست', 'ردشده': 'نادرست',
  'گمراه‌کننده': 'گمراه‌کننده', 'گمراه كننده': 'گمراه‌کننده', 'نیمه‌درست': 'گمراه‌کننده',
  'تأییدناپذیر': 'تأییدناپذیر', 'تاییدناپذیر': 'تأییدناپذیر', 'قابل تأیید نیست': 'تأییدناپذیر',
  'نظر/تحلیل': 'نظر/تحلیل', 'نظر': 'نظر/تحلیل', 'تحلیل': 'نظر/تحلیل',
};

export function normalizeVerdict(v: string): SegmentVerdict {
  const s = (v || '').trim().replace(/_/g, ' ');
  if (VERDICT_ALIASES[s]) return VERDICT_ALIASES[s];
  if ((SEGMENT_VERDICTS as readonly string[]).includes(s)) return s as SegmentVerdict;
  return 'تأییدناپذیر';
}

/**
 * نسخه نرمال متن (حذف نیم‌فاصله، فشرده‌سازی فاصله‌ها) همراه با نگاشت
 * اندیس هر نویسه نسخه نرمال به اندیس متن خام — برای برش دقیق از متن اصلی.
 */
export function normWithMap(text: string): { norm: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\u200c') continue; // نیم‌فاصله حذف می‌شود («می‌رویم» = «میرویم» برای تطبیق)
    if (/\s/.test(ch)) {
      if (!lastWasSpace) { chars.push(' '); map.push(i); lastWasSpace = true; }
      continue;
    }
    chars.push(ch); map.push(i); lastWasSpace = false;
  }
  while (chars.length && chars[chars.length - 1] === ' ') { chars.pop(); map.pop(); }
  return { norm: chars.join(''), map };
}

/**
 * ساخت توالی پوشاننده قطعه‌ها از متن پیام.
 * quoteهای ناموجود در متن به missingQuotes می‌روند؛ همپوشانی: اولویت با بلندتر.
 */
export function buildSegments(
  text: string,
  rawSegments: RawSegment[],
): { segments: RenderedSegment[]; missingQuotes: string[] } {
  const { norm, map } = normWithMap(text);
  type Range = { start: number; end: number; seg: RawSegment };
  const ranges: Range[] = [];
  const missingQuotes: string[] = [];

  for (const seg of rawSegments || []) {
    if (!seg || typeof seg.quote !== 'string' || seg.quote.trim().length < 3) continue;
    const q = normWithMap(seg.quote).norm;
    if (!q) continue;
    const idx = norm.indexOf(q);
    if (idx === -1) { missingQuotes.push(seg.quote); continue; }
    const start = map[idx];
    const endIdx = idx + q.length - 1;
    const end = endIdx < map.length ? map[endIdx] + 1 : text.length;
    if (start < end && end <= text.length) ranges.push({ start, end, seg });
  }

  // حذف همپوشانی: اولویت با quoteهای بلندتر
  ranges.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const accepted: Range[] = [];
  for (const r of ranges) {
    if (accepted.some((a) => r.start < a.end && a.start < r.end)) continue;
    accepted.push(r);
  }
  accepted.sort((a, b) => a.start - b.start);

  const out: RenderedSegment[] = [];
  let cursor = 0;
  for (const r of accepted) {
    if (r.start > cursor) out.push({ text: text.slice(cursor, r.start), verdict: 'خنثی' });
    out.push({
      text: text.slice(r.start, r.end),
      verdict: normalizeVerdict(r.seg.verdict),
      explanation: r.seg.explanation,
      basis: r.seg.basis,
    });
    cursor = r.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), verdict: 'خنثی' });
  return { segments: out.filter((s) => s.text.length > 0), missingQuotes };
}
