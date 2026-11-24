/** کادر واقعی متن هر برچسب — رندر مجزای هر برچسب و اندازه‌گیری پیکسلی؛ سپس احاطه در استان */
import { placeCapitalLabels, mercProject, pointInPolygon } from '../bot/iran-map-base';
import { IRAN_PROVINCES } from '../bot/iran-provinces';

const sharp = (await import('sharp')).default;
const placed = placeCapitalLabels();
const polysOf = new Map(IRAN_PROVINCES.map((p) => [p.nameFa, p.rings.map((r) => r.map(([lon, lat]) => mercProject(lon, lat) as [number, number]))]));

let strictOk = 0, looseOk = 0, fail = 0;
for (const p of placed) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60">
  <rect width="300" height="60" fill="black"/>
  <text x="150" y="28" font-family="'B Nazanin', Vazirmatn, sans-serif" font-size="17" font-weight="700" fill="white" text-anchor="middle">\u202B${p.cap.name}\u202C</text>
</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i]! > 100) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  const realW = x1 - x0 + 1;
  const realH = y1 - y0 + 1;
  // مبدأ متن واقعی روی نقشه: مرکز برچسب p.x,p.y — متن واقعی نسبت به مرکز 150 در SVG
  const cx = p.x + (x0 + x1) / 2 - 150;
  const cy = p.y + (y0 + y1) / 2 - 28;
  const bx0 = cx - realW / 2, bx1 = cx + realW / 2;
  const by0 = cy - realH / 2, by1 = cy + realH / 2;
  const polys = polysOf.get(p.cap.province)!;
  const centerIn = polys.some((poly) => pointInPolygon(cx, cy, poly));
  const corners = [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]] as const;
  const strict = centerIn && polys.some((poly) => corners.every(([X, Y]) => pointInPolygon(X, Y, poly)));
  if (strict) strictOk++;
  else if (centerIn) looseOk++;
  else fail++;
  console.log(`${p.cap.name.padEnd(12)} عرض‌واقعی=${String(realW).padStart(3)} (تخمین ${p.w}) متن‌مرکز=(${cx.toFixed(0)},${cy.toFixed(0)}) نشان=(${p.dotX.toFixed(0)},${p.dotY.toFixed(0)}) مرکز‌درون=${centerIn ? 'بله' : 'خیر'} کاملاً=${strict ? 'بله' : 'خیر'}`);
}
console.log(`\nکاملاً‌درون: ${strictOk} | فقط‌مرکز: ${looseOk} | بیرون: ${fail}`);
