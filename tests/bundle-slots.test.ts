/**
 * تست‌های اسلات‌های قطعی بسته‌ها و بستهٔ جداگانهٔ توییت (خواستهٔ کاربر ۱۲ نوامبر ۲۰۲۶):
 * «چرخهٔ خبر هر ۲ ساعت اما خبری از قلم نیفته؛ توییت‌های افراد تأثیرگذار هر ۲ ساعت اما
 *  یک ساعت بعد از دستهٔ اخبار در دستهٔ جداگانه — اگر جدید نبود هیچ متنی نفرست» +
 *  «برنامه در زمان جمع‌بندی اخبار قبلی رو چک کنه — خبر مضمون تکراری ارسال نشه»
 * اجرا: bun test tests/bundle-slots.test.ts
 */
import { describe, test, expect } from 'bun:test';
import {
  periodicSlotKey,
  dueBundleSlotKey,
  buildTweetBundleChunks,
  buildBundleChunks,
  type BundleItem,
} from '../bot/bundle';
import { dropAlreadySent, type HourlyItem } from '../bot/hourly';

// ---------- کلید اسلات تکرارشونده ----------

describe('periodicSlotKey — اسلات‌های قطعی', () => {
  const D = '2026-11-12';

  test('بستهٔ خبری (offset=0، دورهٔ ۲ ساعت) — اسلات‌های زوج', () => {
    expect(periodicSlotKey(D, 0 * 60 + 5, 0, 120)).toBe(`${D}T00:00`);
    expect(periodicSlotKey(D, 1 * 60 + 59, 0, 120)).toBe(`${D}T00:00`);
    expect(periodicSlotKey(D, 2 * 60 + 0, 0, 120)).toBe(`${D}T02:00`);
    expect(periodicSlotKey(D, 10 * 60 + 37, 0, 120)).toBe(`${D}T10:00`);
    expect(periodicSlotKey(D, 22 * 60 + 1, 0, 120)).toBe(`${D}T22:00`);
    expect(periodicSlotKey(D, 23 * 60 + 59, 0, 120)).toBe(`${D}T22:00`);
  });

  test('بستهٔ توییت (offset=60، دورهٔ ۲ ساعت) — اسلات‌های فرد = یک ساعت بعد از خبر', () => {
    expect(periodicSlotKey(D, 1 * 60 + 0, 60, 120)).toBe(`${D}T01:00`);
    expect(periodicSlotKey(D, 1 * 60 + 59, 60, 120)).toBe(`${D}T01:00`);
    expect(periodicSlotKey(D, 2 * 60 + 30, 60, 120)).toBe(`${D}T01:00`); // هنوز اسلات ۰۳ نرسیده
    expect(periodicSlotKey(D, 3 * 60 + 10, 60, 120)).toBe(`${D}T03:00`);
    expect(periodicSlotKey(D, 23 * 60 + 45, 60, 120)).toBe(`${D}T23:00`);
  });

  test('پوشش نیمه‌شب — ۰۰:۳۰ برای توییت یعنی اسلات ۲۳:۰۰ دیروز (جبران)', () => {
    expect(periodicSlotKey(D, 0 * 60 + 30, 60, 120)).toBe('2026-11-11T23:00');
    expect(periodicSlotKey('2026-11-01', 0 * 60 + 10, 60, 120)).toBe('2026-10-31T23:00');
  });

  test('مرز دقیق اسلات — دقیقهٔ صفر همان اسلات تازه را می‌دهد', () => {
    expect(periodicSlotKey(D, 4 * 60 + 0, 0, 120)).toBe(`${D}T04:00`);
    expect(periodicSlotKey(D, 5 * 60 + 0, 60, 120)).toBe(`${D}T05:00`);
  });
});

