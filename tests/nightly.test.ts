/**
 * تست‌های واحد تحلیل جامع شبانهٔ ۲۲:۳۰ (bot/nightly.ts) — خواستهٔ کاربر (۱۳ نوامبر ۲۰۲۶):
 * «هر شب ساعت ۲۲:۳۰ کلِ روز تحلیل جامع و نتیجه‌گیری بشه؛ تحلیل‌ها ذخیره بشن و روزهای آتی
 *  خلاصهٔ روزهای قبل با تاریخشون خونده بشه تا حافظه ریست نشه»
 * پوشش: سوپرپرامپت، پانوشت حافظهٔ 🧷، دفتر تحلیل‌ها (ضدتکرار روز + سقف ۶۰)،
 * بلوک حافظهٔ تاریخ‌دار، برش آرشیو امروز، اعتبارسنجی متن و بازنویسی پرامپت «nightly».
 * اجرا: bun test tests/nightly.test.ts
 */
import { describe, test, expect, afterAll } from 'bun:test';
import {
  DEFAULT_SYSTEM_NIGHTLY,
  appendNightlyAnalysis,
  buildNightlyMemoryBlock,
  splitMemoryFooter,
  memorySummaryOf,
  todayPoolSlice,
  validateNightlyText,
  faDateOfKey,
  MEMORY_FOOTER_TAG,
  NIGHTLY_HISTORY_CAP,
  NIGHTLY_MEMORY_DAYS,
  type NightlyAnalysis,
} from '../bot/nightly';
import { applyPromptOverrides, parsePromptFile, getNightlyPrompt } from '../bot/bot';
import type { PoolItem } from '../bot/digest';

// ---------- کمکی ----------

function poolItem(id: string, text: string, at: string, source = 'ایسنا'): PoolItem {
  return { id, titleKey: `tk-${id}`, source, lang: 'fa', text, at };
}

function analysis(dateKey: string, text: string, summary?: string): NightlyAnalysis {
  return { dateKey, at: `${dateKey}T19:00:00.000Z`, text, summary, items: 5 };
}

const FA_DAY = 'امروز بازار بورس تهران با رشد شاخص بسته شد و دلار و طلا تغییر چندانی نداشتند؛ مذاکرات منطقه‌ای هم ادامه یافت.';

// ---------- سوپرپرامپت ----------

describe('DEFAULT_SYSTEM_NIGHTLY — سوپرپرامپت تحلیل شبانه (خواستهٔ کاربر)', () => {
  test('ساختار الزامی کامل — همهٔ بخش‌ها و ایموجی‌ها', () => {
    expect(DEFAULT_SYSTEM_NIGHTLY.length).toBeGreaterThan(1500);
    for (const marker of ['🧭', '📊 پانورامای امروز', '🗂 رویدادهای امروز', '🔗 پیوند رویدادهای امروز', '🧠 تحلیل عمیق', '📈 روندها و ادامهٔ ماجراها', '🔮 نتیجه‌گیری', '🗞 منابع', MEMORY_FOOTER_TAG]) {
      expect(DEFAULT_SYSTEM_NIGHTLY).toContain(marker);
    }
  });

  test('حافظهٔ پایدار و تیک اعتبارسنجی در پرامپت صریح است', () => {
    expect(DEFAULT_SYSTEM_NIGHTLY).toContain('حافظهٔ پایدار');
    expect(DEFAULT_SYSTEM_NIGHTLY).toContain('۲ منبع مستقل');
    expect(DEFAULT_SYSTEM_NIGHTLY).toContain('تاریخ');
    expect(DEFAULT_SYSTEM_NIGHTLY).toContain('هیچ خبر، عدد، نام، نقل‌قول یا تاریخ از حافظهٔ خودتان اضافه نکنید');
  });
});

// ---------- پانوشت حافظه ----------

