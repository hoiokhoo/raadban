/**
 * دسته‌بندی قانون‌محور (بدون هوش مصنوعی) — تاب‌آوری خط لوله
 * وقتی سرویس مدل محدود/قطع است، هر مطلب دسته‌بندی «حداقلی و صادقانه» می‌گیرد:
 * امتیازدهی کلیدواژه‌ای شفاف، اطمینان ۰٫۳ و برچسب «قانون‌محور».
 * هرگز جایگزین نهایی دسته‌بندی AI نمی‌شود — AI پس از رفع محدودیت بازنگری می‌کند.
 */
import { db } from '@/lib/db';

export interface RuleMatch { slug: string; hits: Array<{ term: string; count: number }>; score: number }

/** دیکشنری کلیدواژه‌ای ۱۲ دسته سامانه — فقط واژه‌های مشخص، نه عمومی */
export const RULE_KEYWORDS: Record<string, string[]> = {
  economy: [
    'اقتصاد', 'تورم', 'بانک مرکزی', 'بورس', 'ارز', 'دلار', 'یورو', 'بازار', 'بودجه', 'مالیات',
    'صادرات', 'واردات', 'رهن و اجاره', 'مسکن', 'گران', 'برابری', 'دینار', 'درصد رشد', 'پی‌آی‌پی',
    'economy', 'inflation', 'sanction', 'تحریم اقتصادی', 'کارت بازرگانی', 'گمرک', 'یوآن', 'ریال',
  ],
  'foreign-policy': [
    'دیپلمات', 'سیاست خارجی', 'مذاکره', 'سفیر', 'وزارت امور خارجه', 'برجام', 'سازمان ملل', 'نشست سران',
    'روابط دو کشور', 'دوجانبه', 'چندجانبه', 'بیانیه مشترک', 'وزیر خارجه', 'دیپلماسی', 'گفت‌وگوهای وین',
    'diplomacy', 'summit', 'UN ', 'sanctions relief', 'میدان‌های آن', 'bilateral',
  ],
  tech: [
    'فناوری', 'هوش مصنوعی', 'موبایل', 'گوشی', 'نرم‌افزار', 'سخت‌افزار', 'اینترنت', 'اپراتور', 'سرور',
    'استارتاپ', 'دیجیتال', 'فیلترینگ', 'رمزارز', 'بیت‌کوین', 'شبکه اجتماعی', 'تراشه', 'ربات',
    'AI ', 'technology', 'startup', 'satellite', 'ماهواره', 'سامانه هوشمند', 'پهپاد ساخت',
  ],
  energy: [
    'نفت', 'گاز', 'اوپک', 'پالایشگاه', 'پتروشیمی', 'انرژی', 'میعانات', 'بارِل', 'بشکه', 'خط لوله',
    'برق', 'نیروگاه', 'انرژی تجدیدپذیر', 'خورشیدی', 'بادی', 'اویک', 'oil', 'opec', 'gas ', 'crude',
    'صندوق توسعه ملی', 'میدان گازی', 'میدان نفتی', 'بارrel',
  ],
  khodro: [
    'خودرو', 'خودرویی', 'ایران خودرو', 'سایپا', 'پژو', 'سمند', 'تیبا', 'دنا', 'شاهین', 'تارا',
    'موتور', 'لوازم یدکی', 'قیمت خودرو', 'بازار خودرو', 'وام خودرو', 'plug-in', 'خودرو برقی',
    'car market', 'سایدک', 'رانا', 'کوییک', 'قطعه‌سازی', 'عقب‌نشینی قیمت',
  ],
  'domestic-politics': [
    'مجلس', 'دولت', 'رئیس‌جمهور', 'وزیر', 'استان', 'شورای شهر', 'انتخابات', 'رأی', 'قانون', 'لایحه',
    'هیئت وزیران', 'فراکسیون', 'نماینده مجلس', 'شهردار', 'استاندار', 'داخلی', 'جمع‌بندی سیاسی',
    'عزل', 'انتصاب', 'حکم ریاست', 'گفت‌وگوی داخلی',
  ],
  sports: [
    'فوتبال', 'ورزش', 'بازی', 'تیم ملی', 'لیگ', 'استقلال', 'پرسپولیس', 'قهرمان', 'گل', 'بازیکن',
    'مربی', 'جام جهانی', 'المپیک', 'کشتی', 'والیبال', 'ووشو', 'دونده', 'football', 'soccer', 'match',
    'فوتبالیست', 'نیمه نهایی', 'یک‌چهارم نهایی', 'جام حذفی', 'سوپر لیگ',
  ],
  agriculture: [
    'کشاورزی', 'گندم', 'جو', 'برنج', 'محصول', 'خشکسالی', 'بارش', 'نهال', 'باغداری', 'دام',
    'طیور', 'شیلات', 'آب', 'سد', 'نان', 'غله', 'امنیت غذایی', 'آفات', 'زعفران', 'پسته',
    'wheat', 'دشت', 'چاه عمیق', 'سفره', 'میوه',
  ],
  military: [
    'نظامی', 'دفاعی', 'ارتش', 'سپاه', 'موشک', 'پهپاد', 'حمله', 'جنگ', 'نیروی هوایی', 'رزمایش',
    'سلاح', 'نبرد', 'دفاع مقدس', 'تروریست', 'انفجار', 'ناتو', 'جنگنده', 'ناو', 'military', 'missile',
    'strike', 'drone attack', 'آتش‌بس', 'جنگی',
  ],
  health: [
    'سلامت', 'بهداشت', 'ویروس', 'بیماری', 'دارو', 'درمان', 'بیمارستان', 'پزشک', 'واکسن', 'کرونا',
    'سرطان', 'وزارت بهداشت', 'دانشکده پزشکی', 'آنفلوانزا', 'health', 'hospital', 'انتانسیون',
    'مرگ‌ومیر بیماری', 'فلج اطفال',
  ],
  culture: [
    'فرهنگ', 'هنر', 'سینما', 'فیلم', 'کتاب', 'نویسنده', 'جشنواره', 'موزیک', 'تئاتر', 'نمایشگاه',
    'شاعر', 'ادبیات', 'چاپ', 'موزه', 'میراث فرهنگی', 'توریست', 'گردشگری', 'فیلمبرداری', 'سریال',
    'culture', 'cinema', 'festival', 'دوبله',
  ],
  environment: [
    'محیط زیست', 'آلودگی', 'آلاینده', 'هوای تهران', 'گرد و غبار', 'زیست‌بوم', 'گونه', 'انقراض',
    'جنگل', 'تالاب', 'دریاچه', 'زباله', 'بازیافت', 'گرمایش جهانی', 'اقلیم', 'environment',
    'pollution', 'تنفس ناسالم', 'رطوبت',
  ],
};

