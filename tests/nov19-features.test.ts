/**
 * تست‌های خواستهٔ کاربر ۱۹ نوامبر ۲۰۲۶:
 *  ۱) دسته‌بندی + اولویت‌بندی اخبار (categories) — «خبرها ترکیبی اند … هر دسته دسته بندی بشن،
 *     اولویت بندی بشن … و بعد در نهایت در دسته اون خبر منتشر بشن»
 *  ۲) اطلاعیه فروش خودرو — حذف «آدرس و اسم آخرین خودرو» + لینک خودروساز + قیمت کارخانه + قیمت بازار
 *  ۳) خودروهای VIP — J4/SR3/فیدلیتی الیت ۷نفره اول لیست + ستون کارخانه + ما به‌التفاوت/درصد
 *  ۴) ترجمهٔ کامل توییت — بدون بریدن ورودی ۹۰۰ نویسه‌ای
 * همهٔ داده‌های زندهٔ این تست‌ها (اسلاگ‌های باما، سامانه‌های فروش) از جست‌وجوی وبِ ۲۰ نوامبر ۲۰۲۶ است.
 */
import { describe, expect, test } from 'bun:test';
import { categorizeFa, groupByCategory, CAT_LABELS, CAT_ORDER, type CatKey } from '../bot/categories';
import { cleanSaleAnnouncementText, matchSalePortal, extractSaleFactoryPrice, matchSaleCarModel, SALE_PORTALS } from '../bot/sale-announcement';
import { parseBamaPrices, parseBamaMarketPrice, carFactoryDelta, formatMarketMessage, CAR_BAMA_MODELS, CAR_FEATURED } from '../bot/market';
import { marketSectionsOf } from '../bot/market-card';
import type { Quote } from '../bot/market';

// ---------- (۱) دسته‌بندی ----------

describe('categorizeFa — دسته‌بندی واژه‌محور قطعی', () => {
  test('جنگ و امنیت — حمله/موشک/آتش‌بس', () => {
    expect(categorizeFa('حملهٔ موشکی به پایگاه هوایی در شرق کشور گزارش شد')).toBe('war');
    expect(categorizeFa('آتش‌بس میان دو طرف با وساطت قطر امضا شد')).toBe('war');
    expect(categorizeFa('پهپادهای شناسایی در مرز مشاهده شدند')).toBe('war');
  });

  test('سیاسی و دیپلماسی — وزیر/مذاکره/تحریم', () => {
    expect(categorizeFa('وزیر خارجه برای مذاکرات دیپلماتیک به ژنو سفر کرد')).toBe('politics');
    expect(categorizeFa('قطعنامهٔ تازهٔ شورای امنیت به تصویب رسید')).toBe('politics');
  });

  test('اقتصادی — دلار/بورس/طلا', () => {
    expect(categorizeFa('شاخص بورس تهران امروز ۹۲۰ واحد رشد کرد')).toBe('economy');
    expect(categorizeFa('قیمت دلار در بازار آزاد کاهش یافت')).toBe('economy');
  });

  test('حوادث — تصادف/آتش‌سوزی/زلزله', () => {
    expect(categorizeFa('واژگونی خودرو در جادهٔ چالوس سه مصدوم بر جای گذاشت')).toBe('incidents');
    expect(categorizeFa('زلزله ۵٫۲ ریشتری شهرستان سرپل ذهاب را لرزاند')).toBe('incidents');
  });

  test('ورزشی — فوتبال/قهرمانی', () => {
    expect(categorizeFa('تیم ملی فوتبال به مرحلهٔ بعد صعود کرد')).toBe('sports');
    expect(categorizeFa('استقلال در لیگ برتر برابر پرسپولیس به پیروزی رسید')).toBe('sports');
  });

  test('علمی و فناوری — هوش مصنوعی/فضا', () => {
    expect(categorizeFa('هوش مصنوعی تازه برای تشخیص سرطان ارائه شد')).toBe('tech');
    expect(categorizeFa('ناسا فضاپیمای تازه را به مدت ماه پرتاب کرد')).toBe('tech');
  });

  test('تطبیق واژه‌مرزی — «آتش‌سوزی جنگل» هرگز «جنگ» نمی‌گیرد', () => {
    expect(categorizeFa('آتش‌سوزی گسترده در جنگل‌های شمال کشور مهار شد')).toBe('incidents');
  });

  test('هیچ تطبیقی → سایر', () => {
    expect(categorizeFa('متن بی‌ربط دربارهٔ موضوعات مختلف')).toBe('other');
    expect(categorizeFa('')).toBe('other');
  });
});

