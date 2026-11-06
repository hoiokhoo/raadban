/**
 * تست‌های واحد رصدبان‌بات (bot/bot.ts) — همهٔ توابع خالص
 * قواعد: قالب پیام نسخهٔ ۴، ضدتکرار سه‌لایه، تجمیع، خارجی اول، پارس فید/تلگرام، اعتبارسنج مدل
 */
import { describe, expect, test } from 'bun:test';
import {
  cleanNewsText, clusterItems, composeNewsMessage, emptyState, extractAvatarUrl, extractItemImage,
  extractMessageImage, extractTweetsFromHtml, fluentFaText, foreignFirstOrder, freshTweets, isAlreadySent, isForeignItem, isLikelyForeign,
  isSimilarToAny, isStorySent, jaccard, makeIds, mergeSentState, needsTranslation, normalizeTitle, parseBingNewsRss, parseFeed,
  parseGeminiKeys, parseTargets, parseTelegramPage, planBotSends, rotateAccounts, splitForBale, splitPhotoCaption, tokensOf, unescapeEntities,
  selectWithDomesticQuota,
  validateBatchTranslation, validateOneShot, verdictToEmoji, type BotItem, type BotState,
} from '../bot/bot';

// ---------- کمکی ----------

function item(over: Partial<BotItem> & { content: string }): BotItem {
  const ids = makeIds({ url: over.url, content: over.content });
  return {
    id: ids.id, titleKey: ids.titleKey,
    sourceName: over.sourceName || 'منبع آزمون',
    platform: over.platform || 'rss',
    language: over.language || 'fa',
    region: over.region || 'ایران',
    content: over.content,
    url: over.url,
    imageUrl: over.imageUrl,
    publishedAt: over.publishedAt ?? new Date('2026-11-03T09:00:00Z'),
    translationFa: over.translationFa,
  };
}

// ---------- پاک‌سازی متن ----------

describe('cleanNewsText', () => {
  test('حذف تگ HTML و واکشی موجودیت', () => {
    expect(cleanNewsText('<p>سلام &amp; خداحوز</p>')).toBe('سلام & خداحوز');
  });

  test('واکشی دوبل موجودیت (فید گوگل‌نیوز)', () => {
    expect(cleanNewsText('&amp;#8216;نقل&amp;#8217;')).toContain('نقل');
    expect(cleanNewsText('&amp;#8216;نقل&amp;#8217;')).not.toContain('&#');
  });
});

describe('isLikelyForeign', () => {
  test('متن انگلیسی → خارجی', () => {
    expect(isLikelyForeign('The president said negotiations will continue next week in Geneva')).toBe(true);
  });
  test('متن فارسی → خارجی نیست', () => {
    expect(isLikelyForeign('رییس‌جمهور گفت مذاکرات هفتهٔ آینده در ژنو ادامه می‌یابد')).toBe(false);
  });
});

// ---------- ضدتکرار ----------

describe('normalizeTitle و makeIds', () => {
  test('ی/ك عربی و فارسی یکسان هش می‌شوند', () => {
    const a = makeIds({ content: 'دیدار ياد شده با كشور' }).titleKey;
    const b = makeIds({ content: 'دیدار یاد شده با کشور' }).titleKey;
    expect(a).toBe(b);
  });

  test('نشانه‌گذاری و بزرگی حرف بی‌اثر است', () => {
    expect(makeIds({ content: 'Breaking: Talks Begin!' }).titleKey)
      .toBe(makeIds({ content: 'breaking talks begin' }).titleKey);
  });
});

describe('mergeSentState', () => {
  test('افزودن جدیدها و ماندن قدیمی‌های درون بازه', () => {
    const now = 1_000_000_000;
    const st = emptyState();
    st.sentIds = { old: now - 3600_000 }; // ۱ ساعت پیش
    const merged = mergeSentState(st, ['new1', 'new2'], ['t1'], now);
    expect(merged.sentIds.new1).toBe(now);
    expect(merged.sentIds.old).toBe(now - 3600_000);
    expect(merged.sentTitles.t1).toBe(now);
  });

  test('هرس قدیمی‌تر از ۷۲ ساعت', () => {
    const now = 1_000_000_000;
    const st = emptyState();
    st.sentIds = { ancient: now - 80 * 3600_000, recent: now - 10 * 3600_000 };
    const merged = mergeSentState(st, [], [], now);
    expect(merged.sentIds.ancient).toBeUndefined();
    expect(merged.sentIds.recent).toBeDefined();
  });

  test('سقف تعداد — همانند سامانه، نخستین‌های دسته در سقف می‌مانند', () => {
    const now = 1_000_000_000;
    const st = emptyState();
    const ids = Array.from({ length: 50 }, (_, i) => `id${i}`);
    const merged = mergeSentState(st, ids, [], now, 72 * 3600_000, 10, 10);
    expect(Object.keys(merged.sentIds).length).toBe(10);
    expect(merged.sentIds.id0).toBeDefined();
    expect(merged.sentIds.id49).toBeUndefined(); // مابقی از سقف بیرون می‌ماند
  });

  test('متن‌های عنوان/پیام هم ذخیره و سقف‌گذاری می‌شوند', () => {
    const now = 1_000_000_000;
    const st = emptyState();
    const titles = Array.from({ length: 20 }, (_, i) => `عنوان شمارهٔ ${i} دربارهٔ سیاست`);
    const msgs = Array.from({ length: 20 }, (_, i) => `متن پیام شمارهٔ ${i} دربارهٔ دیپلماسی`);
    const merged = mergeSentState(st, [], [], now, undefined, undefined, undefined, { titleTexts: titles, msgTexts: msgs, maxTexts: 8 });
    expect(Object.keys(merged.sentTitleTexts).length).toBe(8);
    expect(Object.keys(merged.sentMsgTexts).length).toBe(8);
    expect(merged.sentTitleTexts['عنوان شمارهٔ 0 دربارهٔ سیاست']).toBe(now); // جدیدها اول
    expect(merged.sentTitleTexts['عنوان شمارهٔ 19 دربارهٔ سیاست']).toBeUndefined();
  });

  test('state قدیمی بدون فیلدهای متن — سازگار با عقب', () => {
    const now = 1_000_000_000;
    const st = { sentIds: { a: now }, sentTitles: {} } as unknown as ReturnType<typeof emptyState>;
    const merged = mergeSentState(st, ['b'], [], now);
    expect(merged.sentTitleTexts).toEqual({});
    expect(merged.sentMsgTexts).toEqual({});
    expect(merged.sentIds.b).toBe(now);
  });
});

