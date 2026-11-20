/**
 * تست‌های ویژگی‌های ۱۶ نوامبر ۲۰۲۶ — خواسته‌های صریح کاربر:
 * (۱) «بسته خبری … کل اون خبر خلاصه بشه در حداکثر دوخط و در هر سطر بسته جا بگیره»
 *     → پرامپت ساعتی دوخطی + پیکرهٔ ۷۲ موردی + سقف ۹۰۰۰.
 * (۲) «چارت نمودارها عکسشون داخل ربات چرا ارسال نمیشه؟»
 *     → تلاش مجدد آپلود کارت روی خطای گذرای ۵xx بله (موک fetch).
 * (۳) «توییت‌ها: بجای عبارت ترجمه فارسی، نام توییت‌کننده به فارسی بیاد»
 *     → tweetDisplayBody با faName + قرارداد صف با نشانگر پلتفرم.
 * (۴) «تروث سوشال ترامپ و قالیباف و سایر مقامات»
 *     → پارس آرشیو تروث‌سوشال + فهرست حساب‌ها با پلتفرم/نام فارسی.
 * (۵) «حوادث مرتبط با اغتشاشات ایران مثه کیان پیرفلک … نمیخوام داخل وقایع بیاد»
 *     → واژه‌نامهٔ نام‌ها + قالب کامل «۲۵ آبان ۱۲۹۳؛ …» + وقایع جهانی ویکی انگلیسی.
 * (۶) «دیگه نمیخوام اخبار عینا از خبرگذاریا بیاد» → پرامپت خلاصهٔ دوخطی + بچ‌بندی ترجمه.
 */
import { describe, expect, test } from 'bun:test';
import {
  tweetDisplayBody,
  buildTweetBundleChunks,
} from '../bot/bundle';
import {
  parseTruthFeedXml,
  cleanTruthText,
  truthIdOf,
} from '../bot/truth-social';
import {
  formatDayHistoryBlock,
  isDayHistoryBlocked,
  parseEnWikiDayWikitext,
  enWikiDayTitle,
  isSignificantWorldEvent,
  EN_MONTHS,
} from '../bot/day-history';
import {
  salvageBatchTranslations,
  readTweetAccounts,
  needsTranslation,
  sendBalePhotoBytes,
  DEFAULT_NEWS_SUMMARY_PROMPT,
  DEFAULT_SYSTEM_BOT_ONESHOT,
} from '../bot/bot';
import { DEFAULT_SYSTEM_HOURLY, validateHourlyText, tokensFa } from '../bot/hourly';
import { containment } from '../bot/grounding';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------- (۱) خلاصهٔ دوخطی — پرامپت و اعتبارسنجی ----------

describe('سوپرپرامپت دوخطی (خواستهٔ ۱۶ نوامبر)', () => {
  test('پرامپت ساعتی قانون «ترجیح یک خط، حداکثر ۲-۳ خط» و «هیچ رویدادی از قلم نیفتد» را دارد (به‌روزشده ۲۰ نوامبر)', () => {
    expect(DEFAULT_SYSTEM_HOURLY).toContain('در یک خط');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('~۱۱۰');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('هیچ رویدادی از قلم نیفتد');
    // ۲۰ نوامبر (دومی): «کل کامل اون خبر در ۲ـ۳ خط خلاصه بشه با معنی کامل نه ناقص»
    expect(DEFAULT_SYSTEM_HOURLY).toContain('سطر سوم');
    expect(DEFAULT_SYSTEM_HOURLY).toContain('معنای کامل مقدم بر کوتاهی');
  });

  test('پرامپت اصلی (oneshot) قانون خلاصهٔ دو-سه‌خطی به‌جای عین‌نویسی خبرگزاری دارد', () => {
    expect(DEFAULT_SYSTEM_BOT_ONESHOT).toContain('خلاصهٔ دوخطی شکیل');
    expect(DEFAULT_SYSTEM_BOT_ONESHOT).not.toContain('خبر کامل، بدون خلاصه‌سازی');
  });

  test('پرامپت خلاصهٔ خبر خارجی — دوخطی، شکیل، بدون هالوسینیشن', () => {
    expect(DEFAULT_NEWS_SUMMARY_PROMPT).toContain('خلاصهٔ خبری دوخطی');
    expect(DEFAULT_NEWS_SUMMARY_PROMPT).toContain('شکیل');
    expect(DEFAULT_NEWS_SUMMARY_PROMPT).toContain('هالوسینیشن ممنوع');
  });

  test('سقف متن بستهٔ ساعتی ۹۰۰۰ نویسه است (جای خلاصه‌های دوخطی بیشتر)', () => {
    const long = 'متن فارسی روان برای تست سقف اعتبارسنجی بستهٔ ساعتی. '.repeat(170); // ~۹۸۰۰ نویسه
    const v = validateHourlyText(long);
    expect(v).not.toBeNull();
    expect(v!.length).toBeLessThanOrEqual(9100); // بریده در مرز سطر و «…» — نه حذف کل
    expect(validateHourlyText('کوتاه')).toBeNull(); // زیر حداقل
  });
});