describe('splitMemoryFooter — جداکردن خلاصهٔ حافظهٔ 🧷', () => {
  test('بدنه و خلاصه درست جدا می‌شوند و برچسب حذف می‌شود', () => {
    const text = `🧭 عنوان\n\n${FA_DAY}\n\n${MEMORY_FOOTER_TAG} خلاصهٔ حافظه: روند صعودی بورس؛ مذاکرات فردا ادامه دارد.`;
    const r = splitMemoryFooter(text);
    expect(r.body).toContain('عنوان');
    expect(r.body).toContain('بورس');
    expect(r.body).not.toContain(MEMORY_FOOTER_TAG);
    expect(r.summary).toBe('روند صعودی بورس؛ مذاکرات فردا ادامه دارد.');
  });

  test('بدون پانوشت — کل متن بدنه است و خلاصه خالی', () => {
    const r = splitMemoryFooter(`🧭 عنوان\n\n${FA_DAY}`);
    expect(r.body).toContain('بورس');
    expect(r.summary).toBe('');
  });

  test('متن فقط-پانوشت — قابل اعتماد نیست؛ کل متن بدنه می‌شود', () => {
    const r = splitMemoryFooter(`${MEMORY_FOOTER_TAG} فقط خلاصه`);
    expect(r.body).toContain('فقط خلاصه');
    expect(r.summary).toBe('');
  });

  test('متن خالی — خروجی خالی', () => {
    expect(splitMemoryFooter('')).toEqual({ body: '', summary: '' });
  });
});

// ---------- خلاصهٔ حافظهٔ قطعی (پشتیبان نبودِ پانوشت) ----------

describe('memorySummaryOf — استخراج قطعی خلاصه از بخش‌های تحلیل', () => {
  const body = [
    '🧭 بحران انرژی در مرکز توجه',
    '',
    '📊 پانورامای امروز',
    'روز با هشدار قطعی گاز و رشد دلار گذشت؛ چند رویداد چندمنبعی بود.',
    '',
    '🗂 رویدادهای امروز',
    '۱. خبر نخست درباره گاز و شبکه انتقال.',
    '',
    '🔮 نتیجه‌گیری',
    'پیام اصلی امروز فشار انرژی است؛ فردا بازار سوخت را رصد کنید.',
    '',
    '🗞 منابع: ایسنا، ایرنا',
  ].join('\n');

  test('عنوان + پانوراما + نتیجه‌گیری استخراج می‌شود — بدون بخش رویدادها', () => {
    const s = memorySummaryOf(body);
    expect(s).toContain('عنوان: بحران انرژی در مرکز توجه');
    expect(s).toContain('پانوراما:');
    expect(s).toContain('نتیجه‌گیری:');
    expect(s).toContain('فردا بازار سوخت را رصد کنید');
    expect(s).not.toContain('خبر نخست'); // فهرست رویدادها در حافظه نمی‌آید
  });

  test('سقف طول و متن خالی', () => {
    expect(memorySummaryOf(body, 80).length).toBeLessThanOrEqual(80);
    expect(memorySummaryOf('')).toBe('');
  });
});

// ---------- دفتر حافظهٔ شبانه ----------

