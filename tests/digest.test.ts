/**
 * تست‌های واحد تحلیل جامع و زمان‌بندی تهران (bot/digest.ts) — خواستهٔ ۹ نوامبر ۲۰۲۶:
 * استخر رویدادها، پیکرهٔ تحلیل، اعتبارسنج متن فارسی، اسلات‌های ظهر/شب و ضدتکرار روزانه
 */
import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_SYSTEM_BOT_DIGEST, addToPool, dueSlotKey, parseSlots, poolCorpus, slotLabel,
  tehranParts, thinPool, validateDigestText, type PoolItem,
} from '../bot/digest';

function poolItem(i: number, over: Partial<PoolItem> = {}): PoolItem {
  return {
    id: `id-${i}`,
    titleKey: `tk-${i}`,
    source: `منبع ${i}`,
    lang: 'fa',
    text: `متن رویداد شمارهٔ ${i} — تحلیل جامع رصدبان`,
    at: new Date(Date.parse('2026-11-09T08:00:00Z') + i * 60_000).toISOString(),
    ...over,
  };
}

// ---------- استخر ----------

describe('addToPool و thinPool', () => {
  test('افزودن با ضدتکرار id/titleKey', () => {
    const p0 = addToPool([], [poolItem(1), poolItem(2)]);
    expect(p0.added).toBe(2);
    const p1 = addToPool(p0.pool, [poolItem(2), poolItem(3)]);
    expect(p1.added).toBe(1);
    expect(p1.droppedDup).toBe(1);
    expect(p1.pool.map((x) => x.id)).toEqual(['id-3', 'id-1', 'id-2']); // جدیدترین اول
  });

  test('سقف استخر — جدیدترین‌ها می‌مانند و هرگز از سقف رد نمی‌شوند', () => {
    let pool: PoolItem[] = [];
    for (let i = 0; i < 20; i++) pool = addToPool(pool, [poolItem(i)], 10).pool;
    expect(pool.length).toBeLessThanOrEqual(10);
    expect(pool.length).toBeGreaterThanOrEqual(5);
    expect(pool[0].id).toBe('id-19');
  });

  test('thinPool — از نیمهٔ قدیمی با فاصلهٔ یکنواخت می‌ماند (پوشش زمانی)', () => {
    // ترتیب واقعی استخر: جدیدترین اول (عین خروجی addToPool)
    const items: PoolItem[] = [];
    for (let i = 99; i >= 0; i--) items.push(poolItem(i));
    const thinned = thinPool(items, 50);
    expect(thinned.length).toBe(50); // دقیقاً سقف
    expect(thinned.some((x) => x.id === 'id-99')).toBe(true);
    expect(thinned.some((x) => x.id === 'id-74')).toBe(true); // اولین قدیمیِ نگه‌داشته‌شده
    expect(thinned.some((x) => x.id === 'id-0')).toBe(false); // کهن‌ترین حذف
    expect(thinned.some((x) => Number(x.id.slice(3)) < 60)).toBe(true); // پراکندگی زمانی حفظ شده
  });

  test('متن بلند به سقف ۸۰۰ نویسه بریده می‌شود', () => {
    const long = poolItem(1, { text: 'خ'.repeat(2000) });
    const res = addToPool([], [long]);
    expect(res.pool[0].text.length).toBe(800);
  });

  test('آیتم بی‌id یا بی‌متن رد می‌شود', () => {
    const res = addToPool([], [{ ...poolItem(1), id: '' }, { ...poolItem(2), text: '' }]);
    expect(res.added).toBe(0);
  });
});

describe('poolCorpus', () => {
  test('شماره‌گذاری + تازه‌ترین‌ها + سقف نویسه + مقدم بودن متن فارسی', () => {
    const pool = [poolItem(1, { at: '2026-11-09T07:00:00Z' }), poolItem(2, { at: '2026-11-09T08:00:00Z', fa: 'ترجمهٔ فارسی روان' })];
    const c = poolCorpus(pool, 10, 50);
    expect(c).toContain('[1] منبع 2 — ترجمهٔ فارسی روان');
    expect(c).toContain('[2] منبع 1');
  });

  test('استخر خالی → متن خالی', () => {
    expect(poolCorpus([], 10, 50)).toBe('');
  });
});

// ---------- اعتبارسنج متن تحلیل ----------

describe('validateDigestText', () => {
  const FA_OK = '🧭 امروز دو رویداد مهم در اقتصاد و سیاست خارجی رخ داد.\n\n📌 رویدادهای کلیدی\n۱. توافق تازه در مذاکرات انرژی اعلام شد و بازارهای جهانی واکنش نشان دادند و قیمت نفت تغییر کرد.\n۲. شاخص بورس تهران در پایان معاملات رشد کرد و ارزش معاملات بالا بود.\n\n🔍 تحلیل و پیامدها\n• پیوند دو رویداد در جریان سرمایه آشکار است و پیامد کوتاه‌مدت آن تقویت روانهٔ خرید بود.\n• ریسک اصلی بازگشت تنش‌ها و اثر آن بر نرخ ارز است.\n\n📈 روندها و موارد قابل رصد\n• اعلام جزئیات بیشتر توافق در روزهای آینده و اثر آن بر بازار ارز.\n\n🗞 منابع: ایسنا، رویترز';

  test('متن فارسی سالم پذیرفته می‌شود و کد‌بلاک/لینک پاک می‌شود', () => {
    const out = validateDigestText('```\n' + FA_OK + '\n```\nhttps://example.com/x');
    expect(out).not.toBeNull();
    expect(out).not.toContain('```');
    expect(out).not.toContain('https://');
    expect(out).toContain('🧭');
  });

  test('متن خیلی کوتاه رد می‌شود', () => {
    expect(validateDigestText('کوتاه است')).toBeNull();
  });

  test('متن غیرفارسی (انگلیسی) مطلقاً رد می‌شود', () => {
    const en = 'Today the market moved sharply. '.repeat(30);
    expect(validateDigestText(en)).toBeNull();
  });

  test('متن بسیار بلند به ~۳۴۰۰ نویسه بریده می‌شود', () => {
    const long = FA_OK + '\n' + 'پاراگراف تحلیلی طولانی دربارهٔ بازار و سیاست و انرژی. '.repeat(200);
    const out = validateDigestText(long);
    expect(out).not.toBeNull();
    expect((out || '').length).toBeLessThanOrEqual(3450);
  });

  test('undefined/null رد می‌شود', () => {
    expect(validateDigestText(undefined)).toBeNull();
    expect(validateDigestText(null)).toBeNull();
    expect(validateDigestText('')).toBeNull();
  });
});

