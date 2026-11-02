import { safeFetchBinary } from '../src/lib/security/ssrf';

// ۱) ویکی‌مدیا با UA پیش‌فرض بات
const r1 = await safeFetchBinary('https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/480px-Cat03.jpg');
console.log('wikimedia bot-UA:', r1.ok, r1.status, r1.error || `${r1.bytes?.byteLength}B ${r1.contentType}`);

// ۲) تصویر picsum (ریدایرکت به fastly)
const r2 = await safeFetchBinary('https://picsum.photos/400/240');
console.log('picsum:', r2.ok, r2.status, r2.error || `${r2.bytes?.byteLength}B ${r2.contentType}`);
