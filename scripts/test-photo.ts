/** تست ارسال عکس به بله — URL مستقیم و آپلود جایگزین */
import { sendBalePhoto } from '../src/lib/bale-bot';
import { db } from '../src/lib/db';

const row = await db.setting.findUnique({ where: { key: 'bale_chat_id' } });
const chatId = row!.value;
console.log('chatId:', chatId);

// تصویر عمومی پایدار (ویکی‌مدیا)
const url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/480px-Cat03.jpg';
const r1 = await sendBalePhoto(chatId, url, '<b>تست عکس — حالت URL مستقیم</b>\n\nاگر این پیام را با عکس می‌بینید، sendPhoto با URL کار می‌کند.');
console.log('URL mode:', JSON.stringify(r1));

const r2 = await sendBalePhoto(chatId, 'https://nonexistent-domain-xyz123.example/no.jpg', 'این باید شکست بخورد و آپلود هم ناموفق باشد');
console.log('fail path:', JSON.stringify(r2));

await db.$disconnect();
