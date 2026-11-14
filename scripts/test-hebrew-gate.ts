/**
 * آزمون زندهٔ مسیر توییت عبری — بازتولید دقیق باگ نتانیاهو (۱۵ نوامبر ۲۰۲۶):
 * «الان یه تویییت از نتانیاهو اومده ولی ترجمه نشده!»
 * مسیر واقعی ربات: needsTranslation (دروازهٔ خط) → گیت ترجمه (chainCall) →
 * tweetDisplayBody (متن اصلی + ترجمهٔ فارسی زیرش).
 * موفقیت = توییت عبری نمی‌گذرد مگر با ترجمهٔ فارسی؛ خروجی پیش‌نمایش در download/preview.
 */
import { needsTranslation, translateOne } from '../bot/bot';
import { tweetDisplayBody } from '../bot/bundle';
import { writeFileSync, mkdirSync } from 'node:fs';

const HE_TWEET = 'Netanyahu: נמשיך במערכה בעזה עד להשגת כל היעדים — הניצחון המלא קרוב';
const HE_PURE = 'שר הביטחון אמר היום כי ישראל תמשיך במערכה בעזה עד להשגת כל היעדים';

async function main() {
  mkdirSync('/home/z/my-project/download/preview', { recursive: true });
  console.log('── ۱) دروازهٔ خط (قطعی، بدون مدل) ──');
  console.log(`توییت عبری+لاتین: needsTranslation = ${needsTranslation(HE_TWEET)} (انتظار: true)`);
  console.log(`توییت عبری خالص:  needsTranslation = ${needsTranslation(HE_PURE)} (انتظار: true)`);
  if (!needsTranslation(HE_TWEET) || !needsTranslation(HE_PURE)) {
    console.error('❌ دروازهٔ خط هنوز عبری را نمی‌بیند — باگ رفع نشده');
    process.exit(2);
  }

  console.log('\n── ۲) گیت ترجمهٔ زنده (chainCall واقعی) ──');
  const fa = await translateOne(HE_TWEET);
  if (!fa) {
    console.error('❌ ترجمهٔ زنده ناموفق — در ربات: توییت ارسال نمی‌شود و چرخهٔ بعد دوباره تلاش می‌کند (صادقانه)');
    process.exit(2);
  }
  console.log(`ترجمه: ${fa.slice(0, 200)}`);
  if (!needsTranslation(fa)) {
    console.log('✅ خروجی ترجمه فارسی است و از گیت بازرسی می‌گذرد');
  } else {
    console.error('❌ خروجی ترجمه هنوز غیرفارسی است — گیت ربات آن را رد می‌کند (ارسال نمی‌شود)');
    process.exit(2);
  }

  console.log('\n── ۳) قالب نمایش نهایی بله ──');
  const body = tweetDisplayBody(HE_TWEET, fa);
  console.log(body);
  if (!body.includes('🗣 ترجمه فارسی:')) {
    console.error('❌ قالب «متن اصلی + ترجمهٔ فارسی زیرش» ساخته نشد');
    process.exit(2);
  }

  writeFileSync('/home/z/my-project/download/preview/hebrew-tweet-gate.txt', [
    'آزمون زندهٔ مسیر توییت عبری — ۱۵ نوامبر ۲۰۲۶ (رفع باگ نتانیاهو)',
    '',
    `متن اصلی: ${HE_TWEET}`,
    '',
    body,
    '',
    `needsTranslation(عبری) = ${needsTranslation(HE_TWEET)} — در نسخهٔ قبل false بود و توییت خام می‌رفت`,
  ].join('\n'), 'utf8');
  console.log('\n✅ مسیر کامل: عبری → ترجمهٔ فارسی → «متن اصلی + ترجمه فارسی» — باگ نتانیاهو بسته شد');
}

main().catch((e) => { console.error('❌ خطا:', e); process.exit(1); });
