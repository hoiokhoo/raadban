/**
 * خواستهٔ ۲۰ نوامبر ۲۰۲۶ (هشتم) — ریشه‌کنی نهایی «…» از توییت‌های فوری:
 *  «توییتهای فوری شامل ایران یا جنگ رو اصلا خلاصه نکن … الآن دیدم توییت ترامپ اومد آخرش
 *   دوباره ... داره یعنی کل توییتش ترجمه نشده، کامل باشه فقط فارسی روان و کامل»
 *
 * زنجیرهٔ نشتِ یافت‌شده و اصلاح‌شده:
 *  ۱) کارت فوری با wrapFa(۶۰×۱۶ خط ≈ ۹۶۰ نویسه) بریده می‌شد و «…» می‌گذاشت ← wrapFaFull بی‌سقف؛
 *     ارتفاع کارت با شمارش کامل رشد می‌کند. گیف متحرک فقط تا ارتفاع ۶۰۰۰px؛ بالاتر → PNG تک‌پیام.
 *  ۲) ترجمهٔ دستهٔ وفادار ورودی را در ۲۴۰۰ نویسه می‌برید ← ۶۰۰۰؛ بچ ۵→۳؛ maxTokens ۸۰۰۰→۱۰۰۰۰.
 *  ۳) validators خروجی را در ۳۵۰۰ نویسه می‌برید ← ۱۰۰۰۰ (فقط سپر ضدِ پاسخ دیوانه‌وار).
 *  ۴) translateOne ورودی ۳۰۰۰ نویسه ← ۱۲۰۰۰؛ maxTokens ۲۲۰۰→۵۰۰۰ (مسیر gateFa فوریِ ساعتی).
 *  ۵) فوری بدون ترجمهٔ دسته ← یک فراخوان تک‌موردی اختصاصی قبل از ارسال (هرگز متن ناقص).
 *  ۶) کپشن بازگشتی دیگر slice(0,1000) خاموش ندارد — splitPhotoCaption + پیام مکمل.
 */
import { describe, expect, test } from 'bun:test';
import {
  wrapFaFull,
  breakingCardHeight,
  makeBreakingCardSvg,
  renderBreakingCardPng,
  renderBreakingCardGif,
  BREAKING_GIF_MAX_HEIGHT,
  TW_MAX_LINES,
  BR_MAX_LINES,
} from '../bot/news-card';
import { tripleDateOf } from '../bot/calendar';
import { validateBatchTranslation, salvageBatchTranslations } from '../bot/bot';

const DATE = tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura');

/** متن آزمونی فارسی با n کلمه — مثل ترجمهٔ یک تروث‌سوشال بلند ترامپ */
function faText(words: number): string {
  return Array.from({ length: words }, (_, i) => `واژه${i}`).join(' ');
}

describe('wrapFaFull — شکستن کامل بدون هیچ بریدگی', () => {
  test('متن ۳۰۰۰نویسه‌ای — همهٔ خطوط برمی‌گردد و هیچ «…» وجود ندارد', () => {
    const t = faText(600); // ~۴۳۰۰ نویسه
    const lines = wrapFaFull(t, 60);
    expect(lines.length).toBeGreaterThan(50);
    for (const ln of lines) {
      expect(ln.length).toBeLessThanOrEqual(60);
      expect(ln.includes('…')).toBe(false);
    }
    // بی‌نقص: اتصال خطوط = عین متن نرمال‌شده
    expect(lines.join(' ')).toBe(t.replace(/\s+/g, ' ').trim());
  });

  test('واژهٔ فوق‌بلند (لینک) — شکست سخت بدون «…»', () => {
    const lines = wrapFaFull(`پیشوند ${'a'.repeat(200)} پسوند`, 30);
    expect(lines[0]).toBe('پیشوند');
    expect(lines[lines.length - 1]).toBe('پسوند'); // واژهٔ بعد از واژهٔ شکسته‌شده در خط خودش
    // بی‌نقص نویسه‌ای: واژهٔ شکسته‌شده با فاصلهٔ مصنوعی جدا می‌شود — بدون فاصله‌ها عین اصل است
    expect(lines.join(' ').replace(/ /g, '')).toBe(`پیشوند ${'a'.repeat(200)} پسوند`.replace(/ /g, ''));
    expect(lines.some((l) => l.includes('…'))).toBe(false);
  });

  test('متن خالی/فاصله — خط صفر', () => {
    expect(wrapFaFull('', 60)).toEqual([]);
    expect(wrapFaFull('   ', 60)).toEqual([]);
  });

  test('متن کوتاه — یک خط عیناً', () => {
    expect(wrapFaFull('سلام دنیا', 60)).toEqual(['سلام دنیا']);
  });
});

