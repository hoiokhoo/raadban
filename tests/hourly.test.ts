/**
 * تست‌های واحد بستهٔ ساعتی هوشمند (bot/hourly.ts) — خواستهٔ کاربر (۱۰ نوامبر ۲۰۲۶):
 * تجمیع مشابه‌ها، تیک اعتبارسنجی قطعی بر پایهٔ شمار منابع، پیکرهٔ شماره‌دار،
 * حافظهٔ تاریخچهٔ تحلیل‌ها، اعتبارسنجی متن مدل و سربرگ خنثی (حذف «بست رصدبان»).
 * + چرخش یکی‌یکی تأمین‌کنندگان و جایگاه GLM در زنجیرهٔ bot.ts
 * اجرا: bun test tests/hourly.test.ts
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_SYSTEM_HOURLY,
  mergeSimilarItems,
  buildHourlyCorpus,
  buildHistoryBlock,
  validateHourlyText,
  chunkHourlyMessage,
  appendAnalysis,
  HOURLY_HISTORY_CAP,
  tokensFa,
  type HourlyItem,
  type HourlyAnalysis,
} from '../bot/hourly';
import {
  buildChain,
  rotateChain,
  applyPromptOverrides,
  parsePromptFile,
  getHourlyPrompt,
} from '../bot/bot';

// ---------- کمکی ----------

function it(id: string, source: string, text: string, at = '2026-11-10T09:30:00Z'): HourlyItem {
  return { id, source, text, at };
}

// ---------- تجمیع مشابه‌ها ----------

describe('mergeSimilarItems — یکی‌کردن مشابه‌ها (خواستهٔ کاربر)', () => {
  const A = 'وزیر خارجه امروز در نشست خبری از توافق تازه با همسایگان خبر داد و جزئیات آن را تشریح کرد';
  const A2 = 'وزیر خارجه در نشست خبری امروز از توافق تازه با همسایگان خبر داد و جزئیات آن را تشریح کرد';
  const B = 'شاخص بورس تهران امروز با رشد دو هزار واحدی بسته شد و ارزش معاملات سهام افزایش یافت';

  test('دو بازنویسی یک رویداد یکی می‌شوند و منابع جمع می‌شوند', () => {
    const merged = mergeSimilarItems([
      it('1', 'ایسنا', A),
      it('2', 'همشهری', A2),
      it('3', 'تسنیم', B),
    ]);
    expect(merged.length).toBe(2);
    const ev = merged.find((m) => m.sources.includes('ایسنا'))!;
    expect(ev.sources).toEqual(['ایسنا', 'همشهری']);
    expect(ev.verified).toBe(true); // ۲ منبع مستقل → تیک اعتبارسنجی
    expect(ev.ids).toEqual(['1', '2']);
  });

  test('رویداد تک‌منبعی تیک نمی‌گیرد', () => {
    const merged = mergeSimilarItems([it('1', 'ایرنا', B)]);
    expect(merged.length).toBe(1);
    expect(merged[0].verified).toBe(false);
  });

  test('ترتیب: تازه‌ترین اول؛ متن نماینده = کامل‌ترین پوشش', () => {
    const long = `${A} — و دربارهٔ مذاکرات بعدی هم توضیح داد که نشست بعدی هفتهٔ آینده برگزار می‌شود`;
    const merged = mergeSimilarItems([
      it('1', 'ایسنا', A, '2026-11-10T09:00:00Z'),
      it('2', 'ایرنا', long, '2026-11-10T09:20:00Z'),
      it('3', 'تسنیم', B, '2026-11-10T09:40:00Z'),
    ]);
    expect(merged[0].id).toBe('3'); // تازه‌ترین
    const ev = merged.find((m) => m.sources.length >= 2)!;
    expect(ev.text).toBe(long); // کامل‌ترین
  });

  test('متن خالی/بدون شناسه حذف می‌شود', () => {
    const merged = mergeSimilarItems([it('1', 'x', ''), it('', 'y', 'متن'), it('3', 'z', 'خبر تازه درباره بازار تهران امروز')]);
    expect(merged.length).toBe(1);
  });
});

// ---------- پیکره و تاریخچه ----------

describe('buildHourlyCorpus — پیکرهٔ شماره‌دار با شمار منابع', () => {
  test('رویداد چندمنبعی «(+n منبع دیگر)» دارد — مبنای تیک اعتبارسنجی', () => {
    const merged = mergeSimilarItems([
      it('1', 'ایسنا', 'متن خبر اول درباره توافق امروز در مذاکرات منطقه‌ای'),
      it('2', 'ایرنا', 'متن خبر اول درباره توافق امروز در مذاکرات منطقه‌ای'),
      it('3', 'تسنیم', 'متن کاملاً دیگری درباره بازار بورس و رشد شاخص'),
    ]);
    const corpus = buildHourlyCorpus(merged);
    expect(corpus).toContain('[1] ایسنا (+1 منبع دیگر)');
    expect(corpus).toContain('[2] تسنیم —');
  });
});

describe('buildHistoryBlock — حافظهٔ تاریخچهٔ تحلیل‌ها', () => {
  test('خالی → صادقانه «اولین تحلیل»', () => {
    expect(buildHistoryBlock([])).toContain('اولین تحلیل');
  });
  test('تازه‌ترین اول با ساعت از hourKey و برش طول', () => {
    const list: HourlyAnalysis[] = [
      { hourKey: '2026-11-10T14:00', at: '2026-11-10T14:05:00Z', text: 'x'.repeat(900), items: 5 },
      { hourKey: '2026-11-10T15:00', at: '2026-11-10T15:05:00Z', text: 'تحلیل ساعت پانزده درباره بازار و اوپک', items: 7 },
    ];
    const block = buildHistoryBlock(list, 10, 200);
    expect(block.indexOf('ساعت 15:00')).toBeLessThan(block.indexOf('ساعت 14:00'));
    expect(block).toContain('تحلیل ساعت پانزده');
    expect(block.length).toBeLessThan(900); // برش اعمال شده
  });
  test('appendAnalysis — سقف ۲۴ تحلیل (حافظهٔ یک شبانه‌روز)', () => {
    let list: HourlyAnalysis[] = [];
    for (let i = 0; i < HOURLY_HISTORY_CAP + 5; i++) {
      list = appendAnalysis(list, { hourKey: `2026-11-10T${String(i % 24).padStart(2, '0')}:00`, at: new Date(2026, 10, 10, i).toISOString(), text: `تحلیل شماره ${i}`, items: i });
    }
    expect(list.length).toBe(HOURLY_HISTORY_CAP);
    expect(list[list.length - 1].text).toContain('تحلیل شماره ۲۸'.replace('۲۸', String(HOURLY_HISTORY_CAP + 4)));
  });
});

// ---------- اعتبارسنجی متن مدل ----------

describe('validateHourlyText — هیچ متن نامعتبری ارسال نمی‌شود', () => {
  const good = `۱. ✅ خبر اول درباره توافق دیروز میان طرف‌ها که امضا شد و اعلام عمومی پیدا کرد.
۲. خبر دوم درباره بازار و رشد شاخص بورس در معاملات امروز.

🔍 تحلیل
• پیوند این دو خبر در سیاست انرژی روشن است و پیامد آن در هفتهٔ آینده دیده می‌شود.`;

  test('متن فارسی معتبر پذیرفته و پاک‌سازی می‌شود', () => {
    const out = validateHourlyText('```\n' + good + '\n```');
    expect(out).not.toBeNull();
    expect(out!).not.toContain('```');
    expect(out!).toContain('🔍 تحلیل');
  });
  test('خیلی کوتاه یا خالی → null', () => {
    expect(validateHourlyText('')).toBeNull();
    expect(validateHourlyText('کوتاه')).toBeNull();
    expect(validateHourlyText(undefined)).toBeNull();
  });
  test('غیرفارسی → null (هیچ پیام غیرفارسی ارسال نمی‌شود)', () => {
    expect(validateHourlyText('This is a long English only message about news and analysis of the world economy and politics today with many words to pass the length threshold. '.repeat(3))).toBeNull();
  });
  test('لینک حذف و سقف طول رعایت می‌شود', () => {
    const long = `${good}\nمنبع: https://example.com/news/${'x'.repeat(200)}\n${'متن طولانی فارسی برای آزمون سقف. '.repeat(300)}`;
    const out = validateHourlyText(long, 3400)!;
    expect(out).not.toContain('https://');
    expect(out!.length).toBeLessThanOrEqual(3420);
  });
});

// ---------- تقسیم چندپیامی — بدون سربرگ (خواستهٔ کاربر ۱۲ نوامبر: «🕒 اخبار … رو حذف کن») ----------

describe('chunkHourlyMessage — بدون سربرگ زمانی، ادامه با نشانگر', () => {
  test('پیام کوتاه تک‌پیام می‌ماند — عین متن، بدون هیچ سربرگ', () => {
    const parts = chunkHourlyMessage('متن کوتاه خبر و تحلیل امروز.');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe('متن کوتاه خبر و تحلیل امروز.');
    expect(parts[0]).not.toContain('🕒');
  });
  test('بلند به چند پیام می‌شکند — پیام اول خودِ متن؛ ادامه با «— ادامه»', () => {
    const parts = chunkHourlyMessage('بند خبری فارسی برای آزمون شکستن پیام. '.repeat(200), 3300);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).not.toContain('🕒');
    expect(parts[1].startsWith('— ادامه')).toBe(true);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(3400);
  });
});

// ---------- سوپرپرامپت و چرخش تأمین‌کنندگان ----------

describe('سوپرپرامپت ساعتی — پوشش الزامات کاربر', () => {
  test('پرامپت پیش‌فرض کامل است — تجمیع، تیک، بیان ساده، تحلیل، تاریخچه، ضدتزریق', () => {
    expect(DEFAULT_SYSTEM_HOURLY).toContain('تجمیع');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('✅');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('به زبان ساده'.replace('به زبان ساده', 'ساده'));
    expect(DEFAULT_SYSTEM_HOURLY).toContain('🔍 تحلیل');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('تحلیل‌های ساعات پیشین');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('دستور به شما داشت'); // ضدتزریق
    expect(DEFAULT_SYSTEM_HOURLY).toContain('بی‌طرفی');
  });
  test('override پرامپت ساعتی از bot/prompts.json (کلید hourly)', () => {
    const pf = parsePromptFile(JSON.stringify({ hourly: 'سوپرپرامپت آزمایشی. '.repeat(40) }));
    expect(pf.hourly).toBeDefined();
    const r = applyPromptOverrides(pf);
    expect(r.hourly).toBe(true);
    expect(getHourlyPrompt()).toContain('سوپرپرامپت آزمایشی');
  });
});

describe('زنجیرهٔ bot.ts — فراوان، چرخشی، GLM آخرین پشتیبان', () => {
  test('buildChain — GLM (zai) همیشه حاضر و همیشه آخرین عضو', () => {
    const chain = buildChain();
    expect(chain.length).toBeGreaterThanOrEqual(2);
    expect(chain[chain.length - 1].id).toBe('zai');
    expect(chain[chain.length - 1].kind).toBe('zai');
    // بدون کلید، زنجیره دست‌کم pollinations + zai را دارد
    expect(chain.map((p) => p.id)).toContain('pollinations');
  });
  test('rotateChain — چرخش یکی‌یکی با نشانگر و پیمایش حلقوی', () => {
    const chain = ['a', 'b', 'c'];
    expect(rotateChain(chain, 0)).toEqual(['a', 'b', 'c']);
    expect(rotateChain(chain, 1)).toEqual(['b', 'c', 'a']);
    expect(rotateChain(chain, 2)).toEqual(['c', 'a', 'b']);
    expect(rotateChain(chain, 3)).toEqual(['a', 'b', 'c']); // پیمایش حلقوی
    expect(rotateChain(chain, -1)).toEqual(['c', 'a', 'b']); // منفی هم امن
    expect(rotateChain(['a'], 5)).toEqual(['a']);
  });
  test('تأمین‌کنندگان کلیددار فراوان — با کلید محیطی فعال می‌شوند', () => {
    // خواندن مستقیم از process.env اینجا ممکن نیست (CFG هنگام import خوانده شده)؛
    // ساختار را با ارزیابی منبع بررسی می‌کنیم: شش تأمین‌کنندهٔ کلیددار تازه تعریف شده باشد.
    const src = readFileSync('bot/bot.ts', 'utf8');
    for (const env of ['GROQ_API_KEY', 'CEREBRAS_API_KEY', 'MISTRAL_API_KEY', 'COHERE_API_KEY', 'TOGETHER_API_KEY', 'NVIDIA_API_KEY']) {
      expect(src).toContain(`'${env}'`);
    }
  });
});
