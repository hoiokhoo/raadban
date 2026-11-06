/** بررسی دسترس‌پذیری فیدهای خبری داخلی ایران — هم برای bot/sources.json و هم سید سامانه */
const CANDIDATES: Array<[string, string]> = [
  ['IRNA', 'https://www.irna.ir/rss'],
  ['ISNA', 'https://www.isna.ir/rss'],
  ['Mehr', 'https://www.mehrnews.com/rss'],
  ['Tasnim-fa-rss', 'https://www.tasnimnews.com/fa/rss'],
  ['Tasnim-feed', 'https://www.tasnimnews.com/en/rss-feed'],
  ['Fars', 'https://farsnews.ir/rss'],
  ['YJC', 'https://www.yjc.ir/rss'],
  ['IRIB', 'https://www.iribnews.ir/rss'],
  ['KhabarOnline', 'https://www.khabaronline.ir/rss'],
  ['ILNA', 'https://www.ilna.ir/rss'],
  ['Entekhab', 'https://www.entekhab.ir/rss'],
  ['EtemadOnline', 'https://www.etemadonline.ir/rss'],
  ['Mashregh', 'https://www.mashreghnews.ir/rss'],
  ['DonyaEqtesad', 'https://www.donya-e-eqtesad.com/rss'],
  ['Varzesh3', 'https://www.varzesh3.com/rss'],
  ['ISNA-raw', 'https://www.isna.ir/rsspage'],
  ['IRNA-latest', 'https://www.irna.ir/rss/latest'],
  ['Tasnim-GB', 'https://news.google.com/rss/search?q=site:tasnimnews.com+when:3d&hl=fa&gl=IR&ceid=IR:fa'],
  ['IRNA-GB', 'https://news.google.com/rss/search?q=site:irna.ir+when:3d&hl=fa&gl=IR&ceid=IR:fa'],
  ['Fararu', 'https://www.fararu.com/rss'],
  ['Hamshahri', 'https://www.hamshahrionline.ir/rss'],
  ['EghtesadOnline', 'https://www.eghtesadonline.com/rss'],
  ['TejaratNews', 'https://tejaratnews.com/rss'],
  ['AsrIran-GB', 'https://news.google.com/rss/search?q=site:asriran.com+when:3d&hl=fa&gl=IR&ceid=IR:fa'],
];

function countItems(xml: string): number {
  return (xml.match(/<item[\s>]/g) || []).length;
}

for (const [name, url] of CANDIDATES) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RaadbanBot/1.0)', Accept: 'application/rss+xml,application/xml,text/xml,*/*' },
      signal: ctrl.signal, redirect: 'follow',
    });
    const text = await res.text();
    const items = countItems(text);
    const title = text.match(/<title>(?:<!\[CDATA\[)?([^<\]]+)/)?.[1]?.trim() || '?';
    console.log(`${res.ok && items > 0 ? '✅' : '❌'} ${name.padEnd(16)} HTTP ${res.status} items=${items} — ${title.slice(0, 60)}`);
  } catch (e) {
    console.log(`❌ ${name.padEnd(16)} ERR: ${e instanceof Error ? e.message : e}`);
  } finally { clearTimeout(t); }
}
