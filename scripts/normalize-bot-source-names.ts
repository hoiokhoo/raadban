/**
 * یکسان‌سازی نام منابع خارجی به انگلیسی (خواستهٔ کاربر ۶ نوامبر ۲۰۲۶: «اسم منابع خارجی همگی انگلیسی باشن»)
 * + ترمیم منابع مردهٔ داخلی (فارس/یوجی‌سی ۴۰۴ → مسیر تجمیعی گوگل‌نیوز)
 * + حذف منبع مردهٔ بی‌جایگزین (صدا و سیما — هر دو مسیر ۴۰۴/بی‌خروجی)
 * + افزودن منابع داخلی غایب: ایرنا، همشهری آنلاین، انتخاب
 * منابع داخلی ایران فارسی می‌مانند.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'bot/sources.json';

/** نام انگلیسی — کلید = نام فعلی در فایل */
const EN_NAMES: Record<string, string> = {
  'CGTN (China Global TV Network)': 'CGTN',
  'ESPN (تجمیعی)': 'ESPN',
  'RT (Russia Today)': 'RT',
  'TRT فارسی (TRT Persian — تجمیعی)': 'TRT Persian',
  'آسوشیتد پرس (AP News)': 'AP News',
  'آژانس آناتولی (Anadolu — تجمیعی)': 'Anadolu Agency',
  'اخبار ملی اسرائیل (Israel National News — جایگزین قابل‌دسترس)': 'Israel National News',
  'اسپوتنیک (Sputnik)': 'Sputnik',
  'اسکای‌نیوز (Sky News World)': 'Sky News World',
  'الجزیره انگلیسی (Al Jazeera English)': 'Al Jazeera English',
  'الجزیره عربی (الجزيرة نت)': 'Al Jazeera Arabic',
  'السومرية (Alsumaria — عراق)': 'Alsumaria',
  'الشرق الاوسط (Asharq Al-Awsat)': 'Asharq Al-Awsat',
  'العربی الجدید (Al-Araby Al-Jadeed)': 'Al-Araby Al-Jadeed',
  'العربیه (Al Arabiya — مسیر جایگزین)': 'Al Arabiya',
  'المسیره (Al Masirah — مسیر جایگزین)': 'Al Masirah',
  'المیادین (Al Mayadeen — مسیر جایگزین)': 'Al Mayadeen',
  'ام‌اس‌ان‌بی‌سی (MSNBC)': 'MSNBC',
  'ان‌پی‌آر (NPR World)': 'NPR World',
  'ایران اینترنشنال (Iran International)': 'Iran International',
  'بلومبرگ (Bloomberg — تجمیعی)': 'Bloomberg',
  'بی‌بی‌سی فارسی': 'BBC Persian',
  'بی‌بی‌سی — بین‌الملل (BBC World)': 'BBC World',
  'تاس انگلیسی (TASS English)': 'TASS English',
  'تایمز آو اسرائیل (Times of Israel — تجمیعی)': 'Times of Israel',
  'تایمز آو ایندیا (Times of India)': 'Times of India',
  'د هیل (The Hill)': 'The Hill',
  'د هیندو (The Hindu — International)': 'The Hindu',
  'دان (Dawn — پاکستان، تجمیعی)': 'Dawn',
  'دی‌وی انگلیسی (DW English World)': 'DW English',
  'دی‌وی فارسی (DW Persian)': 'DW Persian',
  'رادیو زمانه (Radio Zamaneh — تجمیعی)': 'Radio Zamaneh',
  'رادیو فرانس اینترناسیونال فارسی (RFI فارسی)': 'RFI Persian',
  'رادیو فردا (Radio Farda — تجمیعی)': 'Radio Farda',
  "روزنامه مردم انگلیسی (People's Daily English)": "People's Daily English",
  'رویترز (Reuters — مسیر جایگزین)': 'Reuters',
  'سازمان جهانی بهداشت (WHO News)': 'WHO News',
  'سازمان خواربار و کشاورزی (FAO News)': 'FAO News',
  'ساوت چاینا مورنینگ پست (SCMP)': 'SCMP',
  'سی‌ان‌ان (CNN World)': 'CNN World',
  'شبکه ۱۲ اسرائیل (کانال ۱۲ — مسیر جایگزین)': 'Israel Channel 12',
  'شبکه ۱۴ اسرائیل (NOW14 — مسیر جایگزین)': 'NOW14 Israel',
  'شینهوا انگلیسی (Xinhua English)': 'Xinhua English',
  'طلوع‌نیوز (TOLOnews — افغانستان)': 'TOLOnews',
  'فاکس‌نیوز (Fox News World)': 'Fox News World',
  'فرانس ۲۴ انگلیسی (France 24 English)': 'France 24 English',
  'نیویورک تایمز (NYT World)': 'NYT World',
  'هاآرتص انگلیسی (Haaretz English)': 'Haaretz English',
  'واشنگتن پست (Washington Post — تجمیعی)': 'Washington Post',
  'وال‌استریت ژورنال (WSJ World)': 'WSJ World',
  'پرس‌تی‌وی (Press TV — انگلیسی)': 'Press TV',
  'پولیتیکو (Politico — تجمیعی)': 'Politico',
  'چاینا دیلی (China Daily)': 'China Daily',
  'گاردین — بین‌الملل (Guardian World)': 'Guardian World',
  'گاردین — محیط زیست (Guardian Environment)': 'Guardian Environment',
  'گلوبال تایمز (Global Times)': 'Global Times',
  'یورونیوز فارسی (Euronews Persian)': 'Euronews Persian',
  // تلگرام — منبع ایرانی‌زبانِ ایران؛ نام لاتین ذاتی‌اش
  presstv: 'Press TV',
};

