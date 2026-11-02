/**
 * سرور آزمون سازگار-OpenAI برای اثبات failover واقعی (تست کنترل کیفی)
 * فقط برای پروب /api/settings/ai/test استفاده می‌شود و پس از آزمون متوقف می‌شود.
 */
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url?.endsWith('/chat/completions')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ message: { content: `موفق (مدل آزمون: ${parsed.model})` } }],
      }));
    });
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(9377, '127.0.0.1', () => console.log('mock provider ready on 9377'));
setTimeout(() => process.exit(0), 180000); // خروج خودکار پس از ۳ دقیقه
