/**
 * تست‌های خواستهٔ ۲۵ نوامبر ۲۰۲۶:
 *  ۱) «عکسها کیفیتشون کمه … اگر نمیشه عکس رو با کیفیت‌تر کرد، تعداد اخبار یا توییتهای
 *     هر عکس رو کمتر کن، تعداد عکسها رو بیشتر» — نردبان تراکم ۳× (tests/nov24-features.test.ts)،
 *     کارت خبر ۸ ردیفی، کارت توییت سقف ارتفاع ۲۱۰۰ (هر دو در تست‌های به‌روزشدهٔ
 *     nov16/nov21) و انکود تطبیقی گیف (radar/forecast).
 *  ۲) «بعضی از اخبار الآن خام ارسال میشن … اونا هم با یه رنگ پس زمینهٔ متفاوت از
 *     بخشهای دیگه داخل یه عکس جا بشن» — کارت بنفش «متن کامل» (bot/fulltext-card.ts).
 *  ۳) «داخل هر عکس با همون استانداردی که داشتیم کلمه جنگ و ایران اگر بود اون خبر رو
 *     متمایزکن» — isWarRelated/isPriorityRelated + هایلایت کهربایی در خبر/توییت/متن کامل.
 */
import { describe, expect, test } from 'bun:test';
import { isWarRelated, isPriorityRelated, highlightPriorityItemsHtml, WAR_KEYWORDS } from '../bot/iran';
import { makeNewsCardSvg, NEWS_CARD_ROWS_PER_PAGE, TW_PAGE_MAX_HEIGHT, makeTweetCardSvg, type NewsCardItem, type TweetCardItem } from '../bot/news-card';
import {
  makeFullTextCardSvg,
  renderFullTextCardPng,
  renderFullTextCardPages,
  splitFullTextItemsForCards,
  fullTextRowHeight,
  FT_PAGE_MAX_HEIGHT,
  FT_MAX_PAGES,
  FULLTEXT_NEWS_TITLE,
  FULLTEXT_TWEETS_TITLE,
  type FullTextCardItem,
} from '../bot/fulltext-card';
import { tripleDateOf } from '../bot/calendar';

const DATE = tripleDateOf('2026-11-25', 'Asia/Tehran', 'umalqura');

// ────────────────────────────────────────────────────────────────────
// ۱) کلیدواژهٔ جنگ + ترکیب ایران/جنگ
// ────────────────────────────────────────────────────────────────────

describe('isWarRelated — کلمهٔ جنگ (خواستهٔ ۲۵ نوامبر)', () => {
  test('واژه‌های نشانهٔ جنگ', () => {
    expect(isWarRelated('وضعیت جنگ در منطقه تشدید شد')).toBe(true);
    expect(isWarRelated('دو کشور در آستانهٔ جنگی تمام‌عیار هستند')).toBe(true);
    expect(isWarRelated('جنگ‌های گذشته درس تاریخ است')).toBe(true);
    expect(isWarRelated('Trump: We are on the brink of war')).toBe(true);
    expect(isWarRelated('warfare escalated')).toBe(true);
  });
  test('«جنگل» جنگ نیست — استثنای واژه‌ای', () => {
    expect(isWarRelated('تور در جنگل ابرهایمازندران برگزار شد')).toBe(false);
    expect(isWarRelated('')).toBe(false);
    expect(isWarRelated('قیمت نفت در بازارهای جهانی بالا رفت')).toBe(false);
  });
  test('WAR_KEYWORDS فهرست عمومی دارد', () => {
    expect(WAR_KEYWORDS.length).toBeGreaterThanOrEqual(3);
    expect(WAR_KEYWORDS).toContain('جنگ');
  });
});

describe('isPriorityRelated — ایران یا جنگ (تمایز استاندارد در همهٔ کارت‌ها)', () => {
  test('جنگ بدون ایران → اولویت‌دار', () => {
    expect(isPriorityRelated('آتش‌بس میان دو ارتش برقرار نشد؛ جنگ ادامه دارد')).toBe(true);
  });
  test('ایران بدون جنگ → اولویت‌دار (رفتار پیشین حفظ شد)', () => {
    expect(isPriorityRelated('دلار در بازار تهران کاهش یافت')).toBe(true);
  });
  test('هیچ‌کدام → معمولی؛ «ایرانسل»/«جنگل» هر دو استثنا می‌مانند', () => {
    expect(isPriorityRelated('قیمت گوشی در بازار کاهش یافت')).toBe(false);
    expect(isPriorityRelated('ایرانسل تعرفهٔ اینترنت را ارزان کرد')).toBe(false);
    expect(isPriorityRelated('پیاده‌روی در جنگل نور')).toBe(false);
  });
});

