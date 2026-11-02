import { searchEvidenceWeb } from '../src/lib/factcheck/engine';
for (const q of ['آتش‌بس غزه شورای امنیت سازمان ملل', 'ترامپ تعرفه واردات کانادا و مکزیک']) {
  const r = await searchEvidenceWeb(q);
  console.log('Q:', q.slice(0, 40));
  console.log('  ok:', r.ok, '| engines:', r.enginesTried.join(','), '| count:', r.items.length);
  for (const it of r.items.slice(0, 3)) console.log('   -', (it.title||'').slice(0, 70), '→', (it.url||'').slice(0, 55));
}