describe('isAlreadySent', () => {
  test('هم شناسه و هم عنوان نرمال‌شده چک می‌شود', () => {
    const st = emptyState();
    const it = item({ content: 'خبر آزمایشی دربارهٔ مذاکرات', url: 'https://x.example/1' });
    st.sentTitles[it.titleKey] = Date.now();
    expect(isAlreadySent(st, it)).toBe(true);
    const it2 = item({ content: 'خبر دیگر', url: 'https://x.example/2' });
    st.sentIds[it2.id] = Date.now();
    expect(isAlreadySent(st, it2)).toBe(true);
  });
});

describe('isStorySent — ضدتکرار شباهتی بین‌چرخه‌ای', () => {
  test('هش دقیق شناسه/عنوان هنوز کار می‌کند', () => {
    const st = emptyState();
    const it = item({ content: 'نشست فوری شورای امنیت دربارهٔ آتش‌بس', url: 'https://x.example/a' });
    st.sentIds[it.id] = Date.now();
    expect(isStorySent(st, it)).toBe(true);
  });

  test('همان خبر با نگارش متفاوت از منبع دیگر بلاک می‌شود', () => {
    const st = emptyState();
    st.sentTitleTexts[normalizeTitle('توافق آتش‌بس میان اسرائیل و حماس امروز امضا شد')] = Date.now();
    const reworded = item({ content: 'امضا شد today? توافق آتش‌بس میان اسرائیل و حماس', url: 'https://other.example/b' });
    // محتوای بازنویسی‌شده با توکن‌های مشترک زیاد
    const reworded2 = item({ content: 'توافق آتش‌بس میان اسرائیل و حماس امروز امضا شد و قرار است اجرایی شود', url: 'https://other.example/c' });
    expect(isStorySent(st, reworded)).toBe(true);
    expect(isStorySent(st, reworded2)).toBe(true);
  });

  test('خبر کاملاً متفاوت رد نمی‌شود', () => {
    const st = emptyState();
    st.sentTitleTexts[normalizeTitle('توافق آتش‌بس میان اسرائیل و حماس امروز امضا شد')] = Date.now();
    const other = item({ content: 'قیمت نفت خام برنت در بازار آسیا کاهش یافت', url: 'https://other.example/d' });
    expect(isStorySent(st, other)).toBe(false);
  });

  test('مجموعه‌های ازپیش‌محاسبه همان نتیجه را می‌دهند (کارایی)', () => {
    const st = emptyState();
    st.sentTitleTexts[normalizeTitle('توافق آتش‌بس میان اسرائیل و حماس امروز امضا شد')] = Date.now();
    const sets = Object.keys(st.sentTitleTexts).map((t) => tokensOf(t));
    const reworded = item({ content: 'توافق آتش‌بس میان اسرائیل و حماس امروز امضا شد', url: 'https://other.example/e' });
    expect(isStorySent(st, reworded, sets)).toBe(true);
  });
});

describe('needsTranslation — گیت بازرسی قطعی', () => {
  test('انگلیسی → ترجمه لازم', () => {
    expect(needsTranslation('US officials said the talks will continue next week in Washington')).toBe(true);
  });

  test('فارسی روان → ترجمه لازم نیست', () => {
    expect(needsTranslation('وزیر خارجه امروز در نشست خبری گفت که مذاکرات ادامه خواهد یافت و توافق نزدیک است')).toBe(false);
  });

  test('فارسی بدون پچژگ هم فارسی شمرده می‌شود', () => {
    expect(needsTranslation('مجلس شورای اسلامی امروز نشست علنی داشت و طرح بودجه را بررسی کرد')).toBe(false);
  });

  test('عربی (ة ي ك بدون پچژگ) → ترجمه لازم', () => {
    expect(needsTranslation('قال الوزير إن الاجتماع الذى عقد اليوم فى العاصمة ناقش الملف كاملا وحضرته وفود من عدة دول')).toBe(true);
  });

  test('روسی (سیریلیک) → ترجمه لازم', () => {
    expect(needsTranslation('Президент России заявил, что переговоры продолжатся на следующей неделе в Москве')).toBe(true);
  });

  test('متن کوتاه عربی‌نما زیر آستانه → فارسی فرض می‌شود (محافظه‌کار)', () => {
    expect(needsTranslation('کلمة الى')).toBe(false);
  });

  test('متن خالی/نشانه‌ای → ترجمه لازم نیست', () => {
    expect(needsTranslation('')).toBe(false);
    expect(needsTranslation('!!! ???')).toBe(false);
  });
});

describe('isSimilarToAny و tokensOf', () => {
  test('متن مشابه با هر مجموعه پیدا می‌شود', () => {
    const sets = [tokensOf('قیمت نفت امروز افزایش یافت'), tokensOf('جلسه مجلس فردا برگزار می‌شود')];
    expect(isSimilarToAny('افزایش قیمت نفت امروز در بازار جهانی', sets)).toBe(true);
    expect(isSimilarToAny('برنامهٔ جدید ناسا برای مریخ اعلام شد', sets)).toBe(false);
  });

  test('متن کوتاه بدون توکن معتبر، مشابه نیست', () => {
    expect(isSimilarToAny('!!', [tokensOf('قیمت نفت امروز افزایش یافت')])).toBe(false);
  });
});

