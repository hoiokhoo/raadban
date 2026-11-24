/**
 * پیش‌نمایش کارت‌های خواستهٔ ۲۵ نوامبر — ذخیره در download/preview/ + راستی‌آزمایی کدی:
 *  ۱) کارت بنفش «متن کامل خبرها» (سرریز خامِ پیشین)؛
 *  ۲) کارت بنفش «متن کامل توییت‌ها»؛
 *  ۳) کارت بنفش «اطلاعیه فروش خودرو»؛
 *  ۴) کارت خبر ۸ردیفی در تراکم ۳× (جنگ/ایران کهربایی).
 * راستی‌آزمایی: ابعاد، غیرخالی‌بودن، حضور پیکسل بنفش/کهربایی (هیچ کارت سفید/سیاه نمی‌ماند).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderFullTextCardPng, makeFullTextCardSvg } from '../bot/fulltext-card';
import { renderNewsCardPng, type NewsCardItem } from '../bot/news-card';
import { tripleDateOf } from '../bot/calendar';
import { faDigits } from '../bot/daily';

const DATE = tripleDateOf('2026-11-25', 'Asia/Tehran', 'umalqura');
const OUT = '/home/z/my-project/download/preview';
mkdirSync(OUT, { recursive: true });

async function main() {
  // ۱) کارت بنفش متن کامل خبر — سرریز سه‌خطی/ظرفیتی
  const newsFull = await renderFullTextCardPng({
    date: DATE,
    title: 'متن کامل خبرها',
    items: [
      { source: 'خبرگزاری تسنیم', text: 'فرمانده کل قوا در مراسم صبحگاهی گفت: هرگونه تهدید نظامی علیه ایران با پاسخ قاطح مواجه خواهد شد و نیروهای مسلح در بالاترین آمادگی دفاعی قرار دارند. جزئیات کامل بیانیه در ادامهٔ خبر آمده است و تحلیل کارشناسان نشان می‌دهد تنش‌ها در منطقه کاهش نیافته است.' },
      { source: 'ایسنا', text: 'شورای پول و اعتبار بانک مرکزی مصوبهٔ تازهٔ تسهیلات صنعتی را تصویب کرد؛ بر اساس این مصوبه نرخ سود تسهیلات بخش تولید با هدف حمایت از خطوط تولید کاهش می‌یابد و بانک‌ها موظف به اجرا از ابتدای ماه آینده هستند.' },
    ],
  });
  writeFileSync(`${OUT}/fulltext-news-purple.png`, newsFull!.png);

  // ۲) کارت بنفش متن کامل توییت
  const tweetFull = await renderFullTextCardPng({
    date: DATE,
    title: 'متن کامل توییت‌ها',
    items: [
      { source: '𝕏 Donald Trump', name: 'دونالد ترامپ (رئیس‌جمهور آمریکا)', text: 'ترجمهٔ کامل توییت بلند مقام آمریکایی دربارهٔ تحولات منطقه‌ای و سیاست تعرفه‌های جدید وارداتی که پیش‌تر در پیام متنی خام ارسال می‌شد و حالا روی کارت تصویری با رنگ پس‌زمینهٔ متفاوت می‌آید.' },
    ],
  });
  writeFileSync(`${OUT}/fulltext-tweets-purple.png`, tweetFull!.png);

  // ۳) کارت بنفش اطلاعیه فروش خودرو
  const saleFull = await renderFullTextCardPng({
    date: DATE,
    title: 'اطلاعیه فروش خودرو',
    items: [
      { source: 'متن کامل اطلاعیه', text: 'شرکت ایران‌خودرو پیش‌فروش محصول تازهٔ خود را از روز شنبه آغاز می‌کند. متقاضیان می‌توانند از طریق سایت رسمی ثبت‌نام کنند. تحویل خودروها به‌صورت مرحله‌ای در سه ماه آینده انجام می‌شود.' },
      { source: 'سایت فروش', text: 'ایران‌خودرو — ikco.ir' },
      { source: 'قیمت فروش کارخانه', text: `${faDigits('1610000000')} تومان (استخراج هوشمند از متن اطلاعیه)` },
      { source: 'قیمت بازار آزاد', text: `${faDigits('3600000000')} تومان — جک J4` },
    ],
  });
  writeFileSync(`${OUT}/fulltext-sale-purple.png`, saleFull!.png);

  // ۴) کارت خبر ۸ردیفی ۳× — جنگ/ایران کهربایی
  const newsItems: NewsCardItem[] = [
    { text: 'گزارش جنگ: درگیری مرزی در منطقه تشدید شد و هر دو طرف تلفات اعلام کردند', tick: true, source: 'تسنیم' },
    { text: 'دلار در بازار آزاد تهران با جهش تازه مواجه شد', tick: true, source: 'مهر' },
    { text: 'تیم ملی والیبال ایران به مرحلهٔ بعد راه یافت', tick: false, source: 'ایسنا' },
    { text: 'قرارداد صادرات فولاد میان دو کشور امضا شد', tick: true, source: 'ایلنا' },
    { text: 'قیمت بنزین در بازارهای جهانی اندکی کاهش یافت', tick: false, source: 'فارس' },
    { text: 'نمایشگاه فناوری‌های نوین در تهران گشایش یافت', tick: false, source: 'ایرنا' },
    { text: 'تیم فوتبال استقلال در دیدار شبانه به پیروزی رسید', tick: false, source: 'خبر ورزشی' },
    { text: 'ماهوارهٔ ارتباطی تازه با موفقیت در مدار قرار گرفت', tick: false, source: 'باشگاه خبر' },
  ];
  const news = await renderNewsCardPng({ date: DATE, items: newsItems });
  writeFileSync(`${OUT}/news-card-8rows-3x.png`, news!.png);

  // راستی‌آزمایی کدی — ابعاد، تراکم ۳×، پیکسل‌های بنفش/کهربایی، غیرخالی
  const sharp = (await import('sharp')).default;
  for (const [name, buf, expectPurple] of [
    ['fulltext-news-purple.png', newsFull!.png, true],
    ['fulltext-tweets-purple.png', tweetFull!.png, true],
    ['fulltext-sale-purple.png', saleFull!.png, true],
    ['news-card-8rows-3x.png', news!.png, false],
  ] as const) {
    const img = sharp(buf);
    const meta = await img.metadata();
    const { data } = await img.raw().toBuffer({ resolveWithObject: true });
    let nonBg = 0;
    let purple = 0;
    let amber = 0;
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
      if (r + g + b < 720) nonBg++; // غیر سفیدِ خالص
      if (b > r && b > 150 && r > 120 && b - g > 25 && g > 130) purple++; // بنفش سربرگ/ردیف
      if (r > 200 && g > 140 && g < 200 && b < 120) amber++; // کهربایی هایلایت
    }
    const total = data.length / 3;
    console.log(`${name}: ${meta.width}x${meta.height} nonBg=${(nonBg / total * 100).toFixed(1)}% purple=${(purple / total * 100).toFixed(2)}% amber=${(amber / total * 100).toFixed(2)}% size=${Math.round(buf.length / 1024)}KB`);
    if (meta.width !== 3240) throw new Error(`${name}: عرض ${meta.width} ≠ ۳۲۴۰ (۳×)`);
    if (meta.width + meta.height! > 9800) throw new Error(`${name}: از سقف بله گذشت`);
    if (nonBg / total < 0.05) throw new Error(`${name}: کارت تقریباً خالی است`);
    if (expectPurple && purple === 0) throw new Error(`${name}: پیکسل بنفش ندارد`);
    if (name.startsWith('news-') && amber === 0) throw new Error(`${name}: هایلایت کهربایی جنگ/ایران رندر نشد`);
    if (name.startsWith('fulltext-news') && amber === 0) throw new Error(`${name}: هایلایت جنگ رندر نشد`);
  }
  console.log('✅ همهٔ پیش‌نمایش‌ها رندر و راستی‌آزمایی شدند');
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
