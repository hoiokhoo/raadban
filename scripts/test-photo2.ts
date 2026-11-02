import { sendBalePhoto } from '../src/lib/bale-bot';
import { db } from '../src/lib/db';
const row = await db.setting.findUnique({ where: { key: 'bale_chat_id' } });
const chatId = row!.value;
// حالت آپلود: عکسی که سرور بله نمی‌تواند بگیرد → دانلود با UA مرورگر → آپلود multipart
const r = await sendBalePhoto(chatId, 'https://picsum.photos/seed/rasadbann/560/320', '<b>تست عکس — حالت آپلود</b>\n\nاگر عکس بالا را می‌بینید، مسیر آپلود multipart کار می‌کند.');
console.log('upload mode:', JSON.stringify(r));
await db.$disconnect();