describe('fluentFaText — تضمین فارسی‌روانی', () => {
  test('محتوای فارسی مستقیماً مجاز است', () => {
    const g = { primary: { language: 'fa', content: 'وزیر خارجه امروز دیدار کرد', translationFa: undefined } };
    expect(fluentFaText(g)).toBe('وزیر خارجه امروز دیدار کرد');
  });

  test('خبر انگلیسی با ترجمهٔ موجود، ترجمه را می‌دهد', () => {
    const g = { primary: { language: 'en', content: 'US officials met in Washington', translationFa: 'مقام‌های آمریکایی در واشنگتن دیدار کردند' } };
    expect(fluentFaText(g)).toBe('مقام‌های آمریکایی در واشنگتن دیدار کردند');
  });

  test('خبر انگلیسی بدون ترجمه → null (ارسال ممنوع)', () => {
    const g = { primary: { language: 'en', content: 'US officials met in Washington today', translationFa: undefined } };
    expect(fluentFaText(g)).toBeNull();
  });

  test('ترجمهٔ خودِ لاتین → معتبر نیست (fallback به محتوای فارسی اگر باشد)', () => {
    const g = { primary: { language: 'fa', content: 'متن فارسی خبر', translationFa: 'Broken latin translation text' } };
    expect(fluentFaText(g)).toBe('متن فارسی خبر');
    const g2 = { primary: { language: 'en', content: 'English content here', translationFa: 'Latin words inside' } };
    expect(fluentFaText(g2)).toBeNull();
  });

  test('محتوای برچسب‌خوردهٔ فارسی که عربی است → null (گیت بازرسی)', () => {
    const g = { primary: { language: 'fa', content: 'قال الوزير إن الاجتماع الذى عقد اليوم فى العاصمة ناقش الملف كاملا وحضرته وفود دول كبرى', translationFa: undefined } };
    expect(fluentFaText(g)).toBeNull();
  });
});

// ---------- تجمیع ----------

describe('clusterItems', () => {
  test('خبرهای مشابه یک گروه می‌شوند؛ نماینده = نخستین انتشار', () => {
    const a = item({
      content: 'توافق جدید تجاری بین دو کشور امضا شد',
      publishedAt: new Date('2026-11-03T08:00:00Z'),
      sourceName: 'منبع اول',
    });
    const b = item({
      content: 'توافق جدید تجاری بین دو کشور امروز امضا شد',
      publishedAt: new Date('2026-11-03T08:30:00Z'),
      sourceName: 'منبع دوم',
    });
    const c = item({ content: 'هوا شنبه بارانی خواهد بود', publishedAt: new Date('2026-11-03T09:00:00Z') });
    const groups = clusterItems([c, b, a]);
    expect(groups.length).toBe(2);
    const trade = groups.find((g) => g.members.length === 2);
    expect(trade).toBeDefined();
    expect(trade!.primary.sourceName).toBe('منبع اول'); // نخستین انتشار
  });

  test('خبر بی‌شباهت گروه جدا می‌گیرد', () => {
    const groups = clusterItems([item({ content: 'جلسه شورای امنیت برگزار شد' }), item({ content: 'قیمت نفت افزایش یافت' })]);
    expect(groups.length).toBe(2);
  });
});

// ---------- ترتیب ----------

describe('foreignFirstOrder', () => {
  test('خارجی اول، سپس داخلی؛ ترتیب درون گروه حفظ می‌شود', () => {
    const fa1 = { lang: 'fa' }, fa2 = { lang: 'fa' }, en1 = { lang: 'en' }, en2 = { lang: 'en' };
    const out = foreignFirstOrder([fa1, en1, fa2, en2], (x) => x.lang !== 'fa');
    expect(out).toEqual([en1, en2, fa1, fa2]);
  });
});

describe('isForeignItem', () => {
  test('زبان یا منطقه', () => {
    expect(isForeignItem({ language: 'en', region: 'آمریکا' })).toBe(true);
    expect(isForeignItem({ language: 'fa', region: 'ایران' })).toBe(false);
    expect(isForeignItem({ language: 'fa', region: 'آمریکا' })).toBe(true); // رسانهٔ فارسی‌زبان خارجی
  });
});

describe('selectWithDomesticQuota — سهمیهٔ الزامی اخبار داخلی ایران', () => {
  const isForeign = (x: { lang: string }) => x.lang !== 'fa'; // قاعدهٔ همان isForeignItem
  test('خبر داخلی هرگز با سقف maxItems بیرون نمی‌ماند — حتی با انبوه خارجی', () => {
    const foreign = Array.from({ length: 30 }, (_, i) => ({ lang: 'en', n: i }));
    const domestic = Array.from({ length: 24 }, (_, i) => ({ lang: 'fa', n: i }));
    const out = selectWithDomesticQuota([...foreign, ...domestic], isForeign, 12, 4);
    expect(out.length).toBe(12);
    expect(out.filter((x) => x.lang === 'fa').length).toBe(4); // حداقل ۴ داخلی
    expect(out.filter((x) => x.lang === 'en').length).toBe(8);
  });
  test('خارجی کم بود، جای خالی با داخلی پر می‌شود', () => {
    const foreign = Array.from({ length: 3 }, (_, i) => ({ lang: 'en', n: i }));
    const domestic = Array.from({ length: 10 }, (_, i) => ({ lang: 'fa', n: i }));
    const out = selectWithDomesticQuota([...foreign, ...domestic], isForeign, 12, 4);
    expect(out.length).toBe(12); // ۳ خارجی + ۹ داخلی
    expect(out.filter((x) => x.lang === 'fa').length).toBe(9);
  });
  test('داخلی کمتر از سهمیه → همهٔ داخلی‌ها می‌آیند', () => {
    const foreign = Array.from({ length: 20 }, (_, i) => ({ lang: 'en', n: i }));
    const domestic = Array.from({ length: 2 }, (_, i) => ({ lang: 'fa', n: i }));
    const out = selectWithDomesticQuota([...foreign, ...domestic], isForeign, 12, 4);
    expect(out.length).toBe(12);
    expect(out.filter((x) => x.lang === 'fa').length).toBe(2);
  });
  test('سقف ۰ → خالی؛ سهمیهٔ ۰ = بدون رزرو ولی داخلی جای خالی را پر می‌کند', () => {
    const foreign = [{ lang: 'en', n: 1 }, { lang: 'en', n: 2 }];
    const domestic = [{ lang: 'fa', n: 1 }];
    expect(selectWithDomesticQuota([...foreign, ...domestic], isForeign, 0, 4)).toEqual([]);
    const out = selectWithDomesticQuota([...foreign, ...domestic], isForeign, 12, 0);
    expect(out.filter((x) => x.lang === 'fa').length).toBe(1); // بدون سهمیه، جای خالی با داخلی پر می‌شود
    expect(out.length).toBe(3);
  });
});

