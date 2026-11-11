/**
 * ساخت صفحات پیش‌نمایش به سبک بله از bot/preview-out.json — خواستهٔ کاربر ۱۲ نوامبر ۲۰۲۶:
 * «یه پریویو از نتایج ربات رو بگیر و نمایش بده تا مشکلاتش رو اصلاح کنیم».
 * خروجی: /tmp/preview/<label>.html (یک صفحه برای هر پیام) — بعداً اسکرین‌شات در download/preview/.
 * اجرا: node scripts/render-preview-html.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = '/tmp/preview';
mkdirSync(OUT, { recursive: true });

const data = JSON.parse(readFileSync(resolve(ROOT, 'bot/preview-out.json'), 'utf8'));

// فونت وزیرمتن — کپی کنار صفحه تا file:// کار کند
for (const f of ['vazirmatn-arabic-400-normal.woff2', 'vazirmatn-arabic-500-normal.woff2', 'vazirmatn-arabic-700-normal.woff2']) {
  const src = resolve(ROOT, 'node_modules/@fontsource/vazirmatn/files', f);
  if (existsSync(src)) copyFileSync(src, resolve(OUT, f));
}

// ---------- تبدیل HTML بله به HTML مرورگر — فقط تگ‌های مجاز بله ----------
function baleToHtml(s) {
  let t = s;
  t = t.replace(/<(\/?)(b|strong|i|em|u|s|strike|del|code|pre)>/gi, '\u0001$1$2\u0002');
  t = t.replace(/<a href="([^"]*)">/g, (_, h) => `\u0001a href="${h}"\u0002`).replace(/<\/a>/gi, '\u0001/a\u0002');
  t = t.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  t = t.replace(/\u0001(\/?)(b|strong|i|em|u|s|strike|del|code|pre|a(?: href="[^"]*"))\u0002/g, '<$1$2>');
  return t.replace(/\n/g, '<br>'); // خط جدید متن پیام = خط واقعی در پیش‌نمایش
}

const ORDER = { news: '۱', morning: '۲', evening: '۳', weather: '۴', market: '۵' };
const TITLES = {
  news: 'بستهٔ خبری ۲ساعته — اسلات‌های زوج تهران',
  morning: 'پیام صبحگاهی — ساعت ۰۵:۰۰',
  evening: 'پیام شبانگاهی — ساعت ۲۱:۰۰',
  weather: 'پیش‌بینی ساعتی فردا — ساعت ۲۱:۰۰',
  market: 'گزارش بازار — اسلات‌های ۱۲:۳۰ و ۲۱:۰۰',
};

function pageHtml(m) {
  const notes = (m.notes || []).map((n) => `• ${n}`).join('<br>');
  const hasPhoto = !!m.photoUrl;
  // کپشن = متن پیام (اگر بلندتر از ۱۰۲۴ باشد ادامه در پیام جداگانه — نمایش در همین صفحه)
  let captionHtml = '';
  let restHtml = '';
  if (hasPhoto) {
    const cap = m.captionSplit || { caption: m.text, rest: '' };
    captionHtml = baleToHtml(cap.caption);
    if (cap.rest) restHtml = cap.rest;
  }
  const bodyHtml = baleToHtml(m.text);
  // عکس: اگر فایل محلی موجود باشد استفاده می‌شود؛ وگرنه جانگهدار صادقانه (شبکهٔ سندباکس
  // بعضی CDNها را می‌بندد — در محیط واقعی ربات عکس واقعی می‌چسبد)
  let photoMarkup = '';
  if (hasPhoto) {
    const local = existsSync(resolve(OUT, 'morning-photo.jpg')) && m.label === 'morning';
    photoMarkup = local
      ? `<div class="photo"><img src="morning-photo.jpg"></div>`
      : `<div class="photo ph">🖼 این‌جا در بله تصویر طبیعت می‌چسبد (عکس با کپشنِ همین پیام — پیام جداگانه نیست)<br><span class="phurl">آدرس تصویر این چرخه: ${m.photoUrl}</span></div>`;
  }
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour12: false, hour: '2-digit', minute: '2-digit' }).format(Date.now());
  const faTime = time.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Vazirmatn'; src: url('vazirmatn-arabic-400-normal.woff2') format('woff2'); font-weight: 400; }
  @font-face { font-family: 'Vazirmatn'; src: url('vazirmatn-arabic-500-normal.woff2') format('woff2'); font-weight: 500; }
  @font-face { font-family: 'Vazirmatn'; src: url('vazirmatn-arabic-700-normal.woff2') format('woff2'); font-weight: 700; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Vazirmatn', 'Tahoma', sans-serif;
    background: linear-gradient(160deg, #e8e3d9 0%, #dfe6e0 55%, #e6e9e4 100%);
    padding: 0 0 28px 0;
    width: 720px;
  }
  .pagehead { background: #173d33; color: #fff; padding: 14px 24px 12px; }
  .pagehead h1 { font-size: 17px; font-weight: 700; }
  .pagehead .sub { font-size: 12px; opacity: .75; margin-top: 3px; }
  .chat { padding: 18px 20px 6px; }
  .chan { display: flex; align-items: center; gap: 12px; background: #134d40; padding: 10px 18px; color: #fff; }
  .chan .avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg,#0e7a5f,#0a5c48); display: flex; align-items: center; justify-content: center; font-size: 21px; font-weight: 700; color: #ffd75e; }
  .chan .t { font-size: 15.5px; font-weight: 700; }
  .chan .s { font-size: 11.5px; opacity: .8; margin-top: 2px; }
  .bubble {
    background: #fff; border-radius: 14px 14px 4px 14px; padding: 12px 16px 8px;
    margin: 14px 6px 0 auto; max-width: 660px; width: calc(100% - 40px);
    box-shadow: 0 1px 2px rgba(0,0,0,.18); font-size: 14.5px; line-height: 2.05; color: #1c1c1c;
    overflow-wrap: break-word; position: relative;
  }
  .bubble b { font-weight: 700; }
  .bubble a { color: #0a7a5f; text-decoration: none; }
  .photo { margin: -12px -16px 10px; }
  .photo img { width: 100%; display: block; border-radius: 14px 14px 0 0; }
  .meta { text-align: left; color: #8a97a0; font-size: 11px; margin-top: 6px; }
  .note {
    margin: 16px 20px 0; background: #fff8e6; border: 1px solid #eedc9a; border-radius: 10px;
    padding: 10px 14px; font-size: 12.5px; line-height: 1.9; color: #6b5518;
  }
  .rest {
    background: #fff; border-radius: 14px 14px 4px 14px; padding: 12px 16px 8px;
    margin: 10px 6px 0 auto; max-width: 660px; width: calc(100% - 40px);
    box-shadow: 0 1px 2px rgba(0,0,0,.18); font-size: 14.5px; line-height: 2.05;
  }
  .restlabel { font-size: 11.5px; color: #5a6b75; margin: 10px 26px 0; }
  .photo.ph { margin: -12px -16px 12px; background: linear-gradient(140deg,#f5c26b 0%,#e8905a 45%,#8a5a3b 100%); color: #fff; padding: 68px 22px; text-align: center; font-size: 14px; font-weight: 500; border-radius: 14px 14px 0 0; text-shadow: 0 1px 3px rgba(0,0,0,.35); }
  .photo.ph .phurl { font-size: 10.5px; opacity: .85; direction: ltr; display: inline-block; max-width: 96%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 400; }
</style>
</head>
<body>
  <div class="pagehead">
    <h1>${ORDER[m.label] || ''}. ${TITLES[m.label] || m.title}</h1>
    <div class="sub">پیش‌نمایش خروجی واقعی ربات — ساخته‌شده با همان کد و همان داده‌ها • ${data.tehranNow} به وقت تهران</div>
  </div>
  <div class="chat">
    <div class="chan">
      <div class="avatar">ر</div>
      <div>
        <div class="t">رصدبان 📡</div>
        <div class="s">کانال خبری‌ـ‌تحلیلی • پیام‌رسان بله</div>
      </div>
    </div>
    <div class="bubble">
      ${hasPhoto ? photoMarkup : ''}
      ${hasPhoto ? captionHtml : bodyHtml}
      <div class="meta">${faTime} ✓✓</div>
    </div>
    ${restHtml ? `<div class="restlabel">ادامهٔ پیام (متنِ سرریز از کپشن ۱۰۲۴ نویسه‌ای — در بله پیام جداگانه می‌شود):</div><div class="rest">${baleToHtml(restHtml)}<div class="meta">${faTime} ✓✓</div></div>` : ''}
  </div>
  ${notes ? `<div class="note"><b>یادداشت ساخت این پیش‌نمایش:</b><br>${notes}</div>` : ''}
</body>
</html>`;
}

let n = 0;
for (const m of data.messages) {
  const f = resolve(OUT, `${m.label}.html`);
  writeFileSync(f, pageHtml(m), 'utf8');
  console.log('نوشته شد:', f);
  n++;
}
console.log(`${n} صفحهٔ پیش‌نمایش ساخته شد.`);
