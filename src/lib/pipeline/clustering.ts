/**
 * خوشه‌بندی اخبار مشابه — قابلیت T9 (خط خبری گره‌دار: چه‌کسی اول، چه‌کسی به‌ترتیب نقل کرده)
 *
 * الگوریتم خالص و تست‌پذیر (بدون بانک اطلاعاتی) — مدل «نمایندهٔ اول»:
 * ۱) توکن‌های معنادار: نرمال‌سازی فارسی، حذف استوپ‌وردها و کلمات <۳ حرفی، حفظ اعداد به‌صورت دقیق
 * ۲) هر پست به «کهن‌ترین پستِ» خوشه‌ای می‌پیوندد که شباهت Jaccard ≥ آستانه داشته باشد؛
 *    وگرنه خودش نمایندهٔ خوشهٔ تازه می‌شود (ستاره‌ای به‌جای زنجیره‌ای).
 *    چرا؟ در مدل زنجیره‌ای (Union-Find) A≈B و B≈C می‌تواند A و Cِ بی‌ربط را در یک خوشه بریزد و
 *    «اولین منبع» را غلط نشان دهد — بدترین خطای ممکن برای ردیابی منشأ خبر.
 * ۳) همهٔ اعضای یک خوشه بازگوییِ همان گزارش اول‌اند؛ کهن‌ترین عضو = «اولین انتشار».
 * ۴) پالایش دسته‌ای: توکن‌های فراگیر (بویلرپلیت تکراری در دسته‌های بزرگ) حذف می‌شوند.
 */
import { normalizePersian } from './normalize';

export interface ClusterInputPost {
  id: string;
  content: string;
  publishedAt: Date;
  sourceName: string;
  sourcePlatform: string;
  language?: string;
}

export interface ClusterMemberOut {
  postId: string;
  isFirst: boolean;
  publishedAt: Date;
  similarity: number;
  sourceName: string;
  sourcePlatform: string;
  /** فاصله زمانی از اولین انتشار بر حسب دقیقه */
  minutesAfterFirst: number;
}

export interface ClusterOut {
  members: ClusterMemberOut[]; // مرتب بر زمان انتشار
  first: ClusterMemberOut;
  titleSource: string; // متن نماینده برای عنوان
  language: string;
}

const TIME_WINDOW_MS = 48 * 60 * 60 * 1000; // بازه جفت‌گیری با نمایندهٔ اول
export const SIMILARITY_THRESHOLD = 0.42;

// ---------- توکن‌های معنادار ----------

/**
 * استوپ‌وردهای پرتکرار فارسی/انگلیسی — کلمات عمومی که شباهت را بی‌معنا می‌کنند.
 * عمداً محدود است؛ پالایش اصلی «فراگیر بودن در خودِ دسته» است (پایین).
 */
const STOPWORDS = new Set([
  // فارسی — حروف ربط و پیشوند/پسوند و فعل‌های کمکی
  'از', 'به', 'با', 'در', 'که', 'را', 'و', 'این', 'آن', 'است', 'بود', 'شد', 'شده',
  'کرد', 'کردند', 'کردم', 'کند', 'کنم', 'کنیم', 'برای', 'تا', 'نیز', 'اما', 'یا',
  'هر', 'همه', 'بین', 'روی', 'پس', 'چون', 'درباره', 'برابر', 'علیه', 'برخی',
  'بسیار', 'دیگر', 'همین', 'چنین', 'وقتی', 'قبل', 'بعد', 'گزارش', 'خبر',
  'خبرگزاری', 'رسانه', 'پایگاه', 'وی', 'ما', 'شما', 'او', 'آنها', 'ها', 'های',
  'هایی', 'نیست', 'دارد', 'داشت', 'دهد', 'شود', 'داد', 'داده', 'هست', 'خواهد',
  'باید', 'ممکن', 'بر', 'طبق', 'براساس', 'بنابر', 'مطابق', 'جهت', 'سوی', 'طور',
  'هم', 'فقط', 'حتی', 'دوباره', 'مجدد', 'سپس', 'بنابراین', 'یک', 'چرا', 'چه',
  'کجا', 'اکنون', 'الان', 'شما', 'خود', 'برای', 'بله', 'خیر',
  // انگلیسی
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'was', 'were', 'has',
  'have', 'had', 'his', 'her', 'its', 'their', 'said', 'after', 'before',
  'about', 'into', 'over', 'more', 'most', 'will', 'would', 'could', 'should',
  'than', 'then', 'they', 'them', 'there', 'what', 'when', 'where', 'which',
  'who', 'whose', 'why', 'how', 'not', 'but', 'all', 'any', 'are', 'you',
  'your', 'our', 'out', 'per', 'via', 'amid', 'also', 'news', 'report',
  'reports', 'according', 'been', 'being',
]);

/**
 * توکن‌های معنادار یک متن — تابع خالص تست‌پذیر:
 * نرمال‌سازی فارسی (ی/ک، اعداد) + حذف استوپ‌ورد + حداقل ۳ حرف (اعداد ≥۲ رقم حفظ می‌شوند)
 */
export function tokenizeSalient(text: string): string[] {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, ' ') // لینک‌ها در مقایسه اثر ندارند
    .replace(/<[^>]+>/g, ' '); // HTML عنوان‌های RSS
  const norm = normalizePersian(cleaned).toLowerCase();
  return norm
    .replace(/\u200c/g, '') // نیم‌فاصله → اتصال (می‌شود → میشود)
    .replace(/[^\u0600-\u06FFA-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => {
      if (!w) return false;
      if (STOPWORDS.has(w)) return false;
      if (/^\d+$/.test(w)) return w.length >= 2; // عددِ دقیق سیگنال است («۲۵ سال» ≠ «۳ سال»)
      return w.length >= 3;
    });
}

