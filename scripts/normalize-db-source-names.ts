/**
 * یکسان‌سازی نام منابع خبری خارجی در بانک اطلاعاتی سامانه به انگلیسی
 * (خواستهٔ کاربر ۶ نوامبر ۲۰۲۶: «اسم منابع خارجی همگی انگلیسی باشن»)
 * منابع داخلی ایران و اشخاص (با هندل لاتین) دست‌نخورده می‌مانند.
 * اجرا: bun scripts/normalize-db-source-names.ts (idempotent)
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const EN: Record<string, string> = {
  'بی‌بی‌سی — بین‌الملل (BBC World)': 'BBC World',
  'بی‌بی‌سی فارسی': 'BBC Persian',
  'سی‌ان‌ان (CNN World)': 'CNN World',
  'فاکس‌نیوز (Fox News World)': 'Fox News World',
  'ام‌اس‌ان‌بی‌سی (MSNBC — مسیر جایگزین)': 'MSNBC',
  'رویترز (Reuters — مسیر جایگزین)': 'Reuters',
  'الجزیره انگلیسی (Al Jazeera English)': 'Al Jazeera English',
  'الجزیره عربی (الجزيرة نت)': 'Al Jazeera Arabic',
  'العربیه (Al Arabiya — مسیر جایگزین)': 'Al Arabiya',
  'اسکای‌نیوز (Sky News World)': 'Sky News World',
  'المیادین (Al Mayadeen — مسیر جایگزین)': 'Al Mayadeen',
  'المسیره (Al Masirah — مسیر جایگزین)': 'Al Masirah',
  'شبکه ۱۲ اسرائیل (کانال ۱۲ — مسیر جایگزین)': 'Israel Channel 12',
  'شبکه ۱۴ اسرائیل (NOW14 — مسیر جایگزین)': 'NOW14 Israel',
  'اخبار ملی اسرائیل (Israel National News — جایگزین قابل‌دسترس)': 'Israel National News',
  'ایران اینترنشنال (Iran International)': 'Iran International',
  'رادیو فردا (Radio Farda — تجمیعی)': 'Radio Farda',
  'دی‌وی فارسی (DW Persian)': 'DW Persian',
  'فرانس ۲۴ فارسی (France 24 Persian)': 'France 24 Persian',
  'یورونیوز فارسی (Euronews Persian)': 'Euronews Persian',
  'رادیو زمانه (Radio Zamaneh — تجمیعی)': 'Radio Zamaneh',
  'شینهوا انگلیسی (Xinhua English)': 'Xinhua English',
  'گلوبال تایمز (Global Times)': 'Global Times',
  'CGTN (China Global TV Network)': 'CGTN',
  "روزنامه مردم انگلیسی (People's Daily English)": "People's Daily English",
  'چاینا دیلی (China Daily)': 'China Daily',
  'ساوت چاینا مورنینگ پست (SCMP)': 'SCMP',
  'تاس انگلیسی (TASS English)': 'TASS English',
  'RT (Russia Today)': 'RT',
  'اسپوتنیک (Sputnik)': 'Sputnik',
  'نیویورک تایمز (NYT World)': 'NYT World',
  'آسوشیتد پرس (AP News)': 'AP News',
  'ان‌پی‌آر (NPR World)': 'NPR World',
  'پولیتیکو (Politico — تجمیعی)': 'Politico',
  'د هیل (The Hill)': 'The Hill',
  'بلومبرگ (Bloomberg — تجمیعی)': 'Bloomberg',
  'واشنگتن پست (Washington Post — تجمیعی)': 'Washington Post',
  'وال‌استریت ژورنال (WSJ World)': 'WSJ World',
  'گاردین — بین‌الملل (Guardian World)': 'Guardian World',
  'گاردین — محیط زیست (Guardian Environment)': 'Guardian Environment',
  'دی‌وی انگلیسی (DW English World)': 'DW English',
  'فرانس ۲۴ انگلیسی (France 24 English)': 'France 24 English',
  'آژانس آناتولی (Anadolu — تجمیعی)': 'Anadolu Agency',
  'TRT فارسی (TRT Persian — تجمیعی)': 'TRT Persian',
  'تایمز آو اسرائیل (Times of Israel — تجمیعی)': 'Times of Israel',
  'هاآرتص انگلیسی (Haaretz English)': 'Haaretz English',
  'الشرق الاوسط (Asharq Al-Awsat)': 'Asharq Al-Awsat',
  'السومرية (Alsumaria — عراق)': 'Alsumaria',
  'العربی الجدید (Al-Araby Al-Jadeed)': 'Al-Araby Al-Jadeed',
  'تایمز آو ایندیا (Times of India)': 'Times of India',
  'د هیندو (The Hindu — International)': 'The Hindu',
  'دان (Dawn — پاکستان، تجمیعی)': 'Dawn',
  'طلوع‌نیوز (TOLOnews — افغانستان)': 'TOLOnews',
  'ESPN (تجمیعی)': 'ESPN',
  'سازمان جهانی بهداشت (WHO News)': 'WHO News',
  'سازمان خواربار و کشاورزی (FAO News)': 'FAO News',
  'ولادیمیر پوتین — کرملین (kremlin.ru)': 'Kremlin (kremlin.ru)',
};

let renamed = 0;
for (const [oldName, en] of Object.entries(EN)) {
  const r = await db.source.updateMany({ where: { name: oldName }, data: { name: en } });
  if (r.count > 0) renamed += r.count;
}
console.log(`تغییرنام‌شده: ${renamed} منبع`);
const remainingFa = await db.source.findMany({
  where: { region: { not: 'ایران' }, name: { not: { contains: '@' } } },
  select: { name: true },
});
const stillPersian = remainingFa.filter((s) => /[پچژگآابسد]/.test(s.name) && !/[A-Za-z]/.test(s.name));
console.log(`منابع خارجی باقی‌مانده با نام فارسی خالص: ${stillPersian.length}${stillPersian.length ? ' → ' + stillPersian.map((s) => s.name).join(' | ') : ''}`);
await db.$disconnect();
