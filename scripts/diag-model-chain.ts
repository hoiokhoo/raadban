/** تشخیص زنجیرهٔ مدل — خام‌خروجی هر تأمین‌کننده و دلیل رد اعتبارسنجی */
import { chainCall, getHourlyPrompt } from '../bot/bot';
import { validateHourlyText } from '../bot/hourly';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const state = JSON.parse(readFileSync(resolve(ROOT, 'bot/state.json'), 'utf8'));
const q = (state.bundleQueue || []).slice(0, 8);
const corpus = q.map((it: { text: string; source?: string }, i: number) => `[${i + 1}] ${(it.source || 'منبع')} — ${it.text.slice(0, 300).replace(/\s+/g, ' ')}`).join('\n');

async function main() {
  const r = await chainCall(getHourlyPrompt(), 'رویدادهای این بازه:\n' + corpus, { maxTokens: 8000 });
  console.log('ok:', r.ok, '| provider:', r.providerId, '| error:', r.error || '-');
  console.log('--- raw (اول ۶۰۰ نویسه) ---');
  console.log((r.content || '').slice(0, 600));
  const v = validateHourlyText(r.content);
  console.log('--- validateHourlyText:', v ? `قبول (len ${v.length})` : 'رد شد');
  if (r.content) {
    const t = r.content.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim().replace(/^#+\s*/gm, '').replace(/\*\*/g, '');
    console.log('len بعد از پاک‌سازی:', t.length, '| حروف:', (t.match(/\p{L}/gu) || []).length,
      '| فارسی٪:', Math.round((((t.match(/[\u0600-\u06FF]/gu) || []).length) / Math.max(1, (t.match(/\p{L}/gu) || []).length)) * 100));
  }
}
main();