// ---------- (۲) نجات JSON بریده + متریک پوشش ----------

describe('salvageBatchTranslations — نجات مدخل‌های JSON بریده (بن‌بست ۶۴ خبری)', () => {
  test('JSON بریدهٔ وسط آرایه — مدخل‌های کامل نجات می‌یابند', () => {
    const broken = '{"t":[{"n":1,"fa":"خلاصهٔ اول"},{"n":2,"fa":"خلاصهٔ دوم"},{"n":3,"fa":"خلاصهٔ س'; // بریده در مدخل ۳
    const out = salvageBatchTranslations(broken);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(2);
    expect(out![0]).toEqual({ n: 1, fa: 'خلاصهٔ اول' });
    expect(out![1]).toEqual({ n: 2, fa: 'خلاصهٔ دوم' });
  });

  test('اسکیپ‌های درونی رشته («نقل‌قول») درست پارس می‌شوند', () => {
    const broken = '{"t":[{"n":1,"fa":"او گفت: \\"جنگ تمام شد\\" و رفت"},';
    const out = salvageBatchTranslations(broken);
    expect(out).not.toBeNull();
    expect(out![0]!.fa).toContain('"جنگ تمام شد"');
  });

  test('بدون هیچ مدخل کامل → null (صادقانه)', () => {
    expect(salvageBatchTranslations('{"t":[{"n":1,"fa":"خ')).toBeNull();
    expect(salvageBatchTranslations('')).toBeNull();
  });

  test('متریک پوشش — خلاصهٔ وفادار از خوشهٔ بلند پوشش بالا دارد، هالوسینیشن صفر', () => {
    const cluster = tokensFa('توافق آتش‌بس میان دو طرف در جلسهٔ امشب با وساطت قطر امضا شد و از ساعت فردا اجرایی می‌شود');
    const summary = tokensFa('دو طرف با وساطت قطر توافق آتش‌بس امضا کردند');
    const setA = new Set(summary);
    const setB = new Set(cluster);
    expect(containment(setA, setB)).toBeGreaterThan(0.55); // خلاصهٔ وفادار — خاستگاه‌دار
    const fake = tokensFa('مراسم عزاداری با حضور رهبر انقلاب در زینبیه برگزار شد');
    expect(containment(fake, setB)).toBeLessThan(0.15); // بی‌خاستگاه — حذف
  });
});

// ---------- (۳) نمایش توییت با نام فارسی — فقط فارسی روان (خواستهٔ ۱۹ نوامبر) ----------

describe('tweetDisplayBody — فقط فارسی روان، بدون متن اصلی (خواستهٔ ۱۹ نوامبر)', () => {
  test('متن اصلی حذف — فقط «نام فارسی (مسئولیت): ترجمهٔ کامل»', () => {
    const body = tweetDisplayBody('Peace through strength!', 'صلح از طریق قدرت!', 'دونالد ترامپ (رئیس‌جمهور آمریکا)');
    expect(body).toBe('دونالد ترامپ (رئیس‌جمهور آمریکا): صلح از طریق قدرت!');
    expect(body).not.toContain('Peace');
    expect(body).not.toContain('ترجمه فارسی');
  });

  test('نبود faName → فقط ترجمهٔ فارسی (بدون برچسب)', () => {
    expect(tweetDisplayBody('Hello', 'سلام')).toBe('سلام');
  });

  test('توییت فارسی/بدون اصلی → فقط متن', () => {
    expect(tweetDisplayBody(undefined, 'متن فارسی')).toBe('متن فارسی');
  });
});

