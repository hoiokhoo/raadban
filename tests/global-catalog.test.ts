/**
 * تست‌های کاتالوگ جهانی منابع و دسته‌ها
 * اجرا: bun test tests/global-catalog.test.ts
 * بدون شبکه — صحت داده‌های seed، یکتایی، گرایش و قواعد فیلتر UI
 */
import { describe, test, expect } from 'bun:test';
import { CATEGORIES } from '../scripts/global-cats';
import { MEDIA_SOURCES } from '../scripts/global-sources';
import { PEOPLE_SOURCES } from '../scripts/global-people';
import { connectors, platformCatalog } from '../src/lib/connectors';
import { twitterConnector } from '../src/lib/connectors/twitter';
import { truthsocialConnector } from '../src/lib/connectors/truthsocial';

const ALL_SOURCES = [...MEDIA_SOURCES, ...PEOPLE_SOURCES];
const CAT_SLUGS = new Set(CATEGORIES.map((c) => c.slug));

describe('کاتالوگ دسته‌های موضوعی', () => {
  test('۱۱ دسته در فایل seed + khodro موجود در پایگاه = ۱۲ دسته', () => {
    // khodro از قبل با کمیته ۷ نفره در پایگاه است و در این فایل مدیریت نمی‌شود
    expect(CATEGORIES.length).toBe(11);
    expect(CATEGORIES.some((c) => c.slug === 'khodro')).toBe(false);
  });
  test('slugها یکتا و مطابق الگو هستند', () => {
    const slugs = new Set(CATEGORIES.map((c) => c.slug));
    expect(slugs.size).toBe(CATEGORIES.length);
    for (const s of slugs) expect(/^[a-z0-9-]+$/.test(s)).toBe(true);
  });
  test('هر دسته پرامپت کمیته کارشناسی با نقش‌های شماره‌دار دارد', () => {
    for (const c of CATEGORIES) {
      expect(c.prompt.length).toBeGreaterThan(1200);
      // حداقل ۵ کارشناس شماره‌دار (اعداد فارسی)
      const roles = (c.prompt.match(/^[۰-۹0-9]\)/gm) || []).length;
      expect(roles).toBeGreaterThanOrEqual(5);
      // قواعد مشترک و ممنوعیت نتیجه‌گیری سیاستی
      expect(c.prompt).toContain('تاریخ انتشار');
      expect(c.prompt).toContain('ممنوع');
    }
  });
});

