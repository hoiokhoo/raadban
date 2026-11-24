/** راستی‌آزمایی پیکسلی: کادر واقعی متنِ هر برچسب (diff تصویر با/بدون برچسب) درون استان خویش؟ */
import { writeFileSync } from 'node:fs';
import { makeForecastFrameSvg } from '../bot/forecast-gif';
import { placeCapitalLabels, mercProject, pointInPolygon } from '../bot/iran-map-base';
import { IRAN_PROVINCES } from '../bot/iran-provinces';
import { buildIranGrid } from '../bot/iran-radar';
import { tripleDateOf } from '../bot/calendar';
import type { RadarCell } from '../bot/iran-radar';

const sharp = (await import('sharp')).default;
const date = tripleDateOf('2026-11-25', 'Asia/Tehran', 'umalqura');
const grid = buildIranGrid(0.7);
const cells: RadarCell[] = grid.map((g) => ({ lat: g.lat, lon: g.lon, cur: { precipitation: 0, rain: 0, snowfall: 0, cloudCover: 15 }, fc: null }));

const svgWith = makeForecastFrameSvg(date, cells, '18:00', 'همین حالا');
// حذف برچسب‌ها/نشان‌ها: خطوط برچسب font-size="17" و نشان‌های r="3.2"
const svgNoLabels = svgWith
  .split('\n')
  .filter((l) => !l.includes('font-size="17"') && !l.includes('r="3.2"'))
  .join('\n');

const imgWith = await sharp(Buffer.from(svgWith)).raw().toBuffer({ resolveWithObject: true });
const imgWithout = await sharp(Buffer.from(svgNoLabels)).raw().toBuffer({ resolveWithObject: true });

const W = imgWith.info.width, H = imgWith.info.height, CH = imgWith.info.channels;
let diffCount = 0;
const diff = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * CH;
    const d = Math.abs(imgWith.data[i]! - imgWithout.data[i]!) + Math.abs(imgWith.data[i + 1]! - imgWithout.data[i + 1]!) + Math.abs(imgWith.data[i + 2]! - imgWithout.data[i + 2]!);
    if (d > 60) { diff[y * W + x] = 1; diffCount++; }
  }
}
console.log('پیکسل‌های متفاوت:', diffCount);
const seen = new Uint8Array(W * H);
const clusters: Array<{ x0: number; x1: number; y0: number; y1: number; n: number }> = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!diff[y * W + x] || seen[y * W + x]) continue;
    let x0 = x, x1 = x, y0 = y, y1 = y, n = 0;
    const stack = [[x, y]];
    seen[y * W + x] = 1;
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      n++;
      if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
      if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (diff[ny * W + nx] && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; stack.push([nx, ny]); }
      }
    }
    if (n > 60) clusters.push({ x0, x1, y0, y1, n });
  }
}
console.log('خوشه‌های متن:', clusters.length);

const HEADER_H = 200;
const placed = placeCapitalLabels();
const polysOf = new Map(IRAN_PROVINCES.map((p) => [p.nameFa, p.rings.map((r) => r.map(([lon, lat]) => mercProject(lon, lat) as [number, number]))]));
let allInside = true;
let matched = 0;
for (const p of placed) {
  const w = p.w;
  const bx0 = p.x - w / 2, bx1 = p.x + w / 2;
  const by0 = p.y + HEADER_H - 11, by1 = p.y + HEADER_H + 11;
  const cl = clusters.find((c) => c.x0 <= bx1 + 6 && c.x1 >= bx0 - 6 && c.y0 <= by1 + 6 && c.y1 >= by0 - 6);
  if (!cl) { console.log(`${p.cap.name}: خوشهٔ متن یافت نشد — کادر انتظاری [${bx0.toFixed(0)}-${bx1.toFixed(0)}, ${by0.toFixed(0)}-${by1.toFixed(0)}]`); allInside = false; continue; }
  matched++;
  const cx = (cl.x0 + cl.x1) / 2, cy = (cl.y0 + cl.y1) / 2;
  const polys = polysOf.get(p.cap.province)!;
  const inside = polys.some((poly) => pointInPolygon(cx, cy - HEADER_H, poly));
  const corners = [[cl.x0, cl.y0 - HEADER_H], [cl.x1, cl.y0 - HEADER_H], [cl.x0, cl.y1 - HEADER_H], [cl.x1, cl.y1 - HEADER_H]] as const;
  const strict = polys.some((poly) => corners.every(([X, Y]) => pointInPolygon(X, Y, poly)));
  if (!inside || !strict) allInside = false;
  console.log(`${p.cap.name.padEnd(10)} متن [${cl.x0}-${cl.x1}, ${cl.y0}-${cl.y1}] درون=${inside ? 'بله' : 'خیر'} کاملاً=${strict ? 'بله' : 'خیر'}`);
}
console.log(`تطبیق ${matched}/${placed.length} —`, allInside ? '✅ متن رندرشدهٔ همهٔ برچسب‌ها کاملاً درون استان خویش است' : '❌ برچسبی بیرون استان است');
