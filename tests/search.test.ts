/**
 * تست‌های واحد موتور جست‌وجوی شواهد چندموتوری — بدون شبکه واقعی
 * اجرا: bun test tests/search.test.ts
 */
import { describe, test, expect } from 'bun:test';
import {
  decodeBingRedirect,
  decodeBingNewsUrl,
  parseBingNewsRss,
  parseBingResults,
  significantTokens,
  isRelevantResult,
} from '../src/lib/factcheck/engine';

describe('decodeBingNewsUrl — رمزگشایی لینک Bing News', () => {
  test('پارامتر url= کدگذاری‌شده → URL واقعی', () => {
    const link = 'http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=abc&url=https%3a%2f%2fwww.aljazeera.com%2fnews%2f2026%2f11%2fstop&c=123&mkt=zh-hk';
    expect(decodeBingNewsUrl(link)).toBe('https://www.aljazeera.com/news/2026/11/stop');
  });

  test('لینک مستقیم دست‌نخورده می‌ماند', () => {
    expect(decodeBingNewsUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
  });
});

describe('decodeBingRedirect — رمزگشایی لینک وب بینگ', () => {
  test('u=a1<base64url> → URL واقعی', () => {
    // «https://example.com/news» در base64url
    const enc = Buffer.from('https://example.com/news').toString('base64url');
    expect(decodeBingRedirect(`https://www.bing.com/ck/a?x=1&u=a1${enc}&ntb=1`)).toBe('https://example.com/news');
  });

  test('بدون پارامتر u → همان ورودی', () => {
    expect(decodeBingRedirect('https://example.com/x')).toBe('https://example.com/x');
  });
});

describe('parseBingNewsRss — پارس فید خبری بینگ', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>آتش‌بس غزه - Bing</title>
<item><title>حملات تازه اسرائیل به غزه؛ ترامپ می‌گوید آتش‌بس هنوز برقرار است</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3a%2f%2fwww.example.com%2fgaza-news&amp;c=1</link><description>Israel carried out several attacks in Gaza.</description><pubDate>Sat, 31 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>خبر دوم کوتاه</title><link>https://direct.example.com/two</link><description>خلاصهٔ خبر دوم</description></item>
</channel></rss>`;

  test('عنوان، URL واقعی و خلاصه استخراج می‌شود', () => {
    const r = parseBingNewsRss(xml);
    expect(r.length).toBe(2);
    expect(r[0].url).toBe('https://www.example.com/gaza-news');
    expect(r[0].title).toContain('آتش‌بس هنوز برقرار است');
    expect(r[0].snippet).toContain('several attacks in Gaza');
    expect(r[1].url).toBe('https://direct.example.com/two');
  });

  test('آیتم بدون لینک/عنوان نادرست رد می‌شود', () => {
    const bad = '<rss><item><title>t</title><link></link></item></rss>';
    expect(parseBingNewsRss(bad).length).toBe(0);
  });
});

describe('parseBingResults — پارس وب بینگ', () => {
  test('بلوک b_algo با لینک ریدایرکت → URL رمزگشایی‌شده', () => {
    const enc = Buffer.from('https://realsite.example/article').toString('base64url');
    const html = `<ul><li class="b_algo"><h2><a target="_blank" href="https://www.bing.com/ck/a?p=1&amp;u=a1${enc}&ntb=1">تیتر نتیجهٔ آزمایشی طولانی</a></h2><div class="b_caption"><p class="b_lineclamp2">خلاصهٔ نتیجه با جزئیات کافی برای نمایش</p></div></li></ul>`;
    const r = parseBingResults(html);
    expect(r.length).toBe(1);
    expect(r[0].url).toBe('https://realsite.example/article');
    expect(r[0].title).toContain('تیتر نتیجهٔ آزمایشی');
    expect(r[0].snippet).toContain('خلاصهٔ نتیجه');
  });
});

describe('فیلتر تناظر واژگان — سپر نتایج بی‌ربط', () => {
  test('significantTokens واژه‌های کوتاه و ایست را حذف می‌کند', () => {
    const t = significantTokens('در شورای امنیت سازمان ملل درباره آتش‌بس غزه');
    expect(t).toContain('آتش‌بس');
    expect(t).toContain('غزه');
    expect(t).toContain('امنیت');
    expect(t).not.toContain('در');
    expect(t).not.toContain('درباره');
  });

  test('نتیجهٔ بی‌ربط (بدون هیچ واژهٔ مشترک) رد می‌شود', () => {
    const q = 'آتش‌بس غزه شورای امنیت';
    expect(isRelevantResult(q, { title: 'Free Porn Videos - XVIDEOS.COM', snippet: 'free hosting service' })).toBe(false);
    expect(isRelevantResult(q, { title: 'برگزاری نشست اضطراری غزه در شورای امنیت', snippet: 'قطعنامه آتش‌بس' })).toBe(true);
  });

  test('ادعای بدون واژهٔ معنادار → همه مجاز (فیلت سخت‌گیرانه نیست)', () => {
    expect(isRelevantResult('!!!', { title: 'هر چیزی' })).toBe(true);
  });
});
