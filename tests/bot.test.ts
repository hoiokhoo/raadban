/**
 * تست‌های واحد رصدبان‌بات (bot/bot.ts) — همهٔ توابع خالص
 * قواعد: قالب پیام نسخهٔ ۴، ضدتکرار سه‌لایه، تجمیع، خارجی اول، پارس فید/تلگرام، اعتبارسنج مدل
 */
import { describe, expect, test } from 'bun:test';
import {
  cleanNewsText, clusterItems, composeNewsMessage, emptyState, extractItemImage,
  extractMessageImage, foreignFirstOrder, isAlreadySent, isForeignItem, isLikelyForeign,
  jaccard, makeIds, mergeSentState, normalizeTitle, parseBingNewsRss, parseFeed,
  parseTelegramPage, splitForBale, splitPhotoCaption, validateBatchTranslation,
  validateOneShot, verdictToEmoji, type BotItem,
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
