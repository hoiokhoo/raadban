/**
 * تست‌های واحد قابلیت‌های T9 — خوشه‌بندی، دسته‌بندی موضوعی، رفرنس
 * اجرا: bun test tests/analysis.test.ts
 */
import { describe, test, expect } from 'bun:test';
import {
  buildClusters,
  clusterTitle,
  tokenize,
  tokenizeSalient,
  SIMILARITY_THRESHOLD,
  type ClusterInputPost,
} from '../src/lib/pipeline/clustering';
import { TOPICS, TOPIC_NAMES, validateTopicBatch } from '../src/lib/pipeline/topics';
import { REF_KINDS, REF_VERDICTS } from '../src/lib/pipeline/references';

// ---------- ابزار ساخت داده آزمون ----------

const A_TEXT = 'نیروهای نظامی امروز در منطقه مرزی مانور گسترده برگزار کردند و فرماندهان از آمادگی کامل یگان‌ها خبر دادند';
const B_TEXT = 'مانور گسترده نظامی امروز در منطقه مرزی برگزار شد؛ فرماندهان یگان‌ها از آمادگی کامل خبر دادند';
const C_TEXT = 'مانور گسترده نظامی امروز در منطقه مرزی با حضور یگان‌های زرهی انجام شد و فرماندهان از آمادگی کامل خبر دادند';
const OTHER_TEXT = 'بورس اوراق بهادار امروز با رشد شاخص کل بسته شد و ارزش معاملات سهام افزایش یافت';

function post(id: string, content: string, publishedAt: Date, sourceName: string, language = 'fa'): ClusterInputPost {
  return { id, content, publishedAt, sourceName, sourcePlatform: 'rss', language };
}

const T = (min: number) => new Date(Date.UTC(2026, 9, 30, 8, min));

// ---------- خوشه‌بندی ----------

