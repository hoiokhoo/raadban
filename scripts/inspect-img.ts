/** بازبینی چشمی تصویر با مدل چشم‌دار — استفاده: bun scripts/inspect-img.ts <مسیر> [پرسش] */
import { readFileSync } from 'node:fs';

async function main() {
  const path = process.argv[2];
  if (!path) { console.error('مسیر تصویر بده'); process.exit(1); }
  const question = process.argv[3] || 'این تصویر را دقیق توصیف کن؛ هرگونه مشکل چیدمان، هم‌پوشانی، بیرون‌زدگی متن، بریدگی، ریز یا ناخوانا بودن متن را فهرست کن.';
  const buf = readFileSync(path);
  const b64 = buf.toString('base64');
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          { type: 'text', text: question },
        ],
      } as any,
    ],
    thinking: { type: 'disabled' },
  });
  const out = (completion as any)?.choices?.[0]?.message?.content || '(پاسخ خالی)';
  console.log(out);
}

main().catch((e) => { console.error('خطا:', e instanceof Error ? e.message : e); process.exit(1); });
