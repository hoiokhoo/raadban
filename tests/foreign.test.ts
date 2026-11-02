/**
 * تست‌های منابع خارجی و اتصال‌دهنده‌های جدید
 * اجرا: bun test tests/foreign.test.ts
 * بدون شبکه — پارسرها با فیکسچر واقعی‌نما آزمایش می‌شوند
 */
import { describe, test, expect } from 'bun:test';
import { extractTweetsFromHtml, extractAvatarUrl } from '../src/lib/connectors/twitter';
import { extractTruthsFromJson } from '../src/lib/connectors/truthsocial';
import { platformCatalog, connectors } from '../src/lib/connectors';

function syndicationHtml(handle: string, tweets: Array<{ id: string; text: string; date: string; author?: string }>): string {
  const entries = tweets.map((t) => ({
    type: 'tweet',
    content: {
      tweet: {
        id_str: t.id,
        full_text: t.text,
        created_at: t.date,
        user: { screen_name: t.author || handle },
      },
    },
  }));
  const data = { props: { pageProps: { timeline: { entries } } } };
  return `<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></head><body></body></html>`;
}

describe('extractAvatarUrl — عکس پروفایل صاحب حساب (خواستهٔ کاربر)', () => {
  test('استخراج نشانی پروفایل از HTML سندیکاسیون و ارتقا به نسخهٔ بزرگ', () => {
    const html = `<html><img src="https://pbs.twimg.com/profile_images/1880000000/xyz_abc_normal.jpg" alt=""><script id="__NEXT_DATA__" type="application/json">{}</script></html>`;
    expect(extractAvatarUrl(html)).toBe('https://pbs.twimg.com/profile_images/1880000000/xyz_abc_400x400.jpg');
  });

  test('نسخهٔ _bigger هم ارتقا می‌یابد و نشانی تمیز برمی‌گردد', () => {
    const html = 'https://pbs.twimg.com/profile_images/12345/photo_bigger.png"';
    expect(extractAvatarUrl(html)).toBe('https://pbs.twimg.com/profile_images/12345/photo_400x400.png');
  });

  test('بدون پروفایل → undefined', () => {
    expect(extractAvatarUrl('<html>بدون عکس</html>')).toBeUndefined();
    expect(extractAvatarUrl('')).toBeUndefined();
  });
});

