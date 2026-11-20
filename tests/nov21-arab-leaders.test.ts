/**
 * خواستهٔ ۲۱ نوامبر ۲۰۲۶ (یازدهم) — «نخست وزیر یا ولیعهد ها یا اشخاص مهم کشورهای عربی
 * مثه اردن رو هم اضافه کن» — دو تغییر وابسته:
 *
 *  ۱) دوازده حساب تازه به bot/tweets.json (چرخش عادی؛ سرِ اولویت دست‌نخورده):
 *     اردن: پادشاه عبدالله دوم + دربار هاشمی (بیانیه‌های ولیعهد اینجا می‌آید) + ایمن صفدی؛
 *     امارات: محمد بن زاید + محمد بن راشد + عبدالله بن زاید؛
 *     عربستان: شاهزاده فیصل بن فرحان + وزارت خارجه (محمد بن سلمان حساب ایکس ندارد)؛
 *     قطر: محمد بن عبدالرحمن آل ثانی + وزارت خارجه؛ مصر: وزارت خارجه؛ عراق: دفتر نخست‌وزیر.
 *     صادقانه: حساب تنها-نامی ولیعهد اردن (@al_husseinjo) خالی/تأییدنشده است — اضافه نشد؛
 *     بیانیه‌های ولیعهد از @RHCJO دیده‌بانی می‌شود.
 *  ۲) کلیدواژهٔ فوری عربی — بیانیه‌های این مقامات عربی است: «إيران» (همزهٔ زیر)، «ايران»
 *     (ی عربی)، «حرب» (جنگ)، «الجمهورية الإسلامية». نرمال‌سازی رسم‌الخط (أ/إ/آ→ا، ي→ی،
 *     ك→ک، حذف اعراب) + الگوی عربی تازه؛ فارسی و انگلیسی عیناً دست‌نخورده.
 *  ۳) پنجرهٔ چرخش ۶→۸ — فهرست ۲۷→۳۹ حساب؛ دور کامل چرخش همان ~۵ چرخه (~۵۰ دقیقه)
 *     می‌ماند و پنجرهٔ تازگی ۵ ساعته هر پست مقام عربی را می‌گیرد.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isBreakingTweetText, normalizeArabicVariants } from '../bot/breaking';
import {
  BREAKING_PRIORITY_DEFAULT,
  TWEET_ACCOUNTS_PER_CYCLE_DEFAULT,
  pickTweetAccountsForCycle,
  readTweetAccounts,
  type TweetAccount,
} from '../bot/bot';

const RAW = JSON.parse(readFileSync(join(import.meta.dir, '..', 'bot', 'tweets.json'), 'utf8')) as TweetAccount[];
const ACCS = readTweetAccounts(join(import.meta.dir, '..', 'bot', 'tweets.json'));

/** دوازده حساب عربی تازه — هندل + واژهٔ کلیدی نام فارسی (کشور/سمت) برای اطمینان از درستی محتوا */
const ARAB_ACCOUNTS: Array<{ handle: string; faContains: string[] }> = [
  { handle: 'KingAbdullahII', faContains: ['عبدالله دوم', 'پادشاه اردن'] },
  { handle: 'RHCJO', faContains: ['دربار هاشمی اردن', 'ولیعهد'] },
  { handle: 'AymanHsafadi', faContains: ['ایمن صفدی', 'اردن'] },
  { handle: 'MohamedBinZayed', faContains: ['محمد بن زاید', 'رئیس‌جمهور امارات'] },
  { handle: 'HHShkMohd', faContains: ['محمد بن راشد', 'نخست‌وزیر امارات'] },
  { handle: 'ABZayed', faContains: ['عبدالله بن زاید', 'امارات'] },
  { handle: 'FaisalbinFarhan', faContains: ['فیصل بن فرحان', 'عربستان'] },
  { handle: 'KSAMOFA', faContains: ['عربستان', 'خارجه'] },
  { handle: 'MBA_AlThani_', faContains: ['آل ثانی', 'نخست‌وزیر'] },
  { handle: 'MofaQatar_AR', faContains: ['قطر', 'خارجه'] },
  { handle: 'MFAEgOfficial', faContains: ['مصر', 'خارجه'] },
  { handle: 'IraqiPMO', faContains: ['نخست‌وزیر عراق', 'السودانی'] },
];