describe('buildClusters — خوشه‌بندی اخبار مشابه', () => {
  test('سه پست مشابه از سه منبع → خوشه با «اولین انتشار» کهن‌ترین', () => {
    const clusters = buildClusters([
      post('p2', B_TEXT, T(30), 'CNN'),
      post('p1', A_TEXT, T(0), 'بی‌بی‌سی'),
      post('p3', C_TEXT, T(90), 'صدا و سیما'),
      post('p4', OTHER_TEXT, T(10), 'تجارت نیوز'),
    ]);
    expect(clusters.length).toBe(1);
    const cl = clusters[0];
    expect(cl.first.postId).toBe('p1');
    expect(cl.first.sourceName).toBe('بی‌بی‌سی');
    expect(cl.members.length).toBe(3);
    expect(cl.members.map((m) => m.postId)).toEqual(['p1', 'p2', 'p3']); // مرتب زمانی
    expect(cl.members.every((m) => m.isFirst === (m.postId === 'p1'))).toBe(true);
    expect(cl.members[1].minutesAfterFirst).toBe(30);
    expect(cl.members[2].minutesAfterFirst).toBe(90);
    // خط زمانی: بازنشرها شباهت <1 دارند
    expect(cl.members[0].similarity).toBe(1);
    expect(cl.members[1].similarity).toBeLessThan(1);
  });

  test('پست‌های بی‌ربط خوشه نمی‌شوند', () => {
    const clusters = buildClusters([
      post('a', A_TEXT, T(0), 'منبع۱'),
      post('b', OTHER_TEXT, T(5), 'منبع۲'),
    ]);
    expect(clusters.length).toBe(0);
  });

  test('پست مشابه خارج از پنجره ۴۸ ساعته خوشه نمی‌شود', () => {
    const clusters = buildClusters([
      post('old', A_TEXT, new Date(Date.UTC(2026, 9, 1, 8, 0)), 'منبع۱'),
      post('new', B_TEXT, new Date(Date.UTC(2026, 9, 10, 8, 0)), 'منبع۲'),
    ]);
    expect(clusters.length).toBe(0);
  });

  test('شباهت زیر آستانه → بدون خوشه؛ آستانه منطقی است', () => {
    expect(SIMILARITY_THRESHOLD).toBeGreaterThan(0.3);
    expect(SIMILARITY_THRESHOLD).toBeLessThan(0.6);
    const weak = buildClusters([
      post('x', 'رئیس بانک مرکزی درباره نرخ تورم و سیاست پولی سال آینده توضیح داد', T(0), 'الف'),
      post('y', 'نرخ ارز در بازار آزاد امروز تغییر کرد و دلار گران شد', T(10), 'ب'),
    ]);
    expect(weak.length).toBe(0);
  });

  test('خوشه تک‌عضوی و ورودی خالی → خروجی خالی', () => {
    expect(buildClusters([post('only', A_TEXT, T(0), 'منبع')])).toEqual([]);
    expect(buildClusters([])).toEqual([]);
  });

  test('زبان غالب خوشه درست تشخیص داده می‌شود', () => {
    const clusters = buildClusters([
      post('e1', 'Military forces held a large exercise today', T(0), 'BBC', 'en'),
      post('e2', 'Large military exercise held today in border area', T(40), 'CNN', 'en'),
    ]);
    expect(clusters.length).toBe(1);
    expect(clusters[0].language).toBe('en');
  });

  test('ضد drift زنجیره‌ای: بازگویی دومَرحله‌ای به خوشهٔ اول نمی‌چسبد', () => {
    // A≈B (بالای آستانه) و B≈C (بالای آستانه) اما A و C هیچ توکن مشترکی ندارند؛
    // مدل زنجیره‌ای (Union-Find) هر سه را یکی می‌کرد و «اولین منبع» را مخدوش می‌کرد؛
    // مدل نمایندهٔ اول فقط A و B را در یک خوشه می‌گذارد.
    const P = Array.from({ length: 20 }, (_, i) => `tok${i}p`).join(' ');
    const Q = Array.from({ length: 20 }, (_, i) => `tok${i}q`).join(' ');
    const X = 'extraonea extratwoa extrathrea extrafora';
    const Z = 'extraonec extratwoc extrathrec extraforc';
    const R = 'bridgeone bridgetwo';
    const clusters = buildClusters([
      post('a', `${P} ${X}`, T(0), 'منبع الف'),
      post('b', `${P} ${Q} ${R}`, T(10), 'منبع ب'),
      post('c', `${Q} ${Z}`, T(20), 'منبع ج'),
    ]);
    expect(clusters.length).toBe(1);
    expect(clusters[0].members.map((m) => m.postId)).toEqual(['a', 'b']);
    expect(clusters[0].first.sourceName).toBe('منبع الف');
  });

  test('توکن‌های معنادار: استوپ‌ورد و کلمهٔ کوتاه حذف؛ عدد دقیق حفظ می‌شود', () => {
    const toks = tokenizeSalient('به گزارش خبرگزاری، پروازهای ۲۵ پرواز لغو شد و در سال ۱۴۰۳');
    expect(toks).not.toContain('گزارش');
    expect(toks).not.toContain('خبرگزاری');
    expect(toks).not.toContain('شد');
    expect(toks).toContain('25');
    expect(toks).toContain('1403');
    // کلمات <۳ حرفی حذف می‌شوند
    expect(tokenizeSalient('من از او دیدم').length).toBe(1); // فقط «دیدم»
  });

  test('بازگویی با مقدمهٔ بویلرپلیت متفاوت (به گزارش X) خوشه می‌شود', () => {
    const clusters = buildClusters([
      post('m1', 'به گزارش خبرگزاری مهر، سقوط پهپاد شناسایی در خلیج فارس تأیید شد', T(0), 'مهر'),
      post('m2', 'خبرگزاری ایسنا نوشت: سقوط پهپاد شناسایی در خلیج فارس تأیید گردید', T(25), 'ایسنا'),
    ]);
    expect(clusters.length).toBe(1);
    expect(clusters[0].first.sourceName).toBe('مهر');
  });

  test('اعداد متفاوت در متن کوتاه مانع ادغام بی‌مورد نمی‌شود اما سیگنال تمایز است', () => {
    // دو نسخه از یک رویداد با عدد متفاوت: توکن عددی جزئی تفاوت است، نباید خوشه را بشکند
    const clusters = buildClusters([
      post('n1', 'شمار قربانیان سیل در استان مازندران به ۲۵ نفر رسید و دهها نفر مفقود شدند', T(0), 'الف'),
      post('n2', 'شمار قربانیان سیل در استان مازندران به ۲۷ نفر رسید و دهها نفر مفقود شدند', T(15), 'ب'),
    ]);
    expect(clusters.length).toBe(1);
  });
});

