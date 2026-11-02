import { searchEvidenceWeb, parseBingResults } from '../src/lib/factcheck/engine';
const r = await searchEvidenceWeb('آتش‌بس غزه شورای امنیت');
console.log('LIVE:', JSON.stringify({ ok: r.ok, engines: r.enginesTried, count: r.items.length, sample: r.items.slice(0, 3).map(i => ({ t: i.title?.slice(0, 50), u: i.url?.slice(0, 60), s: i.snippet?.slice(0, 60) })) }, null, 1));
// تست پارس با HTML ذخیره‌شدهٔ واقعی بینگ
import { readFileSync } from 'fs';
try {
  const html = readFileSync('/tmp/bing.html', 'utf8');
  const parsed = parseBingResults(html);
  console.log('parsed-from-file:', parsed.length, 'first:', parsed[0]?.url?.slice(0, 50), '|', parsed[0]?.title?.slice(0, 40));
} catch {}
