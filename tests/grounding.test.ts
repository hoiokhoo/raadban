/**
 * تست‌های قفل تیک اعتبارسنجی به جمله‌های منبع — رفع ریشه‌ای هالوسینیشن (⑨).
 * خواستهٔ کاربر (۱۵ نوامبر ۲۰۲۶): «رفع ریشه‌ای هالوسینیشن — قفل‌کردن تیک اعتبارسنجی به
 * جمله‌های منبع و مقایسهٔ اجباری خروجی/منبع».
 *
 * سناریوی واقعی ۱۴ نوامبر (مورد ۱۰ بسته): مدل رویدادِ «مراسم عزاداری با حضور رهبر انقلاب
 * در زینبیه» را از خود ساخت و ✅ هم گذاشت — این تست تضمین می‌کند چنین موردی حذف و تیکِ
 * بی‌پشتوانه هرگز زنده نمی‌ماند.
 */
import { describe, expect, test } from 'bun:test';
import {
  groundAiBundle,
  parseItemBlocks,
  stripModelTicks,
  foreignNumbers,
  numbersOfText,
  numberVariants,
  GROUND_SIM_KEEP,
  type GroundOptions,
} from '../bot/grounding';
import { mergeSimilarItems, type HourlyItem, type MergedItem } from '../bot/hourly';

// ---------- فیکسچر خوشه‌های منبع ----------

function cluster(text: string, sources: string[], id = Math.random().toString(36).slice(2)): MergedItem {
  return {
    id,
    source: sources[0] || '',
    text,
    at: '2026-11-15T10:00:00.000Z',
    ids: [id],
    sources,
    verified: sources.length >= 2,
  };
}

const CEASEFIRE_FA = 'توافق آتش‌بس میان دو طرف در جلسهٔ امشب با وساطت قطر امضا شد و از ساعت فردا اجرایی می‌شود';
const MARKET_FA = 'شاخص بورس تهران امروز ۹۲۰ واحد رشد کرد و به سطح تازه‌ای از ماه گذشته رسید';

const MERGED: MergedItem[] = [
  cluster(CEASEFIRE_FA, ['ایسنا', 'مهر'], 'c1'), // دومانبعی → verified
  cluster(MARKET_FA, ['بورس‌نیوز'], 'c2'), // تک‌منبعی
];

// ---------- ابزارهای عدد ----------

describe('تطبیق اجباری اعداد خروجی/منبع', () => {
  test('چهره‌های هم‌ارز عدد — هزارگان و اعشار فارسی/لاتین', () => {
    expect(numberVariants('۲٬۵۰۰')).toContain('2500');
    expect(numberVariants('2,500')).toContain('2500');
    expect(numberVariants('۳٫۵')).toContain('3.5');
    expect(numberVariants('۲۵۰۰')).toContain('2500');
  });

  test('استخراج اعداد متن — ارقام فارسی و لاتین', () => {
    expect(numbersOfText('۲۲ آبان و ۱۵ هزار نفر').has('22')).toBe(true);
    expect(numbersOfText('۲۲ آبان و ۱۵ هزار نفر').has('15')).toBe(true);
    expect(numbersOfText('price rose 3.5 percent').has('3.5')).toBe(true);
  });

  test('اعداد بیگانه تشخیص داده می‌شوند — «هیچ عدد ساختگی»', () => {
    expect(foreignNumbers('۱۰ هزار نفر کشته شدند', ['۵ زخمی گزارش شده'])).toContain('10');
    expect(foreignNumbers('۲۵۰۰ دلار', ['قیمت ۲٬۵۰۰ دلار اعلام شد'])).toEqual([]);
    expect(foreignNumbers('۵ زخمی', ['۵ زخمی'])).toEqual([]);
  });
});

// ---------- پارس موارد ----------