describe('مقامات عربی در فهرست تأثیرگذارها — خواستهٔ ۲۱ نوامبر', () => {
  test('هر دوازده حساب با نام فارسیِ درست و پلتفرم ایکس حضور دارند', () => {
    expect(ACCS.length).toBe(RAW.length);
    for (const { handle, faContains } of ARAB_ACCOUNTS) {
      const acc = ACCS.find((a) => a.handle.toLowerCase() === handle.toLowerCase());
      expect(acc).toBeDefined();
      expect(acc!.platform).toBe('x');
      expect(acc!.faName).toBeDefined();
      for (const w of faContains) expect(acc!.faName).toContain(w);
    }
  });

  test('هیچ حساب تکراری در فهرست نیست (هندل+پلتفرم یکتا)', () => {
    const keys = ACCS.map((a) => `${a.handle.toLowerCase()}|${a.platform}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('سرِ اولویت دست‌نخورده — ده حساب تثبیت‌شده، هیچ حساب عربی داخل سرِ فهرست نرفته', () => {
    expect(BREAKING_PRIORITY_DEFAULT).toBe(10);
    expect(ACCS.slice(0, 10).map((a) => a.handle.toLowerCase())).toEqual([
      'realdonaldtrump', 'realdonaldtrump', 'mb_ghalibaf', 'khamenei_ir',
      'drpezeshkian', 'araghchi', 'netanyahu', 'elonmusk', 'centcom', 'idf',
    ]);
    const head = new Set(ACCS.slice(0, BREAKING_PRIORITY_DEFAULT).map((a) => a.handle.toLowerCase()));
    for (const { handle } of ARAB_ACCOUNTS) expect(head.has(handle.toLowerCase())).toBe(false);
  });

  test('پنجرهٔ چرخش ۶→۸ — دور کامل چرخش ۳۹ حساب در ~۵ چرخه (~۵۰ دقیقه) می‌ماند', () => {
    expect(TWEET_ACCOUNTS_PER_CYCLE_DEFAULT).toBe(8);
    // شبیه‌سازی چرخه‌های پیاپی: نشانگر هر چرخه با nextCursor جلو می‌رود
    let cursor = 0;
    const seen = new Set<string>();
    for (let c = 0; c < 5; c++) {
      const { picked, nextCursor } = pickTweetAccountsForCycle(
        ACCS, cursor, TWEET_ACCOUNTS_PER_CYCLE_DEFAULT, BREAKING_PRIORITY_DEFAULT
      );
      for (const a of picked) seen.add(a.handle.toLowerCase());
      cursor = nextCursor;
    }
    // هر ۳۹ حساب — از جمله هر ۱۲ حساب عربی — در ۵ چرخه دیده می‌شوند
    for (const a of ACCS) expect(seen.has(a.handle.toLowerCase())).toBe(true);
    for (const { handle } of ARAB_ACCOUNTS) expect(seen.has(handle.toLowerCase())).toBe(true);
  });

  test('با پنجرهٔ قدیمیِ ۶، دور کامل ۷ چرخه لازم بود — ۸ سرعت را به سطح پیشین برمی‌گرداند', () => {
    // ترامپ دو ورودی دارد (ایکس + تروث‌سوشال) — معیار پوشش، شمار «هندل یکتا» است نه طول فهرست
    const uniqueHandles = new Set(ACCS.map((a) => a.handle.toLowerCase())).size;
    const cyclesForFullSweep = (window: number): number => {
      let cursor = 0;
      const all = new Set<string>();
      for (let c = 1; c <= 12; c++) {
        const { picked, nextCursor } = pickTweetAccountsForCycle(ACCS, cursor, window, BREAKING_PRIORITY_DEFAULT);
        for (const a of picked) all.add(a.handle.toLowerCase());
        cursor = nextCursor;
        if (all.size >= uniqueHandles) return c;
      }
      return -1;
    };
    expect(cyclesForFullSweep(6)).toBe(7); // با ۶: هفت چرخه (~۷۰ دقیقه)
    expect(cyclesForFullSweep(8)).toBe(5); // با ۸: پنج چرخه (~۵۰ دقیقه) — سطح پیشینِ فهرست ۲۷تایی
  });
});

describe('نرمال‌سازی رسم‌الخط عربی → سنجش کلیدواژهٔ فوری', () => {
  test('همزه و ی و ک عربی یکدست فارسی می‌شوند؛ اعراب و کشیده حذف', () => {
    // إ ي ر ا ن (همزهٔ زیر + ی عربی) → ا ی ر ا ن — عیناً «ایران» با ی فارسی
    expect(normalizeArabicVariants('إيران')).toBe('ایران');
    expect(normalizeArabicVariants('ايران')).toBe('ایران'); // ا ي ر ا ن (ی عربی) → ایران
    expect(normalizeArabicVariants('الجمهورية الإسلامية')).toBe('الجمهوریة الاسلامیة');
    expect(normalizeArabicVariants('مـحـافظ')).toBe('محافظ'); // کشیده
    expect(normalizeArabicVariants('مُحَمَّد')).toBe('محمد'); // اعراب
    expect(normalizeArabicVariants('سلام دنیا')).toBe('سلام دنیا'); // فارسی دست‌نخورده
    expect(normalizeArabicVariants('')).toBe('');
  });
});

describe('کلیدواژهٔ فوری عربی — بیانیه‌های مقامات عربی هم فوری می‌شوند', () => {
  test('إيران (همزهٔ زیر) و ايران (الف ساده) — هر دو می‌گیرد', () => {
    expect(isBreakingTweetText('الأردن تدين الهجوم على إيران')).toBe(true);
    expect(isBreakingTweetText('ايران ترد على التهديدات')).toBe(true);
    expect(isBreakingTweetText('الخليج إيران والحرب')) .toBe(true);
  });

  test('حرب = جنگ — حتی بدون ذکر ایران', () => {
    expect(isBreakingTweetText('الحرب على غزة تشتد')).toBe(true);
    expect(isBreakingTweetText('مصر تحذر من حرب إقليمية')).toBe(true);
    expect(isBreakingTweetText('بيان بشأن التصعيد العسكري')).toBe(false); // بدون کلیدواژه
  });

  test('الجمهورية الإسلامية — نام رسمی ایران به عربی', () => {
    expect(isBreakingTweetText('قمة بشأن الملف النووي للجمهورية الإسلامية')).toBe(true);
    expect(isBreakingTweetText('الجمهورية الإسلامية الإيرانية ترد')).toBe(true);
  });

  test('فارسی و انگلیسی عیناً دست‌نخورده — رگرسیون ندارد', () => {
    expect(isBreakingTweetText('آمریکا تحریم‌های تازهٔ ایران را اعلام کرد')).toBe(true);
    expect(isBreakingTweetText('جنگ در خاورمیانه گسترش یافت')).toBe(true);
    expect(isBreakingTweetText('Iran rejects negotiations')).toBe(true);
    expect(isBreakingTweetText('Trump: We are ready for war')).toBe(true);
    expect(isBreakingTweetText('ایرادهای قانونی مطرح‌شده بررسی شد')).toBe(false);
    expect(isBreakingTweetText('ایرانسل پلن جدید برداشت')).toBe(false);
    expect(isBreakingTweetText('مفاوضات تجارية بين الدوحة والرياض')).toBe(false); // عربی بدون کلیدواژه
    expect(isBreakingTweetText('قمم إقليمية واتفاقات اقتصادية')).toBe(false);
    expect(isBreakingTweetText('')).toBe(false);
  });

  test('ترکیب عربی با اعراب و کشیده — واقعی‌ترین حالت بیانیه‌های رسمی', () => {
    expect(isBreakingTweetText('تُدين الخارجيةُ الأردنية العدوانَ على إيران')).toBe(true);
    expect(isBreakingTweetText('المملكة تحذّر من انزلاق المنطقة إلى الحرب')).toBe(true);
  });
});