describe('highlightPriorityItemsHtml — بولد موارد جنگ/ایران در متن', () => {
  test('مورد جنگ هم مثل ایران بولد می‌شود', () => {
    const t = '۱. آتش‌بس شکست خورد و جنگ دوباره آغاز شد.\n۲. قیمت طلا امروز ثابت ماند.';
    const out = highlightPriorityItemsHtml(t);
    expect(out).toContain('<b>آتش‌بس شکست خورد و جنگ دوباره آغاز شد.</b>');
    expect(out).not.toContain('<b>قیمت طلا امروز ثابت ماند.</b>');
  });
  test('سطر بولد‌شده از قبل → دست‌نخورده (بدون بولد دوبل)', () => {
    expect(highlightPriorityItemsHtml('۱. <b>خبر تهران</b>')).toBe('۱. <b>خبر تهران</b>');
  });
});

// ────────────────────────────────────────────────────────────────────
// ۲) هایلایت کهربایی جنگ/ایران روی کارت خبر و توییت
// ────────────────────────────────────────────────────────────────────

describe('هایلایت کارت خبر — جنگ/ایران کهربایی و بولد (همان استاندارد)', () => {
  const items: NewsCardItem[] = [
    { text: 'خبر عادی دربارهٔ اقتصاد جهانی و بازارهای سرمایهٔ آسیا', tick: false, source: 'ایسنا' },
    { text: 'گزارش جنگ: درگیری مرزی در منطقه تشدید شد', tick: false, source: 'تسنیم' },
    { text: 'اخبار ورزشی لیگ برتر امشب', tick: false, source: 'مهر' },
  ];
  const svg = makeNewsCardSvg({ date: DATE, items });

  test('ردیف جنگ: نوار کهربایی + متن بولد کهربایی', () => {
    expect(svg).toContain('#ffd75e'); // نوار لبه + متن ردیف اولویت‌دار
    expect(svg).toMatch(/fill="#ffd75e"[^>]*>.*?گزارش جنگ/);
  });
  test('ردیف عادی بدون نوار کهربایی — متن سفید usual', () => {
    // سه ردیف؛ فقط ردیف جنگ دارای font-weight 700 در متن است
    const boldRows = (svg.match(/font-weight="700" fill="#ffd75e"/g) || []).length;
    expect(boldRows).toBe(1);
  });
  test('کارت خبر ۸ ردیف هر صفحه (کمتر اقلام، بیشتر عکس — خواستهٔ ۲۵ نوامبر)', () => {
    expect(NEWS_CARD_ROWS_PER_PAGE).toBe(8);
  });
});

describe('هایلایت کارت توییت — جنگ/ایران روی پالت سبز', () => {
  const items: TweetCardItem[] = [
    { source: '𝕏 A', fa: 'توییت عادی دربارهٔ بازار', faName: 'تحلیلگر' },
    { source: '𝕏 B', fa: 'ترجمهٔ توییت دربارهٔ جنگ و آتش‌بس', faName: 'مقام نظامی' },
  ];
  const svg = makeTweetCardSvg({ date: DATE, items });
  test('ردیف جنگ کهربایی (#d9a441 لبه)؛ ردیف عادی سبز', () => {
    expect(svg).toContain('#d9a441'); // نوار کهربایی ردیف جنگ/ایران
    expect(svg).toContain('#e7f3e9'); // ردیف عادی سبز کم‌رنگ
  });
  test('سقف ارتفاع صفحهٔ توییت ۲۱۰۰ (۳× رندر؛ ۶۴۰→ عملاً ۱× تار)', () => {
    expect(TW_PAGE_MAX_HEIGHT).toBe(2100);
  });
});

// ────────────────────────────────────────────────────────────────────
// ۳) کارت بنفش «متن کامل» — جایگزین پیام‌های خام سرریز
// ────────────────────────────────────────────────────────────────────

const longText = Array.from({ length: 30 }, (_, i) => `بخش ${i + 1} از متن کامل خبر بلند که پیش‌تر خام ارسال می‌شد و شامل واژهٔ جنگ در جملهٔ پایانی است.`).join(' ');