describe('کارت فوری بی‌سقف — هیچ متنی با «…» بریده نمی‌شود (ریشهٔ توییت ترامپ)', () => {
  test('متن ~۲۰۰۰نویسه‌ای (تروث‌سوشال واقعی) — SVG بدون «…» و با همهٔ خطوط', () => {
    const t = faText(300); // ~۲۲۰۰ نویسه — ترجمهٔ پست بلند ترامپ
    const svg = makeBreakingCardSvg({ source: '🅣 Donald Trump (تروث‌سوشال)', text: t, date: DATE });
    expect(svg).not.toContain('…'); // هیچ بریدگی — حتی یک نویسه هم نیست
    const wantLines = wrapFaFull(t, 60);
    expect(wantLines.length).toBeGreaterThan(30);
    // هر خطِ محاسبه‌شده عیناً در SVG رندر شده
    for (const ln of wantLines.slice(0, 5)) expect(svg).toContain(ln);
    for (const ln of wantLines.slice(-5)) expect(svg).toContain(ln);
    // شروع و پایان متن کامل در کارت است — «آخرش … ندارد»
    expect(svg).toContain('واژه0');
    expect(svg).toContain(`واژه${299}`);
  });

  test('متن ۶۰۰۰نویسه‌ای — ارتفاع کارت دقیقاً با شمارش کامل wrapFaFull', () => {
    const t = faText(900); // ~۶۴۰۰ نویسه
    const lines = wrapFaFull(t, 60);
    const H = breakingCardHeight(t, false);
    expect(H).toBe(170 + 14 + 56 + Math.max(1, lines.length) * 42 + 54 + 88);
    expect(H).toBeGreaterThan(4000); // کارت بلند شده — متن کامل جا شده
    const svg = makeBreakingCardSvg({ source: '🅣 x', text: t, date: DATE });
    expect(svg).not.toContain('…');
    expect(svg).toContain(`height="${H}"`);
  });

  test('ارتفاع یکنواخت با طول متن و سازگاری خط/ارتفاع', () => {
    const short = breakingCardHeight('خبر فوری کوتاه', false);
    const mid = breakingCardHeight(faText(80), false);
    const long = breakingCardHeight(faText(400), false);
    expect(mid).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(mid);
  });

  test('PNG واقعیِ کارت بلند — رندر می‌شود، ارتفاع درست، بدون «…»', async () => {
    const t = faText(220); // ~۱۶۰۰ نویسه → ~۲۷ خط
    const card = await renderBreakingCardPng({ source: '🅣 Donald Trump (تروث‌سوشال)', text: t, date: DATE });
    expect(card).not.toBeNull();
    expect(card!.height).toBe(breakingCardHeight(t, false));
    expect(card!.png.length).toBeGreaterThan(5000);
  });

  test('گیف متحرک برای کارت خیلی بلند → null سریع (مسیر PNG تک‌پیام)', async () => {
    expect(BREAKING_GIF_MAX_HEIGHT).toBe(6000);
    const t = faText(1500); // ~۱۰۶۰۰ نویسه → ارتفاع ~۷۶۰۰px بالای سقف گیف
    expect(breakingCardHeight(t, false)).toBeGreaterThan(BREAKING_GIF_MAX_HEIGHT);
    const gif = await renderBreakingCardGif({ source: '🅣 x', text: t, date: DATE });
    expect(gif).toBeNull();
  });

  test('گیف متحرک برای کارت عادی همچنان رندر می‌شود — رفتار پیشین دست‌نخورده', async () => {
    const gif = await renderBreakingCardGif({ source: '🅣 x', text: 'توییت فوری آزمونی دربارهٔ ایران و جنگ — متن کوتاه کامل', date: DATE });
    expect(gif).not.toBeNull();
    expect(gif!.png.length).toBeGreaterThan(5000);
  });

  test('سقف‌های منسوخ — BR_MAX_LINES برای سازگاری صادقانه علامت خورده', () => {
    expect(BR_MAX_LINES).toBe(16); // دیگر در مسیر رندر فوری استفاده نمی‌شود — فقط سازگاری
    expect(TW_MAX_LINES).toBe(32); // بستهٔ عادی توییت: ۱۶→۳۲
  });
});

describe('سقف‌های ترجمه — هیچ ترجمهٔ کاملی وسط راه بریده نمی‌شود', () => {
  test('validateBatchTranslation — ترجمهٔ ۹۰۰۰نویسه‌ای دست‌نخورده می‌ماند (سقف ۱۰۰۰۰)', () => {
    const fa = faText(1200); // ~۸۷۰۰ نویسه
    const out = validateBatchTranslation([{ n: 1, fa }]);
    expect(out).not.toBeNull();
    expect(out![0]!.fa).toBe(fa);
    expect(out![0]!.fa.length).toBeGreaterThan(8000);
  });

  test('validateBatchTranslation — سپر ۱۰۰۰۰ فقط ضدِ پاسخ دیوانه‌وار است', () => {
    const out = validateBatchTranslation([{ n: 1, fa: 'x'.repeat(15000) }]);
    expect(out![0]!.fa.length).toBe(10000);
  });

  test('validateBatchTranslation — پشتیبان فیلد translation هم با همان سقف', () => {
    const fa = faText(800);
    const out = validateBatchTranslation([{ n: 2, translation: fa }]);
    expect(out![0]!.n).toBe(2);
    expect(out![0]!.fa).toBe(fa);
  });

  test('salvageBatchTranslations — مدخل کاملِ بلند از JSON بریده نجات می‌یابد بی‌بریدگی', () => {
    const fa = faText(1000); // ~۷۳۰۰ نویسه
    const raw = `{"t":[{"n":1,"fa":"${fa}"},{"n":2,"fa":"ناتم`;
    const out = salvageBatchTranslations(raw);
    expect(out).not.toBeNull();
    expect(out![0]!.n).toBe(1);
    expect(out![0]!.fa).toBe(fa);
  });
});