describe('کاتالوگ منابع جهانی', () => {
  test('حداقل ۷۵ منبع در seed جهانی تعریف شده (با منابع قبلی ≥ ۱۰۰)', () => {
    expect(ALL_SOURCES.length).toBeGreaterThanOrEqual(75);
  });

  test('کلید (پلتفرم، شناسه) یکتا است', () => {
    const keys = ALL_SOURCES.map((s) => `${s.platform}:${s.identifier}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('همه پلتفرم‌ها در رجیستری اتصال‌دهنده‌ها موجودند', () => {
    for (const s of ALL_SOURCES) {
      expect(connectors[s.platform]).toBeDefined();
    }
  });

  test('همه منابع گرایش سیاسی مستند و نوع منبع معتبر دارند', () => {
    for (const s of ALL_SOURCES) {
      expect(s.politicalOrientation.length).toBeGreaterThanOrEqual(8);
      expect(s.trustNote.length).toBeGreaterThanOrEqual(15);
      expect(['رسانه', 'شخصیت', 'نهاد رسمی']).toContain(s.entityType);
      expect(s.region.length).toBeGreaterThan(1);
    }
  });

  test('همه دسته‌های ارجاع‌شده در فهرست دسته‌ها موجودند', () => {
    for (const s of ALL_SOURCES) {
      for (const slug of s.categories) {
        expect(CAT_SLUGS.has(slug)).toBe(true);
      }
    }
  });

  test('RSSهای مستقیم با https و URL معتبرند؛ تجمیعی‌ها صریحاً برچسب دارند', () => {
    for (const s of ALL_SOURCES) {
      if (s.platform === 'rss') {
        expect(s.identifier.startsWith('https://') || s.identifier.startsWith('http://')).toBe(true);
        if (s.identifier.includes('news.google.com')) {
          expect(s.fetchMethod).toContain('تجمیع‌کننده');
        }
      }
    }
  });

  test('پوشش جغرافیایی موردنظر — تطبیق زیررشته در کل کشورها', () => {
    const regions = ALL_SOURCES.map((s) => s.region).join(' | ');
    for (const r of ['چین', 'روسیه', 'آمریکا', 'بریتانیا', 'آلمان', 'فرانسه', 'ترکیه', 'هند', 'پاکستان', 'اسرائیل', 'قطر', 'عربستان سعودی', 'هنگ‌کنگ', 'عراق', 'افغانستان']) {
      expect(regions).toContain(r);
    }
  });

  test('شخصیت‌های موردنظر: اوباما، ترامپ، ماسک، نتانیاهو، ظریف، قالیباف، پهلوی، مودی، مکرون، اردوغان، زلنسکی', () => {
    const names = ALL_SOURCES.map((s) => s.name).join(' | ');
    for (const k of ['اوباما', 'ترامپ', 'بایدن', 'کلینتون', 'پمپئو', 'بولتون', 'روبیو', 'ونس', 'سندرز', 'کارلسون', 'نتانیاهو', 'لاپید', 'بن گویر', 'گانتز', 'ظریف', 'قالیباف', 'پهلوی', 'علی‌نژاد', 'اسماعیلیون', 'مودی', 'مکرون', 'اردوغان', 'زلنسکی', 'استارمر', 'پوتین']) {
      expect(names).toContain(k);
    }
  });

  test('شی جین‌پینگ و بن‌سلمان حساب ساختگی ندارند — محدودیت صریح ثبت شده', () => {
    const names = ALL_SOURCES.map((s) => s.name).join(' | ');
    expect(names).not.toContain('شی جین‌پینگ —');
    expect(names).not.toContain('محمد بن سلمان —');
  });

  test('حساب‌های ایکس شناسه معتبر دارند (نام کاربر بدون @)', () => {
    for (const s of ALL_SOURCES.filter((x) => x.platform === 'twitter')) {
      expect(/^[A-Za-z0-9_]{2,15}$/.test(s.identifier)).toBe(true);
      expect(twitterConnector.validateIdentifier(twitterConnector.normalizeIdentifier(s.identifier))).toBe(true);
    }
  });

  test('حساب‌های تروث سوشال شناسه معتبر دارند', () => {
    for (const s of ALL_SOURCES.filter((x) => x.platform === 'truthsocial')) {
      expect(truthsocialConnector.validateIdentifier(truthsocialConnector.normalizeIdentifier(s.identifier))).toBe(true);
    }
  });
});

describe('اتصال‌دهنده‌های توییتر و تروث سوشال — پیاده‌سازی واقعی', () => {
  test('هر دو در کاتالوگ پلتفرم‌ها به‌عنوان پیاده‌سازی‌شده ثبت‌اند', () => {
    const tw = platformCatalog.find((p) => p.key === 'twitter');
    const ts = platformCatalog.find((p) => p.key === 'truthsocial');
    expect(tw?.implemented).toBe(true);
    expect(ts?.implemented).toBe(true);
    expect(tw?.limits.length).toBeGreaterThan(30); // محدودیت‌ها صریح
    expect(ts?.limits.length).toBeGreaterThan(30);
  });

  test('پیاده‌سازی همه اتصال‌دهنده‌ها fetchRecent دارد و محدودیت صادقانه اعلام می‌کنند', () => {
    for (const c of Object.values(connectors)) {
      expect(typeof c.fetchRecent).toBe('function');
      expect(c.limitsDescription.length).toBeGreaterThan(20);
      expect(c.authDescription.length).toBeGreaterThan(5);
    }
  });
});

describe('قواعد فیلتر گرایش UI — هیچ منبعی در فیلترها نامرئی نمی‌شود', () => {
  const GROUPS: Array<{ name: string; re: RegExp }> = [
    { name: 'میانه', re: /مرکز|میانه|مستقل/ },
    { name: 'راست', re: /راست|محافظه‌کار|ناسیونالیست|جمهوری‌خواه|اصولگرا/ },
    { name: 'چپ', re: /چپ|لیبرال|دموکرات|پیشرو|اصلاح‌طلب/ },
    { name: 'رسمی/دولتی', re: /رسمی|دولتی/ },
    { name: 'اپوزیسیون', re: /اپوزیسیون/ },
    { name: 'هم‌سو با حاکمیت', re: /هم‌سو|وابسته|نزدیک/ },
    { name: 'نهاد بین‌المللی', re: /نهاد/ },
  ];
  test('هر منبع حداقل در یک گروه فیلتر می‌افتد', () => {
    for (const s of ALL_SOURCES) {
      const hit = GROUPS.some((g) => g.re.test(s.politicalOrientation));
      expect(hit).toBe(true);
    }
  });
  test('پوشش متوازن: هم منابع راست و هم چپ/لیبرال و هم رسمی در کاتالوگ هست', () => {
    const all = ALL_SOURCES.map((s) => s.politicalOrientation).join(' | ');
    expect(/راست|محافظه‌کار|اصولگرا/.test(all)).toBe(true);
    expect(/چپ|لیبرال|دموکرات|اصلاح‌طلب/.test(all)).toBe(true);
    expect(/رسمی|دولتی/.test(all)).toBe(true);
    expect(/اپوزیسیون/.test(all)).toBe(true);
  });
});