const srcs: Array<Record<string, string>> = JSON.parse(readFileSync(FILE, 'utf8'));

const out: Array<Record<string, string>> = [];
const dropped: string[] = [];
for (const s of srcs) {
  // حذف منبع مرده — صدا و سیما: مسیر مستقیم ۴۰۴ و گوگل‌نیوز بدون خروجی (بررسی ۶ نوامبر ۲۰۲۶)
  if (s.name === 'خبرگزاری صدا و سیما (IRIB News)') { dropped.push(s.name); continue; }
  const next = { ...s };
  if (EN_NAMES[s.name]) next.name = EN_NAMES[s.name];
  // ترمیم مسیرهای مرده → تجمیع‌کنندهٔ گوگل‌نیوز (بررسی زندهٔ ۶ نوامبر ۲۰۲۶)
  if (s.name === 'خبرگزاری فارس (Fars)') {
    next.identifier = 'https://news.google.com/rss/search?q=site:farsnews.ir+when:3d&hl=fa&gl=IR&ceid=IR:fa';
  }
  if (s.name === 'باشگاه خبرنگاران جوان (YJC)') {
    next.identifier = 'https://news.google.com/rss/search?q=site:yjc.ir+when:3d&hl=fa&gl=IR&ceid=IR:fa';
  }
  out.push(next);
}

// افزودن منابع داخلی غایب — همه بررسی‌شده و سالم (۶ نوامبر ۲۰۲۶)
const ADD: Array<Record<string, string>> = [
  {
    name: 'خبرگزاری جمهوری اسلامی (ایرنا)', platform: 'rss', identifier: 'https://www.irna.ir/rss',
    url: 'https://www.irna.ir', language: 'fa', region: 'ایران', priority: 'عادی',
  },
  {
    name: 'همشهری آنلاین', platform: 'rss', identifier: 'https://www.hamshahrionline.ir/rss',
    url: 'https://www.hamshahrionline.ir', language: 'fa', region: 'ایران', priority: 'عادی',
  },
  {
    name: 'انتخاب', platform: 'rss',
    identifier: 'https://news.google.com/rss/search?q=site:entekhab.ir+when:3d&hl=fa&gl=IR&ceid=IR:fa',
    url: 'https://www.entekhab.ir', language: 'fa', region: 'ایران', priority: 'عادی',
  },
];
const have = new Set(out.map((s) => s.name));
for (const a of ADD) if (!have.has(a.name)) out.push(a);

writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n', 'utf8');
console.log(`منابع: ${srcs.length} → ${out.length} (حذف‌شده: ${dropped.join('، ') || 'هیچ'})`);
console.log(`نام‌های انگلیسی اعمال‌شده: ${Object.keys(EN_NAMES).length}`);
