/**
 * seed رویدادهای مهم پیش رو — فقط داده واقعی مستند (قابلیت ۱٫۱-د)
 * هر رکورد با منبع ذخیره می‌شود؛ «نامشخص» صریح؛ هیچ عدد ساختگی ممنوع.
 * اجرا: bun run scripts/seed-events.ts
 * منابع ثبت‌شده: CNN poll of polls (۲۲-۲۶ اکتبر ۲۰۲۶)، وزارت خارجه آمریکا (G20 میامی)،
 * UNFCCC/پارلمان اروپا (COP31 آنتالیا)، and other public trackers.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

interface PollRow { label: string; value: number; unit: string; color: string; source: string; sourceUrl?: string; asOf: string }
interface MapRow { label: string; value: number; color: string; note?: string }
interface SourceRow { name: string; url: string }

const EVENTS: Array<{
  slug: string; title: string; scope: string; category: string;
  eventDateISO?: string; eventDateEndISO?: string; dateNote?: string; dateCertainty: string;
  description: string; importance: number; status?: string;
  polls?: PollRow[]; map?: MapRow[]; mapNote?: string; liveMapUrl?: string;
  sources: SourceRow[];
}> = [
  {
    slug: 'us-midterms-2026',
    title: 'انتخابات میان‌دوره‌ای کنگره آمریکا',
    scope: 'ایالات متحده',
    category: 'انتخابات',
    eventDateISO: '2026-11-03',
    dateCertainty: 'قطعی',
    description:
      'همه ۴۳۵ کرسی مجلس نمایندگان، ۳۵ کرسی سنا (به‌علاوه انتخابات ویژه چند کرسی) و ۳۶ فرمانداری هم‌زمان برگزار می‌شود. جمهوری‌خواهان با اکثریت باریک در هر دو مجلس وارد انتخابات می‌شوند و نتیجه این رأی‌گیری، قدرت قانون‌گذاری دو سال پایانی دوره ترامپ را تعیین می‌کند. طبق الگوی تاریخی، حزب رئیس‌جمهور در میان‌دوره‌ها معمولاً کرسی از دست می‌دهد.',
    importance: 5,
    polls: [
      { label: 'دموکرات‌ها (رأی سراسری کنگره)', value: 52, unit: '٪', color: '#2563eb', source: 'میانگین نظرسنجی‌های CNN', sourceUrl: 'https://www.cnn.com', asOf: '2026-10-26' },
      { label: 'جمهوری‌خواهان (رأی سراسری کنگره)', value: 43, unit: '٪', color: '#dc2626', source: 'میانگین نظرسنجی‌های CNN', sourceUrl: 'https://www.cnn.com', asOf: '2026-10-26' },
      { label: 'میانگین ۵ تجمیع‌گر عمومی — دموکرات', value: 51.5, unit: '٪', color: '#2563eb', source: 'گزارش تجمیعی رسانه‌ای', sourceUrl: 'https://www.riotimesonline.com', asOf: '2026-10-29' },
    ],
    map: [
      { label: 'مجلس نمایندگان — جمهوری‌خواه (ترکیب پیش از انتخابات)', value: 219, color: '#dc2626', note: 'حدودی؛ شامل تغییرات کرسی خالی' },
      { label: 'مجلس نمایندگان — دموکرات (ترکیب پیش از انتخابات)', value: 213, color: '#2563eb', note: 'حدودی' },
      { label: 'سنا — جمهوری‌خواه (ترکیب پیش از انتخابات)', value: 53, color: '#dc2626' },
      { label: 'سنا — دموکرات و مستقل‌های متحد (ترکیب پیش از انتخابات)', value: 47, color: '#2563eb' },
    ],
    mapNote: 'ترکیب کنگره پیش از انتخابات (تقریبی). برای وضعیت لحظه‌ای ایالت‌به‌ایالت و پیش‌بینی مدل‌ها به ردیاب‌های زنده مراجعه کنید.',
    liveMapUrl: 'https://www.racetothewh.com',
    sources: [
      { name: 'CNN — Poll of Polls (رأی سراسری، ۲۲-۲۶ اکتبر ۲۰۲۶، اختلاف ~۹ واحد به سود دموکرات‌ها)', url: 'https://www.cnn.com' },
      { name: 'Race to the WH — ردیاب روزانه نظرسنجی میان‌دوره', url: 'https://www.racetothewh.com' },
      { name: 'Silver Bulletin (Nate Silver) — مدل FLIPR برای سنا/نمایندگان/فرمانداری', url: 'https://www.natesilver.net' },
      { name: 'Sabato\u2019s Crystal Ball — ارزیابی رقابت‌ها', url: 'https://centerforpolitics.org' },
    ],
  },
  {
    slug: 'cop31-antalya-2026',
    title: 'کنفرانس اقلیمی COP31 — آنتالیا',
    scope: 'جهانی (ترکیه)',
    category: 'کنفرانس بین‌المللی',
    eventDateISO: '2026-11-09',
    eventDateEndISO: '2026-11-20',
    dateCertainty: 'قطعی',
    description:
      'سی‌ویکمین کنفرانس اطراف کنوانسیون چارچوب سازمان ملل در تغییر اقلیم از ۹ تا ۲۰ نوامبر ۲۰۲۶ در مرکز اکسپو آنتالیای ترکیه با حضور ۱۹۷ طرف برگزار می‌شود. موضوعات محوری: نحوه پیگیری هدف ۱٫۵ درجه، تأمین مالی اقلیمی کشورهای در حال توسعه و مسیر پس از گزارش شکاف انتشار UNEP. برگزاری در ترکیه با ریاست مذاکراتی مشترک با استرالیا توافق شده بود.',
    importance: 4,
    sources: [
      { name: 'UNFCCC — برنامه رسمی COP31 آنتالیا (۹-۲۰ نوامبر ۲۰۲۶)', url: 'https://unfccc.int' },
      { name: 'پارلمان اروپا — بحث نشست COP31 آنتالیا (اکتبر ۲۰۲۶)', url: 'https://multimedia.europarl.europa.eu' },
    ],
  },
  {
    slug: 'g20-miami-2026',
    title: 'اجلاس سران G20 — میامی',
    scope: 'جهانی (ایالات متحده)',
    category: 'اجلاس بین‌المللی',
    eventDateISO: '2026-12-14',
    eventDateEndISO: '2026-12-15',
    dateCertainty: 'قطعی',
    description:
      'دونالد ترامپ میزبان اجلاس سران گروه ۲۰ در میامی فلوریدا در ۱۴ و ۱۵ دسامبر ۲۰۲۶ است. اولویت‌های اعلام‌شده ریاست آمریکایی: کاهش بار مقرراتی، زنجیره تأمین انرژی مقرون‌به‌صرفه و امن، و نوآوری در فناوری‌های نوظهور (شامل چارچوب «ائتلاف شکوفایی هوش مصنوعی»). این نخستین اجلاس سران G20 بر خاک آمریکاست و در حساس‌ترین لحظه روابط اقتصادی آمریکا-چین و جنگ اوکراین/خاورمیانه برگزار می‌شود.',
    importance: 4,
    sources: [
      { name: 'وزارت خارجه آمریکا — لجستیک رسانه‌ای اجلاس سران G20 میامی (۱۴-۱۵ دسامبر ۲۰۲۶)', url: 'https://www.state.gov/releases/office-of-the-spokesman/2026/10/media-logistics-for-the-g20-leaders-summit-in-miami-florida' },
      { name: 'سایت رسمی ریاست آمریکایی G20 ۲۰۲۶', url: 'https://g20.org' },
    ],
  },
  {
    slug: 'france-presidentielle-2027',
    title: 'انتخابات ریاست‌جمهوری فرانسه',
    scope: 'فرانسه',
    category: 'انتخابات',
    dateNote: 'دور اول در آوریل و دور دوم در مه ۲۰۲۷ — تاریخ دقیق طبق روال چند ماه قبل اعلام می‌شود',
    dateCertainty: 'تقریبی',
    description:
      'پنج‌ساله دوره امانوئل ماکرون در مه ۲۰۲۷ تمام می‌شود؛ دور اول انتخابات طبق الگوی دوره‌های پیش (۲۰۲۲ و ۲۰۱۷) در اواسط آوریل ۲۰۲۷ برگزار می‌شود. با خروج از صحنه برخی چهره‌های شاخص و صعود راست‌های رقیب، این انتخابات برای مسیر اروپا (بودجه، دفاع، اوکراین) تعیین‌کننده است. نامزدهای قطعی هنوز ثبت نشده‌اند.',
    importance: 4,
    sources: [
      { name: 'قانون اساسی جمهوری فرانسه — موعد پنج‌ساله و تقویم دوره‌های پیشین', url: 'https://www.conseil-constitutionnel.fr' },
    ],
  },
  {
    slug: 'israel-knesset-next',
    title: 'انتخابات کنست اسرائیل (موعد نامشخص)',
    scope: 'اسرائیل',
    category: 'انتخابات',
    dateNote: 'تاریخ قطعی اعلام نشده — بسته به بقا یا سقوط ائتلاف، زودهنگام یا حداکثر تا موعد قانونی',
    dateCertainty: 'نامشخص',
    description:
      'ائتلاف بنیامین نتانیاهو در کنست با اکثریت باریک کار می‌کند و سرنوشت آن به تصمیم فراکسیون‌های کوچک بستگی دارد؛ تاریخ انتخابات بعدی (زودهنگام یا موعد قانونی) هنوز اعلام نشده است. این رویداد صرفاً به‌عنوان «نامشخص» ثبت شده و هر عدد یا تاریخ قطعی درباره آن ساخته نمی‌شود.',
    importance: 4,
    sources: [
      { name: 'کنست — قواعد انحلال و انتخابات', url: 'https://main.knesset.gov.il' },
    ],
  },
  {
    slug: 'wef-davos-2027',
    title: 'نشست سالانه مجمع جهانی اقتصاد — داووس',
    scope: 'جهانی (سوئیس)',
    category: 'اقتصاد',
    dateNote: 'اواسط ژانویه ۲۰۲۷ — طبق الگوی سالانه (تاریخ رسمی بعداً اعلام می‌شود)',
    dateCertainty: 'تقریبی',
    description:
      'نشست سالانه مجمع جهانی اقتصاد هر سال در اواسط ژانویه در داووس سوئیس برگزار می‌شود و مهم‌ترین گردهمایی سالانه رؤسای دولت‌ها، بانک‌های مرکزی و غول‌های فناوری است. نسخه ۲۰۲۷ نخستین نشست بزرگ پس از میان‌دوره‌ای آمریکا و COP31 خواهد بود.',
    importance: 3,
    sources: [
      { name: 'مجمع جهانی اقتصاد — تقویم نشست‌های سالانه', url: 'https://www.weforum.org' },
    ],
  },
  {
    slug: 'cpc-21st-congress',
    title: 'کنگره ملی بیست‌ویکمین حزب کمونیست چین',
    scope: 'چین',
    category: 'سیاست داخلی کشورها',
    dateNote: 'پاییز ۲۰۲۷ — طبق الگوی پنج‌ساله (۲۰۲۲، ۲۰۱۷، ...)؛ تاریخ دقیق اعلام نشده',
    dateCertainty: 'تقریبی',
    description:
      'مهم‌ترین رویداد سیاسی چین هر پنج سال یک‌بار برگزار می‌شود: تعیین ترکیب کمیته دائمی پلیتبورو و مسیر پنج‌ساله آینده کشور. کنگره بیست‌ویکم طبق الگو در اکتبر-نوامبر ۲۰۲۷ برگزار می‌شود و ترکیب رهبری پس از شی جین‌پینگ یا چیدمان دوره چهارم او را مشخص خواهد کرد.',
    importance: 4,
    sources: [
      { name: 'الگوی تاریخی کنگره‌های حزب (۱۹۲۱ تاکنون — هر ۵ سال)', url: 'https://www.britannica.com' },
    ],
  },
  {
    slug: 'expo-2027-belgrade',
    title: 'نمایشگاه جهانی تخصصی اکسپو ۲۰۲۷ — بلگراد',
    scope: 'جهانی (صربستان)',
    category: 'رویداد بزرگ',
    eventDateISO: '2027-05-15',
    eventDateEndISO: '2027-08-15',
    dateCertainty: 'تقریبی',
    description:
      'نمایشگاه جهانی تخصصی (Expo) از مه تا اوت ۲۰۲۷ در بلگراد با محوریت «تربیت برای بازی فردا» برگزار می‌شود — نخستین اکسپو جهانی در منطقه بالکان و بزرگ‌ترین رویداد چندجانبه‌ای میزبانی‌شده توسط صربستان، با حضور دهها کشور و اثر مستقیم بر زیرساخت و اقتصاد منطقه.',
    importance: 2,
    sources: [
      { name: 'BIE — دفتر بین‌المللی نمایشگاه‌ها، صفحه رسمی اکسپو بلگراد ۲۰۲۷', url: 'https://www.bie-paris.org' },
    ],
  },
];

async function main() {
  console.log('=== seed رویدادهای پیش رو (فقط داده مستند) ===');
  for (const ev of EVENTS) {
    const data = {
      slug: ev.slug,
      title: ev.title,
      scope: ev.scope,
      category: ev.category,
      eventDateISO: ev.eventDateISO || null,
      eventDateEndISO: ev.eventDateEndISO || null,
      dateNote: ev.dateNote || null,
      dateCertainty: ev.dateCertainty,
      description: ev.description,
      importance: ev.importance,
      status: ev.status || 'پیش_رو',
      pollsJson: ev.polls ? JSON.stringify(ev.polls) : null,
      mapJson: ev.map ? JSON.stringify({ rows: ev.map, note: ev.mapNote || null }) : null,
      liveMapUrl: ev.liveMapUrl || null,
      sourcesJson: JSON.stringify(ev.sources),
    };
    await db.majorEvent.upsert({
      where: { slug: ev.slug },
      create: data,
      update: {
        title: data.title, scope: data.scope, category: data.category,
        eventDateISO: data.eventDateISO, eventDateEndISO: data.eventDateEndISO,
        dateNote: data.dateNote, dateCertainty: data.dateCertainty,
        description: data.description, importance: data.importance, status: data.status,
        pollsJson: data.pollsJson, mapJson: data.mapJson, liveMapUrl: data.liveMapUrl,
        sourcesJson: data.sourcesJson,
      },
    });
    console.log(`  ✓ ${ev.title}`);
  }
  const count = await db.majorEvent.count();
  console.log(`مجموع رویدادها: ${count}`);
}

main().finally(() => db.$disconnect());