describe('dueBundleSlotKey — سررسید و جبران', () => {
  const now = Date.parse('2026-11-12T07:37:00Z'); // ۱۰:۳۷ تهران (UTC+3:30)
  const parts = { dateKey: '2026-11-12', minutes: 10 * 60 + 37 };

  test('اسلات جاری بدون سابقه → سررسید (اجرای جبرانی)', () => {
    expect(dueBundleSlotKey(now, 0, 120, undefined, parts)).toBe('2026-11-12T10:00');
    expect(dueBundleSlotKey(now, 60, 120, undefined, parts)).toBe('2026-11-12T09:00');
  });

  test('همان اسلات قبلاً انجام شده → null (بدون ارسال دوباره)', () => {
    expect(dueBundleSlotKey(now, 0, 120, '2026-11-12T10:00', parts)).toBeNull();
    expect(dueBundleSlotKey(now, 60, 120, '2026-11-12T09:00', parts)).toBeNull();
  });

  test('اسلات قدیمی‌تر انجام شده → اسلات تازه سررسید است', () => {
    expect(dueBundleSlotKey(now, 0, 120, '2026-11-12T08:00', parts)).toBe('2026-11-12T10:00');
  });

  test('چرخهٔ بعدیِ همان اسلات دوباره سررسید می‌دهد (تلاش مجدد پس از شکست ارسال)', () => {
    const next = Date.parse('2026-11-12T08:07:00Z'); // ۱۱:۰۷ تهران — همان اسلات ۱۰
    const p2 = { dateKey: '2026-11-12', minutes: 11 * 60 + 7 };
    expect(dueBundleSlotKey(next, 0, 120, '2026-11-12T08:00', p2)).toBe('2026-11-12T10:00');
    expect(dueBundleSlotKey(next, 0, 120, '2026-11-12T10:00', p2)).toBeNull();
  });

  test('دورهٔ ۱ ساعته هم کار می‌کند (سازگاری پیکربندی)', () => {
    expect(periodicSlotKey('2026-11-12', 7 * 60 + 15, 0, 60)).toBe('2026-11-12T07:00');
  });
});

// ---------- ضدتکرار زمان جمع‌بندی ----------

describe('dropAlreadySent — خبر مضمون تکراری در زمان جمع‌بندی ارسال نمیشود', () => {
  const A = 'وزیر خارجه ایران امروز در نشست خبری از توافق تازه با همسایگان خبر داد و جزئیات آن را تشریح کرد';
  const A2 = 'در نشست خبری امروز وزیر خارجه ایران توافق تازه با همسایگان تشریح شد و جزئیات آن اعلام گردید';
  const B = 'شاخص بورس تهران امروز با رشد دو هزار واحدی بسته شد و ارزش معاملات سهام افزایش یافت';

  const it = (id: string, text: string): HourlyItem => ({ id, source: 'ایسنا', text, at: '2026-11-12T09:30:00Z' });

  test('رویداد هم‌مضمونِ ارسال‌شدهٔ قبل حذف می‌شود', () => {
    const sets = tokensLike(['وزیر خارجه ایران در نشست خبری امروز از توافق تازه با همسایگان خبر داد']);
    const res = dropAlreadySent([it('1', A), it('2', B)], sets);
    expect(res.dropped).toBe(1);
    expect(res.kept.map((x) => x.id)).toEqual(['2']);
  });

  test('بازنویسیِ متفاوتِ همان رویداد درون‌بازه هم یکی می‌شود (دومی حذف)', () => {
    const res = dropAlreadySent([it('1', A), it('2', A2), it('3', B)], []);
    expect(res.dropped).toBe(1);
    expect(res.kept.map((x) => x.id)).toEqual(['1', '3']);
  });

  test('تاریخچهٔ خالی → هیچ چیز حذف نمی‌شود', () => {
    const res = dropAlreadySent([it('1', A), it('2', B)], []);
    expect(res.dropped).toBe(0);
    expect(res.kept.length).toBe(2);
  });
});