// ---------- (۴) تروث‌سوشال + حساب‌های مقامات ----------

describe('آرشیو تروث‌سوشال (خواستهٔ ۱۶ نوامبر: تروث سوشال ترامپ)', () => {
  const FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Trump's Truths</title>
<item>
  <title><![CDATA[Text post from November 16, 2026]]></title>
  <link>https://www.trumpstruth.org/statuses/43601</link>
  <pubDate>Mon, 16 Nov 2026 02:10:00 +0000</pubDate>
  <description><![CDATA[A must read article about peace: https://www. wsj.com/peace View image Quoted Donald J. Trump]]></description>
</item>
<item>
  <title><![CDATA[Video post from November 16, 2026]]></title>
  <link>https://www.trumpstruth.org/statuses/43600</link>
  <pubDate>Mon, 16 Nov 2026 01:58:39 +0000</pubDate>
  <description><![CDATA[View video]]></description>
</item>
<item>
  <title><![CDATA[Image post]]></title>
  <link>https://www.trumpstruth.org/statuses/43601</link>
  <pubDate>Mon, 16 Nov 2026 01:00:00 +0000</pubDate>
  <description><![CDATA[View image]]></description>
</item>
<item>
  <title><![CDATA[Text post 2]]></title>
  <link>https://www.trumpstruth.org/statuses/43602</link>
  <pubDate>Mon, 15 Nov 2026 20:00:00 +0000</pubDate>
  <description><![CDATA[I am in the White House having meetings on many subjects. Very exciting times!]]></description>
</item>
</channel></rss>`;

  test('پارس فید — پست متنی با تاریخ؛ پست صرفاً ویدیویی/تصویری و تکراری حذف؛ لینک شکسته پاک', () => {
    const posts = parseTruthFeedXml(FEED, 10);
    expect(posts.length).toBe(2);
    expect(posts[0]!.id).toBe('43601');
    expect(posts[0]!.text).toBe('A must read article about peace:');
    expect(posts[0]!.text).not.toContain('View image');
    expect(posts[0]!.text).not.toContain('Quoted');
    expect(posts[0]!.text).not.toContain('https://');
    expect(posts[1]!.id).toBe('43602');
    expect(posts[1]!.createdAt?.getUTCFullYear()).toBe(2026);
  });

  test('cleanTruthText — زائدات آرشیو پاک می‌شوند', () => {
    const t = cleanTruthText('<![CDATA[RT: https://truthsocial.com/x View video Quote post: text here Quoted Donald J. Trump https://pic.site/a.jpg]]>');
    expect(t).not.toContain('View');
    expect(t).not.toContain('RT:');
    expect(t).not.toContain('Quoted');
    expect(t).not.toContain('https://');
    expect(t).toContain('text here');
  });

  test('truthIdOf — شناسه از نشانی آرشیو', () => {
    expect(truthIdOf('https://www.trumpstruth.org/statuses/43599')).toBe('43599');
    expect(truthIdOf('https://www.trumpstruth.org/')).toBe('');
  });
});

describe('readTweetAccounts — پلتفرم و نام فارسی (قالیباف، رهبر، عراقچی، پزشکیان، تروث ترامپ)', () => {
  test('فیلدهای جدید پارس می‌شوند؛ نبود → پیش‌فرض x', () => {
    const dir = mkdtempSync(join(tmpdir(), 'raadban-tw-'));
    const file = join(dir, 'tweets.json');
    writeFileSync(file, JSON.stringify([
      { handle: '@realDonaldTrump', name: 'Donald Trump', faName: 'دونالد ترامپ (رئیس‌جمهور آمریکا)', platform: 'truth' },
      { handle: 'mb_ghalibaf', name: 'Mohammad Bagher Ghalibaf', faName: 'محمدباقر قالیباف (رئیس مجلس شورای اسلامی)' },
      'khamenei_ir',
    ]), 'utf8');
    const accs = readTweetAccounts(file);
    expect(accs.length).toBe(3);
    expect(accs[0]).toEqual({ handle: 'realDonaldTrump', name: 'Donald Trump', faName: 'دونالد ترامپ (رئیس‌جمهور آمریکا)', platform: 'truth' });
    expect(accs[1]!.platform).toBe('x'); // پیش‌فرض
    expect(accs[1]!.faName).toContain('قالیباف');
    expect(accs[2]).toEqual({ handle: 'khamenei_ir' });
    rmSync(dir, { recursive: true, force: true });
  });

  test('فهرست واقعی ربات — تروث‌سوشال ترامپ و مقامات ایرانی حضور دارند', () => {
    const accs = readTweetAccounts('bot/tweets.json');
    expect(accs.some((a) => a.platform === 'truth' && a.handle.toLowerCase() === 'realdonaldtrump')).toBe(true);
    for (const h of ['mb_ghalibaf', 'khamenei_ir', 'drpezeshkian', 'araghchi', 'netanyahu']) {
      expect(accs.some((a) => a.handle.toLowerCase() === h)).toBe(true);
    }
    // همهٔ حساب‌های تأثیرگذار نام فارسی دارند (خط دوم نمایش)
    expect(accs.filter((a) => !a.faName).length).toBe(0);
  });
});

// ---------- (۵) وقایع روز — قالب کامل + پالایش نام‌ها + وقایع جهانی ----------

describe('وقایع روز — قالب «۲۵ آبان ۱۲۹۳؛ …» + فقط رویدادهای بسیار مهم (خواستهٔ ۲۰ نوامبر)', () => {
  const entries = [
    { year: 1320, text: 'اشغال ایران توسط متفقین در جنگ جهانی دوم', kind: 'event' as const },
    { year: 1293, text: 'انعقاد قرارداد ایران با آمریکا به منظور خرید ذرت', kind: 'event' as const },
    { year: 1377, text: 'علامه محمدتقی جعفری، فیلسوف و مفسر قرآن', kind: 'death' as const },
    { year: 1376, text: 'آغاز پخش رسمی شبکه جهانی سحر', kind: 'event' as const },
    { year: 1349, text: 'زادروز خوانندهٔ مشهور', kind: 'birth' as const },
  ];

  test('قالب کامل روز/ماه/سال — فقط رویدادهای بسیار مهم؛ زادروز/درگذشت هرگز', () => {
    const block = formatDayHistoryBlock(entries, 'امروز', '۲۵ آبان');
    expect(block).toContain('۲۵ آبان ۱۳۲۰؛ اشغال ایران توسط متفقین در جنگ جهانی دوم');
    expect(block).toContain('۲۵ آبان ۱۲۹۳؛ انعقاد قرارداد ایران با آمریکا به منظور خرید ذرت');
    expect(block).toContain('📜 وقایع امروز در تاریخ');
    // زادروز/درگذشت چهره‌ها و رویدادهای عادی هرگز (خواستهٔ کاربر ۲۰ نوامبر)
    expect(block).not.toContain('جعفری');
    expect(block).not.toContain('سحر');
    expect(block).not.toContain('زادروز');
    expect(block).not.toContain('درگذشت');
  });

  test('نبود عنوان روز → قالب سال‌تنهای قبلی (سازگاری)', () => {
    const block = formatDayHistoryBlock(entries, 'امروز');
    expect(block).toContain('۱۳۲۰؛ اشغال ایران');
    expect(block).not.toContain('۲۵ آبان ۱۳۲۰');
  });

  test('کیان پیرفلک و چهره‌های ماجرای ۱۴۰۱ — حتی بی‌واژهٔ «اعتراض» — مسدود می‌شوند', () => {
    expect(isDayHistoryBlocked('کشته‌شدن کیان پیرفلک، نوجوان لر')).toBe(true); // نام، بدون واژهٔ اعتراض
    expect(isDayHistoryBlocked('درگذشت نیکا شاکرمی')).toBe(true);
    expect(isDayHistoryBlocked('بزرگداشت سارینا اسماعیلی')).toBe(true);
    expect(isDayHistoryBlocked('درگذشت ستارخان، سردار ملی ایران')).toBe(false); // رویداد تاریخی مجاز
    expect(isDayHistoryBlocked('انعقاد قرارداد ایران با آمریکا به منظور خرید ذرت')).toBe(false);
  });
});

describe('وقایع جهانی امروز — ویکی‌پدیای انگلیسی (نمونهٔ کاربر: «۱۶ نوامبر ۱۹۴۵؛ ایجاد یونسکو»)', () => {
  test('enWikiDayTitle — نشانی صفحهٔ روز میلادی', () => {
    expect(enWikiDayTitle(11, 16)).toBe('November 16');
    expect(enWikiDayTitle(13, 1)).toBe('');
    expect(EN_MONTHS.length).toBe(12);
  });

  test('پالایندهٔ اهمیت — ایران و رویدادهای تاریخی بزرگ می‌مانند، جزئیات رد می‌شوند', () => {
    expect(isSignificantWorldEvent('UNESCO, the United Nations Educational, Scientific and Cultural Organization, is founded')).toBe(true);
    expect(isSignificantWorldEvent('A peace treaty is signed between Iran and Iraq')).toBe(true);
    expect(isSignificantWorldEvent('Birth of an American baseball player')).toBe(false);
    expect(isSignificantWorldEvent('A new shopping mall opens in Ohio')).toBe(false);
  });

  test('پارس بخش Events — سال + متن، تازه‌ترین اول، سقف limit', () => {
    const wt = `==Events==
* [[1945]] – [[UNESCO]] is founded.
* 1938 – LSD is first synthesized.
* [[1532]] – [[Francisco Pizarro]] ... whatever happens in Peru.
* 1990 – A massive earthquake hits Iran.
* 1988 – The Soviet war in Afghanistan ends.
==Births==
* 1960 – Someone born.
`;
    const out = parseEnWikiDayWikitext(wt, 3);
    expect(out.length).toBe(3);
    expect(out[0]!.year).toBe(1990); // تازه‌ترین اول
    expect(out.some((e) => e.text.includes('UNESCO'))).toBe(true);
    expect(out.every((e) => e.kind === 'event')).toBe(true);
    // تولدها پارس نمی‌شوند
    expect(out.some((e) => e.text.includes('Someone born'))).toBe(false);
    // LSD (جزئیات، بی‌کلیدواژهٔ اهمیت/ایران) نباید بیاید
    expect(out.some((e) => e.text.includes('LSD'))).toBe(false);
  });
});

// ---------- (۶) یکپارچگی — بستهٔ توییت با نام فارسی ----------

describe('بستهٔ توییت — یکپارچگی پلتفرم/نام فارسی', () => {
  test('توییت تروث‌سوشال ترامپ: نشانگر 🅣 + نام فارسی: ترجمهٔ کامل — بدون متن اصلی', () => {
    const res = buildTweetBundleChunks([
      {
        id: 'ts-1',
        source: '🅣 Donald Trump (تروث‌سوشال)',
        text: 'صلح از طریق قدرت!',
        orig: 'Peace through strength!',
        faName: 'دونالد ترامپ (رئیس‌جمهور آمریکا)',
        at: '2026-11-16T02:00:00.000Z',
      },
    ]);
    expect(res.chunks[0]).toContain('دونالد ترامپ (رئیس‌جمهور آمریکا): صلح از طریق قدرت!');
    expect(res.chunks[0]).not.toContain('Peace through strength!'); // متن اصلی حذف — خواستهٔ ۱۹ نوامبر
    expect(res.chunks[0]).not.toContain('🗣 ترجمه فارسی');
  });

  test('خلاصهٔ فارسیِ خروجی summarize از دروازهٔ زبان می‌گذرد (فارسی است، نه انگلیسی)', () => {
    expect(needsTranslation('ترامپ گفت بهرهٔ فدرال کاهش می‌یابد و تورم آرام می‌شود.')).toBe(false);
    expect(needsTranslation('Fed cuts rates as inflation cools')).toBe(true);
  });
});

// ---------- (۲-ب) تلاش مجدد آپلود کارت روی خطای گذرای ۵xx بله ----------

describe('sendBalePhotoBytes — رفع «چارت‌ها داخل ربات ارسال نمیشن» (۱۶ نوامبر)', () => {
  test('خطای گذرای ۵۰۰ («failed to upload file bytes») سپس موفقیت — تلاش مجدد تا ۳ بار', async () => {
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls < 3) {
        return new Response(JSON.stringify({ ok: false, error_code: 500, description: 'Internal Error: failed to upload file bytes' }), { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      const bytes = new Uint8Array(2000).fill(1);
      const r = await sendBalePhotoBytes('TOKEN', '123', bytes, 'card.png', 'کپشن');
      expect(r.ok).toBe(true);
      expect(calls).toBe(3); // دو شکست گذرا + موفقیت
    } finally {
      globalThis.fetch = realFetch;
    }
  }, 20000);

  test('خطای دائمی ۴۰۰ — بدون تلاش مجدد، شکست شفاف', async () => {
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }), { status: 400 });
    }) as unknown as typeof fetch;
    try {
      const r = await sendBalePhotoBytes('TOKEN', '123', new Uint8Array(2000).fill(2), 'card.png');
      expect(r.ok).toBe(false);
      expect(r.error).toContain('400');
      expect(calls).toBe(1); // خطای دائمی — تکرار بی‌فایده ممنوع
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

// ---------- (۷) کارت تصویری همهٔ اخبار/توییت‌ها — خواستهٔ ۱۶ نوامبر + بازطراحی ۱۹ نوامبر ----------

import {
  paginateItems,
  makeNewsCardSvg,
  makeTweetCardSvg,
  paginateTweetItems,
  tweetRowHeight,
  TW_MAX_LINES,
  NEWS_CARD_ROWS_PER_PAGE,
  NEWS_CARD_MAX_PAGES,
  type NewsCardInput,
  type TweetCardInput,
} from '../bot/news-card';
import * as newsCardModule from '../bot/news-card';
import { tripleDateOf } from '../bot/calendar';

const CARD_DATE = tripleDateOf('2026-11-16', 'Asia/Tehran', 'umalqura');

describe('کارت چندصفحه‌ای — همهٔ اخبار در قالب تصویر', () => {
  test('صفحه‌بندی خالص — ۱۵ آیتم → ۲ صفحهٔ ۱۲تایی؛ سقف صفحات رعایت می‌شود', () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => i);
    const pages = paginateItems(fifteen, 12, 7);
    expect(pages.length).toBe(2);
    expect(pages[0]!.length).toBe(12);
    expect(pages[1]!.length).toBe(3);
    expect(NEWS_CARD_ROWS_PER_PAGE).toBe(12);
    expect(NEWS_CARD_MAX_PAGES * NEWS_CARD_ROWS_PER_PAGE).toBeGreaterThanOrEqual(84);
    // سقف صفحات — ۱۰۰ آیتم با maxPages=2 → فقط ۲ صفحه
    expect(paginateItems(Array.from({ length: 100 }, (_, i) => i), 12, 2).length).toBe(2);
    expect(paginateItems([], 12, 7)).toEqual([]);
  });

  test('برچسب «بخش ۱ از ۲» در کارت — سازندهٔ کپشن حذف شد (فقط عکس — خواستهٔ ۱۹ نوامبر)', () => {
    const input: NewsCardInput = { date: CARD_DATE, items: [{ text: 'خبر نمونه برای کارت', tick: false, source: 'ایسنا' }] };
    expect(makeNewsCardSvg({ ...input, part: { no: 1, of: 2 } })).toContain('بخش ۱ از ۲');
    expect(makeNewsCardSvg(input)).not.toContain('بخش');
    const mod = newsCardModule as unknown as Record<string, unknown>;
    expect(mod.buildNewsCardCaption).toBeUndefined();
    expect(mod.buildTweetCardCaption).toBeUndefined();
  });
});

describe('کارت توییت‌ها — فقط فارسی روان کامل (خواستهٔ ۱۹ نوامبر)', () => {
  const twInput: TweetCardInput = {
    date: CARD_DATE,
    items: [
      { source: '🅣 Donald Trump (تروث‌سوشال)', fa: 'صلح از طریق قدرت!', faName: 'دونالد ترامپ (رئیس‌جمهور آمریکا)' },
      { source: '𝕏 mb_ghalibaf', fa: 'ایران آماده است.', faName: 'محمدباقر قالیباف (رئیس مجلس شورای اسلامی)', verified: true },
    ],
  };

  test('ردیف هر توییت: منبع + نام فارسی (خط عنوان) + ترجمهٔ کامل — بدون متن اصلی', () => {
    const svg = makeTweetCardSvg(twInput);
    expect(svg).toContain('Donald Trump (تروث‌سوشال)');
    expect(svg).not.toContain('Peace through strength!'); // متن اصلی حذف — خواستهٔ صریح کاربر
    expect(svg).toContain('دونالد ترامپ (رئیس‌جمهور آمریکا)');
    expect(svg).toContain('صلح از طریق قدرت!');
    expect(svg).toContain('𝕏 mb_ghalibaf');
    expect(svg).toContain('✅'); // verified
    expect(svg).toContain('توییت‌های مقامات تأثیرگذار');
  });

  test('ترجمهٔ کامل بدون خلاصه‌سازی — توییت بلند چندخطی رندر می‌شود (ریشهٔ «توییت‌ها کامل نیومدن»؛ پالت سبز کم‌رنگ — ۲۰ نوامبر سوم)', () => {
    const long = 'این متن آزمونی طولانی برای بررسی کامل بودن ترجمه در کارت تصویری است. '.repeat(12);
    const svg = makeTweetCardSvg({ date: CARD_DATE, items: [{ source: '🅣 Donald Trump (تروث‌سوشال)', fa: long, faName: 'دونالد ترامپ (رئیس‌جمهور آمریکا)' }] });
    const faLines = svg.split('\n').filter((l) => l.includes('fill="#22432f"') && l.includes('font-size="26"')).length;
    expect(faLines).toBeGreaterThan(4); // چندین خط ترجمه — نه سقف دوخطی قدیمی
    expect(svg).toContain('#eef6ee'); // پس‌زمینهٔ سبز کم‌رنگ کارت توییت — خواستهٔ ۲۰ نوامبر سوم
    expect(TW_MAX_LINES).toBe(32); // ۲۰ نوامبر هشتم: ۱۶→۳۲ — پست‌های بلند تروث‌سوشال (تا ~۱۹۸۰ نویسه) کامل جا می‌شوند
    // متن فوق‌بلند (فراتر از حتی ۳۲ خط) → بریده با «…» در بستهٔ عادی (کارت هرگز سرریز نمی‌کند — صادقانه؛
    // کارت فوری بیرون از بسته، خودش بی‌سقف است و هرگز بریده نمی‌شود)
    const overflow = makeTweetCardSvg({ date: CARD_DATE, items: [{ source: '🅣 x', fa: 'کلمه '.repeat(2000), faName: 'نام' }] });
    expect(overflow).toContain('…');
  });

  test('ارتفاع ردیف متغیر و صفحه‌بندی بر پایهٔ ارتفاع واقعی', () => {
    const short = tweetRowHeight('سلام');
    const long = tweetRowHeight('کلمه '.repeat(400));
    expect(long).toBeGreaterThan(short);
    const items = Array.from({ length: 30 }, (_, i) => ({ source: `𝕏 a${i}`, fa: `توییت آزمونی شمارهٔ ${i} با متن نسبتاً بلند برای پر شدن ارتفاع صفحه. `.repeat(2) }));
    const pages = paginateTweetItems(items);
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) expect(p.length).toBeGreaterThan(0);
    expect(paginateTweetItems([])).toEqual([]);
  });

  test('توییت بدون نام فارسی — خط عنوان «ترجمه فارسی»؛ خالی → SVG خالی', () => {
    const svg = makeTweetCardSvg({ date: CARD_DATE, items: [{ source: '𝕏 elonmusk', fa: 'سلام' }] });
    expect(svg).toContain('سلام');
    expect(svg).toContain('ترجمه فارسی');
    expect(makeTweetCardSvg({ date: CARD_DATE, items: [] })).toBe('');
  });
});
