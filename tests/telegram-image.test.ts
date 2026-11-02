/**
 * تست‌های استخراج عکس از پیش‌نمایش وب تلگرام (t.me/s) — ۱ نوامبر ۲۰۲۶
 * با نمونه‌های واقعی نشانه‌گذاری: wrap عکس CDN، آواتار کانال، ایموجی/استیکر، پیام متنی خالص
 * (خواستهٔ کاربر: «اگر اون خبر عکس داره عکس هم در بالای اون خبر ارسال بشه»)
 */
import { describe, test, expect } from 'bun:test';
import { extractMessageImage } from '@/lib/connectors/telegram';

const PHOTO_URL = 'https://cdn4.telesco.pe/file/PHOTO123';
const AVATAR_URL = 'https://cdn4.telesco.pe/file/AVATAR.jpg';

const blockWithPhoto = `<div class="tgme_widget_message text_not_supported_wrap" data-post="presstv/213057">
  <div class="tgme_widget_message_user"><i class="tgme_widget_message_user_photo bgcolor0" data-content="P"><img src="${AVATAR_URL}"></i></div>
  <a class="tgme_widget_message_photo_wrap 5996583195392020418" href="https://t.me/presstv/213057" style="width:800px;background-image:url('${PHOTO_URL}')">
    <img src="${PHOTO_URL}">
  </a>
  <div class="tgme_widget_message_text">متن خبر با عکس</div>
</div>`;

const blockWithAvatarOnly = `<div class="tgme_widget_message" data-post="presstv/213060">
  <div class="tgme_widget_message_user"><i class="tgme_widget_message_user_photo bgcolor0" data-content="P"><img src="${AVATAR_URL}"></i></div>
  <div class="tgme_widget_message_text">متن خبر بدون عکس</div>
</div>`;

const blockWithEmojiBg = `<div class="tgme_widget_message" data-post="presstv/213061">
  <span class="tgme_widget_message_emoji" style="background-image:url('//telegram.org/img/emoji/40/E29DA4.png')"></span>
  <div class="tgme_widget_message_text">متن با ایموجی</div>
</div>`;

const blockWithInlinePhoto = `<div class="tgme_widget_message" data-post="presstv/213062">
  <div class="tgme_widget_message_user"><i class="tgme_widget_message_user_photo"><img src="${AVATAR_URL}"></i></div>
  <img class="tgme_widget_message_photo" src="https://cdn4.telesco.pe/file/INLINE.jpg">
  <div class="tgme_widget_message_text">متن با عکس درون‌خطی</div>
</div>`;

describe('استخراج عکس از پیش‌نمایش وب تلگرام', () => {
  test('wrap عکس — پس‌زمینهٔ CSS، حتی با حضور آواتار', () => {
    expect(extractMessageImage(blockWithPhoto)).toBe(PHOTO_URL);
  });

  test('پیام بدون عکس → null؛ آواتار کانال هرگز عکس خبر نمی‌شود', () => {
    expect(extractMessageImage(blockWithAvatarOnly)).toBeNull();
  });

  test('ایموجی پس‌زمینه‌ای تلگرام حذف می‌شود', () => {
    expect(extractMessageImage(blockWithEmojiBg)).toBeNull();
  });

  test('پشتیبان: <img> درون‌خطی بعد از حذف آواتار', () => {
    expect(extractMessageImage(blockWithInlinePhoto)).toBe('https://cdn4.telesco.pe/file/INLINE.jpg');
  });

  test('نشانی با &amp; هوانسایی می‌شود', () => {
    const b = `<div class="tgme_widget_message" data-post="c/1"><a class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn4.telesco.pe/file/X?a=1&amp;b=2')"></a><div class="tgme_widget_message_text">متن</div></div>`;
    expect(extractMessageImage(b)).toBe('https://cdn4.telesco.pe/file/X?a=1&b=2');
  });

  test('بلوک خالی → null', () => {
    expect(extractMessageImage('')).toBeNull();
  });
});
