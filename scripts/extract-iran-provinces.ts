// استخراج مرز استان‌های ایران از Natural Earth 10m admin-1 + ساده‌سازی DP → ثابت TS
import { readFileSync, writeFileSync } from 'node:fs';

const g = JSON.parse(readFileSync('/tmp/ne10m_admin1.geojson', 'utf8')) as {
  features: Array<{
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown };
  }>;
};

const iran = g.features.filter((f) => {
  const p = f.properties as Record<string, string>;
  return p.admin === 'Iran' || p.geonunit === 'Iran' || (p.sov_a3 === 'IRN' && p.adm0_a3 === 'IRN');
});
console.log('استان‌های یافت‌شده:', iran.length);
for (const f of iran) {
  const p = f.properties as Record<string, string>;
  console.log('-', p.name, '| type:', p.type_en || p.type, '| fclass:', p.fclass, '| region:', p.region);
}

// ساده‌سازی Douglas-Peucker (همان الگوی extract-iran-poly.ts)
function dp(points: Array<[number, number]>, eps: number): Array<[number, number]> {
  if (points.length < 4) return points;
  const lat0 = points.reduce((s, p) => s + p[1], 0) / points.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const toXY = (p: [number, number]) => [p[0] * kx, p[1]] as [number, number];
  const sqDist = (p: [number, number], a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return (p[0] - (a[0] + t * dx)) ** 2 + (p[1] - (a[1] + t * dy)) ** 2;
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

type Ring = Array<[number, number]>;
interface Province { name: string; nameFa: string; rings: Ring[] }

const out: Province[] = [];
for (const f of iran) {
  const p = f.properties as Record<string, string>;
  const nameFa = p.name_fa || p.name_local || p.name; // نام لاتین fallback
  const rings: Ring[] = [];
  const geom = f.geometry;
  if (geom.type === 'Polygon') rings.push(...(geom.coordinates as number[][][]).map((ring) => ring as Ring));
  else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates as number[][][][]) rings.push(poly[0] as Ring);
  }
  // ساده‌سازی + حذف حلقه‌های ریز (جزایر داخل استان‌های ساحلی ناچیز)
  const simp = rings
    .map((r) => dp(r, 0.02))
    .filter((r) => r.length >= 6);
  if (simp.length > 0) out.push({ name: p.name, nameFa, rings: simp });
}
const totalPts = out.reduce((s, pr) => s + pr.rings.reduce((a, r) => a + r.length, 0), 0);
console.log('\nمجموع نقاط پس از ساده‌سازی:', totalPts, '— تعداد استان:', out.length);

// نگاشت نام لاتین → فارسی (۳۱ استان + تهران در NE یک است؛ «Alborz» جدا است)
const FA: Record<string, string> = {
  'Tehran': 'تهران', 'Alborz': 'البرز', 'Isfahan': 'اصفهان', 'Fars': 'فارس', 'East Azarbaijan': 'آذربایجان شرقی',
  'West Azarbaijan': 'آذربایجان غربی', 'Ardabil': 'اردبیل', 'Khorasan-e Jonubi': 'خراسان جنوبی',
  'Khorasan-e Razavi': 'خراسان رضوی', 'Khorasan-e Shomali': 'خراسان شمالی', 'Khuzestan': 'خوزستان',
  'Zanjan': 'زنجان', 'Semnan': 'سمنان', 'Sistan and Baluchestan': 'سیستان و بلوچستان', 'Kerman': 'کرمان',
  'Kermanshah': 'کرمانشاه', 'Kohgiluyeh and Bowyer Ahmad': 'کهگیلویه و بویراحمد', 'Golestan': 'گلستان',
  'Gilan': 'گیلان', 'Lorestan': 'لرستان', 'Mazandaran': 'مازندران', 'Markazi': 'مرکزی', 'Hormozgan': 'هرمزگان',
  'Hamadan': 'همدان', 'Yazd': 'یزد', 'Qom': 'قم', 'Kurdistan': 'کردستان', 'Kirman': 'کرمان', 'Qazvin': 'قزوین',
  'Chahar Mahall and Bakhtiari': 'چهارمحال و بختیاری', 'Ilam': 'ایلام', 'Bushehr': 'بوشهر',
};
for (const pr of out) {
  if (FA[pr.name]) pr.nameFa = FA[pr.name];
  pr.nameFa = pr.nameFa.replace(/^استان\s+/, ''); // «استان اردبیل» → «اردبیل»
}

const header = `/** مرز استان‌های ایران — Natural Earth 10m admin-1 (مالکیت عمومی)، ساده‌شده با
 * Douglas-Peucker (eps≈0.02°) در نوامبر ۲۰۲۶ — scripts/extract-iran-provinces.ts.
 * فقط حلقه‌های بیرونی هر استان؛ جزیره‌های ناچیز حذف شده‌اند. خالص و فقط داده. */
export type ProvinceRing = Array<[number, number]>;
export interface IranProvince { nameFa: string; rings: ProvinceRing[] }
`;
const body = `export const IRAN_PROVINCES: IranProvince[] = ${JSON.stringify(out.map((pr) => ({ nameFa: pr.nameFa, rings: pr.rings })))};\n`;
writeFileSync('/tmp/iran-provinces.ts', header + body);
const size = (header + body).length;
console.log('حجم فایل TS:', (size / 1024).toFixed(1), 'کیلوبایت');
console.log('نام‌های فارسی:', out.map((pr) => pr.nameFa).join('، '));