describe('parseItemBlocks — موارد شماره‌دار و سطرهای پیوست', () => {
  test('سطر اعشاری («۱.۵ میلیون») مورد نیست', () => {
    const { blocks } = parseItemBlocks('۱.۵ میلیون دلار بودجه اعلام شد');
    expect(blocks.length).toBe(0);
  });

  test('شماره‌گذاری فارسی و لاتین + تیک مدل حذف + سطر پیوست ادغام', () => {
    const raw = '۱. ✅ خبر اول دربارهٔ توافق\nادامهٔ همان خبر در سطر دوم\n2) خبر دوم';
    const { blocks, isItemLine } = parseItemBlocks(raw);
    expect(blocks.length).toBe(2);
    expect(blocks[0]!.no).toBe('۱');
    expect(blocks[0]!.text).not.toContain('✅');
    expect(blocks[0]!.text).toContain('ادامهٔ همان خبر');
    expect(blocks[1]!.no).toBe('2');
    expect(isItemLine[1]).toBe(true); // سطر پیوست بخشی از بلوک است
  });

  test('stripModelTicks — تیک و هشدار مدل پاک می‌شود', () => {
    expect(stripModelTicks('✅ متن')).toBe('متن');
    expect(stripModelTicks('⚠️ متن')).toBe('متن');
  });
});

// ---------- قلب رفع ریشه‌ای ⑨ ----------

