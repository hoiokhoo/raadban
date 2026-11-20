/**
 * بازسازی دقیق کارتِ شکایت کاربر — «یه تیکه پرچم آمریکا افتاده روی توییت!!!» —
 * همان توییت مایک جانسون با 🇺🇸 داخل متن؛ پیش و پس از پالایش.
 * اجرا: bun scripts/preview-tweet-flag.ts
 */
import { renderTweetCardPng, stripCardEmoji, type TweetCardItem } from '../bot/news-card';
import { tripleDateOf } from '../bot/calendar';
import { writeFileSync } from 'node:fs';

const date = tripleDateOf('2026-11-20', 'Asia/Tehran', 'umalqura');

/** همان توییتِ عکسِ کاربر — با پرچم داخل متن */
const johnsonRaw = 'اقترت جمهوری‌خواه ما در مجلس نمایندگان 🇺🇸 با فرماندهی دونالد ترامپ کار خواهد کرد تا ایران را برای همیشه از سلاح هسته‌ای باز دارد — امسال به قدرت برمی‌گردیم!';
const johnson: TweetCardItem = { source: '𝕏 Mike Johnson', fa: johnsonRaw, faName: 'مایک جانسون (رئیس مجلس نمایندگان آمریکا)' };

const items: TweetCardItem[] = [
  { source: '𝕏 Ursula von der Leyen', fa: 'ما همچنین در جهت تلاش بیشتر همکاری می‌کنیم. امروز، مذاکرات برای تسهیل تجارت در محصولات کشاورزی و غذایی را به پایان رساندیم.', faName: 'اروسولا فون در لاین (رئیس کمیسیون اروپا)' },
  johnson,
  { source: '𝕏 Benjamin Netanyahu', fa: 'به چپو پولید حالا، شمار ۳ لیست رغم کوش دهد. آزیزکات این هفته با او جانشین رئیس پارلمان شد و با او می‌خواهند دولت تشکیل دهند.', faName: 'بنیمین نتانیاهو (نخست‌وزیر رژیم صهیونیستی)' },
  { source: '𝕏 Benjamin Netanyahu', fa: 'لیبکود: اینها همان افراد هستنده که بلوک چپ می‌خواهد بر اساس آن‌ها امنیت اسرائیل و سرنوشت دولت بیوند را بنا بدهد.', faName: 'بنیمین نتانیاهو (نخست‌وزیر رژیم صهیونیستی)' },
  { source: '𝕏 Ursula von der Leyen', fa: 'ما بر سر «طرح تجربهٔ جوانان» به توافق رسیده‌ایم. این طرح به 100,000 جوان در هر دو طرف کانال امکان می‌دهد تا حداکثر سه سال را در کشور دیگر بگذرانند.', faName: 'اروسولا فون در لاین (رئیس کمیسیون اروپا)' },
];

const rendered = await renderTweetCardPng({ date, items });
if (!rendered) { console.error('رندر ناموفق'); process.exit(1); }
writeFileSync('/home/z/my-project/download/preview-tweet-noflag.png', rendered.png);
console.log(`کارت اصلاح‌شده: download/preview-tweet-noflag.png (${rendered.width}×${rendered.height})`);
console.log(`متن جانسون پس از پالایش: ${stripCardEmoji(johnsonRaw)}`);
console.log(`پرچم در SVG نیست: ${!stripCardEmoji(johnsonRaw).includes('🇺🇸')}`);
