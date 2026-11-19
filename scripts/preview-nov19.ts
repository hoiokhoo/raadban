/**
 * پیش‌نمایش زندهٔ خواسته‌های ۱۹ نوامبر — رندر کارت خبری با دسته‌بندی + کارت توییت فقط‌فارسی + پیام اطلاعیه فروش
 * اجرا: bun scripts/preview-nov19.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { makeNewsCardSvg, makeTweetCardSvg } from '../bot/news-card';
import { tripleDateOf } from '../bot/calendar';
import { categorizeFa, groupByCategory } from '../bot/categories';
import { cleanSaleAnnouncementText, matchSalePortal, extractSaleFactoryPrice, matchSaleCarModel } from '../bot/sale-announcement';
import { formatMoney } from '../bot/market';
import { renderTweetCardPng } from '../bot/news-card';

const date = tripleDateOf('2026-11-19', 'Asia/Tehran', 'umalqura');

// ---------- کارت خبری با دسته‌بندی ----------
const rawItems = [
  { text: 'حملهٔ هوایی به پایگاه هوایی در شرق کشور گزارش شد؛ خسارات در حال ارزیابی است', tick: true, source: 'رویترز' },
  { text: 'آتش‌بس میان دو طرف با وساطت قطر امضا شد و از فردا اجرایی می‌شود', tick: true, source: 'الجزیره' },
  { text: 'وزیر خارجه برای مذاکرات دیپلماتیک به ژنو سفر کرد', tick: false, source: 'ایرنا' },
  { text: 'قطعنامهٔ تازهٔ شورای امنیت با اکثریت آرا تصویب شد', tick: false, source: 'بی‌بی‌سی' },
  { text: 'شاخص بورس تهران امروز ۹۲۰ واحد رشد کرد و به مرز دو میلیون واحد رسید', tick: false, source: 'بورس‌نیوز' },
  { text: 'قیمت دلار در بازار آزاد با افت ۴۰۰ تومانی معامله شد', tick: false, source: 'tgju' },
  { text: 'واژگونی خودرو در جادهٔ چالوس سه مصدوم بر جای گذاشت', tick: false, source: 'ایرنا' },
  { text: 'آتش‌سوزی گسترده در جنگل‌های شمال کشور مهار شد', tick: false, source: 'ایرنا' },
  { text: 'هوش مصنوعی تازه برای تشخیص زودهنگام سرطان ارائه شد', tick: false, source: 'سی‌نت' },
  { text: 'ناسا فضاپیمای تازه را به مدت ماه پرتاب کرد', tick: false, source: 'اسپیس‌دات‌کام' },
  { text: 'تیم ملی فوتبال با دو گل به مرحلهٔ بعد صعود کرد', tick: true, source: 'ایسنا' },
  { text: 'استقلال در لیگ برتر برابر پرسپولیس به پیروزی رسید', tick: false, source: 'ایسنا' },
  { text: 'آزمون سراسری کنکور در هفتهٔ آینده برگزار می‌شود', tick: false, source: 'سنجش' },
  { text: 'نرخ رشد اقتصادی کشور در فصل دوم اعلام شد', tick: false, source: 'بانک مرکزی' },
];
const cardItems = groupByCategory(rawItems, (it) => categorizeFa(it.text)).flatMap((sec) => sec.items.map((it) => ({ ...it, section: sec.label })));
console.log('دسته‌ها:', [...new Set(cardItems.map((i) => i.section))].join(' | '));
const newsSvg = makeNewsCardSvg({ date, items: cardItems, total: 18, dropped: 1, part: { no: 1, of: 2 } });
mkdirSync('download/preview', { recursive: true });
writeFileSync('download/preview/news-card-nov19.svg', newsSvg);

const sharp = (await import('sharp')).default;
const newsPng = await sharp(Buffer.from(newsSvg), { density: 72 }).png().toBuffer();
writeFileSync('download/preview/news-card-nov19.png', newsPng);
console.log(`کارت خبری: ${newsSvg.length} بایت SVG → PNG ${Math.round(newsPng.length / 1024)} کیلوبایت`);

// ---------- کارت توییت فقط‌فارسی با ترجمهٔ کامل ----------
const tweetItems = [
  {
    source: '🅣 Donald Trump (تروث‌سوشال)',
    fa: 'ما در کاخ سفید در حال برگزاری جلسات متعددی دربارهٔ موضوعات مختلف هستیم. روزهای هیجان‌انگیزی در پیش است! به‌زودی اخبار مهمی دربارهٔ توافق اقتصادی با چند کشور بزرگ اعلام خواهم کرد. این توافق‌ها برای کارگران آمریکایی فوق‌العاده خواهد بود و هزاران شغل جدید ایجاد می‌کند. منتظر جزئیات کامل باشید — همه‌چیز طبق برنامه و بهتر از انتظار پیش می‌رود.',
    faName: 'دونالد ترامپ (رئیس‌جمهور آمریکا)',
    verified: true,
  },
  {
    source: '𝕏 mb_ghalibaf',
    fa: 'سیاست خارجی آمریکا، یا هر قدرت دیگری، هیچ‌گاه منافع ملت ایران را تأمین نمی‌کند. ما بر پایهٔ عزت، خردمندی و مصلحت حرکت می‌کنیم؛ نه بر پایهٔ تنش‌سازی و نه ذلت. راه تیم مذاکره‌کننده باید کاملاً شفاف و تحت نظارت مجلس باشد.',
    faName: 'محمدباقر قالیباف (رئیس مجلس شورای اسلامی)',
  },
  {
    source: '𝕏 araghchi',
    fa: 'دیپلماسی ایران فعال است؛ اما شفافیت و اعتماد مسیر دوطرفه می‌خواهد. مذاکره فقط وقتی نتیجه می‌دهد که طرف مقابل به تعهداتش پایبند بماند.',
    faName: 'سعید عراقچی (وزیر خارجه)',
  },
];
const twSvg = makeTweetCardSvg({ date, items: tweetItems });
const twPng = await renderTweetCardPng({ date, items: tweetItems });
writeFileSync('download/preview/tweet-card-nov19.svg', twSvg);
if (twPng) {
  writeFileSync('download/preview/tweet-card-nov19.png', twPng.png);
  console.log(`کارت توییت: ${twPng.width}×${twPng.height} — ${Math.round(twPng.png.length / 1024)} کیلوبایت`);
}

// ---------- اطلاعیه فروش — قالب تازه ----------
const sample = [
  '🚘 شرایط فروش کیا اسپورتیج نیوفیس کوشا خودرو اعلام شد',
  '',
  '🔹شرکت کوشا خودرو شرایط فروش فوق العاده خودروی کیا اسپورتیج 2026 را با قیمت قطعی و موعد تحویل 90 روزه اعلام کرد.',
  '',
  '🔹متقاضیان می توانند از ساعت 10 صبح روز یکشنبه 1 آذرماه 1405 با مراجعه به سایت فروش کوشا خودرو یا نمایندگی های منتخب این شرکت نسبت به ثبت نام اقدام نمایند.',
  '',
  '@akharin_khodro | Akharinkhodro.ir',
].join('\n');
const clean = cleanSaleAnnouncementText(sample);
const portal = matchSalePortal(clean);
const factory = extractSaleFactoryPrice(clean);
const model = matchSaleCarModel(clean);
const msg = [
  '🚗 <b>اطلاعیه فروش/پیش‌فروش خودرو</b>',
  '',
  clean,
  '',
  portal ? `🛒 <a href="${portal.url}">${portal.label}</a> — ${portal.url}` : '🛒 سایت فروش خودروساز: در اطلاعیه ذکر نشده بود',
  factory ? `🏭 قیمت فروش کارخانه: ${formatMoney(factory, 'toman')}` : '🏭 قیمت فروش کارخانه: در اطلاعیه ذکر نشده',
  model ? `📈 قیمت بازار آزاد (${model.label}): از باما واکشی می‌شود` : '📈 قیمت بازار آزاد: مدل در اطلاعیه مشخص نبود',
].join('\n');
console.log('--- اطلاعیه فروش (بدون تگ) ---');
console.log(msg.replace(/<[^>]+>/g, ''));
