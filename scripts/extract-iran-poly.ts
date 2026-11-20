// استخراج مرز ایران از Natural Earth 50m + ساده‌سازی Douglas-Peucker → ثابت TS
import { readFileSync, writeFileSync } from 'node:fs';

const g = JSON.parse(readFileSync('/tmp/ne50m.geojson', 'utf8'));
const f = g.features.find((x: any) => (x.properties.admin || x.properties.name) === 'Iran');
if (!f) { console.error('Iran not found'); process.exit(1); }
const geom = f.geometry;
console.log('geometry type:', geom.type);

// هر حلقه: [ [lon,lat], ... ] — فقط حلقه‌های بیرونی (سوراخ‌های داخلی ایران ناچیزند)
const rings: Array<Array<[number, number]>> =
  geom.type === 'Polygon'
    ? [geom.coordinates[0]]
    : geom.coordinates.map((p: number[][][]) => p[0]);
console.log('outer rings:', rings.length, 'sizes:', rings.map((r) => r.length).join(','));

// ساده‌سازی Douglas-Peucker روی جفت (x=lon, y=lat با کشش cos(lat میانگین) تا متریک درست باشد)
function dp(points: Array<[number, number]>, eps: number): Array<[number, number]> {
  if (points.length < 4) return points;
  const lat0 = points.reduce((s, p) => s + p[1], 0) / points.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const toXY = (p: [number, number]) => [p[0] * kx, p[1]] as [number, number];
  const sqDist = (p: [number, number], a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return (p[0]-a[0])**2 + (p[1]-a[1])**2;
    const t = Math.max(0, Math.min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / (dx*dx+dy*dy)));
    return (p[0]-(a[0]+t*dx))**2 + (p[1]-(a[1]+t*dy))**2;
  };
  const keep = new Uint8Array(points.length);
  keep[0] = 1; keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const a = toXY(points[s]!), b = toXY(points[e]!);
    let maxD = -1, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = sqDist(toXY(points[i]!), a, b);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps * eps && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}

// eps بر حسب درجه ~0.02 (≈2.2km) — جزئیات ساحلی خوب، حجم کم
const simplified = rings.map((r) => dp(r, 0.005));
const total = simplified.reduce((s, r) => s + r.length, 0);
console.log('simplified sizes:', simplified.map((r) => r.length).join(','), 'total:', total);

// حلقه‌های خیلی کوچک (جزیره‌های ناچیز <6 نقطه یا مساحت ناچیز) حذف
const kept = simplified.filter((r) => r.length >= 5);
const out = JSON.stringify(kept.map((r) => r.map(([lon, lat]) => [+lon.toFixed(4), +lat.toFixed(4)])));
writeFileSync('/tmp/iran-poly.json', out);
console.log('kept rings:', kept.length, 'bytes:', out.length);