describe('fulltext-card — ساختار و پالت بنفش متمایز', () => {
  const items: FullTextCardItem[] = [
    { source: 'ایسنا', text: longText },
    { source: '𝕏 Donald Trump', name: 'دونالد ترامپ', text: 'ترجمهٔ توییت کوتاه دربارهٔ اقتصاد.' },
  ];
  const svg = makeFullTextCardSvg({ date: DATE, title: FULLTEXT_NEWS_TITLE, items });

  test('پالت بنفش — متمایز از سرمه‌ای خبر/سبز توییت/قرمز فوری', () => {
    expect(svg).toContain('#f7f3fc'); // زمینهٔ کارت بنفش کم‌رنگ
    expect(svg).toContain('#7c3aed'); // گرادیان سربرگ بنفش
    expect(svg).toContain('#e9def5'); // ردیف بنفش (تناوب روشن/کم‌رنگ)
    expect(svg).not.toContain('#0a1c30'); // زمینهٔ سرمه‌ای کارت خبر نیست
  });
  test('عنوان و تاریخ و منبع', () => {
    expect(svg).toContain(FULLTEXT_NEWS_TITLE);
    expect(svg).toContain('ایسنا');
    expect(svg).toContain('دونالد ترامپ');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
  });
  test('متن کامل بدون هیچ «…» — حتی متن ۳۰ جمله‌ای', () => {
    // شکستن خط واژه‌محور است — واژه‌ها عیناً می‌مانند؛ جملهٔ پایانی کامل حاضر است
    expect(svg).toContain('پایانی');
    expect(svg).not.toContain('…');
    const bodyLines = (svg.match(/<text[^>]*>\u202B/g) || []).length;
    expect(bodyLines).toBeGreaterThan(30); // متن بلند چندخطی کامل رندر شد
  });
  test('ردیف جنگ کهربایی متمایز (همان استاندارد)', () => {
    expect(svg).toContain('#d9a441'); // نوار لبهٔ کهربایی ردیف جنگ
    expect(svg).toContain('#faf2da'); // زمینهٔ کهربایی ردیف اولویت‌دار
  });
  test('بدون آیتم → SVG خالی (هیچ کارت نیمه‌ساختگی)', () => {
    expect(makeFullTextCardSvg({ date: DATE, items: [] })).toBe('');
  });
  test('برچسب بخش N از M', () => {
    expect(makeFullTextCardSvg({ date: DATE, items, part: { no: 2, of: 3 } })).toContain('بخش ۲ از ۳');
  });
});

describe('fulltext-card — صفحه‌بندی ارتفاعی', () => {
  test('سقف ارتفاع ۲۱۰۰ و سقف صفحات', () => {
    expect(FT_PAGE_MAX_HEIGHT).toBe(2100);
    expect(FT_MAX_PAGES).toBeGreaterThanOrEqual(8);
  });
  test('ارتفاع ردیف با طول متن رشد می‌کند (کامل، بدون سقف خط)', () => {
    expect(fullTextRowHeight({ text: longText })).toBeGreaterThan(fullTextRowHeight({ text: 'کوتاه' }));
    expect(fullTextRowHeight({ text: 'کوتاه', source: 'ایسنا' })).toBeGreaterThan(fullTextRowHeight({ text: 'کوتاه' }));
  });
  test('صفحه‌بندی: هر صفحه در سقف ارتفاع؛ مازاد در overflow (نه حذف بی‌صدا)', () => {
    const many: FullTextCardItem[] = Array.from({ length: 30 }, (_, i) => ({ text: `مورد ${i + 1} ${longText.slice(0, 200)}` }));
    const { paged, overflow } = splitFullTextItemsForCards(many);
    expect(paged.length).toBeGreaterThan(1); // «تعداد عکسها بیشتر» — چند کارت کوچک‌تر
    expect(paged.flat().length + overflow.length).toBe(30); // هیچ موردی گم نمی‌شود
    for (const p of paged) {
      const h = p.reduce((a, it) => a + fullTextRowHeight(it), 0) + 190 + 88 + 26;
      // تک‌ردیفِ بلندتر از سقف، تنها در صفحهٔ خودش جا می‌شود (رفتار هم‌الگوی توییت)
      if (p.length > 1) expect(h).toBeLessThanOrEqual(FT_PAGE_MAX_HEIGHT);
    }
  });
});

describe('fulltext-card — رندر واقعی PNG', () => {
  test('رندر ۳× (سقف ۲۱۰۰ → ۳۲۴۰px عرض) و امضای PNG', async () => {
    const card = await renderFullTextCardPng({ date: DATE, items: [{ source: 'ایسنا', text: 'متن کامل آزمونی' }] });
    expect(card).not.toBeNull();
    expect(card!.width).toBe(3240); // ۳× — شارپ‌تر با زوم
    expect(card!.width + card!.height).toBeLessThanOrEqual(9800); // سقف بله
    expect(card!.png.length).toBeGreaterThan(5000);
    const sig = Array.from(card!.png.slice(0, 8)).join(',');
    expect(sig).toBe('137,80,78,71,13,10,26,10');
  }, 30_000);

  test('صفحه‌ها + overflow صادقانه (سپر «خبری از قلم نمی‌افتد»)', async () => {
    const items: FullTextCardItem[] = Array.from({ length: 6 }, (_, i) => ({ source: `س${i + 1}`, text: `مورد ${i + 1}: ${longText.slice(0, 800)}` }));
    const { pages, overflow } = await renderFullTextCardPages({ date: DATE, items });
    expect(pages.length).toBeGreaterThan(1); // «تعداد عکسها بیشتر» — چند کارت کوچک‌تر ۳×
    const covered = items.length - overflow.length;
    expect(covered).toBeGreaterThan(0);
    expect(pages.length + Math.ceil(overflow.length / 2)).toBeGreaterThanOrEqual(items.length / 2);
  }, 60_000);

  test('تیتر توییت — عنوان سربرگ متفاوت', () => {
    const svg = makeFullTextCardSvg({ date: DATE, title: FULLTEXT_TWEETS_TITLE, items: [{ text: 'توییت' }] });
    expect(svg).toContain(FULLTEXT_TWEETS_TITLE);
  });
});