describe('appendNightlyAnalysis — دفتر تحلیل‌های شبانه', () => {
  test('تحلیل دوبارهٔ همان روز جایگزین قبلی می‌شود (ضدتکرار dateKey)', () => {
    let list: NightlyAnalysis[] = [analysis('2026-11-11', 'تحلیل دیروز')];
    list = appendNightlyAnalysis(list, analysis('2026-11-12', 'نسخهٔ اول امروز'));
    expect(list.length).toBe(2);
    list = appendNightlyAnalysis(list, analysis('2026-11-12', 'نسخهٔ کامل‌تر امروز'));
    expect(list.length).toBe(2);
    expect(list.filter((a) => a.dateKey === '2026-11-12')[0].text).toBe('نسخهٔ کامل‌تر امروز');
  });

  test('مرتب بر تاریخ — کهن‌ترین اول', () => {
    const list = appendNightlyAnalysis(
      [analysis('2026-11-13', 'جدید'), analysis('2026-11-11', 'قدیم')],
      analysis('2026-11-12', 'وسط')
    );
    expect(list.map((a) => a.dateKey)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
  });

  test('سقف ۶۰ روز — کهن‌ترین‌ها هرس می‌شوند', () => {
    let list: NightlyAnalysis[] = [];
    for (let i = 0; i < NIGHTLY_HISTORY_CAP + 5; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      const key = d.toISOString().slice(0, 10);
      list = appendNightlyAnalysis(list, analysis(key, `تحلیل روز ${i}`));
    }
    expect(list.length).toBe(NIGHTLY_HISTORY_CAP);
    expect(list[0].text).toBe('تحلیل روز 5');
    expect(list[list.length - 1].text).toBe(`تحلیل روز ${NIGHTLY_HISTORY_CAP + 4}`);
  });

  test('مدخل نامعتبر حذف می‌شود', () => {
    const bad = { dateKey: '', at: 'x', text: 'y', items: 0 } as unknown as NightlyAnalysis;
    expect(appendNightlyAnalysis([bad], analysis('2026-11-12', 'امروز')).length).toBe(1);
  });
});

// ---------- بلوک حافظهٔ تاریخ‌دار ----------

describe('buildNightlyMemoryBlock — حافظهٔ تاریخ‌دار روزهای قبل (خواستهٔ کاربر)', () => {
  test('خالی → صادقانه «اولین شب»', () => {
    expect(buildNightlyMemoryBlock([])).toContain('اولین شب');
  });

  test('هر روز با تاریخ شمسی و میلادی — خلاصهٔ 🧷 مقدم بر متن کامل', () => {
    const list = [
      analysis('2026-11-10', 'متن کامل دیروزپریروز که خیلی بلند است', 'خلاصهٔ روز ۱۰ نوامبر: رشد بورس'),
      analysis('2026-11-11', 'متن کامل دیروز'),
    ];
    const block = buildNightlyMemoryBlock(list);
    expect(block).toContain('2026-11-10');
    expect(block).toContain('خلاصهٔ روز ۱۰ نوامبر');
    expect(block).not.toContain('خیلی بلند'); // خلاصه بود → متن کامل نخوانده می‌شود
    expect(block).toContain('متن کامل دیروز'); // بی‌خلاصه → آغاز متن کامل
    expect(block.indexOf('2026-11-10')).toBeLessThan(block.indexOf('2026-11-11')); // کهن‌ترین اول
    expect(block).toContain('آبان'); // تاریخ شمسی در بلوک هست
  });

  test('پنجرهٔ ۱۴ روز و برش طول هر مدخل', () => {
    const list: NightlyAnalysis[] = [];
    for (let i = 0; i < NIGHTLY_MEMORY_DAYS + 4; i++) {
      const key = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
      list.push(analysis(key, 'x'.repeat(3000)));
    }
    const block = buildNightlyMemoryBlock(list, NIGHTLY_MEMORY_DAYS, 120);
    const lines = block.split('\n');
    expect(lines.length).toBe(NIGHTLY_MEMORY_DAYS);
    for (const l of lines) expect(l.length).toBeLessThan(300);
  });
});

// ---------- برش آرشیو امروز ----------

describe('todayPoolSlice — برش رویدادهای امروز تهران از آرشیو', () => {
  test('فقط رویدادهای همان روز تهران — مرز نیمه‌شب تهران رعایت شود', () => {
    const items = [
      poolItem('1', 'خبر صبح امروز', '2026-11-12T06:00:00.000Z'), // ۰۹:۳۰ تهران ۱۲ نوامبر
      poolItem('2', 'خبر دیشب', '2026-11-11T20:00:00.000Z'), // ۲۳:۳۰ تهران ۱۱ نوامبر — دیروز
      poolItem('3', 'خبر بعد از نیمه‌شب تهران', '2026-11-11T21:00:00.000Z'), // ۰۰:۳۰ تهران ۱۲ نوامبر — امروز
      poolItem('4', 'خبر فردا', '2026-11-12T23:00:00.000Z'), // ۰۲:۳۰ تهران ۱۳ نوامبر
      poolItem('5', 'بدون زمان معتبر', 'نه-تاریخ'),
    ];
    const today = todayPoolSlice(items, '2026-11-12');
    expect(today.map((p) => p.id)).toEqual(['1', '3']); // تازه‌ترین اول
  });

  test('آرشیو خالی/نامعتبر → خالی', () => {
    expect(todayPoolSlice([], '2026-11-12')).toEqual([]);
    expect(todayPoolSlice([poolItem('1', 'متن', '')], '2026-11-12')).toEqual([]);
  });
});

// ---------- اعتبارسنجی متن ----------

describe('validateNightlyText — اعتبارسنجی متن شبانه', () => {
  test('متن معتبر فارسی پاس می‌شود', () => {
    const t = validateNightlyText(`🧭 عنوان روز\n\n${FA_DAY.repeat(6)}`);
    expect(t).not.toBeNull();
    expect(t).toContain('بورس');
  });

  test('کوتاه‌تر از کف ۴۰۰ نویسه → null', () => {
    expect(validateNightlyText('🧭 عنوان\n\nمتن کوتاه')).toBeNull();
  });

  test('متن انگلیسی مطلقاً رد می‌شود', () => {
    expect(validateNightlyText('Today the market closed higher and talks continued. '.repeat(12))).toBeNull();
  });

  test('مارک‌داون و لینک پاک می‌شود؛ سقف ۶۰۰۰ رعایت می‌شود', () => {
    const raw = `# تیتر\n\n${FA_DAY.repeat(4)}\n\nمنبع: https://example.com/x\n\n${'**مهم**\n\n'.repeat(200)}${FA_DAY.repeat(40)}`;
    const t = validateNightlyText(raw)!;
    expect(t).not.toBeNull();
    expect(t).not.toContain('https://');
    expect(t).not.toContain('**');
    expect(t.length).toBeLessThanOrEqual(6100);
  });
});

// ---------- تاریخ شمسی ----------

describe('faDateOfKey — تاریخ شمسی کلید روز', () => {
  test('۱۲ نوامبر ۲۰۲۶ = ۲۱ آبان ۱۴۰۵', () => {
    const fa = faDateOfKey('2026-11-12');
    expect(fa).toContain('آبان');
    expect(fa).toContain('۲۱');
    expect(fa).toContain('۱۴۰۵');
  });

  test('کلید نامعتبر → رشتهٔ خالی', () => {
    expect(faDateOfKey('bad')).toBe('');
  });
});

// ---------- بازنویسی پرامپت از bot/prompts.json ----------

describe('پرامپت nightly — بازنویسی از اپلیکیشن', () => {
  const LONG = 'پرامپت شبانهٔ ویرایش‌شدهٔ کاربر. '.repeat(30).trim(); // ربات متن را trim می‌کند

  test('parsePromptFile کلید nightly را می‌خواند', () => {
    const pf = parsePromptFile(JSON.stringify({ nightly: LONG, updatedAt: '2026-11-13T00:00:00Z' }));
    expect(pf.nightly).toBe(LONG);
  });

  test('اعمال فقط با متن بلند (≥۴۰۰ نویسه) و بازیابی پیش‌فرض پس از آزمون', () => {
    const def = getNightlyPrompt();
    const short = applyPromptOverrides({ nightly: 'کوتاه' });
    expect(short.nightly).toBe(false);
    expect(getNightlyPrompt()).toBe(def);
    const ok = applyPromptOverrides({ nightly: LONG });
    expect(ok.nightly).toBe(true);
    expect(getNightlyPrompt()).toBe(LONG);
    applyPromptOverrides({ nightly: def }); // بازیابی — اثر آزمون روی سایر تست‌ها نماند
  });

  afterAll(() => {
    applyPromptOverrides({ nightly: DEFAULT_SYSTEM_NIGHTLY });
  });
});