// ---------- قالب پیام ----------

describe('composeNewsMessage — قالب نسخهٔ ۴', () => {
  test('فقط «منبع: متن» — بدون واژهٔ اضافه', () => {
    const msg = composeNewsMessage({ sourceName: 'بی‌بی‌سی', text: 'متن خبر آزمایشی' });
    expect(msg).toBe('بی‌بی‌سی: متن خبر آزمایشی');
    expect(msg).not.toContain('لینک');
    expect(msg).not.toContain('پیوند');
  });

  test('تأیید → فقط ✅ سبز', () => {
    expect(verdictToEmoji('تأیید می‌شود')).toBe('✅');
    const msg = composeNewsMessage({ sourceName: 'ایرنا', text: 'خبر', verdict: 'تأیید می‌شود' });
    expect(msg.endsWith('✅')).toBe(true);
  });

  test('شک/رد → فقط ⚠️ زرد', () => {
    expect(verdictToEmoji('مورد شک')).toBe('⚠️');
    expect(verdictToEmoji('ردشده با شواهد')).toBe('⚠️');
    expect(verdictToEmoji('گمراه‌کننده')).toBe('⚠️');
  });

  test('بدون شواهد کافی → هیچ ایموجی', () => {
    expect(verdictToEmoji('')).toBe('');
    expect(verdictToEmoji(undefined)).toBe('');
    expect(composeNewsMessage({ sourceName: 'منبع', text: 'خبر' })).not.toContain('✅');
  });

  test('هرگز توضیح راستی‌آزمایی در پیام نیست', () => {
    const msg = composeNewsMessage({ sourceName: 'منبع', text: 'خبر', verdict: 'تأیید می‌شود' });
    expect(msg).not.toContain('راستی');
    expect(msg).not.toContain('اعتبار');
  });
});

describe('splitForBale و splitPhotoCaption', () => {
  test('متن کوتاه برش نمی‌خورد', () => {
    expect(splitForBale('کوتاه')).toEqual(['کوتاه']);
  });
  test('متن بلند روی مرز خط برش می‌خورد', () => {
    const long = Array.from({ length: 200 }, (_, i) => `خط شماره ${i}`).join('\n');
    const parts = splitForBale(long, 400);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(' ').replace(/\s+/g, ' ')).toContain('خط شماره 199');
  });
  test('کپشن عکس سقف ۱۰۲۴ دارد و مابقی برمی‌گردد', () => {
    const long = 'x'.repeat(1500);
    const { caption, rest } = splitPhotoCaption(long);
    expect(caption.length).toBeLessThanOrEqual(1024);
    expect(rest.length).toBeGreaterThan(0);
  });
});

// ---------- پارس فید و تلگرام ----------

describe('parseFeed و extractItemImage', () => {
  const rss = `<?xml version="1.0"?>
  <rss><channel>
    <item>
      <title>توافق نفتی جدید</title>
      <link>https://news.example/oil-deal</link>
      <description><![CDATA[جزئیات توافق <b>نفتی</b> میان دو کشور امروز اعلام شد.]]></description>
      <pubDate>Tue, 03 Nov 2026 08:00:00 GMT</pubDate>
      <guid>https://news.example/oil-deal</guid>
      <media:content url="https://img.example/oil.jpg" medium="image"/>
    </item>
    <item>
      <title>خبر دوم بدون عکس</title>
      <link>https://news.example/second</link>
      <description>متن کوتاه خبر دوم.</description>
    </item>
  </channel></rss>`;

  test('پارس آیتم‌ها با تاریخ و عکس', () => {
    const items = parseFeed(rss);
    expect(items.length).toBe(2);
    expect(items[0].title).toBe('توافق نفتی جدید');
    expect(items[0].link).toBe('https://news.example/oil-deal');
    expect(items[0].imageUrl).toBe('https://img.example/oil.jpg');
    expect(items[0].desc).not.toContain('<b>');
    expect(items[1].imageUrl).toBeUndefined();
  });

  test('Atom هم پارس می‌شود', () => {
    const atom = `<feed><entry><title>عنوان اتم</title><link href="https://a.example/1" rel="alternate"/>
      <summary>خلاصهٔ اتم</summary><published>2026-11-03T07:00:00Z</published></entry></feed>`;
    const items = parseFeed(atom);
    expect(items.length).toBe(1);
    expect(items[0].link).toBe('https://a.example/1');
  });

  test('extractItemImage: enclosure تصویری و protocol-relative', () => {
    expect(extractItemImage('<enclosure url="https://x.example/a.png" type="image/png"/>')).toBe('https://x.example/a.png');
    expect(extractItemImage('<media:thumbnail url="//img.example/b.jpg"/>')).toBe('https://img.example/b.jpg');
    expect(extractItemImage('<description>متن بدون عکس</description>')).toBeUndefined();
  });
});