/** جاکارد روی مجموعه‌های آماده — بدون توکنایز مجدد */
export function jaccardSets(A: Set<string>, B: Set<string>): number {
  if (A.size === 0 || B.size === 0) return 0;
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  let inter = 0;
  for (const w of small) if (big.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** نرمال‌سازی متنی قدیمی — برای سازگاری تست‌ها نگه داشته می‌شود */
export function tokenize(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[\u200c\u064b-\u0652]/g, '') // نیم‌فاصله و اعراب
    .replace(/[یي]/g, 'ی')
    .replace(/[کك]/g, 'ک')
    .replace(/[۰-۹0-9]+/g, ' # ')
    .replace(/[^\u0600-\u06FF\u0590-\u05FFA-Za-z ]+/g, ' ');
  return normalized.split(/\s+/).filter((w) => w.length > 1);
}

// ---------- هستهٔ خوشه‌بندی: مدل نمایندهٔ اول ----------

export function buildClusters(
  posts: ClusterInputPost[],
  opts: { threshold?: number; minSize?: number } = {}
): ClusterOut[] {
  const threshold = opts.threshold ?? SIMILARITY_THRESHOLD;
  const minSize = opts.minSize ?? 2;
  if (posts.length < minSize) return [];

  // ۱) مجموعه توکن‌ها — فقط یک‌بار برای هر پست
  const sets = posts.map((p) => new Set(tokenizeSalient(p.content)));

  // ۲) پالایش دسته‌ای: توکن فراگیر (در ≥۲۰٪ پست‌ها) بویلرپلیت است — فقط دسته‌های بزرگ
  if (posts.length >= 60) {
    const df = new Map<string, number>();
    for (const s of sets) for (const w of s) df.set(w, (df.get(w) || 0) + 1);
    const cut = Math.floor(posts.length * 0.2);
    for (const s of sets) {
      for (const w of s) {
        if ((df.get(w) || 0) >= cut) { s.delete(w); }
      }
    }
  }

  // ۳) عبور زمانی — کهن‌ترین‌ها اول؛ هر پست به بهترین خوشهٔ موجود می‌پیوندد یا نماینده می‌شود
  const order = posts
    .map((p, i) => ({ i, t: p.publishedAt.getTime() }))
    .sort((a, b) => a.t - b.t);

  interface Active {
    leaderIdx: number;
    leaderT: number;
    leaderSet: Set<string>;
    members: number[];
    sims: Map<number, number>;
  }
  const actives: Active[] = [];
  let head = 0; // نماینده‌های خارج از پنجرهٔ ۴۸ ساعته از جلو بسته می‌شوند
  for (const { i, t } of order) {
    while (head < actives.length && t - actives[head].leaderT > TIME_WINDOW_MS) head++;
    const cur = sets[i];
    let best: Active | null = null;
    let bestSim = 0;
    for (let k = head; k < actives.length; k++) {
      const a = actives[k];
      // کران بالای جاکارد نسبت اندازه‌هاست — هرس ارزان بدون تقاطع
      if (Math.min(cur.size, a.leaderSet.size) / Math.max(cur.size, a.leaderSet.size, 1) < threshold) continue;
      const sim = jaccardSets(cur, a.leaderSet);
      if (sim >= threshold && sim > bestSim) { best = a; bestSim = sim; }
    }
    if (best) {
      best.members.push(i);
      best.sims.set(i, bestSim);
    } else {
      actives.push({ leaderIdx: i, leaderT: t, leaderSet: cur, members: [i], sims: new Map([[i, 1]]) });
    }
  }

  // ۴) ساخت خروجی — خوشه‌های ≥minSize؛ مرتب بر زمان؛ کهن‌ترین = اولین انتشار
  const out: ClusterOut[] = [];
  for (const a of actives) {
    if (a.members.length < minSize) continue;
    a.members.sort((x, y) => posts[x].publishedAt.getTime() - posts[y].publishedAt.getTime());
    const firstIdx = a.members[0];
    const firstT = posts[firstIdx].publishedAt.getTime();
    const langCounts = new Map<string, number>();
    for (const m of a.members) {
      const lang = posts[m].language || 'fa';
      langCounts.set(lang, (langCounts.get(lang) || 0) + 1);
    }
    const dominantLang = [...langCounts.entries()].sort((x, y) => y[1] - x[1])[0][0];

    const memberOut: ClusterMemberOut[] = a.members.map((idx) => ({
      postId: posts[idx].id,
      isFirst: idx === firstIdx,
      publishedAt: posts[idx].publishedAt,
      similarity: a.sims.get(idx) ?? 0,
      sourceName: posts[idx].sourceName,
      sourcePlatform: posts[idx].sourcePlatform,
      minutesAfterFirst: Math.round((posts[idx].publishedAt.getTime() - firstT) / 60000),
    }));

    out.push({
      members: memberOut,
      first: memberOut[0],
      titleSource: posts[firstIdx].content.slice(0, 300),
      language: dominantLang,
    });
  }
  // خوشه‌های بزرگ‌تر اول
  out.sort((a, b) => b.members.length - a.members.length);
  return out;
}

/** عنوان کوتاه خوشه از متن نماینده (حداکثر ۹۰ نویسه) — HTML منابع RSS هم پاک می‌شود */
export function clusterTitle(titleSource: string): string {
  const clean = titleSource
    .replace(/<[^>]+>/g, ' ') // حذف تگ‌های HTML از عنوان‌های Google News RSS
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > 90 ? `${clean.slice(0, 88)}…` : clean;
}