describe('اتصال‌دهنده توییتر/ایکس — پارسر سندیکاسیون', () => {
  test('استخراج توییت‌های بیرونی خط زمانی با شناسه و تاریخ درست', () => {
    const html = syndicationHtml('elonmusk', [
      { id: '2114765150431682772', text: 'Remember when using the wrong pronoun got people canceled? That was dumb.', date: 'Sun Oct 26 17:04:36 +0000 2026' },
      { id: '1519480761749016577', text: 'Next I’m buying Coca-Cola to put the cocaine back in', date: 'Thu Apr 28 00:56:58 +0000 2022' },
    ]);
    const posts = extractTweetsFromHtml(html, 'elonmusk');
    expect(posts.length).toBe(2);
    expect(posts[0].externalId).toBe('elonmusk-2114765150431682772');
    expect(posts[0].url).toBe('https://x.com/elonmusk/status/2114765150431682772');
    expect(posts[0].publishedAt?.getUTCFullYear()).toBe(2026);
    expect(posts[0].metadata?.author).toBe('elonmusk');
  });

  test('نقل‌قول‌های تو در تو از حساب‌های دیگر به‌عنوان پست مستقل ثبت نمی‌شوند', () => {
    // ساختار رسمی entries فقط توییت بیرونی را برمی‌گرداند
    const html = syndicationHtml('netanyahu', [
      { id: '1001', text: 'بیانیه رسمی درباره امنیت اسرائیل', date: 'Mon Oct 27 10:00:00 +0000 2026' },
    ]);
    // حالت JSON بی‌ساختار: توییت‌های حساب دیگر باید فیلتر شوند
    const messy = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      random: [
        { id_str: '2001111111111111111', full_text: 'پست کسی دیگر', created_at: 'Mon Oct 27 10:00:00 +0000 2026', user: { screen_name: 'OtherUser' } },
        { id_str: '2002222222222222222', full_text: 'پست خود حساب', created_at: 'Mon Oct 27 11:00:00 +0000 2026', user: { screen_name: 'netanyahu' } },
      ],
    })}</script>`;
    const a = extractTweetsFromHtml(html, 'netanyahu');
    expect(a.length).toBe(1);
    expect(a[0].metadata?.author).toBe('netanyahu');
    const b = extractTweetsFromHtml(messy, 'netanyahu');
    expect(b.length).toBe(1);
    expect(b[0].externalId).toBe('netanyahu-2002222222222222222');
  });

  test('ری‌توییت با پرچم فوروارد ثبت می‌شود و HTML خالی پستی نمی‌دهد', () => {
    const html = syndicationHtml('PahlaviReza', [
      { id: '3001', text: 'RT @someone: پیام بازنشرشده با محتوای نسبتاً بلند برای آزمون', date: 'Tue Oct 28 08:00:00 +0000 2026' },
    ]);
    const posts = extractTweetsFromHtml(html, 'PahlaviReza');
    expect(posts.length).toBe(1);
    expect(posts[0].isForwarded).toBe(true);
    expect(extractTweetsFromHtml('', 'elonmusk').length).toBe(0);
  });

  test('HTML بدون JSON معتبر خطای استخراج صادقانه می‌دهد (بدون پست)', () => {
    expect(extractTweetsFromHtml('<html><body>error page</body></html>', 'elonmusk').length).toBe(0);
  });
});

describe('اتصال‌دهنده تروث سوشال — پارسر API عمومی', () => {
  test('استخراج پست‌های متنی با شناسه و پیوند درست', () => {
    const json = JSON.stringify([
      { id: '1234567890', text: 'Just posted a statement about the economy.', created_at: '2026-10-29T12:00:00.000Z', account: { acct: 'realDonaldTrump' }, url: 'https://truthsocial.com/@realDonaldTrump/posts/1234567890' },
      { id: '1234567891', content: '<p>HTML post about trade policy with numbers.</p>', created_at: '2026-10-29T13:00:00.000Z', account: { acct: 'realDonaldTrump' } },
      { id: '1234567892', text: 'short', account: { acct: 'realDonaldTrump' } }, // خیلی کوتاه — رد می‌شود
    ]);
    const posts = extractTruthsFromJson(json, 'realDonaldTrump');
    expect(posts.length).toBe(2);
    expect(posts[0].externalId).toBe('truth-realDonaldTrump-1234567890');
    expect(posts[0].url).toContain('truthsocial.com');
    expect(posts[1].content).not.toContain('<p>');
  });

  test('پاسخ نامعتبر یا غیرآرایه‌ای پستی نمی‌دهد', () => {
    expect(extractTruthsFromJson('{"error":"forbidden"}', 'x').length).toBe(0);
    expect(extractTruthsFromJson('', 'x').length).toBe(0);
  });
});

describe('کاتالوگ پلتفرم‌ها — وضعیت صادقانه', () => {
  test('توییتر و تروث سوشال پیاده‌سازی واقعی دارند و محدودیت‌شان صریح است', () => {
    const tw = platformCatalog.find((p) => p.key === 'twitter');
    const ts = platformCatalog.find((p) => p.key === 'truthsocial');
    expect(tw?.implemented).toBe(true);
    expect(ts?.implemented).toBe(true);
    expect(tw?.limits).toContain('۴۲۹');
    expect(ts?.limits).toContain('403');
    expect(connectors.twitter.fetchRecent).toBeFunction();
    expect(connectors.truthsocial.fetchRecent).toBeFunction();
  });

  test('پلتفرم‌های بی‌پیاده‌سازی همچنان صادقانه «ناموجود» می‌مانند', () => {
    const ig = platformCatalog.find((p) => p.key === 'instagram');
    const ap = platformCatalog.find((p) => p.key === 'aparat');
    expect(ig?.implemented).toBe(false);
    expect(ap?.implemented).toBe(false);
    expect(connectors['instagram']).toBeUndefined();
  });

  test('شناسه‌ها نرمال می‌شوند (@ و URL و مسیرهای اضافه حذف می‌شوند)', () => {
    expect(connectors.twitter.normalizeIdentifier('@realDonaldTrump')).toBe('realDonaldTrump');
    expect(connectors.twitter.normalizeIdentifier('https://x.com/elonmusk')).toBe('elonmusk');
    expect(connectors.truthsocial.normalizeIdentifier('https://truthsocial.com/@realDonaldTrump')).toBe('realDonaldTrump');
    expect(connectors.twitter.validateIdentifier('Bad Handle!')).toBe(false);
  });
});