describe('parseTelegramPage و extractMessageImage', () => {
  const tg = `<html><div class="tgme_widget_message_wrap">
    <div class="tgme_widget_message text_not_supported_wrap" data-post="kanal/123">
      <i class="tgme_widget_message_user_photo" style="background-image:url('https://cdn4.example/avatar.jpg')"></i>
      <div class="tgme_widget_message_text" dir="auto">بیانیهٔ امروز وزارت خارجه منتشر شد.</div>
      <time datetime="2026-11-03T08:10:00+00:00"></time>
    </div>
    <div class="tgme_widget_message text_not_supported_wrap js-message_inline" data-post="kanal/124">
      <a class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn4.example/photo.jpg')">
        <div class="tgme_widget_message_text" dir="auto">عکس کنفرانس خبری.</div>
      </a>
      <time datetime="2026-11-03T08:20:00+00:00"></time>
    </div>
  </div></html>`;

  test('پارس پیام‌ها با شناسه و متن و زمان', () => {
    const posts = parseTelegramPage(tg);
    expect(posts.length).toBe(2);
    expect(posts[0].dataPost).toBe('kanal/123');
    expect(posts[0].text).toContain('بیانیهٔ امروز');
    expect(posts[0].timeAttr).toBe('2026-11-03T08:10:00+00:00');
  });

  test('عکس پیام = photo_wrap؛ آواتار کانال عکس خبر حساب نمی‌شود', () => {
    const posts = parseTelegramPage(tg);
    expect(extractMessageImage(tg.split('kanal/123')[0] ? tg : tg)).not.toBeNull();
    expect(posts[1].imageUrl).toBe('https://cdn4.example/photo.jpg');
    // بلوک اول فقط آواتار دارد → بدون عکس خبر
    const block1 = tg.split('data-post="kanal/124"')[0];
    expect(extractMessageImage(block1)).toBeNull();
  });
});

describe('parseBingNewsRss', () => {
  test('استخراج عنوان و نشانی نتایج خبری', () => {
    const xml = `<rss><channel>
      <item><title>Result One About Talks</title><link>https://r.example/1</link></item>
      <item><title>Result Two About Talks</title><link>https://r.example/2</link></item>
      <item><title>بدون لینک</title></item>
    </channel></rss>`;
    const out = parseBingNewsRss(xml);
    expect(out.length).toBe(2);
    expect(out[0].url).toBe('https://r.example/1');
  });
});

// ---------- اعتبارسنجی خروجی مدل ----------

describe('validateOneShot', () => {
  test('خروجی استاندارد پذیرفته می‌شود', () => {
    const v = validateOneShot({ items: [{ refs: [1, 2], text: 'متن خبر', verdict: 'تأیید می‌شود' }], injectionWarnings: [] });
    expect(v).not.toBeNull();
    expect(v!.items[0].refs).toEqual([1, 2]);
  });
  test('بدون refs یا متن کوتاه → آیتم رد می‌شود (فهرست خالی، نه null)', () => {
    expect(validateOneShot({ items: [{ refs: [], text: 'متن' }] })!.items.length).toBe(0);
    expect(validateOneShot({ items: [{ refs: [1], text: 'x' }] })!.items.length).toBe(0);
    expect(validateOneShot({ items: 'نه آرایه' })).toBeNull();
  });
  test('شکل قدیمی title/summary هم ترکیب می‌شود', () => {
    const v = validateOneShot({ items: [{ refs: [3], title: 'تیتر', summary: 'خلاصه' }] });
    expect(v!.items[0].text).toContain('تیتر');
  });
});

describe('validateBatchTranslation', () => {
  test('شکل {"t":[...]} پذیرفته می‌شود', () => {
    const v = validateBatchTranslation({ t: [{ n: 1, fa: 'ترجمهٔ اول' }, { n: 2, fa: 'ترجمهٔ دوم' }] });
    expect(v!.length).toBe(2);
    expect(v![0].fa).toBe('ترجمهٔ اول');
  });
  test('شکل آرایهٔ خام و کلید translation هم پذیرفته می‌شود', () => {
    expect(validateBatchTranslation([{ n: 1, translation: 'ترجمه' }])!.length).toBe(1);
  });
  test('شمارهٔ نامعتبر رد می‌شود', () => {
    expect(validateBatchTranslation({ t: [{ n: 0, fa: 'xxx' }, { n: 999, fa: 'yyy' }] })).toBeNull();
  });
});

describe('jaccard', () => {
  test('همان خبر = ۱، بی‌ربط = نزدیک صفر', () => {
    expect(jaccard('توافق تجاری دو کشور امضا شد', 'توافق تجاری دو کشور امضا شد!')).toBe(1);
    expect(jaccard('جلسه شورای امنیت', 'قیمت جهانی گندم')).toBeLessThan(0.2);
  });
});

describe('planBotSends — برنامهٔ ارسال مسیر مدل', () => {
  const g = (content: string, lang = 'fa'): ReturnType<typeof makeGroup> => makeGroup(content, lang);
  function makeGroup(content: string, lang: string) {
    const it = item({ content, language: lang, region: lang === 'fa' ? 'ایران' : 'آمریکا' });
    return { primary: it, members: [it] };
  }
  const groups = [
    g('توافق تجاری جدید واشنگتن و پکن امضا شد'),
    g('European Union leaders meet in Brussels on sanctions', 'en'),
    g('جلسه شورای امنیت درباره آتش‌بس برگزار شد'),
  ];
  test('refs نامعتبر حذف می‌شود', () => {
    const r = planBotSends([{ refs: [99], text: 'متن خبر', verdict: '' }, { refs: [1], text: 'خبر معتبر', verdict: '' }], groups);
    expect(r.skippedBadRef).toBe(1);
    expect(r.sends.length).toBe(1);
    expect(r.sends[0].g).toBe(groups[0]);
  });
  test('دو آیتم با refs مشترک — رویداد دوباره ارسال نمی‌شود', () => {
    const r = planBotSends([
      { refs: [1], text: 'توافق تجاری واشنگتن و پکن امروز نهایی شد', verdict: '' },
      { refs: [1, 2], text: 'گزارش دیگر از همین نشست اروپایی', verdict: '' },
    ], groups);
    expect(r.skippedDupGroup).toBe(1);
    expect(r.sends.length).toBe(1);
  });
  test('دو متن بسیار مشابه از شماره‌های مختلف — فقط یکی ارسال می‌شود', () => {
    const r = planBotSends([
      { refs: [1], text: 'توافق تجاری جدید واشنگتن و پکن امروز امضا شد', verdict: '' },
      { refs: [3], text: 'توافق تجاری جدید واشنگتن و پکن امروز در پایتخت امضا شد', verdict: '' },
    ], groups);
    expect(r.skippedDupText).toBe(1);
    expect(r.sends.length).toBe(1);
  });
  test('ترتیب نهایی: خارجی اول، داخلی بعد — حتی اگر مدل برعکس داده', () => {
    const r = planBotSends([
      { refs: [1], text: 'خبر داخلی نخست', verdict: '' },
      { refs: [2], text: 'Brussels summit conclusions', verdict: '' },
      { refs: [3], text: 'خبر داخلی دوم', verdict: '' },
    ], groups);
    expect(r.sends[0].g).toBe(groups[1]); // خارجی اول
    expect(r.sends.map((s) => s.g)).toEqual([groups[1], groups[0], groups[2]]);
  });

  test('priorTexts — متن مشابه با پیام ارسال‌شدهٔ چرخهٔ قبل بلاک می‌شود', () => {
    const r = planBotSends([
      { refs: [1], text: 'توافق تجاری جدید واشنگتن و پکن امروز امضا شد', verdict: '' },
      { refs: [3], text: 'جلسهٔ کاملاً متفاوت دربارهٔ بودجه داخلی', verdict: '' },
    ], groups, { priorTexts: ['متن پیشین: توافق تجاری جدید واشنگتن و پکن امروز امضا شد'] });
    expect(r.skippedDupText).toBe(1);
    expect(r.sends.length).toBe(1);
    expect(r.sends[0].g).toBe(groups[2]);
  });
});

