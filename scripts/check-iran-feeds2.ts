const CANDIDATES: Array<[string, string]> = [
  ['Fars-www', 'https://www.farsnews.ir/rss'],
  ['Fars-GB', 'https://news.google.com/rss/search?q=site:farsnews.ir+when:3d&hl=fa&gl=IR&ceid=IR:fa'],
  ['YJC-1', 'https://www.yjc.ir/fa/rss/1'],
  ['YJC-GB', 'https://news.google.com/rss/search?q=site:yjc.ir+when:3d&hl=fa&gl=IR&ceid=IR:fa'],
  ['IRIB-GB', 'https://news.google.com/rss/search?q=site:iribnews.ir+when:3d&hl=fa&gl=IR&ceid=IR:fa'],
  ['Entekhab-GB', 'https://news.google.com/rss/search?q=site:entekhab.ir+when:3d&hl=fa&gl=IR&ceid=IR:fa'],
  ['Tasnim-GB2', 'https://news.google.com/rss/search?q=site:tasnimnews.com+when:7d&hl=fa&gl=IR&ceid=IR:fa'],
  ['Tasnim-en', 'https://www.tasnimnews.com/en/rss?service=7'],
  ['Varzesh3-GB', 'https://news.google.com/rss/search?q=site:varzesh3.com+when:3d&hl=fa&gl=IR&ceid=IR:fa'],
  ['ISNA-fa-GB', 'https://news.google.com/rss/search?q=site:isna.ir+when:3d&hl=fa&gl=IR&ceid=IR:fa'],
  ['ParsToday', 'https://parstoday.com/fa/rss'],
  ['Khabaronline-sport', 'https://www.khabaronline.ir/rss/sport'],
  ['IRNA-economy', 'https://www.irna.ir/rss/economy'],
  ['Mehr-fa-services', 'https://www.mehrnews.com/rss?srv=17'],
  ['IRNA-politics', 'https://www.irna.ir/rss/politics'],
  ['ISNA-sport', 'https://www.isna.ir/rss/sport'],
];
function countItems(xml: string): number { return (xml.match(/<item[\s>]/g) || []).length; }
for (const [name, url] of CANDIDATES) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RaadbanBot/1.0)', Accept: 'application/rss+xml,application/xml,text/xml,*/*' }, signal: ctrl.signal, redirect: 'follow' });
    const text = await res.text();
    const items = countItems(text);
    console.log(`${res.ok && items > 0 ? 'OK' : 'NO'} ${name.padEnd(18)} HTTP ${res.status} items=${items}`);
  } catch (e) { console.log(`NO ${name.padEnd(18)} ERR: ${e instanceof Error ? e.message : e}`); }
  finally { clearTimeout(t); }
}
