/**
 * تکمیل گرایش سیاسی و نوع منبع برای منابع قدیمی (seedهای قبلی)
 * مطابق همان استاندارد: توصیف مستند مالکیت/خط تحریریه
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const UPDATES: Array<{
  match: RegExp; // تشخیص بر اساس نام
  entityType: string; politicalOrientation: string; region?: string;
}> = [
  // --- ایران داخلی قدیمی ---
  { match: /^خبرگزاری مهر/, entityType: 'رسانه', politicalOrientation: 'رسمی/دولتی — خبرگزاری وابسته به صدا و سیما' },
  { match: /^خبرآنلاین/, entityType: 'رسانه', politicalOrientation: 'میانه — سایت خبری عمومی با گرایش اصلاح‌طلبانه در پوشش سیاسی' },
  { match: /^دنیای اقتصاد/, entityType: 'رسانه', politicalOrientation: 'راست‌میانه اقتصادی — روزنامه تخصصی اقتصاد' },
  { match: /^مشرق نیوز/, entityType: 'رسانه', politicalOrientation: 'اصولگرا — سایت تحلیلی نزدیک به جریان انقلابی' },
  { match: /^اقتصادآنلاین/, entityType: 'رسانه', politicalOrientation: 'میانه اقتصادی — رسانه تخصصی اقتصاد' },
  { match: /^خبرگزاری تسنیم/, entityType: 'رسانه', politicalOrientation: 'اصولگرا — نزدیک به بدنه امنیتی و جریان انقلابی' },
  { match: /^کانال خبر ایتا/, entityType: 'رسانه', politicalOrientation: 'میانه — کانال خبری عمومی پلتفرم ایتا' },
  // --- خارجی قدیمی (seed-foreign) ---
  { match: /^بی‌بی‌سی — بین‌الملل/, entityType: 'رسانه', politicalOrientation: 'مرکز — رسانه عمومی بریتانیا با استقلال قانونی تحریریه', region: 'بریتانیا' },
  { match: /^بی‌بی‌سی فارسی/, entityType: 'رسانه', politicalOrientation: 'مرکز با چارچوب بریتانیا — منتقد حاکمیت ایران', region: 'بریتانیا' },
  { match: /^سی‌ان‌ان/, entityType: 'رسانه', politicalOrientation: 'میانه‌چپ/لیبرال — تمایل به دموکرات‌ها', region: 'آمریکا' },
  { match: /^فاکس‌نیوز/, entityType: 'رسانه', politicalOrientation: 'محافظه‌کار/راست — نزدیک به جمهوری‌خواهان', region: 'آمریکا' },
  { match: /^ام‌اس‌ان‌بی‌سی/, entityType: 'رسانه', politicalOrientation: 'لیبرال/میانه‌چپ — سهم بالای برنامه‌های نظری دموکرات‌ها', region: 'آمریکا' },
  { match: /^رویترز/, entityType: 'رسانه', politicalOrientation: 'مرکز — بزرگ‌ترین آژانس بین‌المللی با رویه منبع‌محوری', region: 'بریتانیا/کانادا' },
  { match: /^الجزیره انگلیسی/, entityType: 'رسانه', politicalOrientation: 'هم‌سو با حاکمیت قطر — منتقد آمریکا و اسرائیل در خاورمیانه', region: 'قطر' },
  { match: /^الجزیره عربی/, entityType: 'رسانه', politicalOrientation: 'هم‌سو با حاکمیت قطر — نسخه عربی', region: 'قطر' },
  { match: /^العربیه/, entityType: 'رسانه', politicalOrientation: 'هم‌سو با حاکمیت عربستان سعودی (گروه MBC)', region: 'عربستان سعودی' },
  { match: /^اسکای‌نیوز/, entityType: 'رسانه', politicalOrientation: 'مرکز — بریتانیایی (گروه کامکست) با پوشش نسبتاً متوازن', region: 'بریتانیا' },
  { match: /^المیادین/, entityType: 'رسانه', politicalOrientation: 'هم‌سو با محور مقاومت — مستقر در بیروت', region: 'لبنان' },
  { match: /^المسیره/, entityType: 'رسانه', politicalOrientation: 'وابسته به انصارالله (حوثی‌ها) — یمن', region: 'یمن' },
  { match: /شبکه ۱۲ اسرائیل|کانال ۱۲/, entityType: 'رسانه', politicalOrientation: 'میانه‌راست اسرائیلی — رسانه اصلی با چارچوب امنیت ملی', region: 'اسرائیل' },
  { match: /شبکه ۱۴ اسرائیل|NOW14/, entityType: 'رسانه', politicalOrientation: 'راست اسرائیل — نزدیک به نتانیاهو', region: 'اسرائیل' },
  { match: /اخبار ملی اسرائیل|Israel National News/, entityType: 'رسانه', politicalOrientation: 'راست اسرائیل (آروتز شووا)', region: 'اسرائیل' },
  { match: /^دفتر مقام معظم رهبری/, entityType: 'نهاد رسمی', politicalOrientation: 'رسمی — دفتر رهبر جمهوری اسلامی ایران', region: 'ایران' },
  { match: /^دفتر رئیس‌جمهور/, entityType: 'نهاد رسمی', politicalOrientation: 'رسمی — دفتر رئیس‌جمهور ایران', region: 'ایران' },
  { match: /ترامپ — تروث سوشال|trumpstruth/, entityType: 'شخصیت', politicalOrientation: 'جمهوری‌خواه/محافظه‌کار — رئیس‌جمهور آمریکا', region: 'آمریکا' },
  // --- اشخاص X قدیمی (seed-foreign) ---
  { match: /ایلان ماسک/, entityType: 'شخصیت', politicalOrientation: 'میانه با تمایل راست‌گرای اخیر — کارآفرین و مالک X', region: 'آمریکا' },
  { match: /بنیامین نتانیاهو/, entityType: 'شخصیت', politicalOrientation: 'راست اسرائیل — نخست‌وزیر اسرائیل', region: 'اسرائیل' },
  { match: /رضا پهلوی/, entityType: 'شخصیت', politicalOrientation: 'اپوزیسیون سکولار — خارج از کشور', region: 'آمریکا/اپوزیسیون' },
];

async function main() {
  const sources = await db.source.findMany({
    where: { platform: { in: ['rss', 'twitter', 'truthsocial', 'telegram', 'eitaa', 'web'] }, politicalOrientation: null },
    select: { id: true, name: true, platform: true },
  });
  let patched = 0;
  for (const s of sources) {
    const u = UPDATES.find((x) => x.match.test(s.name));
    if (u) {
      await db.source.update({
        where: { id: s.id },
        data: { entityType: u.entityType, politicalOrientation: u.politicalOrientation, ...(u.region ? { region: u.region } : {}) },
      });
      patched++;
      console.log(`✓ تکمیل شد: ${s.name}`);
    } else {
      console.log(`⚠ بدون قاعده: ${s.name} [${s.platform}]`);
    }
  }
  const remaining = await db.source.count({ where: { politicalOrientation: null } });
  console.log(`\nتکمیل‌شده: ${patched} | بدون گرایش (شخصیت‌های بی‌طرف/عمومی): ${remaining}`);
}

main().finally(() => db.$disconnect());