describe('unescapeEntities — مسیر ارسال بدون parse_mode', () => {
  test('موجودیت‌ها واکشی می‌شوند — دیگر «&amp;» عیناً نمایش داده نمی‌شود', () => {
    expect(unescapeEntities('قرارداد &amp; توافق')).toBe('قرارداد & توافق');
    expect(unescapeEntities('&quot;نقل&quot; &lt;تگ&gt;')).toBe('"نقل" <تگ>');
    expect(unescapeEntities('عدد &#x06F1;&#x06F2;')).toBe('عدد ۱۲');
  });
});

describe('composeNewsMessage — حالت عکس (سقف کپشن)', () => {
  test('با سقف ۹۵۰، «متن + حکم» همیشه زیر ۱۰۲۴ می‌ماند و ایموجی تنها نمی‌ماند', () => {
    const long = 'خبر بسیار بلند. '.repeat(150);
    const msg = composeNewsMessage({ sourceName: 'منبع', text: long, verdict: 'تأیید می‌شود' }, 950);
    expect(msg.length).toBeLessThanOrEqual(1024);
    expect(msg.endsWith('✅')).toBe(true); // حکم در همان کپشن می‌ماند
  });
  test('پیش‌فرض ۳۴۰۰ است — خبر کامل زیر سقف پیام بله (خواستهٔ کاربر ۶ نوامبر ۲۰۲۶)', () => {
    const long = 'خبر. '.repeat(400);
    const msg = composeNewsMessage({ sourceName: 'منبع', text: long });
    expect(msg.length).toBeGreaterThan(2000);
    expect(msg.length).toBeLessThanOrEqual(3460);
  });
});

// ---------- استخر کلیدهای جمینی و مقصدهای ارسال (نسخهٔ ۲ ربات) ----------

describe('parseGeminiKeys — استخر چندکلید جمینی', () => {
  test('آرایهٔ JSON کلیدها به ترتیب', () => {
    expect(parseGeminiKeys('["AQ.k1","AQ.k2"]')).toEqual(['AQ.k1', 'AQ.k2']);
  });
  test('جداشده با ویرگول/خط جدید + حذف تکراری', () => {
    expect(parseGeminiKeys('AQ.a, AQ.b\nAQ.a')).toEqual(['AQ.a', 'AQ.b']);
  });
  test('پشتیبان تک‌کلید GEMINI_API_KEY', () => {
    expect(parseGeminiKeys(undefined, 'AQ.env')).toEqual(['AQ.env']);
    expect(parseGeminiKeys('', 'AQ.env')).toEqual(['AQ.env']);
  });
  test('بدون هیچ کلیدی → خالی', () => {
    expect(parseGeminiKeys('', '')).toEqual([]);
    expect(parseGeminiKeys(undefined, undefined)).toEqual([]);
  });
});

describe('parseTargets — چت شخصی + کانال‌های ادمین‌شده', () => {
  test('چت و کانال‌ها یکتا و مرتب', () => {
    expect(parseTargets('1234', '@chan1, -1001234567\n@chan1')).toEqual(['1234', '@chan1', '-1001234567']);
  });
  test('بدون کانال → فقط چت شخصی', () => {
    expect(parseTargets('999', '')).toEqual(['999']);
    expect(parseTargets('999', undefined)).toEqual(['999']);
  });
});

describe('rotateAccounts — چرخش حساب‌های توییت', () => {
  const accs = [{ handle: 'a' }, { handle: 'b' }, { handle: 'c' }];
  test('پنجرهٔ چرخشی از cursor', () => {
    const { picked, nextCursor } = rotateAccounts(accs, 1, 2);
    expect(picked.map((a) => a.handle)).toEqual(['b', 'c']);
    expect(nextCursor).toBe(0);
  });
  test('بیشتر از طول فهرست → فهرست کامل بدون تکرار', () => {
    const { picked, nextCursor } = rotateAccounts(accs, 0, 5);
    expect(picked.map((a) => a.handle)).toEqual(['a', 'b', 'c']);
    expect(nextCursor).toBe(0);
  });
  test('فهرست خالی', () => {
    expect(rotateAccounts([], 0, 3).picked).toEqual([]);
  });
});

// ---------- توییت‌های ایکس ----------

