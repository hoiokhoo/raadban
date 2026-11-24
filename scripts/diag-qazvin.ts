/** تشخیص دقیق قزوین: مرز استان، کاندیدها، برخوردها */
import { mercProject, placeCapitalLabels, pointInPolygon, estLabelWidth } from '../bot/iran-map-base';
import { IRAN_PROVINCES } from '../bot/iran-provinces';

function px(ring: Array<[number, number]>): Array<[number, number]> {
  return ring.map(([lon, lat]) => mercProject(lon, lat) as [number, number]);
}

const qz = IRAN_PROVINCES.find((p) => p.nameFa === 'قزوین')!;
const allPts = qz.rings.flat();
const lons = allPts.map((r) => r[0]!);
const lats = allPts.map((r) => r[1]!);
console.log('قزوین bbox:', Math.min(...lons).toFixed(2), Math.max(...lons).toFixed(2), 'lon |', Math.min(...lats).toFixed(2), Math.max(...lats).toFixed(2), 'lat');

const cap = { name: 'قزوین', province: 'قزوین', lat: 36.269, lon: 50.005 };
const [dotX, dotY] = mercProject(cap.lon, cap.lat);
console.log('نشان قزوین px:', dotX.toFixed(1), dotY.toFixed(1));

const polys = qz.rings.map(px);
const w = estLabelWidth('قزوین');
console.log('عرض برچسب:', w.toFixed(0));

const cands: Array<{ dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }> = [
  { dx: -10, dy: -16, anchor: 'end' }, { dx: 10, dy: -16, anchor: 'start' },
  { dx: -10, dy: 20, anchor: 'end' }, { dx: 10, dy: 20, anchor: 'start' },
  { dx: 0, dy: -30, anchor: 'middle' }, { dx: 0, dy: 34, anchor: 'middle' },
  { dx: -12, dy: 3, anchor: 'end' }, { dx: 12, dy: 3, anchor: 'start' },
  { dx: 0, dy: -48, anchor: 'middle' }, { dx: 0, dy: 52, anchor: 'middle' },
  { dx: -24, dy: -16, anchor: 'end' }, { dx: 24, dy: -16, anchor: 'start' },
  { dx: -24, dy: 20, anchor: 'end' }, { dx: 24, dy: 20, anchor: 'start' },
  { dx: -26, dy: 3, anchor: 'end' }, { dx: 26, dy: 3, anchor: 'start' },
  { dx: 0, dy: -66, anchor: 'middle' }, { dx: 0, dy: 70, anchor: 'middle' },
  { dx: -42, dy: 3, anchor: 'end' }, { dx: 42, dy: 3, anchor: 'start' },
];
const placed = placeCapitalLabels();
for (const c of cands) {
  const cx = c.anchor === 'end' ? dotX + c.dx - w / 2 : c.anchor === 'start' ? dotX + c.dx + w / 2 : dotX + c.dx;
  const cy = dotY + c.dy;
  const box = { x: cx - w / 2, y: cy - 11, w, h: 22 };
  const loose = polys.some((poly) => pointInPolygon(box.x + box.w / 2, box.y + box.h / 2, poly));
  // برخورد با کدام برچسبِ چیده‌شده؟
  let hit = '';
  for (const p of placed) {
    const bx = { x: p.x - p.w / 2, y: p.y - 11, w: p.w, h: 22 };
    const pad = 3;
    const isHit = Math.abs(box.x + box.w / 2 - (bx.x + bx.w / 2)) < (box.w + bx.w) / 2 + pad
      && Math.abs(box.y + box.h / 2 - (bx.y + bx.h / 2)) < (box.h + bx.h) / 2 + pad;
    if (isHit) { hit = p.cap.name; break; }
  }
  console.log(`dx=${String(c.dx).padStart(3)} dy=${String(c.dy).padStart(3)} ${c.anchor.padEnd(6)} داخل=${loose ? 'YES' : 'no '} برخورد=${hit || '—'}`);
}