function tokensLike(texts: string[]): Set<string>[] {
  // بازسازی سادهٔ توکن‌سازی فارسی (هم‌معنی tokensFa برای تست)
  return texts.map((t) =>
    new Set(
      t
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[ىي]/g, 'ی').replace(/ة/g, 'ه').replace(/[أإآ]/g, 'ا')
        .replace(/[^\u0600-\u06FF0-9a-zA-Z\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    )
  );
}

// ---------- بستهٔ جداگانهٔ توییت ----------

describe('buildTweetBundleChunks — دستهٔ جداگانهٔ توییت‌ها', () => {
  const tw = (id: string, source: string, text: string): HourlyItem => ({ id, source, text, at: '2026-11-12T09:00:00Z' });

  test('هر توییت «نام حساب: متن» با سربرگ خنثی — بدون برند', () => {
    const res = buildTweetBundleChunks([
      tw('1', 'Reuters', 'بازار نفت امروز نوسان داشت'),
      tw('2', 'BBC Breaking', 'نشست شورای امنیت آغاز شد'),
    ], { fromIso: '2026-11-12T07:00:00Z', toIso: '2026-11-12T09:00:00Z' });
    expect(res.chunks.length).toBe(1);
    expect(res.chunks[0]).toContain('🕒 آخرین توییت‌ها 10:30 تا 12:30');
    expect(res.chunks[0]).toContain('𝕏 Reuters: بازار نفت امروز نوسان داشت');
    expect(res.chunks[0]).toContain('𝕏 BBC Breaking: نشست شورای امنیت آغاز شد');
    expect(res.chunks[0]).not.toContain('رصدبان');
    expect(res.merged.length).toBe(2);
  });

  test('توییت‌های هم‌مضمون یکی می‌شوند و شمار مشابه‌ها می‌آید', () => {
    const res = buildTweetBundleChunks([
      tw('1', 'Reuters', 'وزیر خارجه آمریکا امروز تحریم‌های تازه‌ای علیه ایران اعلام کرد'),
      tw('2', 'AP', 'امروز وزیر خارجه آمریکا تحریم‌های تازه علیه ایران را اعلام کرد'),
    ]);
    expect(res.merged.length).toBe(1);
    expect(res.chunks[0]).toContain('(+۱ توییت مشابه)');
    expect(res.chunks[0]).toContain('𝕏 Reuters (+۱ توییت مشابه):');
  });

  test('متن بلندتر از سقف پیام → چند پیام با شمارهٔ بخش', () => {
    const long = 'متن توییت بسیار بلند. '.repeat(120);
    const res = buildTweetBundleChunks([tw('1', 'Reuters', long)], { maxLen: 1500 });
    expect(res.chunks.length).toBeGreaterThan(1);
    expect(res.chunks[0]).toContain('بخش ۱ از');
    expect(res.chunks[1]).toContain('ادامهٔ بخش');
  });

  test('صف خام BundleItem توییت → آیتم ساعتی با نام حساب درست (بدون پیشوند تکراری)', () => {
    // قرارداد صف: text = خودِ توییت ترجمه‌شده، source = نام حساب — بسته «𝕏 نام: متن» می‌سازد
    const q: BundleItem = {
      kind: 'tweet',
      text: 'بازار نفت امروز نوسان داشت',
      source: 'Reuters',
      ids: ['tw-reuters-123'],
      titleKeys: [],
      titleTexts: [],
      queuedAt: '2026-11-12T09:00:00Z',
    };
    const mapped = {
      id: q.ids?.[0] || '',
      source: (q.source || '').replace(/^𝕏\s*/, '').trim(),
      text: q.text.trim(),
      at: q.queuedAt,
    };
    const res = buildTweetBundleChunks([mapped]);
    expect(res.chunks[0]).toContain('𝕏 Reuters: بازار نفت امروز نوسان داشت');
    expect(res.chunks[0]).not.toContain('𝕏 𝕏');
    expect(res.chunks[0]).not.toContain('Reuters: Reuters');
  });
});

// ---------- سازگاری بستهٔ خام خبر ----------

describe('buildBundleChunks — مسیر پشتیبان خبر (سربرگ خنثی)', () => {
  test('چند خبر در قطعه‌های معتبر با شمارهٔ بخش', () => {
    const chunks = buildBundleChunks(['خبر اول نمونه برای تست', 'خبر دوم نمونه برای تست'], {
      fromIso: '2026-11-12T08:00:00Z',
      toIso: '2026-11-12T10:00:00Z',
      maxLen: 3300,
    });
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('🕒 اخبار');
    expect(chunks[0]).toContain('خبر اول');
  });
});