const TWEET_HTML = `<html><head>
<link href="https://pbs.twimg.com/profile_images/1580000/test_avatar_normal.jpg" rel="shortcut icon"/>
</head><body>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"timeline":{"entries":[
{"content":{"tweet":{"id_str":"1711111111111111111","full_text":"Breaking: talks resume in Geneva tomorrow &amp; more https://t.co/xyz","created_at":"Tue Nov 04 09:30:00 +0000 2026","user":{"screen_name":"Reuters"}}}},
{"content":{"tweet":{"id_str":"1712222222222222222","full_text":"Statement on sanctions package released today https://t.co/ab2","created_at":"Tue Nov 04 10:05:00 +0000 2026","user":{"screen_name":"Reuters"}}}},
{"content":{"tweet":{"id_str":"1713333333333333333","full_text":"Old post from last week","created_at":"Mon Oct 27 08:00:00 +0000 2026","user":{"screen_name":"Reuters"}}}}
]}}}}</script>
</body></html>`;

describe('extractTweetsFromHtml — پارس خط زمانی سندیکاسیون ایکس', () => {
  test('توییت‌های بیرونی استخراج و پاک‌سازی می‌شوند (بدون t.co، واکشی موجودیت)', () => {
    const ts = extractTweetsFromHtml(TWEET_HTML, 'Reuters');
    expect(ts.length).toBe(3);
    expect(ts[0].id).toBe('1711111111111111111');
    expect(ts[0].text).toContain('Geneva tomorrow & more');
    expect(ts[0].text).not.toContain('t.co');
    expect(ts[0].createdAt).not.toBeNull();
  });
  test('بدون __NEXT_DATA__ → مسیر پشتیبان HTML خالی است ولی خطا نمی‌دهد', () => {
    expect(extractTweetsFromHtml('<div class="tweet">no data</div>', 'Reuters')).toEqual([]);
    expect(extractTweetsFromHtml('', 'Reuters')).toEqual([]);
  });
});

describe('extractAvatarUrl — عکس پروفایل صاحب حساب', () => {
  test('نسخهٔ ۴۰۰x400 جای _normal ترجیح داده می‌شود', () => {
    expect(extractAvatarUrl(TWEET_HTML)).toBe('https://pbs.twimg.com/profile_images/1580000/test_avatar_400x400.jpg');
  });
  test('بدون عکس پروفایل → undefined', () => {
    expect(extractAvatarUrl('<html></html>')).toBeUndefined();
  });
});

describe('freshTweets — ضدتکرار توییت بین‌چرخه‌ای', () => {
  const now = new Date('2026-11-04T11:00:00Z').getTime();
  const tw = (id: string, daysAgo: number): { id: string; text: string; createdAt: Date | null } => ({
    id,
    text: `Fresh statement number ${id} about negotiations`,
    createdAt: new Date(now - daysAgo * 3600_000),
  });
  const st: BotState = { ...emptyState(), sentIds: { 'tw-reuters-999': now } };
  const tweets = [tw('999', 1), tw('888', 1), tw('777', 50)]; // 999 ارسال‌شده؛ 777 خارج از پنجره
  test('توییت ارسال‌شده و خارج از پنجره رد می‌شود؛ تازه باقی می‌ماند', () => {
    const { fresh } = freshTweets(st, tweets, 'Reuters', [], { windowHours: 3, nowMs: now, limit: 10 });
    expect(fresh.map((t) => t.id)).toEqual(['888']);
  });
  test('blocked شامل تکراری و قدیمی است', () => {
    const { blocked } = freshTweets(st, tweets, 'Reuters', [], { windowHours: 3, nowMs: now, limit: 10 });
    expect(blocked).toBe(2);
  });
  test('سقف limit رعایت می‌شود', () => {
    const { fresh } = freshTweets(st, [tw('1', 1), tw('2', 1), tw('3', 1)], 'Reuters', [], { windowHours: 3, nowMs: now, limit: 2 });
    expect(fresh.length).toBe(2);
  });
});

// ---------- دسته‌ها، تجمیع منابع و پرامپت‌های ویرایش‌شده (۵ نوامبر ۲۰۲۶) ----------
import {
  parseCategoryConfig, parseBotConfig, parsePromptFile, applyPromptOverrides, loadPromptOverrides,
  aggregateSourceLabel, composeGroupMessage, DEFAULT_SYSTEM_BOT_ONESHOT, DEFAULT_SYSTEM_BOT_TRANSLATE,
  getOneshotPrompt, getTranslatePrompt, type CategoryRouting,
} from '../bot/bot';
import { writeFileSync, rmSync } from 'node:fs';

describe('parseCategoryConfig — پیکربندی توکن هر بخش خبری', () => {
  test('پیکربندی معتبر پارس می‌شود', () => {
    const raw = JSON.stringify({
      sports: { token: '111:abc', targets: ['@sports_ch', '12345'] },
      energy: { token: '222:def', targets: ['-100999'], title: 'انرژی' },
    });
    const cfg = parseCategoryConfig(raw);
    expect(Object.keys(cfg).sort()).toEqual(['energy', 'sports']);
    expect(cfg.sports.targets).toEqual(['@sports_ch', '12345']);
    expect(cfg.energy.title).toBe('انرژی');
  });
  test('دستهٔ ناقص (بی‌توکن یا بی‌مقصد) حذف می‌شود', () => {
    const raw = JSON.stringify({ aa: { token: '', targets: ['x'] }, bb: { token: 't', targets: [] }, cc: { token: 't', targets: ['y'] } });
    const cfg = parseCategoryConfig(raw);
    expect(Object.keys(cfg)).toEqual(['cc']);
  });
  test('JSON خراب/خالی = پیکربندی تهی (بدون پرتاب خطا)', () => {
    expect(parseCategoryConfig('not-json')).toEqual({});
    expect(parseCategoryConfig('')).toEqual({});
    expect(parseCategoryConfig('[1,2]')).toEqual({});
  });
  test('اسلاگ نامعتبر پذیرفته نمی‌شود', () => {
    const raw = JSON.stringify({ 'Bad Slug!': { token: 't', targets: ['x'] }, ok_slug: { token: 't', targets: ['x'] } });
    expect(Object.keys(parseCategoryConfig(raw))).toEqual(['ok_slug']);
  });
});