describe('clusterTitle و tokenize — ابزار', () => {
  test('عنوان بلند بریده می‌شود', () => {
    const long = 'خبر بسیار طولانی '.repeat(20).trim();
    const t = clusterTitle(long);
    expect(t.length).toBeLessThanOrEqual(90);
    expect(t.endsWith('…')).toBe(true);
  });
  test('عنوان کوتاه دست‌نخورده می‌ماند', () => {
    expect(clusterTitle('خبر کوتاه')).toBe('خبر کوتاه');
  });
  test('tokenize نیم‌فاصله و اعداد فارسی را نرمال می‌کند', () => {
    const tokens = tokenize('می‌شود ۱۲۳ دقیقه');
    expect(tokens).not.toContain('می\u200cشود');
    expect(tokens.join(' ')).not.toContain('۱۲۳');
  });
});

// ---------- دسته‌بندی موضوعی ----------

describe('طبقه‌بندی موضوعی — طبقه ثابت و اعتبارسنجی', () => {
  test('۱۲ موضوع ثابت با نام و slug یکتا', () => {
    expect(TOPICS.length).toBe(12);
    expect(new Set(TOPIC_NAMES).size).toBe(12);
    expect(new Set(TOPICS.map((t) => t.slug)).size).toBe(12);
    expect(TOPIC_NAMES).toContain('سیاسی');
    expect(TOPIC_NAMES).toContain('سایر/نامشخص');
  });

  test('خروجی درست مدل پذیرفته می‌شود', () => {
    const r = validateTopicBatch({ items: [{ i: 1, topic: 'سیاسی' }, { i: 2, topic: 'ورزشی' }] });
    expect(r!.items.length).toBe(2);
    expect(r!.items[0]).toEqual({ i: 1, topic: 'سیاسی' });
  });

  test('موضوع خارج از فهرست → «سایر/نامشخص» (هیچ دسته خودسرانه‌ای پذیرفته نمی‌شود)', () => {
    const r = validateTopicBatch({ items: [{ i: 1, topic: 'سبک زندگی' }, { i: 2, topic: '' }] });
    expect(r!.items[0].topic).toBe('سایر/نامشخص');
    expect(r!.items[1].topic).toBe('سایر/نامشخص');
  });

  test('ساختار خراب → null؛ آیتم‌های بی‌شماره رد می‌شوند', () => {
    expect(validateTopicBatch(null)).toBeNull();
    expect(validateTopicBatch('متن')).toBeNull();
    expect(validateTopicBatch({ items: 'no' })).toBeNull();
    const r = validateTopicBatch({ items: [{ i: 0, topic: 'سیاسی' }, { i: 2, topic: 'اقتصادی' }, 'خراب'] });
    expect(r!.items.length).toBe(1);
    expect(r!.items[0].i).toBe(2);
  });
});

// ---------- رفرنس‌ها ----------

describe('رفرنس‌ها — ثابت‌ها', () => {
  test('انواع ارجاع و حکم‌های مجاز', () => {
    expect(REF_KINDS).toEqual(['خبر_دیگر', 'واقعه_تاریخی', 'نقل_قول_مستقیم']);
    expect(REF_VERDICTS).toContain('مرتبط_و_معتبر');
    expect(REF_VERDICTS).toContain('یافت_نشده');
    expect(REF_VERDICTS.length).toBe(4);
  });
});
