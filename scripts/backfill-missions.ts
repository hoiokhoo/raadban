/**
 * بازپروری یک‌باره مأموریت‌های ۲-۷ پرامپت سودر:
 * ۱) دسته‌بندی قانون‌محور مطالب بدون دسته  ۲) بازسازی خوشه‌ها  ۳) تحلیل رفرنس‌ها
 * ۴) اتصال کانال‌های موجود خوانش به منابع رسمی
 * اجرا: bun run scripts/backfill-missions.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// ---------- دیکشنری (هماهنگ با src/lib/pipeline/rules.ts) ----------
const RULE_KEYWORDS: Record<string, string[]> = {
  economy: ['اقتصاد', 'تورم', 'بانک مرکزی', 'بورس', 'ارز', 'دلار', 'یورو', 'بازار', 'بودجه', 'مالیات', 'صادرات', 'واردات', 'مسکن', 'تحریم اقتصادی', 'گمرک', 'یوآن', 'ریال', 'inflation', 'sanction'],
  'foreign-policy': ['دیپلمات', 'سیاست خارجی', 'مذاکره', 'سفیر', 'وزارت امور خارجه', 'برجام', 'سازمان ملل', 'نشست سران', 'دوجانبه', 'بیانیه مشترک', 'وزیر خارجه', 'دیپلماسی', 'diplomacy', 'summit'],
  tech: ['فناوری', 'هوش مصنوعی', 'موبایل', 'گوشی', 'نرم‌افزار', 'سخت‌افزار', 'اینترنت', 'اپراتور', 'استارتاپ', 'دیجیتال', 'فیلترینگ', 'رمزارز', 'بیت‌کوین', 'تراشه', 'ماهواره', 'AI ', 'satellite'],
  energy: ['نفت', 'گاز', 'اوپک', 'پالایشگاه', 'پتروشیمی', 'انرژی', 'میعانات', 'بشکه', 'خط لوله', 'برق', 'نیروگاه', 'خورشیدی', 'opec', 'crude', 'میدان گازی', 'میدان نفتی'],
  khodro: ['خودرو', 'ایران خودرو', 'سایپا', 'پژو', 'سمند', 'تیبا', 'دنا', 'شاهین', 'تارا', 'قیمت خودرو', 'بازار خودرو', 'وام خودرو', 'خودرو برقی', 'کوییک', 'رانا'],
  'domestic-politics': ['مجلس', 'دولت', 'رئیس‌جمهور', 'وزیر', 'استان', 'انتخابات', 'رأی', 'قانون', 'لایحه', 'هیئت وزیران', 'فراکسیون', 'نماینده مجلس', 'شهردار', 'استاندار', 'انتصاب', 'عزل'],
  sports: ['فوتبال', 'ورزش', 'بازی', 'تیم ملی', 'لیگ', 'استقلال', 'پرسپولیس', 'قهرمان', 'گل', 'بازیکن', 'مربی', 'جام جهانی', 'المپیک', 'کشتی', 'والیبال', 'football', 'match'],
  agriculture: ['کشاورزی', 'گندم', 'جو', 'برنج', 'محصول', 'خشکسالی', 'بارش', 'نهال', 'باغداری', 'دام', 'طیور', 'شیلات', 'سد', 'نان', 'غله', 'امنیت غذایی', 'آفات', 'زعفران', 'پسته', 'wheat'],
  military: ['نظامی', 'دفاعی', 'ارتش', 'سپاه', 'موشک', 'پهپاد', 'حمله', 'جنگ', 'نیروی هوایی', 'رزمایش', 'سلاح', 'نبرد', 'تروریست', 'انفجار', 'ناتو', 'جنگنده', 'ناو', 'military', 'missile', 'strike', 'آتش‌بس'],
  health: ['سلامت', 'بهداشت', 'ویروس', 'بیماری', 'دارو', 'درمان', 'بیمارستان', 'پزشک', 'واکسن', 'کرونا', 'سرطان', 'وزارت بهداشت', 'آنفلوانزا', 'health', 'hospital'],
  culture: ['فرهنگ', 'هنر', 'سینما', 'فیلم', 'کتاب', 'نویسنده', 'جشنواره', 'موزیک', 'تئاتر', 'نمایشگاه', 'شاعر', 'ادبیات', 'موزه', 'میراث فرهنگی', 'گردشگری', 'سریال', 'culture', 'cinema'],
  environment: ['محیط زیست', 'آلودگی', 'آلاینده', 'گرد و غبار', 'زیست‌بوم', 'گونه', 'انقراض', 'جنگل', 'تالاب', 'دریاچه', 'زباله', 'بازیافت', 'گرمایش جهانی', 'اقلیم', 'pollution'],
};

const norm = (s: string) => s.toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');

function ruleCategorize(text: string): { slug: string; score: number } | null {
  const t = norm(text);
  let best: { slug: string; score: number } | null = null;
  for (const [slug, terms] of Object.entries(RULE_KEYWORDS)) {
    let score = 0;
    for (const term of terms) {
      const nt = norm(term);
      let count = 0, idx = t.indexOf(nt);
      while (idx !== -1) { count++; idx = t.indexOf(nt, idx + nt.length); }
      if (count > 0) score += nt.length * count;
    }
    if (score > 0 && (!best || score > best.score)) best = { slug, score };
  }
  return best && best.score >= 4 ? best : null;
}

async function main() {
  const cats = await db.category.findMany();
  const catBySlug = new Map(cats.map((c) => [c.slug, c]));

  // ۱) دسته‌بندی قانون‌محور
  const noCat = await db.post.findMany({
    where: { isAd: false, isIrrelevant: false, categories: { none: {} } },
    select: { id: true, content: true, normalized: true },
    orderBy: { publishedAt: 'desc' },
    take: 3400,
  });
  let assigned = 0, unmatched = 0;
  for (const p of noCat) {
    const m = ruleCategorize(p.normalized || p.content);
    if (m) {
      const cat = catBySlug.get(m.slug);
      if (cat) {
        await db.postCategory.create({ data: { postId: p.id, categoryId: cat.id, isMain: true, confidence: 0.3 } }).catch(() => {});
        assigned++;
        continue;
      }
    }
    unmatched++;
  }
  console.log(`۱) دسته‌بندی قانون‌محور: ${assigned} تخصیص، ${unmatched} نامشخص (از ${noCat.length} مطلب)`);

  // ۲) بازسازی خوشه‌ها — همان منطق src/lib/pipeline/clustering.ts (نسخه مستقل برای اجرای مستقیم)
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const posts = await db.post.findMany({
    where: { fetchedAt: { gte: since }, isAd: false, isIrrelevant: false, processingStatus: { in: ['پردازش‌شده', 'خام'] } },
    include: { source: true },
    take: 1500,
    orderBy: { publishedAt: 'desc' },
  });
  const tokenize = (text: string) => {
    const words = (p: string) => new Set(p.toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^\u0600-\u06FF\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !/^\d+$/.test(w)));
    return words(text);
  };
  const jaccard = (a: Set<string>, b: Set<string>) => {
    if (!a.size || !b.size) return 0;
    let i = 0; for (const w of a) if (b.has(w)) i++;
    return i / (a.size + b.size - i);
  };
  const usable = posts.filter((p) => p.publishedAt && p.content.trim().length >= 40);
  const tokens = usable.map((p) => ({ id: p.id, t: tokenize(p.content) }));
  const byId = new Map(tokens.map((x) => [x.id, x.t]));
  // کاندیدسازی با واژه‌های نادر مشترک
  const inverted = new Map<string, string[]>();
  for (const { id, t } of tokens) for (const w of t) {
    const l = inverted.get(w);
    if (l) l.push(id); else inverted.set(w, [id]);
  }
  const pairScore = new Map<string, number>();
  for (const [, list] of inverted) {
    if (list.length < 2 || list.length > 25) continue;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i] < list[j] ? `${list[i]}|${list[j]}` : `${list[j]}|${list[i]}`;
        pairScore.set(a, (pairScore.get(a) || 0) + 1);
      }
  }
  const parent = new Map<string, string>();
  const find = (x: string): string => { let p = parent.get(x) ?? x; if (p !== x) { p = find(p); parent.set(x, p); } return p; };
  for (const { id } of tokens) parent.set(id, id);
  let compared = 0, merged = 0;
  for (const [key, cnt] of pairScore) {
    if (cnt < 2) continue;
    const [a, b] = key.split('|');
    compared++;
    if (jaccard(byId.get(a)!, byId.get(b)!) >= 0.42) {
      const ra = find(a), rb = find(b);
      if (ra !== rb) { parent.set(ra, rb); merged++; }
    }
  }
  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const r = find(id);
    const l = groups.get(r);
    if (l) l.push(id); else groups.set(r, [id]);
  }
  const big = [...groups.values()].filter((g) => g.length >= 2);
  let eventsCreated = 0, links = 0;
  for (const g of big) {
    const members = usable.filter((p) => g.includes(p.id));
    const links0 = await db.eventPost.findMany({ where: { postId: { in: g } }, select: { eventId: true } });
    const cnt = new Map<string, number>();
    for (const l of links0) cnt.set(l.eventId, (cnt.get(l.eventId) || 0) + 1);
    const bestExisting = [...cnt.entries()].sort((x, y) => y[1] - x[1])[0];
    let eventId: string;
    if (bestExisting && bestExisting[1] >= 2) {
      eventId = bestExisting[0];
    } else {
      const earliest = [...members].sort((a, b) => (a.publishedAt!.getTime()) - (b.publishedAt!.getTime()))[0];
      const ev = await db.event.create({
        data: {
          dedupKey: 'cluster_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
          title: earliest.content.trim().slice(0, 120),
          summary: earliest.content.slice(0, 800),
          originSourceId: earliest.sourceId,
          originNote: `خوشه‌بندی قطعی (بدون AI): کهن‌ترین انتشار درون‌سامانه‌ای از «${earliest.source?.name || 'منبع ناشناس'}». سایر اعضای خوشه محتمل بازنشر/بازگویی همان خبرند.`,
        },
      });
      eventId = ev.id;
      eventsCreated++;
    }
    for (const m of members) {
      await db.eventPost.upsert({ where: { eventId_postId: { eventId, postId: m.id } }, create: { eventId, postId: m.id }, update: {} });
      links++;
    }
    const earliest = [...members].sort((a, b) => (a.publishedAt!.getTime()) - (b.publishedAt!.getTime()))[0];
    await db.event.update({
      where: { id: eventId },
      data: {
        lastSeenAt: new Date(),
        originSourceId: earliest.sourceId,
        originNote: `خوشه‌بندی قطعی (بدون AI): کهن‌ترین انتشار درون‌سامانه‌ای از «${earliest.source?.name || 'منبع ناشناس'}». سایر اعضای خوشه محتمل بازنشر/بازگویی همان خبرند.`,
      },
    }).catch(() => {});
  }
  console.log(`۲) خوشه‌بندی: ${usable.length} مطلب، ${compared} مقایسه، ${big.length} خوشه (۲+)، ${eventsCreated} رویداد جدید، ${links} پیوند`);

  // ۳) تحلیل رفرنس‌ها
  const refPatterns: Array<[RegExp, string]> = [
    [/به\s*(?:نقل\s*از|گفته|گفتِ)\s+([^،.؛\n]{3,80})/g, 'منبع_نقل‌قول'],
    [/طبق\s*(?:گزارش|اعلام|آمار|اسناد|داده‌های)\s+([^،.؛\n]{3,80})/g, 'آمار_و_گزارش'],
    [/بر\s*اساس\s*(?:گزارش|آمار|اسناد|داده‌های)\s+([^،.؛\n]{3,80})/g, 'آمار_و_گزارش'],
    [/بر\s*پایه\s*(?:گزارش|آمار|اسناد)\s+([^،.؛\n]{3,80})/g, 'آمار_و_گزارش'],
    [/در\s*پی\s+([^،.؛\n]{5,120})/g, 'رویداد_تاریخی'],
    [/پس\s*از\s+([^،.؛\n]{5,120})/g, 'رویداد_تاریخی'],
  ];
  const refPosts = await db.post.findMany({
    where: { isAd: false, isIrrelevant: false, processingStatus: 'پردازش‌شده', referenceAnalyses: { none: {} } },
    select: { id: true, content: true, normalized: true },
    take: 400,
    orderBy: { publishedAt: 'desc' },
  });
  const recentEvents = await db.event.findMany({
    where: { lastSeenAt: { gte: new Date(Date.now() - 60 * 24 * 3600 * 1000) } },
    select: { id: true, title: true, summary: true },
    take: 300,
    orderBy: { lastSeenAt: 'desc' },
  });
  const evTokens = recentEvents.map((e) => ({ id: e.id, title: e.title, t: tokenize((e.title || '') + ' ' + (e.summary || '')) }));
  let refsSaved = 0, refFound = 0;
  for (const p of refPosts) {
    const text = p.normalized || p.content;
    const seen = new Set<string>();
    for (const [re, type] of refPatterns) {
      re.lastIndex = 0;
      let m = re.exec(text);
      while (m) {
        const key = m[0].slice(0, 60);
        if (!seen.has(key)) {
          seen.add(key);
          const target = m[1].trim();
          const t = tokenize(target);
          let bestEv: { id: string; s: number } | null = null, matchCount = 0;
          for (const ev of evTokens) {
            const s = jaccard(t, ev.t);
            if (s >= 0.2) { matchCount++; if (!bestEv || s > bestEv.s) bestEv = { id: ev.id, s }; }
          }
          await db.referenceAnalysis.create({
            data: {
              postId: p.id, refType: type, refText: m[0].slice(0, 500), target: target.slice(0, 200),
              status: bestEv ? 'در_سامانه_یافت_شد' : 'در_سامانه_یافت_نشد',
              matchCount, bestEventId: bestEv?.id || null,
              note: bestEv
                ? `این ارجاع با ${matchCount} رویداد ثبت‌شده در آرشیو سامانه هم‌پوشانی دارد؛ نزدیک‌ترین با شباهت ${(bestEv.s * 100).toFixed(0)}٪. ارتباط ساختاری، نه تأیید قطعی صحت.`
                : 'در آرشیو ۶۰ روز اخیر سامانه رویداد متناظری یافت نشد. این «عدم یافتن» به‌معنای نادرستی ارجاع نیست.',
            },
          }).catch(() => {});
          refsSaved++;
          if (bestEv) refFound++;
        }
        if (seen.size > 8) break;
        m = re.exec(text);
      }
      if (seen.size > 8) break;
    }
  }
  console.log(`۳) رفرنس‌ها: ${refsSaved} ارجاع ذخیره شد از ${refPosts.length} مطلب (${refFound} مورد در سامانه یافت شد)`);

  // ۴) کانال‌های خوانش → منبع رسمی
  const channels = await db.watchedChannel.findMany();
  let sourcesCreated = 0;
  for (const ch of channels) {
    const url = ch.url || (ch.platform === 'telegram' ? `https://t.me/${ch.identifier}` : ch.platform === 'eitaa' ? `https://eitaa.com/${ch.identifier}` : null);
    const ex = await db.source.findUnique({ where: { platform_identifier: { platform: ch.platform, identifier: ch.identifier } } });
    if (ex) {
      if (ch.displayName && ex.name !== ch.displayName) await db.source.update({ where: { id: ex.id }, data: { name: ch.displayName } });
      continue;
    }
    await db.source.create({
      data: {
        name: ch.displayName || ch.identifier,
        platform: ch.platform,
        identifier: ch.identifier,
        url,
        isActive: true,
        status: 'دریافت_موفق',
        statusDetail: 'منبع خودکار از بخش خوانش کانال‌ها — نخستین دریافت پیام موفق بود',
        notes: 'افزوده‌شده خودکار از خوانش کانال‌ها؛ حذف از خوانش این منبع را حذف نمی‌کند',
        fetchMethod: 'عمومی',
      },
    });
    sourcesCreated++;
  }
  console.log(`۴) کانال→منبع: ${channels.length} کانال بررسی شد، ${sourcesCreated} منبع جدید ساخته شد`);

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
