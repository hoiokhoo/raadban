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
  const tw = (id: string, source: string, text: string, orig?: string, faName?: string): HourlyItem => ({ id, source, text, orig, faName, at: '2026-11-12T09:00:00Z' });

  test('هر توییت «نام حساب: متن» — بدون هیچ سربرگ زمانی (خواستهٔ ۱۳ نوامبر)', () => {
    const res = buildTweetBundleChunks([
      tw('1', '𝕏 Donald Trump', 'وزارت دفاع امروز جلسه اضطراری برگزار کرد'),
      tw('2', '𝕏 Elon Musk', 'نشست شورای امنیت آغاز شد'),
    ]);
    expect(res.chunks.length).toBe(1);
    // بدون سربرگ — پیام با خودِ توییت‌ها آغاز می‌شود
    expect(res.chunks[0]).not.toContain('🕒');
    expect(res.chunks[0]).not.toContain('تا ۱۲:۳۰');
    expect(res.chunks[0]).not.toContain('آخرین توییت');
    expect(res.chunks[0].startsWith('𝕏 Donald Trump:')).toBe(true);
    expect(res.chunks[0]).toContain('𝕏 Elon Musk: نشست شورای امنیت آغاز شد');
    expect(res.chunks[0]).not.toContain('رصدبان');
    expect(res.merged.length).toBe(2);
  });

  test('توییت انگلیسی — فقط نام فارسی توییت‌کننده: ترجمهٔ کامل (خواستهٔ ۱۹ نوامبر)', () => {
    const res = buildTweetBundleChunks([
      tw('1', '𝕏 Donald Trump', 'دولت آمریکا تازه مجوزهای جدید صادر کرد', 'We have just authorized the deployment', 'دونالد ترامپ (رئیس‌جمهور آمریکا)'),
    ]);
    expect(res.chunks[0]).toContain('دونالد ترامپ (رئیس‌جمهور آمریکا): دولت آمریکا تازه مجوزهای جدید صادر کرد');
    expect(res.chunks[0]).not.toContain('We have just authorized'); // متن اصلی حذف — خواستهٔ صریح کاربر
    expect(res.chunks[0]).not.toContain('ترجمه فارسی');
  });

  test('توییت انگلیسی بدون faName — فقط ترجمهٔ فارسی (بدون برچسب و بدون متن اصلی)', () => {
    const res = buildTweetBundleChunks([
      tw('1', '𝕏 Donald Trump', 'دولت آمریکا تازه مجوزهای جدید صادر کرد', 'We have just authorized the deployment'),
    ]);
    expect(res.chunks[0]).toContain('𝕏 Donald Trump: دولت آمریکا تازه مجوزهای جدید صادر کرد');
    expect(res.chunks[0]).not.toContain('We have just authorized');
    expect(res.chunks[0]).not.toContain('🗣 ترجمه فارسی');
  });

  test('توییت فارسی — فقط خود متن، بدون برچسب ترجمه', () => {
    const res = buildTweetBundleChunks([
      tw('1', '𝕏 Elon Musk', 'این تصمیم اشتباه است'),
    ]);
    expect(res.chunks[0]).toContain('𝕏 Elon Musk: این تصمیم اشتباه است');
    expect(res.chunks[0]).not.toContain('ترجمه');
  });

  test('توییت‌های هم‌مضمون یکی می‌شوند و شمار مشابه‌ها می‌آید', () => {
    const res = buildTweetBundleChunks([
      tw('1', '𝕏 Marco Rubio', 'وزیر خارجه آمریکا امروز تحریم‌های تازه‌ای علیه ایران اعلام کرد'),
      tw('2', '𝕏 Lindsey Graham', 'امروز وزیر خارجه آمریکا تحریم‌های تازه علیه ایران را اعلام کرد'),
    ]);
    expect(res.merged.length).toBe(1);
    expect(res.chunks[0]).toContain('(+۱ توییت مشابه)');
    expect(res.chunks[0]).toContain('𝕏 Marco Rubio (+۱ توییت مشابه):');
  });

  test('متن بلندتر از سقف پیام → چند پیام با نشانگر «— ادامه»', () => {
    const long = 'متن توییت بسیار بلند. '.repeat(120);
    const res = buildTweetBundleChunks([tw('1', 'Donald Trump', long)], { maxLen: 1500 });
    expect(res.chunks.length).toBeGreaterThan(1);
    expect(res.chunks[0]).toContain('— ادامه');
    expect(res.chunks[0]).not.toContain('بخش ۱ از');
    expect(res.chunks[1]).toContain('— ادامه');
  });

  test('صف خام BundleItem توییت → آیتم ساعتی با نشانگر پلتفرم و نام فارسی (قرارداد ۱۹ نوامبر)', () => {
    // قرارداد صف: text = ترجمهٔ فارسی کامل، orig = متن اصلی (فقط نگه‌داری — در نمایش حذف)،
    // faName = نام فارسی، source = برچسب کامل با نشانگر پلتفرم («𝕏 …» / «🅣 … (تروث‌سوشال)»)
    const q: BundleItem = {
      kind: 'tweet',
      text: 'بازار نفت امروز نوسان داشت',
      orig: 'Oil market fluctuated today',
      faName: 'دونالد ترامپ (رئیس‌جمهور آمریکا)',
      source: '𝕏 Donald Trump',
      ids: ['tw-trump-123'],
      titleKeys: [],
      titleTexts: [],
      queuedAt: '2026-11-12T09:00:00Z',
    };
    const mapped = {
      id: q.ids?.[0] || '',
      source: (q.source || '').trim(),
      text: q.text.trim(),
      orig: q.orig?.trim(),
      faName: q.faName?.trim(),
      at: q.queuedAt,
    };
    const res = buildTweetBundleChunks([mapped]);
    expect(res.chunks[0]).toContain('دونالد ترامپ (رئیس‌جمهور آمریکا): بازار نفت امروز نوسان داشت');
    expect(res.chunks[0]).toContain('𝕏 Donald Trump:');
    expect(res.chunks[0]).not.toContain('Oil market fluctuated today'); // متن اصلی حذف — خواستهٔ ۱۹ نوامبر
    expect(res.chunks[0]).not.toContain('🗣 ترجمه فارسی');
  });
});

