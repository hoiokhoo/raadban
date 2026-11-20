/**
 * تست‌های پالایش وقایع روز — خواستهٔ کاربر ۱۵ نوامبر ۲۰۲۶:
 * «در بخش وقایع روز تمامی حوادث مربوط به اغتشاشات و مسایل ضد جمهوری اسلامی
 *  و بازیگران و بازیکنهای فوتبال رو حذف کن».
 * پوشش: واژه‌نامهٔ حذف (اغتشاش/اعتراض/خیزش/مهسا امینی/… و بازیگر/هنرپیشه/فوتبال)،
 * حفظ رویدادهای انقلابی و علمی و مذهبی، یکپارچگی با فرمت‌کنندهٔ بلوک پیام.
 */
import { describe, expect, test } from 'bun:test';
import {
  isDayHistoryBlocked,
  filterDayHistoryEntries,
  RIOT_ANTI_IRI_KEYWORDS,
  SHOW_FOOTBALL_KEYWORDS,
  formatDayHistoryBlock,
  type DayHistoryEntry,
} from '../bot/day-history';

function entry(text: string, year = 1400, kind: DayHistoryEntry['kind'] = 'event'): DayHistoryEntry {
  return { year, text, kind };
}

describe('واژه‌نامهٔ حذف — اغتشاش/ضد جمهوری اسلامی', () => {
  test('هر واژهٔ واژه‌نامه واقعاً مدخل را می‌بندد', () => {
    for (const k of RIOT_ANTI_IRI_KEYWORDS) {
      expect(isDayHistoryBlocked(`۱۴۰۱؛ ${k} در ایران رخ داد`)).toBe(true);
    }
  });

  test('صیغه‌های رایج ویکی‌پدیا — اعتراضات/اغتشاشات/خیزش ۱۴۰۱', () => {
    expect(isDayHistoryBlocked('کشته‌شدن مهسا امینی در بازداشت گشت ارشاد و آغاز اعتراضات سراسری')).toBe(true);
    expect(isDayHistoryBlocked('خیزش ۱۴۰۱ ایران از این روز آغاز شد')).toBe(true);
    expect(isDayHistoryBlocked('تجمعات و اغتشاشات در چند شهر کشور گزارش شد')).toBe(true);
    expect(isDayHistoryBlocked('شعار «زن، زندگی، آزادی» در این روز سر داده شد')).toBe(true);
  });

  test('رویدادهای انقلابی/مردمی/مذهبی حذف نمی‌شوند (عمداً خارج از واژه‌نامه)', () => {
    expect(isDayHistoryBlocked('پیروزی انقلاب اسلامی ایران به رهبری امام خمینی')).toBe(false);
    expect(isDayHistoryBlocked('قیام ۱۵ خرداد ۱۳۴۲')).toBe(false);
    expect(isDayHistoryBlocked('راهپیمایی ۲۲ بهمن')).toBe(false);
    expect(isDayHistoryBlocked('انفجار بیدگنه؛ شهادت سرتیپ حسن تهرانی مقدم')).toBe(false);
    expect(isDayHistoryBlocked('زادروز نیما یوشیج، پدر شعر نو فارسی')).toBe(false);
  });
});

describe('واژه‌نامهٔ حذف — بازیگران و فوتبالیست‌ها', () => {
  test('هر واژهٔ حوزهٔ سینما/فوتبال مدخل را می‌بندد', () => {
    for (const k of SHOW_FOOTBALL_KEYWORDS) {
      expect(isDayHistoryBlocked(`۱۳۵۰؛ ${k} معروف کشور`)).toBe(true);
    }
  });

  test('زادروز/درگذشت بازیگر و بازیکن و رویداد فوتبال — همه حذف', () => {
    expect(isDayHistoryBlocked('درگذشت بازیگر نامدار سینمای ایران')).toBe(true);
    expect(isDayHistoryBlocked('زادروز هنرپیشه و کارگردان')).toBe(true);
    expect(isDayHistoryBlocked('پیروزی تیم ملی فوتبال ایران در جام ملت‌های آسیا')).toBe(true);
    expect(isDayHistoryBlocked('انتقال فوتبالیست ایرانی به باشگاه اروپایی')).toBe(true);
  });

  test('چهره‌های غیر از این دو حوزه می‌مانند', () => {
    expect(isDayHistoryBlocked('زادروز شاعر و ادیب معاصر')).toBe(false);
    expect(isDayHistoryBlocked('درگذشت دانشمند هسته‌ای')).toBe(false);
    expect(isDayHistoryBlocked('کشف واکسن آبله توسط ادوارد ژنر')).toBe(false);
  });
});

describe('filterDayHistoryEntries — پالایش فهرست', () => {
  test('ترتیب حفظ و فقط مدخل‌های مجاز می‌مانند', () => {
    const list = [
      entry('زادروز نیما یوشیج', 1276, 'birth'),
      entry('اعتراضات سراسری در شهرهای مختلف', 1401, 'event'),
      entry('انفجار بیدگنه و شهادت تهرانی مقدم', 1390, 'event'),
      entry('درگذشت بازیگر سینما', 1398, 'death'),
      entry('زادروز شاعر معاصر', 1280, 'birth'),
    ];
    const out = filterDayHistoryEntries(list);
    expect(out.map((e) => e.year)).toEqual([1276, 1390, 1280]);
  });

  test('ورودی خالی/نامعتبر → خالی (بدون خطا)', () => {
    expect(filterDayHistoryEntries([])).toEqual([]);
    expect(filterDayHistoryEntries(undefined as unknown as DayHistoryEntry[])).toEqual([]);
  });

  test('یکپارچگی با بلوک پیام — مدخل حذف‌شده و زادروز در پیام نمی‌آید', () => {
    const list = [
      entry('زادروز نیما یوشیج', 1276, 'birth'),
      entry('خیزش ۱۴۰۱', 1401, 'event'),
      entry('آغاز جنگ تحمیلی عراق علیه ایران', 1359, 'event'),
    ];
    const block = formatDayHistoryBlock(filterDayHistoryEntries(list), 'امروز');
    expect(block).toContain('۱۳۵۹؛ آغاز جنگ تحمیلی');
    expect(block).not.toContain('خیزش');
    // زادروز چهره‌ها هرگز (خواستهٔ کاربر ۲۰ نوامبر)
    expect(block).not.toContain('نیما یوشیج');
  });
});
