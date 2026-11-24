/** تشخیص: کدام مراکز استان بیرون مضلع استان خویش می‌افتند؟ */
import { mercProject, placeCapitalLabels, PROVINCE_CAPS, pointInPolygon } from '../bot/iran-map-base';
import { IRAN_PROVINCES } from '../bot/iran-provinces';

function px(ring: Array<[number, number]>): Array<[number, number]> {
  return ring.map(([lon, lat]) => mercProject(lon, lat) as [number, number]);
}

console.log('--- نشان مراکز (dot) بیرون استان خویش ---');
for (const p of IRAN_PROVINCES) {
  const cap = PROVINCE_CAPS.find((c) => c.province === p.nameFa);
  if (!cap) { console.log(`بدون مرکز: ${p.nameFa}`); continue; }
  const [x, y] = mercProject(cap.lon, cap.lat);
  const inside = p.rings.some((ring) => pointInPolygon(x, y, px(ring)));
  if (!inside) {
    // نزدیک‌ترین فاصله تا حلقه‌ها
    let best = Infinity;
    for (const ring of p.rings) {
      const poly = px(ring);
      for (const [rx, ry] of poly) {
        const d = Math.hypot(rx - x, ry - y);
        if (d < best) best = d;
      }
    }
    console.log(`${cap.name} (${p.nameFa}) — فاصله تا مرز: ${best.toFixed(1)}px`);
  }
}

console.log('--- برچسب‌های forced یا بیرون مرکز استان ---');
for (const pl of placeCapitalLabels()) {
  const polys = IRAN_PROVINCES.find((p) => p.nameFa === pl.cap.province)!.rings.map(px);
  const centerInside = polys.some((poly) => pointInPolygon(pl.x, pl.y, poly));
  if (pl.forced || !centerInside) {
    console.log(`${pl.cap.name} (${pl.cap.province}) forced=${pl.forced} centerInside=${centerInside} anchor=${pl.anchor}`);
  }
}