describe('aggregateSourceLabel — تجمیع چند خبرگزاری در یک پیام', () => {
  test('تک‌منبع = نام همان منبع (بدون پیشوند)', () => {
    expect(aggregateSourceLabel(['بی‌بی‌سی'])).toBe('بی‌بی‌سی');
  });
  test('چند منبع = «خبرگزاری‌های A و B و C» — خواستهٔ صریح کاربر', () => {
    expect(aggregateSourceLabel(['تی‌آر‌تی', 'بی‌بی‌سی', 'رویترز'])).toBe('خبرگزاری‌های تی‌آر‌تی و بی‌بی‌سی و رویترز');
  });
  test('تکرار نام‌ها حذف و سقف ۵ نام با «و …»', () => {
    expect(aggregateSourceLabel(['A', 'A', 'B'])).toBe('خبرگزاری‌های A و B');
    const many = aggregateSourceLabel(['۱', '۲', '۳', '۴', '۵', '۶', '۷']);
    expect(many).toBe('خبرگزاری‌های ۱ و ۲ و ۳ و ۴ و ۵ و …');
  });
  test('لیست خالی = منبع ناشناس', () => {
    expect(aggregateSourceLabel(['', '  '])).toBe('منبع ناشناس');
  });
  test('composeGroupMessage پیام تجمیع‌شده با متن و حکم می‌سازد', () => {
    const g = { members: [{ sourceName: 'TRT' }, { sourceName: 'BBC' }] };
    const msg = composeGroupMessage(g, 'متن خبر مشترک', 'تأیید می‌شود');
    expect(msg).toContain('خبرگزاری‌های TRT و BBC: متن خبر مشترک');
    expect(msg).toContain('✅');
  });
});

describe('پرامپت‌های ویرایش‌شده از اپلیکیشن', () => {
  test('parsePromptFile فیلدهای درست/نادرست را جداسازی می‌کند', () => {
    const pf = parsePromptFile('{"oneshot":"متن","updatedAt":"2026-11-05"}');
    expect(pf.oneshot).toBe('متن');
    expect(pf.translate).toBeUndefined();
    expect(parsePromptFile('bad').oneshot).toBeUndefined();
  });
  test('applyPromptOverrides فقط متن بلند معتبر را می‌پذیرد', () => {
    const r1 = applyPromptOverrides({ oneshot: 'کوتاه', translate: 'x' });
    expect(r1.oneshot).toBe(false);
    const r2 = applyPromptOverrides({ oneshot: 'ش'.repeat(500) });
    expect(r2.oneshot).toBe(true);
    expect(getOneshotPrompt()).toBe('ش'.repeat(500));
    // بازگرداندن به پیش‌فرض برای بقیهٔ تست‌ها
    applyPromptOverrides({ oneshot: DEFAULT_SYSTEM_BOT_ONESHOT, translate: DEFAULT_SYSTEM_BOT_TRANSLATE });
    expect(getOneshotPrompt()).toBe(DEFAULT_SYSTEM_BOT_ONESHOT);
  });
  test('loadPromptOverrides فایل واقعی bot/prompts.json را اعمال می‌کند', () => {
    const tmp = 'bot/__test-prompts.json';
    writeFileSync(tmp, JSON.stringify({ oneshot: 'پ'.repeat(450) }), 'utf8');
    loadPromptOverrides(tmp);
    expect(getOneshotPrompt()).toBe('پ'.repeat(450));
    rmSync(tmp);
    loadPromptOverrides(tmp); // فایل نبود → بدون خطا، بدون تغییر
    applyPromptOverrides({ oneshot: DEFAULT_SYSTEM_BOT_ONESHOT, translate: DEFAULT_SYSTEM_BOT_TRANSLATE });
  });
  test('پرامپت سوپر حرفه‌ای قواعد کلیدی کاربر را دارد', () => {
    expect(DEFAULT_SYSTEM_BOT_ONESHOT).toContain('cat');
    expect(DEFAULT_SYSTEM_BOT_ONESHOT).toContain('تجمیع');
    expect(DEFAULT_SYSTEM_BOT_TRANSLATE).toContain('تمام‌وکمال');
    expect(DEFAULT_SYSTEM_BOT_TRANSLATE).toContain('خلاصه‌سازی');
  });
});

describe('parseBotConfig — فهرست دسته‌های مجاز', () => {
  test('دسته‌های معتبر استخراج می‌شوند', () => {
    const c = parseBotConfig('{"categories":[{"slug":"politics","title":"سیاسی"},{"slug":"sports","title":"ورزشی"}]}');
    expect(c.categories).toEqual([{ slug: 'politics', title: 'سیاسی' }, { slug: 'sports', title: 'ورزشی' }]);
  });
  test('اسلاگ خراب حذف؛ JSON خراب = تهی', () => {
    expect(parseBotConfig('{"categories":[{"slug":"BAD!","title":"x"},{"slug":"ok","title":"y"}]}').categories.map((c) => c.slug)).toEqual(['ok']);
    expect(parseBotConfig('nope').categories).toEqual([]);
  });
});

describe('validateOneShot با فهرست دسته‌های مجاز', () => {
  test('cat مجاز حفظ و نامعتبر حذف می‌شود', async () => {
    const { validateOneShot } = await import('../bot/bot');
    const out = validateOneShot(
      { items: [{ refs: [1], text: 'خبر', verdict: '', cat: 'sports' }, { refs: [2], text: 'خبر۲', verdict: '', cat: 'hacked' }] },
      ['sports', 'general'],
    );
    expect(out?.items[0].cat).toBe('sports');
    expect(out?.items[1].cat).toBeUndefined();
  });
});

describe('نردبان ارسال عکس — fetchImageBytes', () => {
  test('URL نامعتبر = خطای شفاف، بدون پرتاب', async () => {
    const { fetchImageBytes } = await import('../bot/bot');
    const r = await fetchImageBytes('https://example.invalid/no-image.jpg', 3000);
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
  test('URL غیرتصویری (متن کوچک) رد می‌شود', async () => {
    const { fetchImageBytes } = await import('../bot/bot');
    const r = await fetchImageBytes('https://example.com', 5000);
    expect(r.ok).toBe(false);
  });
});