// ---------- پرامپت ----------

describe('DEFAULT_SYSTEM_BOT_DIGEST', () => {
  test('پرامپت جامع — ساختار الزامی و قواعد صادقگی در آن هست', () => {
    expect(DEFAULT_SYSTEM_BOT_DIGEST).toContain('تحلیلگر ارشد رصدبان');
    expect(DEFAULT_SYSTEM_BOT_DIGEST).toContain('رویدادهای کلیدی');
    expect(DEFAULT_SYSTEM_BOT_DIGEST).toContain('تحلیل و پیامدها');
    expect(DEFAULT_SYSTEM_BOT_DIGEST).toContain('روندها و موارد قابل رصد');
    expect(DEFAULT_SYSTEM_BOT_DIGEST).toContain('منابع');
    expect(DEFAULT_SYSTEM_BOT_DIGEST).toContain('هیچ خبر، عدد، نام');
  });
});

// ---------- زمان‌بندی تهران ----------

describe('parseSlots', () => {
  test('فرمت ساعت ساده و دقیق', () => {
    expect(parseSlots('8,14,20')).toEqual(['08:00', '14:00', '20:00']);
    expect(parseSlots('12:30,21:00')).toEqual(['12:30', '21:00']);
    expect(parseSlots(undefined)).toEqual(['08:00', '14:00', '20:00']);
    expect(parseSlots('25:00,abc,7')).toEqual(['07:00']);
    expect(parseSlots('')).toEqual(['08:00', '14:00', '20:00']);
  });
});

describe('tehranParts', () => {
  test('تاریخ کلید و زمان تهران', () => {
    // 2026-11-08T21:00:00Z = 2026-11-09 00:30 تهران
    const p = tehranParts(Date.parse('2026-11-08T21:00:00Z'));
    expect(p.dateKey).toBe('2026-11-09');
    expect(p.hhmm).toBe('00:30');
    expect(p.dateFa).toContain('آبان');
  });
});

describe('dueSlotKey — قلب ضدتکرار روزانه', () => {
  const SLOTS = ['12:30', '21:00'];

  test('قبل از اولین اسلات → null', () => {
    const p = tehranParts(Date.parse('2026-11-08T06:00:00Z')); // 09:30 تهران
    expect(dueSlotKey(0, SLOTS, undefined, p)).toBeNull();
  });

  test('بعد از اسلات ظهر و بدون سابقه → اسلات ۱۲:۳۰', () => {
    const p = tehranParts(Date.parse('2026-11-08T09:05:00Z')); // 12:35 تهران
    expect(dueSlotKey(0, SLOTS, undefined, p)).toBe('2026-11-08T12:30');
  });

  test('همان اسلات انجام‌شده → null (بدون ارسال دوباره)', () => {
    const p = tehranParts(Date.parse('2026-11-08T09:05:00Z')); // 12:35 تهران
    expect(dueSlotKey(0, SLOTS, '2026-11-08T12:30', p)).toBeNull();
  });

  test('بعد از اسلات شب → اسلات ۲۱ (حتی اگر ظهر انجام شده)', () => {
    const p = tehranParts(Date.parse('2026-11-08T18:10:00Z')); // 21:40 تهران
    expect(dueSlotKey(0, SLOTS, '2026-11-08T12:30', p)).toBe('2026-11-08T21:00');
  });

  test('روز بعد — همان ساعت، تاریخ جدید → دوباره اجرا می‌شود', () => {
    const p = tehranParts(Date.parse('2026-11-09T09:05:00Z')); // 12:35 تهران روز ۹ نوامبر
    expect(dueSlotKey(0, SLOTS, '2026-11-08T21:00', p)).toBe('2026-11-09T12:30');
  });

  test('downtime چندساعته — فقط آخرین اسلت گذشته اجرا می‌شود (بدون انباشت)', () => {
    const p = tehranParts(Date.parse('2026-11-08T18:10:00Z')); // 21:40 تهران؛ هر دو اسلت گذشته
    expect(dueSlotKey(0, SLOTS, undefined, p)).toBe('2026-11-08T21:00');
  });

  test('اسلات‌های نامعتبر → null', () => {
    expect(dueSlotKey(0, [], undefined)).toBeNull();
  });
});

describe('slotLabel', () => {
  test('صبح/ظهر/بعدازظهر/شب', () => {
    expect(slotLabel('08:00')).toBe('صبح');
    expect(slotLabel('12:30')).toBe('ظهر');
    expect(slotLabel('17:00')).toBe('بعدازظهر');
    expect(slotLabel('21:00')).toBe('شب');
  });
});