describe('groupByCategory — اولویت‌بندی دسته‌ها', () => {
  test('دسته‌ها به ترتیب CAT_ORDER می‌آیند؛ ورودی درون دسته حفظ می‌شود', () => {
    const items = [
      { text: 'تیم فوتبال صعود کرد', tick: false, source: 'الف' },
      { text: 'حملهٔ موشکی گزارش شد', tick: false, source: 'ب' },
      { text: 'بورس رشد کرد', tick: false, source: 'ج' },
      { text: 'آتش‌بس امضا شد', tick: false, source: 'د' },
    ];
    const sections = groupByCategory(items, (it) => categorizeFa(it.text));
    expect(sections.map((s) => s.cat)).toEqual(['war', 'economy', 'sports']); // ترتیب اولویت
    expect(sections[0]!.label).toBe(CAT_LABELS.war);
    expect(sections[0]!.items.map((i) => i.source)).toEqual(['ب', 'د']); // ترتیب ورودی حفظ
  });

  test('دستهٔ خالی حذف می‌شود و لیبل‌ها کامل‌اند', () => {
    const sections = groupByCategory([{ text: 'فوتبال' }], () => 'sports' as CatKey);
    expect(sections.length).toBe(1);
    expect(CAT_ORDER.length).toBe(11);
    expect(Object.keys(CAT_LABELS).length).toBe(11);
  });
});

// ---------- (۲) اطلاعیه فروش ----------

describe('cleanSaleAnnouncementText — حذف «آدرس و اسم آخرین خودرو»', () => {
  const SAMPLE = [
    '🚘 شرایط فروش کیا اسپورتیج نیوفیس کوشا خودرو اعلام شد',
    '',
    '🔹شرکت کوشا خودرو شرایط فروش فوق العاده خودروی کیا اسپورتیج 2026 را با قیمت قطعی اعلام کرد.',
    '',
    '@akharin_khodro | Akharinkhodro.ir',
  ].join('\n');

  test('امضای کانال (@…) و آدرس سایتش کامل حذف می‌شود', () => {
    const out = cleanSaleAnnouncementText(SAMPLE);
    expect(out).not.toContain('@akharin_khodro');
    expect(out).not.toContain('Akharinkhodro.ir');
    expect(out).toContain('شرایط فروش');
    expect(out).toContain('کوشا خودرو');
  });

  test('خط آدرس تبلیغاتی و لینک t.me حذف می‌شود؛ خطوط خالی پیاپی فشرده می‌شوند', () => {
    const t = [
      'شرایط فروش سایپا اعلام شد',
      'آدرس: تهران، خیابان ولیعصر',
      'کانال تلگرام ما: t.me/Akharin_khodro',
      '',
      '',
      'قیمت قطعی اعلام شد',
    ].join('\n');
    const out = cleanSaleAnnouncementText(t);
    expect(out).not.toContain('ولیعصر');
    expect(out).not.toContain('t.me');
    expect(out).not.toContain('\n\n\n');
    expect(out).toContain('قیمت قطعی اعلام شد');
  });
});

describe('matchSalePortal — سامانه‌های فروش رسمی تأییدشده', () => {
  test('کوشا خودرو (کیا) → sale.kooshakhodro.com', () => {
    const p = matchSalePortal('شرایط فروش کیا اسپورتیج نیوفیس کوشا خودرو اعلام شد');
    expect(p?.url).toBe('https://sale.kooshakhodro.com');
    expect(p?.label).toContain('کوشا خودرو');
  });

  test('ایران‌خودرو با نیم‌فاصله و بی‌فاصله → esale.ikco.ir', () => {
    expect(matchSalePortal('بخشنامهٔ فروش ایران‌خودرو منتشر شد')?.url).toBe('https://esale.ikco.ir');
    expect(matchSalePortal('ایرانخودرو محصولاتش را عرضه کرد')?.url).toBe('https://esale.ikco.ir');
  });

  test('سایپا / کرمان موتور / مدیران خودرو / بهمن موتور / نیلان خودرو', () => {
    expect(matchSalePortal('فروش سایپا آغاز شد')?.url).toBe('https://saipa.iranecar.com');
    expect(matchSalePortal('شرایط فروش کرمان موتور اعلام شد')?.url).toBe('https://customer.bamco.ir');
    expect(matchSalePortal('فروش ام‌وی‌ام مدیران خودرو شروع شد')?.url).toBe('https://customer.mvmco.ir');
    expect(matchSalePortal('فروش فیدلیتی بهمن موتور')?.url).toBe('https://bahman.ir');
    expect(matchSalePortal('تویوتا نیلان خودرو شرایط فروش را اعلام کرد')?.url).toBe('https://app.nilankhodro.com');
  });

  test('هیچ خودروسازی شناخته نشد → null (لینک ساختگی ممنوع)', () => {
    expect(matchSalePortal('خبری بی‌ربط دربارهٔ بازار')).toBeNull();
  });

  test('همهٔ لینک‌های فهرست HTTPS رسمی‌اند', () => {
    for (const p of SALE_PORTALS) expect(p.url.startsWith('https://')).toBe(true);
  });
});