describe('groundAiBundle — قفل تیک و حذف هالوسینیشن', () => {
  test('سناریوی واقعی ۱۴ نوامبر: مورد ساختگی «زینبیه/رهبر» حذف می‌شود و هرگز به پیام نمی‌رسد', () => {
    const raw = [
      '۱. ✅ دو طرف با وساطت قطر توافق آتش‌بس امضا کردند.',
      '۲. مراسم عزاداری شب شهادت حضرت فاطمه زهرا با حضور رهبر معظم انقلاب در زینبیه برگزار شد.',
      '۳. شاخص بورس تهران امروز رشد کرد.',
      '',
      '🔍 تحلیل',
      '• پیوند این دو رویداد در روند مذاکرات دیده می‌شود.',
    ].join('\n');
    const g = groundAiBundle(raw, MERGED);
    expect(g.total).toBe(3);
    expect(g.dropped).toBe(1);
    expect(g.kept).toBe(2);
    expect(g.text).not.toContain('زینبیه');
    expect(g.text).not.toContain('عزاداری');
    expect(g.droppedSamples[0]).toContain('زینبیه');
  });

  test('تیک فقط از دادهٔ خوشه می‌آید — مورد دومانبعی ✅، تک‌منبعی بدون تیک، تیک مدل حذف', () => {
    const raw = [
      '۱. ✅ دو طرف با وساطت قطر توافق آتش‌بس امضا کردند.', // مدل تیک زده؛ خوشه دومانبعی → تیک می‌ماند (از سامانه)
      '۲. ✅ شاخص بورس تهران امروز رشد کرد.', // مدل تیک زده؛ خوشه تک‌منبعی → تیک باید حذف شود
    ].join('\n');
    const g = groundAiBundle(raw, MERGED);
    expect(g.kept).toBe(2);
    expect(g.ticked).toBe(1);
    const lines = (g.text || '').split('\n');
    expect(lines[0]).toMatch(/^۱\. ✅ /);
    expect(lines[1]!).toMatch(/^۲\. [^✅]/); // تک‌منبعی — تیک مدل حذف شد
    expect(g.items[0]!.tick).toBe(true);
    expect(g.items[0]!.source).toBe('ایسنا');
    expect(g.items[1]!.tick).toBe(false);
  });

  test('مورد خاستگاه‌دار با عدد بیگانه حذف می‌شود — «هیچ عدد ساختگی»', () => {
    const raw = '۱. دو طرف با وساطت قطر توافق آتش‌بس امضا کردند و ۱۰ هزار نفر حاضر بودند.';
    const g = groundAiBundle(raw, MERGED);
    expect(g.dropped).toBe(1);
    expect(g.text).toBeNull();
  });

  test('عدد هم‌ارز (۲۵۰۰ ↔ ۲٬۵۰۰) ردِّ نادرست نمی‌شود', () => {
    const merged2 = [cluster('قیمت سکه امروز به ۲٬۵۰۰ دلار رسید', ['طلا'])];
    const raw = '۱. قیمت سکه امروز به 2500 دلار رسید.';
    const g = groundAiBundle(raw, merged2);
    expect(g.dropped).toBe(0);
    expect(g.kept).toBe(1);
  });

  test('شماره‌گذاری پس از حذف، پیاپی و فارسی است', () => {
    const raw = [
      '۱. مراسم ساختگی بی‌هیچ خاستگاهی در زینبیه برگزار شد.',
      '۲. دو طرف با وساطت قطر توافق آتش‌بس امضا کردند.',
      '۳. شاخص بورس تهران امروز رشد کرد.',
    ].join('\n');
    const g = groundAiBundle(raw, MERGED);
    expect(g.kept).toBe(2);
    const lines = (g.text || '').split('\n');
    expect(lines[0]).toMatch(/^۱\./);
    expect(lines[1]).toMatch(/^۲\./);
  });

  test('همهٔ موارد حذف شوند → text=null (هیچ متن نیمه‌ساختی)', () => {
    const raw = '۱. رویداد کاملاً بی‌خاستگاه با جزئیات ساختگی.\n۲. رویداد دیگر بی‌هیچ ارتباط با منابع ورودی.';
    const g = groundAiBundle(raw, MERGED);
    expect(g.text).toBeNull();
    expect(g.items.length).toBe(0);
  });

  test('بدون هیچ مورد شماره‌دار (تحلیل خالص) — متن می‌ماند، تیک مدل حذف می‌شود', () => {
    const raw = 'تحلیل این بازه بدون فهرست شماره‌دار است و ✅ تیکِ بی‌پشتوانهٔ مدل در آن حذف می‌شود.';
    const g = groundAiBundle(raw, MERGED);
    expect(g.total).toBe(0);
    expect(g.text).not.toBeNull();
    expect(g.text).not.toContain('✅');
    expect(g.text).toContain('تحلیل این بازه');
  });

  test('ساختار بخش‌ها (سبک ژئو) دست‌نخورده می‌ماند — سربرگ‌ها و بولت‌ها', () => {
    const raw = [
      '🧭 بازهٔ مذاکرات و بازار',
      '',
      '🗂 رویدادهای کلیدی بازه',
      '۱. دو طرف با وساطت قطر توافق آتش‌بس امضا کردند.',
      '',
      '⚖️ اعتبارسنجی',
      '• توافق آتش‌بس با پوشش دو کانال تأیید شد.',
      '',
      '🧷 خلاصهٔ حافظه برای بازهٔ بعد.',
    ].join('\n');
    const g = groundAiBundle(raw, MERGED);
    expect(g.kept).toBe(1);
    expect(g.text).toContain('🧭 بازهٔ مذاکرات و بازار');
    expect(g.text).toContain('🗂 رویدادهای کلیدی بازه');
    expect(g.text).toContain('⚖️ اعتبارسنجی');
    expect(g.text).toContain('🧷 خلاصهٔ حافظه');
  });

  test('آستانه‌ها قابل تزریق‌اند (تست پایدار در برابر تغییر پیش‌فرض)', () => {
    const opts: GroundOptions = { simKeep: GROUND_SIM_KEEP, simDrop: 0.09 };
    const raw = '۱. دو طرف با وساطت قطر توافق آتش‌بس امضا کردند.';
    const g = groundAiBundle(raw, MERGED, opts);
    expect(g.kept).toBe(1);
  });
});

// ---------- سازگاری با تجمیع واقعی (mergeSimilarItems) ----------

describe('groundAiBundle × mergeSimilarItems — زنجیرهٔ واقعی', () => {
  test('خوشهٔ دومانبعی واقعی، تیک قطعی می‌گیرد', () => {
    const items: HourlyItem[] = [
      { id: 'a', source: 'ایسنا', text: 'زمین‌لرزهٔ ۵٫۱ ریشتری امروز استان کرمان را لرزاند', at: '2026-11-15T09:00:00.000Z' },
      { id: 'b', source: 'مهر', text: 'زمین‌لرزهٔ ۵٫۱ ریشتری استان کرمان را لرزاند؛ خسارتی گزارش نشد', at: '2026-11-15T09:05:00.000Z' },
    ];
    const merged = mergeSimilarItems(items);
    expect(merged.length).toBe(1);
    expect(merged[0]!.verified).toBe(true);
    const raw = '۱. ✅ زمین‌لرزهٔ ۵٫۱ ریشتری امروز استان کرمان را لرزاند.';
    const g = groundAiBundle(raw, merged);
    expect(g.kept).toBe(1);
    expect(g.ticked).toBe(1);
    expect(g.items[0]!.source).toBe('ایسنا');
  });
});