const normalize = (s: string) => s.toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');

/**
 * امتیازدهی شفاف: هر تطبیق = طول واژه × تعداد تکرار.
 * خروجی: بهترین دسته (اگر حداقل امتیاز ۴ را بگیرد) + تفکیک تطبیق‌ها.
 * هیچ حدس دسته‌ای برای متن‌های بی‌تطبیق داده نمی‌شود → نامشخص صادقانه.
 */
export function ruleCategorize(text: string): { best: RuleMatch | null; all: RuleMatch[] } {
  const t = normalize(text);
  const all: RuleMatch[] = [];
  for (const [slug, terms] of Object.entries(RULE_KEYWORDS)) {
    const hits: Array<{ term: string; count: number }> = [];
    for (const term of terms) {
      const nt = normalize(term);
      // شمارش رخدادهای واژه (کلمه‌مرزی ساده برای لاتین)
      let count = 0;
      let idx = t.indexOf(nt);
      while (idx !== -1) { count++; idx = t.indexOf(nt, idx + nt.length); }
      if (count > 0) hits.push({ term, count });
    }
    if (hits.length > 0) {
      const score = hits.reduce((s, h) => s + h.term.length * h.count, 0);
      all.push({ slug, hits, score });
    }
  }
  all.sort((a, b) => b.score - a.score);
  const best = all.length > 0 && all[0].score >= 4 ? all[0] : null;
  return { best, all };
}

/**
 * دسته‌بندی یک مطلب با قواعد (فقط اگر دسته ندارد) — اطمینان پایین و برچسب شفاف
 * دسته‌بندی AI (اطمینان ۰٫۸) بعداً ممکن است جایگزین کند.
 */
export async function categorizePostRuleBased(postId: string): Promise<{ ok: boolean; assigned?: string; reason?: string }> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { categories: true },
  });
  if (!post) return { ok: false, reason: 'مطلب یافت نشد' };
  if (post.categories.length > 0) return { ok: true, reason: 'دسته دارد — دست‌نخورده' };

  const text = post.normalized || post.content;
  const { best } = ruleCategorize(text);
  if (!best) return { ok: false, reason: 'بدون تطبیق کلیدواژه — نامشخص صادقانه' };

  const cat = await db.category.findUnique({ where: { slug: best.slug } });
  if (!cat) return { ok: false, reason: `دسته ${best.slug} در پایگاه نیست` };

  await db.postCategory.create({
    data: { postId, categoryId: cat.id, isMain: true, confidence: 0.3 },
  });
  return { ok: true, assigned: cat.name };
}

/** دسته‌بندی گروهی مطالب بدون دسته — برای اجرای زمان‌بندی/دستی */
export async function backfillRuleCategories(limit = 200): Promise<{ scanned: number; assigned: number; unmatched: number }> {
  const posts = await db.post.findMany({
    where: { isAd: false, isIrrelevant: false, categories: { none: {} } },
    select: { id: true },
    take: limit,
    orderBy: { publishedAt: 'desc' },
  });
  let assigned = 0, unmatched = 0;
  for (const p of posts) {
    const r = await categorizePostRuleBased(p.id);
    if (r.assigned) assigned++;
    else unmatched++;
  }
  return { scanned: posts.length, assigned, unmatched };
}

/** امتیاز اهمیت قانون‌محور — فقط برای صف‌بندی؛ جایگزین ارزیابی AI نمی‌شود */
export function ruleImportance(text: string): number {
  const t = normalize(text);
  let score = 1;
  const high = ['حمله', 'جنگ', 'انفجار', 'ترور', 'زلزله', 'سیل', 'کشته', 'زخمی', 'تحریم', 'استعفا', 'برکناری'];
  const mid = ['مذاکره', 'توافق', 'نشست', 'ملاقات', 'تصویب', 'قانون', 'بودجه'];
  for (const w of high) if (t.includes(w)) score += 2;
  for (const w of mid) if (t.includes(w)) score += 1;
  return Math.min(5, score);
}
