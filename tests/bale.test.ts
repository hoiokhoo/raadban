/**
 * تست‌های واحد بات بله و کانال خبری — بدون شبکه واقعی
 * نسخهٔ ۴: قالب «منبع: متن»، ایموجی قضاوت، ضدتکرار، تجمیع، اولویت خارجی، توییت بدون تصرف
 * اجرا: bun test tests/bale.test.ts
 */
import { describe, test, expect } from 'bun:test';
import { splitForBale, splitPhotoCaption } from '../src/lib/bale-bot';
import { extractItemImage } from '../src/lib/connectors/rss';
import {
  composeNewsMessageV4,
  composeRawFallbackHeader,
  composeRawItemMessage,
  composeDailyReport,
  validateBatchTranslation,
  cleanNewsText,
  newsTextSimilarity,
  SYSTEM_BALE_ONESHOT,
  SYSTEM_BALE_BATCH_TRANSLATE,
  sourceDisplayName,
  verdictToEmoji,
  foreignFirstOrder,
  mergeSentIds,
  groupFallbackPosts,
  isTweetPost,
  tweetMessageText,
} from '../src/lib/bale-digest';
import type { PostRow } from '../src/lib/bale-digest';

// ---------- تفکیک پیام بلند ----------

describe('splitForBale — تفکیک پیام به قطعه‌های مجاز', () => {
  test('متن کوتاه → یک قطعه', () => {
    expect(splitForBale('سلام دنیا')).toEqual(['سلام دنیا']);
  });

  test('متن بلند → چند قطعه با سقف ۳۵۰۰ نویسه', () => {
    const text = Array.from({ length: 2000 }, (_, i) => `خط ${i}`).join('\n');
    const parts = splitForBale(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(3500);
    expect(parts.join('\n').replace(/\s+/g, ' ').length).toBeGreaterThanOrEqual(text.replace(/\s+/g, ' ').length - 10);
  });

  test('برش ترجیحاً روی مرز پاراگراف است', () => {
    const para = 'پاراگراف. '.repeat(200);
    const text = `${para}\n\n${para}`;
    const parts = splitForBale(text, 2500);
    expect(parts.length).toBe(2);
    expect(parts[0].endsWith('پاراگراف. ')).toBe(true);
  });

  test('متن بدون مرز خط → برش سخت روی سقف', () => {
    const text = 'ا'.repeat(8000);
    const parts = splitForBale(text);
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(3500);
    expect(parts.join('').length).toBe(8000);
  });
});

// ---------- کپشن عکس ----------

describe('splitPhotoCaption — سقف کپشن عکس', () => {
  test('کپشن کوتاه → کامل در کپشن، بدون باقی‌مانده', () => {
    const r = splitPhotoCaption('تیتر خبر\n\nخلاصهٔ کوتاه.');
    expect(r.caption).toBe('تیتر خبر\n\nخلاصهٔ کوتاه.');
    expect(r.rest).toBe('');
  });

  test('کپشن بلند → برش روی سقف ۱۰۲۴ و انتقال باقی به پیام جدا', () => {
    const cap = 'خط خبری. '.repeat(300);
    const r = splitPhotoCaption(cap);
    expect(r.caption.length).toBeLessThanOrEqual(1024);
    expect(r.rest.length).toBeGreaterThan(0);
    expect(r.caption.length + r.rest.length).toBeGreaterThanOrEqual(cap.replace(/\s+/g, ' ').trim().length - 5);
  });
});

// ---------- استخراج عکس از خوراک RSS ----------

describe('extractItemImage — تصویر شاخص آیتم خوراک', () => {
  test('media:content', () => {
    const item = `<item><title>t</title><media:content url="https://cdn.example.com/pic.jpg" medium="image"/></item>`;
    expect(extractItemImage(item)).toBe('https://cdn.example.com/pic.jpg');
  });

  test('enclosure تصویری', () => {
    const item = `<item><enclosure url="https://img.example.com/a.png" type="image/png" length="100"/></item>`;
    expect(extractItemImage(item)).toBe('https://img.example.com/a.png');
  });

  test('اولین <img> در توضیحات HTML', () => {
    const item = `<item><description><![CDATA[متن خبر <img src="https://s.example/x.jpg" alt=""> ادامه]]></description></item>`;
    expect(extractItemImage(item)).toBe('https://s.example/x.jpg');
  });

  test('URL پروتکل‌نسبی به https تبدیل می‌شود', () => {
    const item = `<item><media:thumbnail url="//cdn.example.com/i.webp"/></item>`;
    expect(extractItemImage(item)).toBe('https://cdn.example.com/i.webp');
  });

  test('بدون تصویر → undefined', () => {
    expect(extractItemImage('<item><title>t</title><description>فقط متن</description></item>')).toBeUndefined();
  });
});

// ---------- نسخهٔ ۴: قالب «منبع: متن» + ایموجی قضاوت ----------

describe('composeNewsMessageV4 — قالب مینیمال خواستهٔ کاربر', () => {
  test('فقط «نام منبع: متن خبر» — بدون پیوند، زمان، نقل‌قول، امضا و توضیح راستی‌آزمایی', () => {
    const msg = composeNewsMessageV4({
      sourceName: 'رویترز',
      text: 'وزرای خارجهٔ دو کشور برای گفت‌وگو دربارهٔ آتش‌بس در ژنو دیدار کردند.',
    });
    expect(msg).toContain('رویترز:');
    expect(msg).toContain('آتش‌بس در ژنو دیدار کردند');
    // حذف همهٔ واژه‌های اضافهٔ نسخهٔ ۳
    expect(msg).not.toContain('پیوند');
    expect(msg).not.toContain('<a href');
    expect(msg).not.toContain('🔹');
    expect(msg).not.toContain('☰');
    expect(msg).not.toContain('💬');
    expect(msg).not.toContain('راستی‌آزمایی');
    expect(msg).not.toContain('حکم:');
    expect(msg).not.toContain('رصدبان');
  });

  test('تأیید → فقط تیک سبز؛ مورد شک → فقط هشدار زرد؛ بدون شواهد → هیچ ایموجی', () => {
    const yes = composeNewsMessageV4({ sourceName: 'منبع', text: 'متن خبر', verdict: 'تأیید می‌شود' });
    expect(yes).toContain('✅');
    expect(yes).not.toContain('⚠️');

    const doubt = composeNewsMessageV4({ sourceName: 'منبع', text: 'متن خبر', verdict: 'مورد شک' });
    expect(doubt).toContain('⚠️');
    expect(doubt).not.toContain('✅');

    const none = composeNewsMessageV4({ sourceName: 'منبع', text: 'متن خبر', verdict: '' });
    expect(none).not.toContain('✅');
    expect(none).not.toContain('⚠️');

    const insufficient = composeNewsMessageV4({ sourceName: 'منبع', text: 'متن خبر', verdict: 'تأییدنشده (شواهد ناکافی)' });
    expect(insufficient).not.toContain('✅');
    expect(insufficient).not.toContain('⚠️');
  });

  test('کاراکترهای HTML فرار داده می‌شوند', () => {
    const msg = composeNewsMessageV4({
      sourceName: 'منبع <b>خطرناک</b>',
      text: 'متن با <script> مخرب و & علامت',
    });
    expect(msg).not.toContain('<script>');
    expect(msg).not.toContain('<b>خطرناک');
    expect(msg).toContain('&lt;script&gt;');
    expect(msg).toContain('&amp;');
  });

  test('نام خالی منبع → «منبع ناشناس»', () => {
    const msg = composeNewsMessageV4({ sourceName: '', text: 'متن' });
    expect(msg).toContain('منبع ناشناس:');
  });
});

describe('verdictToEmoji — نگاشت قضاوت به ایموجی تنها', () => {
  test('تأیید → ✅', () => {
    expect(verdictToEmoji('تأیید می‌شود')).toBe('✅');
    expect(verdictToEmoji('تأییدشده_با_شواهد_کافی')).toBe('✅');
  });
  test('شک/رد/گمراه‌کننده → ⚠️', () => {
    expect(verdictToEmoji('مورد شک')).toBe('⚠️');
    expect(verdictToEmoji('رد می‌شود')).toBe('⚠️');
    expect(verdictToEmoji('مورد اختلاف')).toBe('⚠️');
    expect(verdictToEmoji('گمراه‌کننده')).toBe('⚠️');
  });
  test('بدون شواهد/خالی → بدون ایموجی', () => {
    expect(verdictToEmoji('')).toBe('');
    expect(verdictToEmoji(undefined)).toBe('');
    expect(verdictToEmoji('تأییدنشده (شواهد ناکافی)')).toBe('');
  });
});

describe('sourceDisplayName — نام نمایشی منبع', () => {
  test('توییت: پسوند «— ایکس (@handle)» حذف می‌شود', () => {
    expect(sourceDisplayName('دونالد ترامپ — ایکس (@realDonaldTrump)', 'twitter')).toBe('دونالد ترامپ');
    expect(sourceDisplayName('ایلان ماسک — ایکس (@elonmusk)', 'twitter')).toBe('ایلان ماسک');
  });
  test('منابع غیرتوییتری دست‌نخورده می‌مانند', () => {
    expect(sourceDisplayName('خبرگزاری مهر', 'rss')).toBe('خبرگزاری مهر');
    expect(sourceDisplayName('دونالد ترامپ — ایکس (@x)', 'rss')).toBe('دونالد ترامپ — ایکس (@x)');
  });
});

// ---------- اولویت خارجی/داخلی ----------

describe('foreignFirstOrder — خارجی‌ها اول، داخلی بعد؛ ترتیب درون‌گروه پایدار', () => {
  test('خبر انگلیسی و عربی قبل از فارسی می‌آیند', () => {
    const items = [
      { id: 1, lang: 'fa' },
      { id: 2, lang: 'en' },
      { id: 3, lang: 'ar' },
      { id: 4, lang: 'fa' },
    ];
    const out = foreignFirstOrder(items, (x) => x.lang);
    expect(out.map((x) => x.id)).toEqual([2, 3, 1, 4]);
  });

  test('مرتب‌سازی پایدار است (ترتیب نسبی داخل هر گروه حفظ می‌شود)', () => {
    const items = [
      { id: 1, lang: 'en' },
      { id: 2, lang: 'fa' },
      { id: 3, lang: 'en' },
      { id: 4, lang: 'fa' },
    ];
    const out = foreignFirstOrder(items, (x) => x.lang);
    expect(out.map((x) => x.id)).toEqual([1, 3, 2, 4]);
  });

  test('زبان خالی → داخلی حساب می‌شود', () => {
    const out = foreignFirstOrder([{ id: 1, lang: '' }], (x) => x.lang);
    expect(out.map((x) => x.id)).toEqual([1]);
  });
});

// ---------- ضدتکرار بین‌چرخه‌ای ----------

describe('mergeSentIds — ادغام و هرس فهرست ارسالی‌ها', () => {
  test('جدیدها اول، تکراری‌ها حذف، سقف حفظ می‌شود', () => {
    const merged = mergeSentIds(['a', 'b', 'c'], ['c', 'd']);
    expect(merged).toEqual(['c', 'd', 'a', 'b']);
  });

  test('هرس به سقف — جدیدترین‌ها می‌مانند', () => {
    const existing = Array.from({ length: 1500 }, (_, i) => `old-${i}`);
    const merged = mergeSentIds(existing, ['new-1', 'new-2']);
    expect(merged.length).toBe(1500);
    expect(merged[0]).toBe('new-1');
    expect(merged).not.toContain('old-1499');
  });

  test('شناسهٔ خالی نادیده گرفته می‌شود', () => {
    expect(mergeSentIds(['a'], ['', 'a', 'b'])).toEqual(['a', 'b']);
  });
});

// ---------- تجمیع خبرهای یکسان (مسیر شکست) ----------

describe('groupFallbackPosts — گروه‌بندی بر پایهٔ خوشهٔ واقعی', () => {
  const row = (id: string, over: Partial<PostRow> = {}): PostRow => ({
    id, content: 'متن', url: null, publishedAt: new Date('2026-11-02T10:00:00Z'),
    language: 'fa', translationFa: null, translationSummary: null,
    source: { name: 'منبع', platform: 'rss' }, ...over,
  });

  test('اعضای یک خوشه → یک گروه با نمایندهٔ «اولین انتشار»', () => {
    const posts = [
      row('b', { publishedAt: new Date('2026-11-02T11:00:00Z'), source: { name: 'رسانهٔ دوم', platform: 'rss' } }),
      row('a', { publishedAt: new Date('2026-11-02T10:00:00Z'), source: { name: 'رسانهٔ اول', platform: 'rss' } }),
      row('c', { publishedAt: new Date('2026-11-02T12:00:00Z') }),
    ];
    const clusterOf = new Map([['a', 'c7'], ['b', 'c7']]); // c بی‌خوشه
    const groups = groupFallbackPosts(posts, clusterOf);
    expect(groups.length).toBe(2);
    const clusterGroup = groups.find((g) => g.memberIds.length === 2)!;
    expect(clusterGroup.primary.id).toBe('a'); // اولین انتشار = نماینده
    expect(clusterGroup.sourceNames).toEqual(['رسانهٔ اول', 'رسانهٔ دوم']);
    expect(clusterGroup.memberIds).toEqual(['a', 'b']);
  });

  test('خبر بی‌خوشه → گروه تک‌نفره', () => {
    const posts = [row('s1')];
    const groups = groupFallbackPosts(posts, new Map());
    expect(groups.length).toBe(1);
    expect(groups[0].primary.id).toBe('s1');
    expect(groups[0].memberIds).toEqual(['s1']);
  });

  test('ترتیب گروه‌ها: تازه‌ترین نماینده اول', () => {
    const posts = [
      row('old', { publishedAt: new Date('2026-11-02T08:00:00Z') }),
      row('new', { publishedAt: new Date('2026-11-02T12:00:00Z') }),
    ];
    const groups = groupFallbackPosts(posts, new Map());
    expect(groups.map((g) => g.primary.id)).toEqual(['new', 'old']);
  });
});

// ---------- توییت: ترجمهٔ کامل بدون تصرف ----------

describe('isTweetPost + tweetMessageText — توییت بدون دخل و تصرف', () => {
  const tweet = (over: Partial<PostRow> = {}): PostRow => ({
    id: 't1', content: 'Breaking: talks resume tomorrow at noon.', url: null,
    publishedAt: new Date(), language: 'en', translationFa: null, translationSummary: null,
    source: { name: 'دونالد ترامپ — ایکس (@realDonaldTrump)', platform: 'twitter' },
    ...over,
  });

  test('شناسایی توییت از پلتفرم منبع', () => {
    expect(isTweetPost(tweet())).toBe(true);
    expect(isTweetPost(tweet({ source: { name: 'مهر', platform: 'rss' } }))).toBe(false);
  });

  test('ترجمهٔ موجود کامل و بدون خلاصه‌سازی به‌کار می‌رود', () => {
    const full = 'از فردا ظهر مذاکرات از سر گرفته می‌شود — همهٔ جزئیات همان متن اصلی.';
    const msg = tweetMessageText(tweet({ translationFa: full }));
    expect(msg).toBe(full);
  });

  test('بدون ترجمه → متن اصلیِ پاک‌شده (بدون ساختگی)', () => {
    expect(tweetMessageText(tweet())).toBe('Breaking: talks resume tomorrow at noon.');
  });

  test('پیام توییت با نام صاحب حساب (بدون پسوند ایکس) قالب می‌شود', () => {
    const msg = composeRawItemMessage(tweet({ translationFa: 'متن کامل ترجمه‌شدهٔ توییت' }));
    expect(msg).toContain('دونالد ترامپ: متن کامل ترجمه‌شدهٔ توییت');
    expect(msg).not.toContain('@realDonaldTrump');
    expect(msg).not.toContain('ایکس');
  });
});

// ---------- مسیر شکست مدل: هر خبر در پیام جداگانه ----------

describe('composeRawFallbackHeader + composeRawItemMessage — هر خبر یک پیام', () => {
  const row = (over: Partial<PostRow> = {}): PostRow => ({
    id: 'p1', content: 'خبر آزمایشی مهم دربارهٔ مذاکرات', url: null, publishedAt: new Date('2026-10-31T12:00:00Z'),
    language: 'fa', translationFa: null, translationSummary: null, source: { name: 'خبرگزاری الف', platform: 'rss' },
    ...over,
  });

  test('سرصفحه: خطای صریح + تعداد خبر — کوتاه و بدون واژهٔ اضافه', () => {
    const msg = composeRawFallbackHeader({
      windowLabel: '۹ آبان ۱۴۰۵ — از ساعت ۱۵:۰۰',
      aiError: 'همه مدل‌ها خطا دادند',
      count: 12,
    });
    expect(msg).toContain('۹ آبان ۱۴۰۵');
    expect(msg).toContain('خلاصه‌سازی هوشمند ناموفق بود');
    expect(msg).toContain('همه مدل‌ها خطا دادند');
    expect(msg).toContain('۱۲');
  });

  test('پیام هر خبر: «نام منبع: متن» — بدون ساختگی و بدون پیوند', () => {
    const msg = composeRawItemMessage(row());
    expect(msg).toContain('خبرگزاری الف:');
    expect(msg).toContain('خبر آزمایشی مهم دربارهٔ مذاکرات');
    expect(msg).not.toContain('پیوند');
    expect(msg).not.toContain('<a href');
    expect(msg).not.toContain('undefined');
  });

  test('ترجمهٔ فارسی موجود بر تیتر خام مقدم است', () => {
    const msg = composeRawItemMessage(row({ translationFa: 'مذاکرات آتش‌بس وارد مرحله تازه شد' }));
    expect(msg).toContain('مذاکرات آتش‌بس وارد مرحله تازه شد');
    expect(msg).not.toContain('خبر آزمایشی مهم');
  });

  test('تگ‌های HTML و موجودیت‌های دوبله در تیتر خام پاک می‌شوند', () => {
    const msg = composeRawItemMessage(row({
      content: '<a href="https://news.google.com/rss/">Feud Erupts</a> in Michigan &amp;#8216;debate&amp;#8217; <b>test</b>',
    }));
    expect(msg).not.toContain('<a href');
    expect(msg).not.toContain('&amp;#8216;');
    expect(msg).not.toContain('<b>test</b>');
    expect(msg).toContain('‘debate’');
  });
});

// ---------- ترجمهٔ دسته‌جمعی ----------

describe('validateBatchTranslation — پذیرش همهٔ شکل‌های رایج خروجی مدل', () => {
  test('شکل استاندارد {"t":[...]}', () => {
    const out = validateBatchTranslation({ t: [{ n: 1, fa: 'تیتر اول' }, { n: 2, fa: 'تیتر دوم' }] });
    expect(out).toEqual([{ n: 1, fa: 'تیتر اول' }, { n: 2, fa: 'تیتر دوم' }]);
  });

  test('شکل جایگزین آرایهٔ خام و کلید translation', () => {
    expect(validateBatchTranslation([{ n: 3, translation: 'سوم' }])).toEqual([{ n: 3, fa: 'سوم' }]);
  });

  test('ردّ ورودی نامعتبر: شمارهٔ کسری، ترجمهٔ خیلی کوتاه، شکل ناشناخته', () => {
    expect(validateBatchTranslation({ t: [{ n: 1.5, fa: 'نامعتبر' }, { n: 2, fa: 'x' }, { fa: 'بی‌شماره' }] })).toBeNull();
    expect(validateBatchTranslation('رشته')).toBeNull();
    expect(validateBatchTranslation({ foo: 1 })).toBeNull();
  });
});

describe('cleanNewsText — پاک‌سازی تیتر فیدها', () => {
  test('حذف تگ + واکشی موجودیت ساده', () => {
    expect(cleanNewsText('<b>تیتر</b> مهم &amp; کوتاه')).toBe('تیتر مهم & کوتاه');
  });

  test('واکشی دوبلهٔ موجودیت‌های عددی (گوگل‌نیوز)', () => {
    expect(cleanNewsText('&amp;#8216;debate&amp;#8217;')).toBe('‘debate’');
    expect(cleanNewsText('&lt;a href="x"&gt;متن&lt;/a&gt;')).toBe('<a href="x">متن</a>');
  });

  test('فشرده‌سازی فاصله‌ها', () => {
    expect(cleanNewsText('خط   اول\n\nخط\tبعد')).toBe('خط اول خط بعد');
  });
});

describe('SYSTEM_BALE_BATCH_TRANSLATE — پرامپت ترجمهٔ دسته‌جمعی', () => {
  test('همهٔ شماره‌ها + فقط ترجمه + خروجی JSON', () => {
    expect(SYSTEM_BALE_BATCH_TRANSLATE).toContain('ترجمهٔ فارسی روان');
    expect(SYSTEM_BALE_BATCH_TRANSLATE).toContain('همهٔ» شماره‌های ورودی');
    expect(SYSTEM_BALE_BATCH_TRANSLATE).toContain('"fa"');
  });
});

// ---------- گزارش جامع روزانه ----------

describe('composeDailyReport — گزارش جامع پایان روز', () => {
  test('سرصفحه + آمار + رویدادها + راستی‌آزمایی روز', () => {
    const msg = composeDailyReport({
      dayLabel: '۹ آبان ۱۴۰۵',
      items: [
        { title: 'رویداد اول', summary: 'خلاصهٔ رویداد اول در دو جمله.', sourceNames: ['رویترز'] },
        { title: 'رویداد دوم', summary: 'خلاصهٔ رویداد دوم.', sourceNames: ['بی‌بی‌سی', 'الجزیره'] },
      ],
      factchecks: [{ claim: 'ادعای کلیدی روز', verdict: 'مورد اختلاف', reason: 'منابع روایت‌های متفاوت دارند.' }],
      stats: { sources: 42, posts: 120, claims: 8 },
      searchNote: 'جست‌وجوی وب برای ۲ ادعا انجام شد',
    });
    expect(msg).toContain('🗂 <b>گزارش جامع روزانهٔ رصدبان</b> — ۹ آبان ۱۴۰۵');
    expect(msg).toContain('۴۲ منبع فعال');
    expect(msg).toContain('رویداد اول');
    expect(msg).toContain('🧾 <b>راستی‌آزمایی روز</b>');
    expect(msg).toContain('مورد اختلاف');
  });

  test('شکست مدل → یادداشت صریح', () => {
    const msg = composeDailyReport({
      dayLabel: 'روز آزمایشی',
      items: [], factchecks: [],
      stats: { sources: 3, posts: 10, claims: 0 },
      aiFailed: true, aiError: 'زنجیره خطا داد',
    });
    expect(msg).toContain('هیچ محتوای ساختگی‌ای ساخته نشد');
    expect(msg).toContain('زنجیره خطا داد');
  });
});

// ---------- پرامپت نسخهٔ ۴ ----------

describe('SYSTEM_BALE_ONESHOT نسخهٔ ۴ — قواعد حیاتی خواستهٔ کاربر', () => {
  test('قالب پیام: فقط متن خبر، بدون نقل‌قول و توضیح', () => {
    expect(SYSTEM_BALE_ONESHOT).toContain('بدون هر واژهٔ اضافه');
    expect(SYSTEM_BALE_ONESHOT).toContain('بدون نقل‌قول جداگانه');
  });

  test('تجمیع و تکراری‌زدایی با refs', () => {
    expect(SYSTEM_BALE_ONESHOT).toContain('تجمیع و تکراری‌زدایی');
    expect(SYSTEM_BALE_ONESHOT).toContain('refs');
    expect(SYSTEM_BALE_ONESHOT).toContain('هیچ رویداد دوبار آورده نشود');
  });

  test('توییت بدون دخل و تصرف', () => {
    expect(SYSTEM_BALE_ONESHOT).toContain('بدون دخل و تصرف');
    expect(SYSTEM_BALE_ONESHOT).toContain('هیچ خلاصه‌سازی، جمع‌بندی، افزودن یا حذف مطلقاً ممنوع');
  });

  test('قضاوت ایموجی‌ای: تأیید/مورد شک/بدون شواهد', () => {
    expect(SYSTEM_BALE_ONESHOT).toContain('«تأیید می‌شود»');
    expect(SYSTEM_BALE_ONESHOT).toContain('«مورد شک»');
    expect(SYSTEM_BALE_ONESHOT).toContain('verdict = رشتهٔ خالی');
    expect(SYSTEM_BALE_ONESHOT).toContain('هیچ توضیح، دلیل یا متن اضافه‌ای کنار verdict ننویسید');
  });

  test('بی‌طرفی و منع ساختگی + اسکیمای JSON', () => {
    expect(SYSTEM_BALE_ONESHOT).toContain('بی‌طرفی مطلق');
    expect(SYSTEM_BALE_ONESHOT).toContain('هیچ خبر، عدد یا نام از حافظه');
    expect(SYSTEM_BALE_ONESHOT).toContain('injectionWarnings');
    expect(SYSTEM_BALE_ONESHOT).toContain('"text"');
    expect(SYSTEM_BALE_ONESHOT).toContain('"verdict"');
  });
});

// ---------- نقد ۳ نوامبر: سقف کپشن عکس + ضدتکرار متن مدل ----------

describe('composeNewsMessageV4 — حالت عکس (سقف کپشن ۱۰۲۴)', () => {
  test('با سقف ۹۵۰، متن + حکم در کپشن جا می‌شود و ایموجی تنها نمی‌ماند', () => {
    const long = 'خبر بسیار بلند درباره توافق سیاسی. '.repeat(60);
    const msg = composeNewsMessageV4({ sourceName: 'خبرگزاری', text: long, verdict: 'تأیید می‌شود' }, 950);
    expect(msg.length).toBeLessThanOrEqual(1024);
    expect(msg.endsWith('✅')).toBe(true);
  });
  test('بدون عکس، سقف ۱۲۰۰ حفظ می‌شود', () => {
    const long = 'خبر. '.repeat(400);
    const msg = composeNewsMessageV4({ sourceName: 'منبع', text: long });
    expect(msg.length).toBeGreaterThan(1024);
    expect(msg.length).toBeLessThanOrEqual(1300);
  });
});

describe('newsTextSimilarity — ضدتکرار متن دو آیتم مدل', () => {
  test('همان متن = ۱؛ متن بی‌ربط نزدیک صفر', () => {
    expect(newsTextSimilarity('توافق تجاری دو کشور امضا شد', 'توافق تجاری دو کشور امضا شد')).toBe(1);
    expect(newsTextSimilarity('توافق تجاری دو کشور امضا شد', 'قیمت جهانی نفت کاهش یافت')).toBeLessThan(0.2);
  });
  test('بازگویی همان رویداد بالای آستانه است', () => {
    const a = 'نشست سه‌جانبه وزرای خارجه در ژنو درباره آتش‌بس برگزار شد';
    const b = 'وزرای خارجه در ژنو نشست سه‌جانبه درباره آتش‌بس برگزار کردند';
    expect(newsTextSimilarity(a, b)).toBeGreaterThanOrEqual(0.55);
  });
});
