// تست زندهٔ مستقیم اتصال‌دهنده تلگرام — استخراج تصویر بدون واسطهٔ بانک
import { telegramConnector } from '../src/lib/connectors/telegram';
import { db } from '../src/lib/db';

for (const id of ['TasnimNews_Agency', 'presstv']) {
  const r = await telegramConnector.fetchRecent(id, { maxItems: 30 });
  console.log(`\n${id}: ok=${r.ok} posts=${r.posts?.length ?? 0} err=${r.error || '-'}`);
  if (r.posts) {
    const withImg = r.posts.filter((p) => p.imageUrl);
    console.log(`  دارای تصویر: ${withImg.length}/${r.posts.length}`);
    for (const p of withImg.slice(0, 3)) console.log('  🖼', p.imageUrl!.slice(0, 90), '|', p.content.slice(0, 35).replace(/\n/g, ' '));
  }
}
await db.$disconnect();
