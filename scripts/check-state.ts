import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const cats = await db.category.findMany({ select: { slug: true, name: true, isActive: true } });
  console.log('CATEGORIES:', JSON.stringify(cats, null, 0).slice(0, 600));
  const pv = await db.promptVersion.groupBy({ by: ['name'], _count: true });
  console.log('PROMPT_VERSIONS:', JSON.stringify(pv));
  const khodro = await db.promptVersion.findFirst({ where: { name: { contains: 'khodro' } }, select: { name: true, version: true, isActive: true, content: true } });
  if (khodro) console.log('KHODRO_PROMPT:', khodro.name, khodro.version, khodro.isActive, 'len=' + khodro.content.length, '| has-7roles:', ['بازار', 'اقتصاد', 'فنی', 'صنعت', 'واردات', 'الکتریکی', 'راستی'].map(k => khodro!.content.includes(k)).join(','));
  else console.log('KHODRO_PROMPT: NOT FOUND under that name');
  const cKh = await db.category.findFirst({ where: { slug: { contains: 'khodro' } }, select: { slug: true, name: true, promptTemplate: true } });
  if (cKh) console.log('CATEGORY_KHODRO:', cKh.slug, cKh.name, 'promptLen=' + (cKh.promptTemplate?.length ?? 0));
  const src = await db.source.findMany({ select: { name: true, platform: true, status: true, isActive: true } });
  console.log('SOURCES(' + src.length + '):', src.map(s => `${s.platform}:${s.name}[${s.status}]`).join(' | ').slice(0, 800));
  const posts = await db.post.count(); const events = await db.event.count(); const claims = await db.claim.count();
  const reports = await db.dailyReport.findMany({ select: { reportDate: true, jDate: true, status: true, categoryId: true }, orderBy: { generatedAt: 'desc' }, take: 8 });
  console.log(`POSTS=${posts} EVENTS=${events} CLAIMS=${claims}`);
  console.log('REPORTS:', reports.map(r => `${r.jDate}/${r.categoryId ? 'cat' : 'همه'}:${r.status}`).join(' | '));
  const sched = await db.setting.findUnique({ where: { key: 'schedule' } });
  console.log('SCHEDULE:', sched?.value?.slice(0, 200) ?? 'نامعلوم');
  const preds = await db.prediction.count();
  const sugg = await db.sourceSuggestion.count();
  console.log(`PREDICTIONS=${preds} SUGGESTIONS=${sugg}`);
}
main().finally(() => db.$disconnect());