// ---------- سازگاری بستهٔ خام خبر ----------

describe('buildBundleChunks — مسیر پشتیبان خبر (بدون سربرگ)', () => {
  test('چند خبر در قطعه‌های معتبر — پیام با خودِ خبرها آغاز می‌شود', () => {
    const chunks = buildBundleChunks(['خبر اول نمونه برای تست', 'خبر دوم نمونه برای تست'], {
      maxLen: 3300,
    });
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('خبر اول');
    expect(chunks[0]).not.toContain('🕒');
  });
});

// ---------- سقف حجم بسته‌ها (خواستهٔ ۲۵ نوامبر: «برای اینکه حجم اخبار زیادن پیشنهادی نداری؟!») ----------

import { budgetQueueForBundle } from '../bot/bundle';

describe('budgetQueueForBundle — سقف حجم بسته با اولویت جنگ/ایران', () => {
  const isPriority = (t: string) => /جنگ|ایران/.test(t);
  const q = (n: number, text?: string): BundleItem => ({
    kind: 'news',
    text: text || `خبر شمارهٔ ${n} از دنیای امروز`,
    ids: [`id-${n}`],
    titleKeys: [`tk-${n}`],
    titleTexts: [],
    queuedAt: new Date(Date.parse('2026-11-25T08:00:00Z') + n * 60_000).toISOString(),
  });

  test('زیر سقف → همه ارسال، هیچ به‌تعویق', () => {
    const items = [q(1), q(2), q(3)];
    const b = budgetQueueForBundle(items, { maxItems: 24, isPriority });
    expect(b.send).toHaveLength(3);
    expect(b.deferred).toHaveLength(0);
  });

  test('بیش از سقف → اولویت‌دار جلو می‌پرد + FIFO بقیه؛ مازاد به‌تعویق (هیچ حذف)', () => {
    const items = [q(1), q(2, 'اخبار جنگ امروز از جبهه‌ها'), q(3), q(4), q(5)];
    const b = budgetQueueForBundle(items, { maxItems: 3, isPriority });
    // جنگ اول؛ سپس قدیمی‌ترین‌ها؛ ۲ مورد آخر به تعویق
    expect(b.send.map((x) => x.ids[0])).toEqual(['id-2', 'id-1', 'id-3']);
    expect(b.deferred.map((x) => x.ids[0])).toEqual(['id-4', 'id-5']);
    // هیچی گم نمی‌شود
    expect(b.send.length + b.deferred.length).toBe(5);
  });

  test('اولویت‌دارها هرگز به تعویق نمی‌افتند حتی اگر از سقف بگذرند', () => {
    const items = [q(1, 'ایران و جنگ'), q(2, 'جنگ در خاورمیانه'), q(3, 'ایران بازار'), q(4), q(5)];
    const b = budgetQueueForBundle(items, { maxItems: 2, isPriority });
    expect(b.send.map((x) => x.ids[0])).toEqual(['id-1', 'id-2', 'id-3']); // هر ۳ اولویت
    expect(b.deferred.map((x) => x.ids[0])).toEqual(['id-4', 'id-5']);
  });

  test('سپر انباشت: صف ≥ backlogFlush → سقف خاموش، تخلیهٔ کامل', () => {
    const items = Array.from({ length: 20 }, (_, i) => q(i + 1));
    const b = budgetQueueForBundle(items, { maxItems: 5, isPriority, backlogFlush: 20 });
    expect(b.send).toHaveLength(20);
    expect(b.deferred).toHaveLength(0);
  });

  test('ورودی خراب env (صفر/منفی) → حداقل ۱؛ بیش از ۸۸ قفل می‌شود', () => {
    const items = [q(1), q(2)];
    // max=0 → قفل به ۱ → یک مورد ارسال، یکی به تعویق (نه لال‌شدن ربات)
    const b0 = budgetQueueForBundle(items, { maxItems: 0, isPriority });
    expect(b0.send).toHaveLength(1);
    expect(b0.deferred).toHaveLength(1);
    const many = Array.from({ length: 100 }, (_, i) => q(i + 1));
    const b = budgetQueueForBundle(many, { maxItems: 500, isPriority });
    expect(b.send.length).toBeLessThanOrEqual(88);
  });

  test('ترتیب پایدار درون هر گروه (اولویت به ترتیب صف، نه به‌هم‌ریخته)', () => {
    const items = [q(1), q(2, 'ایران ۱'), q(3, 'ایران ۲'), q(4)];
    const b = budgetQueueForBundle(items, { maxItems: 2, isPriority });
    expect(b.send.map((x) => x.ids[0])).toEqual(['id-2', 'id-3']);
    expect(b.deferred.map((x) => x.ids[0])).toEqual(['id-1', 'id-4']);
  });
});