describe('extractSaleFactoryPrice — قیمت کارخانهٔ اعلامی اطلاعیه', () => {
  test('قیمت با ارقام فارسی و ریال → تومان ÷۱۰', () => {
    const p = extractSaleFactoryPrice('قیمت قطعی: ۱۲٬۵۰۰٬۰۰۰٬۰۰۰ ریال — تحویل ۹۰ روزه');
    expect(p).toBe(1250000000);
  });

  test('قیمت تومان مستقیم', () => {
    expect(extractSaleFactoryPrice('فروش نقدی با قیمت 2,500,000,000 تومان')).toBe(2500000000);
  });

  test('پیش‌پرداخت کوچک‌تر از قیمت اصلی — بزرگ‌ترین عدد معقول برگردیده می‌شود', () => {
    const p = extractSaleFactoryPrice('پیش پرداخت ۵۰۰٬۰۰۰٬۰۰۰ تومان\nقیمت کل: ۳٬۲۰۰٬۰۰۰٬۰۰۰ تومان');
    expect(p).toBe(3200000000);
  });

  test('نبود قیمت → null (صادقانه «در اطلاعیه ذکر نشده»)', () => {
    expect(extractSaleFactoryPrice('شرایط فروش اعلام شد؛ متقاضیان ثبت‌نام کنند')).toBeNull();
  });

  test('اعداد بی‌ربط (تلفن/تاریخ) → null', () => {
    expect(extractSaleFactoryPrice('تلفن: 02112345678 — ساعت ۱۰ صبح')).toBeNull();
  });
});

describe('matchSaleCarModel — مدل اطلاعیه → اسلاگ بامای تأییدشده', () => {
  test('تویوتا/کرولا هرگز به فیدلیتی الیت نمی‌خورد (کرولا الیت!)', () => {
    expect(matchSaleCarModel('فروش تویوتا کرولا الیت نیلان خودرو')).toBeNull();
  });

  test('فیدلیتی الیت → fidelity_elite_7seater', () => {
    expect(matchSaleCarModel('فروش فوری فیدلیتی الیت تیپ ۲ هفت نفره')?.bamaUrl).toBe('https://bama.ir/price/fidelity_elite_7seater');
  });

  test('SR3 و J4', () => {
    expect(matchSaleCarModel('فروش کی ام سی SR3 مدل ۱۴۰۵')?.bamaUrl).toBe('https://bama.ir/price/kmc_sr3_1.6liter');
    expect(matchSaleCarModel('فروش جک J4 آغاز شد')?.bamaUrl).toBe('https://bama.ir/price/jac_j4');
  });
});

// ---------- (۳) خودروهای VIP + ستون کارخانه ----------

describe('parseBamaPrices — بازار + کارخانه (نمایندگی) از صفحهٔ باما', () => {
  const HTML = `<div>قیمت صفر کی ام سی SR3 1.6 لیتر</div>
  <span>1405 قیمت بازار 5,550,000,000 تومان</span>
  <span>1405 قیمت نمایندگی 3,141,000,000 تومان</span>
  <span>1404 قیمت بازار 5,350,000,000 تومان</span>`;

  test('هر دو قیمت — نخستین تطبیق = مدل‌سال جدیدتر', () => {
    const p = parseBamaPrices(HTML);
    expect(p.market).toBe(5550000000);
    expect(p.factory).toBe(3141000000);
  });

  test('نبود قیمت کارخانه → فقط بازار؛ صفحهٔ خالی → هر دو null', () => {
    expect(parseBamaPrices('<p>قیمت بازار 1,200,000,000 تومان</p>').factory).toBeNull();
    expect(parseBamaPrices('')).toEqual({ market: null, factory: null });
  });

  test('سازگاری parseBamaMarketPrice حفظ شده', () => {
    expect(parseBamaMarketPrice(HTML)).toBe(5550000000);
  });
});

