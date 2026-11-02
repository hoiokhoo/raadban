import { searchEvidenceWeb } from '../src/lib/factcheck/engine';
const r = await searchEvidenceWeb('نشست شورای امنیت سازمان ملل در مورد آتش‌بس');
console.log(JSON.stringify({ ok: r.ok, engines: r.enginesTried, count: r.items.length, sample: r.items.slice(0, 2).map(i => i.title?.slice(0, 60)), error: r.error }, null, 1));
