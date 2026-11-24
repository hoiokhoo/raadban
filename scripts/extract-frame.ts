/** استخراج فریم ۱۰ گیف و برش شمال‌غرب برای بازبینی برچسب‌ها */
import { execSync } from 'node:child_process';
import sharp from 'sharp';

execSync(`ffmpeg -y -loglevel error -i download/preview-forecast-24h.gif /tmp/render/gf%02d.png`);
const meta = await sharp('/tmp/render/gf11.png').metadata();
console.log('فریم ۱۰:', meta.width, '×', meta.height);
await sharp('/tmp/render/gf11.png').extract({ left: 60, top: 380, width: 520, height: 420 }).resize(1040, 840).png().toFile('/tmp/render/nw-zoom.png');
console.log('ok');
