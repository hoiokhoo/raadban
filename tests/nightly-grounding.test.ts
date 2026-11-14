/**
 * تست‌های قفل تطبیق منبع برای گزارش شبانهٔ ۲۲:۳۰ — خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «شب ۲۲:۳۰ را هم می‌توان با همین قفل تطبیق منبع پایه‌گذاری کن».
 * ساختار گزارش شبانه (🧭 📊 🗂 🔗 🧠 📈 🔮 🗞 🧷) با موارد شماره‌دار فقط در بخش رویدادها —
 * این تست تضمین می‌کند: تیک مدل حذف، مورد بی‌خاستگاه/عددساختگی حذف، تیک فقط از خوشهٔ
 * دومانبعی، و سربرگ بخش‌های پس از موارد (🔗/🧠/📈) در بازسازی زنده می‌مانند.
 */
import { describe, expect, test } from 'bun:test';
import { groundAiBundle } from '../bot/grounding';
import type { MergedItem } from '../bot/hourly';

function cluster(text: string, sources: string[], id: string): MergedItem {
  return { id, source: sources[0] || '', text, at: '2026-11-15T10:00:00.000Z', ids: [id], sources, verified: sources.length >= 2 };
}

const CEASEFIRE = 'توافق آتش‌بس میان دو طرف در جلسهٔ امشب با وساطت قطر امضا شد و از ساعت فردا اجرایی می‌شود';
const MARKET = 'شاخص بورس تهران امروز ۹۲۰ واحد رشد کرد و به سطح تازه‌ای از ماه گذشته رسید';

const MERGED: MergedItem[] = [
  cluster(CEASEFIRE, ['ایسنا', 'مهر'], 'c1'), // verified
  cluster(MARKET, ['بورس‌نیوز'], 'c2'), // تک‌منبعی
];

const NIGHTLY_TEXT = [
  '🧭 روز آتش‌بس و رشد بورس',
  '',
  '📊 پانورامای امروز',
  'روز پررویدادی بود؛ محور دیپلماسی و اقتصاد پررنگ بود.',
  '',
  '🗂 رویدادهای امروز',
  'سیاسی و دیپلماسی',
  `۱. ${CEASEFIRE}`,
  'اقتصاد و انرژی',
  `۲. ✅ ${MARKET}`,
  '۳. مراسم عزاداری شب شهادت حضرت فاطمه زهرا (س) با حضور رهبر معظم انقلاب در زینبیه برگزار شد',
  '۴. توافق آتش‌بس با وساطت عمان و ۱۲ کشور حوزه امضا شد',
  '',
  '🔗 پیوند رویدادهای امروز',
  '• آتش‌بس و رشد بورس هر دو به ثبات سیاسی گره خورده‌اند.',
  '',
  '🧠 تحلیل عمیق',
  '• محور دیپلماسی: آتش‌بس می‌تواند فشار اقتصادی را کم کند.',
  '',
  '📈 روندها و ادامهٔ ماجراها',
  '• ادامهٔ ماجرای آتش‌بس از روز ۲۴ آبان باید رصد شود.',
  '',
  '🔮 نتیجه‌گیری',
  '• امروز روز ثبات‌بخش بود؛ فردا اجرای آتش‌بس را ببینید.',
  '',
  '🗞 منابع: ایسنا، مهر، بورس‌نیوز',
  '',
  '🧷 امروز آتش‌بس قطر-واسط امضا شد؛ بورس ۹۲۰ واحد رشد کرد؛ فردا اجرای آتش‌بس.',
].join('\n');

describe('قفل تطبیق منبع — ساختار گزارش شبانهٔ ۲۲:۳۰', () => {
  test('مورد بی‌خاستگاه (زینبیه) حذف؛ مورد با عدد بیگانه (۱۲ کشور/عمان) حذف؛ شماره‌گذاری فشرده', () => {
    const g = groundAiBundle(NIGHTLY_TEXT, MERGED);
    expect(g.text).not.toBeNull();
    expect(g.total).toBe(4);
    expect(g.dropped).toBe(2);
    expect(g.kept).toBe(2);
    expect(g.text).not.toContain('زینبیه');
    expect(g.text).not.toContain('عمان');
    // شماره‌گذاری مجدد پیاپی — ۱ و ۲
    expect(g.text).toContain('۱. ');
    expect(g.text).toContain('۲. ');
    expect(g.text).not.toContain('۳. ');
    expect(g.text).not.toContain('۴. ');
  });

  test('تیک فقط از خوشهٔ دومانبعی — مورد ۱ (ایسنا+مهر) تیک می‌گیرد، تک‌منبعی نه', () => {
    const g = groundAiBundle(NIGHTLY_TEXT, MERGED);
    expect(g.ticked).toBe(1);
    const lines = (g.text || '').split('\n').filter((l) => /^\u06F1\.|^\u06F2\./.test(l.trim()));
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('✅'); // آتش‌بس — verified
    expect(lines[1]).not.toContain('✅'); // بورس — تک‌منبعی
  });

  test('سربرگ بخش‌های پس از موارد (🔗/🧠/📈) و پانوشت 🧷 و منابع زنده می‌مانند', () => {
    const g = groundAiBundle(NIGHTLY_TEXT, MERGED);
    expect(g.text).toContain('🔗 پیوند رویدادهای امروز');
    expect(g.text).toContain('🧠 تحلیل عمیق');
    expect(g.text).toContain('📈 روندها و ادامهٔ ماجراها');
    expect(g.text).toContain('🔮 نتیجه‌گیری');
    expect(g.text).toContain('🗞 منابع');
    expect(g.text).toContain('🧷');
    expect(g.text).toContain('📊 پانورامای امروز');
    expect(g.text).toContain('🧭');
  });

  test('بولت‌های تحلیل به مورد شماره‌دار نمی‌چسبند و دست‌نخورده می‌مانند', () => {
    const g = groundAiBundle(NIGHTLY_TEXT, MERGED);
    expect(g.text).toContain('• محور دیپلماسی: آتش‌بس می‌تواند فشار اقتصادی را کم کند.');
    expect(g.text).toContain('• آتش‌بس و رشد بورس هر دو به ثبات سیاسی گره خورده‌اند.');
  });

  test('همهٔ موارد حذف شوند → text=null (اسلات شبانه علامت نمی‌خورد؛ چرخهٔ بعد)', () => {
    const hallucinated = ['🗂 رویدادهای امروز', '۱. رویدادی که هیچ نسبتی با منابع ندارد و کاملاً از خودِ مدل است', '۲. رویداد ساختگی دیگر با عدد ۷۷۷'].join('\n');
    const g = groundAiBundle(hallucinated, MERGED);
    expect(g.text).toBeNull();
    expect(g.kept).toBe(0);
    expect(g.dropped).toBe(2);
  });
});