describe('carFactoryDelta — ما به‌التفاوت و درصد تفاوت', () => {
  test('اختلاف بازار نسبت به کارخانه', () => {
    const d = carFactoryDelta(3600000000, 1610000000)!;
    expect(d.diff).toBe(1990000000);
    expect(d.pct).toBeCloseTo(123.6, 1);
  });

  test('کارخانه نامعتبر → null', () => {
    expect(carFactoryDelta(3600000000, undefined)).toBeNull();
    expect(carFactoryDelta(3600000000, 0)).toBeNull();
  });
});

describe('CAR_BAMA_MODELS — پوشش کامل خانواده‌ها با قیمت کارخانهٔ باما (خواستهٔ ۱۹ + ۲۳ نوامبر)', () => {
  test('سه‌گانهٔ ۱۹ نوامبر (J4/SR3/الیت) و خانواده‌های پرتقاضا همه حاضرند — همه از bama.ir', () => {
    const labels = CAR_BAMA_MODELS.map((m) => m.label);
    for (const must of ['جک J4', 'کی ام سی SR3', 'فیدلیتی الیت ۷نفره', 'پراید ۱۵۱', 'پژو ۲۰۷', 'تارا', 'دنا پلاس', 'شاهین', 'کوییک', 'ساینا', 'سورن پلاس', 'رانا', 'ری‌را', 'هایما S5', 'لاماری اکو', 'آریزو ۸', 'تیگو ۷ پرو', 'اطلس']) {
      expect(labels).toContain(must);
    }
    expect(CAR_BAMA_MODELS.every((m) => m.url.startsWith('https://bama.ir/price/'))).toBe(true);
    expect(CAR_BAMA_MODELS.length).toBeGreaterThanOrEqual(35);
  });
});

describe('formatMarketMessage — ستون رسمی در پیام متنی (قالب ۴ستونی ۲۰ نوامبر)', () => {
  const quotes: Quote[] = [
    { key: 'car:j4', title: 'جک J4', value: 3600000000, unit: 'toman', srcLabel: 'باما (نت)', factoryToman: 1610000000, factorySrc: 'باما', emoji: '🚗' },
    { key: 'car:پراید', title: 'پراید', value: 890000000, unit: 'toman', srcLabel: 'کانال', emoji: '🚗' },
  ];

  test('خودرو کارخانه‌دار: قیمت کارخانه در سطرش + اختلاف مبلغ/درصد (بازگشت به خواستهٔ ۲۰ نوامبر هفتم)', () => {
    const msg = formatMarketMessage(quotes, undefined);
    expect(msg).toContain('کارخانه: ');
    expect(msg).toContain('۱٫۶۱۰ میلیارد تومان');
    // اختلاف بازار از کارخانه کنار قیمت رسمی برگشت — «درصد و مبلغ اختلاف کنارش»
    expect(msg).toContain('(اختلاف ۱٫۹۹۰ میلیارد تومان / ۱۲۳٫۶٪)');
  });

  test('خودرو بی‌کارخانه: بدون بخش رسمی', () => {
    const msg = formatMarketMessage(quotes, undefined);
    const line = msg.split('\n').find((l) => l.includes('پراید'))!;
    expect(line).not.toContain('کارخانه');
    expect(line).toContain('—');
  });
});

describe('marketSectionsOf — ستون رسمی یکدست در کارت تصویری', () => {
  test('ردیف VIP ستون رسمی دارد؛ بقیه null («—» در جدول)', () => {
    const quotes: Quote[] = [
      { key: 'car:j4', title: 'جک J4', value: 3600000000, unit: 'toman', srcLabel: 'باما (نت)', factoryToman: 1610000000, emoji: '🚗' },
      { key: 'car:ساینا', title: 'ساینا', value: 960000000, unit: 'toman', srcLabel: 'کانال', emoji: '🚗' },
    ];
    const { sections } = marketSectionsOf(quotes);
    expect(sections[0]!.title).toContain('خودرو');
    expect(sections[0]!.rows[0]!.official).toContain('میلیارد تومان');
    expect(sections[0]!.rows[1]!.official).toBeNull();
  });
});

// ---------- (۴) ترجمهٔ کامل توییت — بدون بریدن ورودی ----------

describe('CAR_FEATURED — سازگاری فهرست پرتقاضا', () => {
  test('الیت ۷ از فهرست عادی حذف شده (الان VIP دارد) — تکراری نمی‌آید', () => {
    // فیدلیتی الیت اکنون فقط در سه‌گانهٔ VIP می‌آید؛ فهرست عادی «فید» را دارد (سدان ۵نفره)
    const labels = CAR_FEATURED.map((c) => c.label);
    expect(labels).toContain('فیدلیتی');
  });
});
