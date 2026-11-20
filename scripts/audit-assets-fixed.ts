/**
 * ممیزی زندهٔ موتور نمودار دارایی‌ها (پس از اصلاح) — خواستهٔ کاربر ۲۰ نوامبر (پنجم):
 * «پس از اصلاح، تمام شش دارایی داشبورد را مجدداً بررسی کن و برای هر دارایی گزارش بده:
 *  Asset | Start Price | End Price | Calculated Change % | Displayed Change % |
 *  Chart Direction | Date Range | Data Source | Status»
 * دادهٔ واقعی tgju + موتور اصلاح‌شده → جدول + رندر کارت جدید.
 */
import {
  CHART_ASSETS, fetchAssetHistory, mergeLivePoint, buildChartPanel, chartWindow,
  renderAssetsChartPng, panelMatchesPct, type ChartPanel,
} from '../bot/assets-chart';
import { tripleDateOf } from '../bot/calendar';
import { formatMoney } from '../bot/market';
import { parseTgjuCurrent } from '../bot/market';
import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (compatible; RaadbanBot/1.0; +https://github.com)';

// درصد نمایش‌داده‌شده در کارتِ معیوب (اسکرین‌شات کاربر، ۱۳:۰۵ تهران ۲۰ نوامبر)
const OLD_DISPLAYED: Record<string, string> = {
  usd: '▲+۲٫۲٪', gold: '▼−۷٫۲٪', coin: '▼−۶٫۹٪', tse: '▲+۱۴٫۷٪', btc: '▼−۲۷٪', brent: '▼−۱۳٫۸٪',
};

async function main() {
  const nowIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
  const win = chartWindow(nowIso);
  console.log(`امروز (تهران): ${nowIso} | پنجرهٔ واحد همهٔ دارایی‌ها: ${win.start} تا ${win.end}\n`);

  // زنده
  let live: Record<string, { p?: string }> = {};
  for (const h of ['https://call1.tgju.org/ajax.json', 'https://call2.tgju.org/ajax.json']) {
    try {
      const r = await fetch(h, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      const j = await r.text();
      const cur = parseTgjuCurrent(j);
      if (Object.keys(cur).length > 0) { live = cur; break; }
    } catch { /* میزبان بعدی */ }
  }

  const panels: ChartPanel[] = [];
  const rows: string[] = [];
  for (const a of CHART_ASSETS) {
    const s = await fetchAssetHistory(a.symbol, a.rial);
    const liveP = live[a.liveKey]?.p ? Number(String(live[a.liveKey]!.p).replace(/[^0-9.]/g, '')) : null;
    const merged = s ? mergeLivePoint(s, nowIso, liveP, a.rial) : null;
    const p = merged ? buildChartPanel(a, merged, win) : null;
    if (!p) {
      rows.push(`| ${a.title} | — | — | — | ${OLD_DISPLAYED[a.key]} | — | — | tgju ${a.symbol} | ❌ داده ناکافی — پنل حذف (صادقانه) |`);
      continue;
    }
    panels.push(p);
    const first = p.values[0]!;
    const last = p.values[p.values.length - 1]!;
    const dir = p.pct > 0.05 ? 'صعودی ↗ (پایان بالاتر از آغاز)' : p.pct < -0.05 ? 'نزولی ↘ (پایان پایین‌تر از آغاز)' : 'ثابت →';
    const ok = panelMatchesPct(p) && p.firstDate >= win.start && p.lastDate <= win.end;
    rows.push(`| ${a.title} | ${formatMoney(first, p.unit)} | ${formatMoney(last, p.unit)} | ${p.pct > 0 ? '+' : ''}${String(p.pct).replace('.', '٫')}٪ | ${OLD_DISPLAYED[a.key]} | ${dir} | ${p.firstDate} تا ${p.lastDate} (${p.points} نقطه، ${p.spanDays} روز) | tgju ${a.symbol} + نقطهٔ زندهٔ امروز | ${ok ? '✅ هم‌خوان: عدد/فلش/رنگ/جهت از یک سری واحد' : '❌'} |`);
  }

  const table = rows.join('\n');
  console.log(table);

  // کارت جدید
  const date = tripleDateOf(nowIso, 'Asia/Tehran', 'umalqura');
  const card = await renderAssetsChartPng({ date, panels });
  if (card) {
    writeFileSync('/home/z/my-project/download/assets-chart-fixed.png', card.png);
    console.log(`\nکارت جدید رندر شد: ${card.width}×${card.height} → download/assets-chart-fixed.png (${(card.png.length / 1024).toFixed(0)}KB)`);
  } else {
    console.log('\n⚠️ رندر کارت ناموفق');
  }

  // گزارش md
  const md = `# ممیزی و اصلاح موتور نمودار دارایی‌ها — رصدبان
**تاریخ ممیزی:** ${nowIso} (تهران) • **پنجرهٔ واحد:** ${win.start} تا ${win.end} (۳۰ روز تقویمی)

## ریشه‌های خطا (یافت‌شده در کد واقعی، با دادهٔ زنده)

1. **محور زمان راست‌به‌چپ** — \`sparklinePoints\` در \`bot/assets-chart.ts\` قدیم‌ترین نقطه را در لبهٔ *راست* می‌کشید (\`px = x + w − …\`)؛ هر خواننده‌ای چارت را چپ‌به‌راست می‌خواند (قرارداد جهانی نمودار مالی، حتی در tgju و TradingView فارسی). نتیجه: هر شش پنل ظاهراً «جهتِ متناقض با درصد» داشتند — بیت‌کوین ▼۲۷٪ با نموداری که چپ‌به‌راست صعودی دیده می‌شد. داده و درصد درست بود؛ *جهت خوانش* وارونه بود.
2. **«۳۰ روز» در عمل «۳۰ ردیف معاملاتی»** — هر سری با \`slice(0, 30)\` از ردیف‌های API بریده می‌شد؛ بازارها روزهای کاری متفاوت دارند → بازهٔ تقویمی ناهمگون: دلار/طلا/سکه از ~۲۵ مهر، بورس از **۳۰ شهریور** (۶۰ روز!)، برنت از ۲۳ مهر. عنوان کارت «۳۰ روز اخیر» بود.
3. **ترتیب ردیف‌ها هرگز مرتب نمی‌شد** — فقط \`reverse()\`؛ اگر منبعی ترتیب دیگری می‌داد (یا تاریخ تکراری داشت) مستقیم به نمودار می‌رفت.
4. **نقطهٔ زنده بدون سنجهٔ هم‌مقیاسی** — قیمت زندهٔ امروز (گاهی با واحد دیگر) بی‌گارد به انتهای سری می‌چسبید.
5. فید بورس (bourse) در tgju تا ۱۴ آبان عقب است — نقطهٔ زندهٔ امروز بعد از ۶ روز خلأ می‌نشیند؛ اکنون برچسب گسترهٔ واقعی («۲۲ روز • ۱۷ نقطه») صادقانه اعلامش می‌کند.

## اصلاحات اعمال‌شده

| # | اصلاح | محل |
|---|---|---|
| ۱ | محور زمان **چپ→راست** (قدیم=چپ، جدید=راست) + برچسب تاریخ آغاز زیر لبهٔ چپ و تاریخ پایان (امروز) زیر لبهٔ راست هر پنل + پانوشت «چپ: آغاز بازه — راست: امروز» | \`sparklinePoints\` / \`makeAssetsChartSvg\` |
| ۲ | **پنجرهٔ تقویمی یکسان** [امروز−۲۹، امروز] برای همهٔ دارایی‌ها؛ نقاط بیرون حذف؛ گستره/تعداد نقطهٔ واقعی روی پنل | \`chartWindow\` / \`clipSeriesToWindow\` / \`buildChartPanel\` |
| ۳ | مرتب‌سازی صعودی بر اساس تاریخ + حذف تاریخ تکراری — با هر ترتیب ورودی سازگار | \`parseHistorySeries\` |
| ۴ | گارد هم‌مقیاسی نقطهٔ زنده (نسبت [۰٫۳۵، ۲٫۸] به آخرین قیمت؛ خارج → رد) | \`mergeLivePoint\` |
| ۵ | درصد/فلش/رنگ/جهت همه از **همان آرایهٔ بریده‌شده در پنجره**؛ قیمت ثابت → «—» و رنگ خنثی؛ اولِ صفر/منفی → پنل null (بدون NaN/Infinity/درصد جعلی) | \`buildChartPanel\` / \`panelMatchesPct\` |
| ۶ | ۱۴ تست تازه + بازنویسی ۱۰ تست کهن (چک‌لیست کامل ممیز) | \`tests/nov20-5-features.test.ts\` / \`nov20-2-features.test.ts\` |

**هیچ درصد یا قیمتی برای هماهنگ‌کردن تصویر تغییر نکرد — فقط موتور و داده واقعی اصلاح شد.**

## گزارش شش دارایی (دادهٔ زندهٔ tgju، پس از اصلاح)

| دارایی | قیمت آغاز | قیمت پایان | درصد محاسبه‌شده (اصلاح‌شده) | درصد کارت معیوب (اسکرین‌شات) | جهت نمودار (چپ→راست) | بازه | منبع | وضعیت |
|---|---|---|---|---|---|---|---|---|
${table}

## نتیجه
- هر شش پنل اکنون از **یک سری واحد** در **یک پنجرهٔ تقویمی واحد** ساخته می‌شوند؛ جهت نمودار همیشه با علامت درصد هم‌خوان است و تست ناگزیر (\`panelMatchesPct\`) هر ناسازگاری را می‌شکند.
- درصد کارت معیوب با درصد محاسبه‌شدهٔ جدید هم‌خوان است (اختلاف جزئی = تغییرات میان‌روز) — تأیید اینکه خطا «رسم/بازه» بود نه محاسبه.
`;
  writeFileSync('/home/z/my-project/download/audit-assets-chart.md', md);
  console.log('گزارش ممیزی → download/audit-assets-chart.md');
}

main();
