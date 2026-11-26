/**
 * پیش‌نمایش بصری کارت‌های ممیزی ۲۷ نوامبر — رندر واقعی PNG برای بازبینی چشمی:
 * کارت خبر (بنر دسته بدون ایموجی + تیک برداری پانوشت + تراشهٔ «+N رویداد»)،
 * کارت توییت (بَج verified)، کارت بازار خودرو، کارت دارایی‌ها (ممیز فارسی)،
 * کارت متن‌کامل، نمودار دارایی‌ها (فلش برداری).
 * خروجی: /tmp/render/*.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderNewsCardPages, renderTweetCardPng, renderBreakingCardPng } from '../bot/news-card';
import { renderFullTextCardPng } from '../bot/fulltext-card';
import { renderMarketCardPng } from '../bot/market-card';
import { renderAssetsCardPng } from '../bot/assets-card';
import { renderAssetsChartPng, buildChartPanel } from '../bot/assets-chart';
import { tripleDateOf } from '../bot/calendar';
import type { Quote, MacroStats } from '../bot/market';
import type { NewsCardItem, TweetCardItem } from '../bot/news-card';
import type { FullTextCardItem } from '../bot/fulltext-card';

const DATE = tripleDateOf('2026-11-27', 'Asia/Tehran', 'umalqura');
const OUT = '/tmp/render';
mkdirSync(OUT, { recursive: true });

const news: NewsCardItem[] = [
  { text: 'حملهٔ موشکی به پایگاه هوایی در غرب کشور گزارش شد؛ پدافند سه پرنده را رهگیری کرد', tick: true, source: 'ایسنا + ایرنا', section: '⚔️ جنگ و امنیت' },
  { text: 'سخنگوی وزارت خارجه از ادامهٔ مذاکرات غیرمستقیم در مسقط خبر داد', tick: false, source: 'تسنیم', section: '⚔️ جنگ و امنیت' },
  { text: 'شاخص بورس تهران امروز ۹۲۰ واحد رشد کرد و ارزش معاملات خرد افزایش یافت', tick: true, source: 'بورس‌نیوز', section: '💰 اقتصادی' },
  { text: 'نرخ دلار در بازار آزاد کاهش یافت و سکه هم آرام گرفت', tick: false, source: 'tgju', section: '💰 اقتصادی' },
  { text: 'تیم ملی فوتبال به مرحلهٔ بعد صعود کرد', tick: false, source: 'ایسنا', section: '⚽ ورزشی' },
  { text: 'برنامهٔ جدید فضاپیمای پژوهشی رونمایی شد', tick: false, source: 'ایلنا', section: '🔬 علمی و فناوری' },
];

const pages = await renderNewsCardPages({ date: DATE, items: news, total: 9, dropped: 2 });
writeFileSync(`${OUT}/news-p1.png`, pages[0]!.png);
console.log('news-p1', pages[0]!.width, pages[0]!.height);

const tweets: TweetCardItem[] = [
  { source: 'Donald Trump — تروث‌سوشال', fa: 'صلح از طریق قدرت! ما همیشه برنده خواهیم بود و هیچ‌کس نمی‌تواند این ملت را متوقف کند، ما قوی‌ترین و بااتفاق‌ترین هستیم.', faName: 'دونالد ترامپ (رئیس‌جمهور آمریکا)', verified: true },
  { source: '𝕏 mb_ghalibaf', fa: 'ایران آماده است و مردم متحدند.', faName: 'محمدباقر قالیباف (رئیس مجلس)' },
];
const tw = await renderTweetCardPng({ date: DATE, items: tweets });
if (tw) { writeFileSync(`${OUT}/tweet.png`, tw.png); console.log('tweet', tw.width, tw.height); }

const cars: Quote[] = [
  { key: 'car:peugeot206', title: 'پژو ۲۰۶ تیپ ۵', value: 685_000_000, unit: 'toman', srcLabel: 'باما', changePct: 1.2 },
  { key: 'car:pride131', title: 'پراید ۱۳۱ مدل ۱۴۰۴', value: 385_000_000, unit: 'toman', srcLabel: 'باما', changePct: -0.6, officialToman: 305_000_000 },
  { key: 'car:shahin', title: 'شاهین هایکو', value: 830_000_000, unit: 'toman', srcLabel: 'باما', changePct: 0.8, factoryToman: 720_000_000 },
  { key: 'car:tiba2', title: 'تیبا ۲ صندوق‌دار', value: 420_000_000, unit: 'toman', srcLabel: 'باما' },
];
const mk = await renderMarketCardPng({ date: DATE, slotLabel: 'گزارش روزانه (ساعت ۱۵)', quotes: cars });
if (mk) { writeFileSync(`${OUT}/market.png`, mk.png); console.log('market', mk.width, mk.height); }

const assets: Quote[] = [
  { key: 'geram18', title: 'طلای ۱۸ عیار (هر گرم)', value: 8_450_000, unit: 'toman', srcLabel: 'tgju', changePct: 0.5, changeAbs: 40_000, officialToman: 8_100_000 },
  { key: 'sekee', title: 'سکهٔ بهار آزادی', value: 92_500_000, unit: 'toman', srcLabel: 'tgju', changePct: 12.3, changeAbs: 1_200_000 },
  { key: 'usd', title: 'دلار آمریکا', value: 113_500, unit: 'toman', srcLabel: 'نوبیتکس', changePct: -0.3, officialToman: 68_000 },
  { key: 'tedpix', title: 'شاخص کل بورس', value: 3_215_000, unit: 'index', srcLabel: 'بورس تهران', changePct: 0.9 },
];
const macro: MacroStats = {
  inflationYoy: { pct: 38.8, periodFa: 'مهر ۱۴۰۵' },
  inflationMom: { pct: 2.9, periodFa: 'مهر ۱۴۰۵' },
  housingTehran: { tomanPerM2: 152_000_000, periodFa: 'پاییز ۱۴۰۵' },
} as unknown as MacroStats;
const ac = await renderAssetsCardPng({ date: DATE, slotLabel: 'گزارش روزانه (ساعت ۱۵)', quotes: assets, macro });
if (ac) { writeFileSync(`${OUT}/assets.png`, ac.png); console.log('assets', ac.width, ac.height); }

const fts: FullTextCardItem[] = [
  { source: 'بلومبرگ', text: 'سندهای CoreWeave به پایین‌ترین سطح تاریخ رسیدند و سودهای سهام Nvidia نیز افت کرد؛ بازارهای مالی آمریکا واکنش نشان دادند و تحلیلگران به تورم و سیاست فدرال رزرو اشاره کردند.'.repeat(2) },
  { source: 'رویترز', text: 'مذاکرات غیرمستقیم دربارهٔ برنامهٔ هسته‌ای ادامه یافت.' },
];
const fc = await renderFullTextCardPng({ date: DATE, title: 'متن کامل خبرها', items: fts });
if (fc) { writeFileSync(`${OUT}/fulltext.png`, fc.png); console.log('fulltext', fc.width, fc.height); }

// نمودار دارایی‌ها — فلش برداری
const CHART_ASSETS: Array<{ key: string; title: string; unit: 'toman' | 'usd' | 'index' }> = [
  { key: 'geram18', title: 'طلای ۱۸ عیار', unit: 'toman' },
  { key: 'sekee', title: 'سکهٔ بهار آزادی', unit: 'toman' },
  { key: 'usd', title: 'دلار آمریکا', unit: 'toman' },
];
const panels = [];
for (let a = 0; a < 3; a++) {
  const closes: number[] = [];
  const dates: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(2026, 9, 22 + i));
    dates.push(d.toISOString().slice(0, 10));
    closes.push(100_000 * (1 + (a === 1 ? -0.01 : 0.01) * i));
  }
  const asset = CHART_ASSETS[a]!;
  const p = buildChartPanel(asset as never, { closes, dates } as never);
  if (p) panels.push(p);
}
if (panels.length >= 3) {
  const ch = await renderAssetsChartPng({ date: DATE, panels: panels.slice(0, 3) });
  if (ch) { writeFileSync(`${OUT}/chart.png`, ch.png); console.log('chart', ch.width, ch.height); }
}

const br = await renderBreakingCardPng({ source: '𝕏 CENTCOM', text: 'فرماندهی مرکزی آمریکا اعلام کرد که در پاسخ به تهدیدهای اخیر، آماده‌ترین وضعیت پدافندی را حفظ می‌کند و هرگونه تجاوز فوری پاسخ داده خواهد شد. نیروهای ما در بالاترین سطح آمادگی قرار دارند.', faName: 'سنتکام (فرماندهی مرکزی آمریکا)', date: DATE });
if (br) { writeFileSync(`${OUT}/breaking.png`, br.png); console.log('breaking', br.width, br.height); }
console.log('DONE');
