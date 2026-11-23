/**
 * زیرساخت نقشهٔ ایران برای گیف‌های هواشناسی — خواستهٔ کاربر ۲۴ نوامبر ۲۰۲۶:
 * «اسامی مرکز شهرها داخل حیطه هر استان قرار داده بشه طوری که بهم نخورن» +
 * «خیلی خفن از یه سایت هواشناسی که مدل پیشبینی ۲۴ ساعته رو داده کپیش کنی یا گیف
 *  متحرکش رو بزاری که بهتره».
 *
 *  → تصویرسازی وب‌مرکاتور (همان تصویر کاشی‌های رادار RainViewer — سازگار با گیف رادار)؛
 *  → مرز استان‌ها از Natural Earth 10m admin-1 (مالکیت عمومی — bot/iran-provinces.ts)؛
 *  → ۳۱ مرکز استان با نشان نقطه و برچسب «بدون هم‌پوشانی» (الگوریتم جابه‌جایی حریصانه)؛
 *  → مرز کشور از bot/iran-radar.ts (IRAN_RINGS) برای clip لایهٔ داده.
 * همهٔ توابع خالص و تست‌پذیرند؛ فقط هندسه و رشتهٔ SVG.
 */
import { IRAN_RINGS } from './iran-radar';
import { IRAN_PROVINCES } from './iran-provinces';

// ---------- هندسهٔ بوم (وب‌مرکاتور) ----------

export const MAP_W = 1100;
/** جعبهٔ جغرافیایی — همان IRAN_BBOX رادار: lon ۴۳–۶۴ / lat ۲۴–۴۱ */
export const MERC_BBOX = { minLat: 24, maxLat: 41, minLon: 43, maxLon: 64 } as const;
const MARGIN = 6;

/** عرض جغرافیایی → y مرکاتور (رادیان‌نما) — خالص */
function mercY(latDeg: number): number {
  const rad = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

const Y_TOP = mercY(MERC_BBOX.maxLat); // مرکاتورِ شمالِ جعبه (بزرگ‌تر)
const Y_SPAN = Y_TOP - mercY(MERC_BBOX.minLat); // مثبت — شمال→جنوب
const X_SPAN = ((MERC_BBOX.maxLon - MERC_BBOX.minLon) * Math.PI) / 180;

/** ارتفاع بوم — نسبت مرکاتوری واقعی (~۱۰۷۵ برای عرض ۱۱۰۰) */
export const MAP_H = Math.round(((MAP_W - MARGIN * 2) * Y_SPAN) / X_SPAN) + MARGIN * 2;

/** lon/lat → پیکسل بوم (بالا=شمال). خالص تست‌پذیر. */
export function mercProject(lon: number, lat: number): [number, number] {
  const x = MARGIN + (((lon - MERC_BBOX.minLon) * Math.PI) / 180 / X_SPAN) * (MAP_W - MARGIN * 2);
  const y = MARGIN + ((Y_TOP - mercY(lat)) / Y_SPAN) * (MAP_H - MARGIN * 2);
  return [x, y];
}

// ---------- مراکز استان‌ها — ۳۱ استان (مختصات جغرافیایی مرجع) ----------

export interface ProvinceCap {
  name: string;
  province: string;
  lat: number;
  lon: number;
  /** شهرهای بزرگ/شلوغ ناحیهٔ مرکزی — اولویت در چینش برچسب */
  big?: boolean;
}

export const PROVINCE_CAPS: ProvinceCap[] = [
  { name: 'تهران', province: 'تهران', lat: 35.689, lon: 51.389, big: true },
  { name: 'مشهد', province: 'خراسان رضوی', lat: 36.297, lon: 59.607, big: true },
  { name: 'اصفهان', province: 'اصفهان', lat: 32.654, lon: 51.666, big: true },
  { name: 'شیراز', province: 'فارس', lat: 29.592, lon: 52.584, big: true },
  { name: 'تبریز', province: 'آذربایجان شرقی', lat: 38.08, lon: 46.292, big: true },
  { name: 'کرج', province: 'البرز', lat: 35.84, lon: 50.939, big: true },
  { name: 'اهواز', province: 'خوزستان', lat: 31.318, lon: 48.671 },
  { name: 'قم', province: 'قم', lat: 34.642, lon: 50.874, big: true },
  { name: 'کرمان', province: 'کرمان', lat: 30.284, lon: 57.083 },
  { name: 'یزد', province: 'یزد', lat: 31.897, lon: 54.357 },
  { name: 'ارومیه', province: 'آذربایجان غربی', lat: 37.553, lon: 45.076 },
  { name: 'رشت', province: 'گیلان', lat: 37.281, lon: 49.583 },
  { name: 'زاهدان', province: 'سیستان و بلوچستان', lat: 29.496, lon: 60.862 },
  { name: 'کرمانشاه', province: 'کرمانشاه', lat: 34.315, lon: 47.065 },
  { name: 'همدان', province: 'همدان', lat: 34.799, lon: 48.515 },
  { name: 'اردبیل', province: 'اردبیل', lat: 38.25, lon: 48.293 },
  { name: 'بندرعباس', province: 'هرمزگان', lat: 27.183, lon: 56.267 },
  { name: 'اراک', province: 'مرکزی', lat: 34.092, lon: 49.689 },
  { name: 'ساری', province: 'مازندران', lat: 36.563, lon: 53.06 },
  { name: 'سنندج', province: 'کردستان', lat: 35.322, lon: 46.986 },
  { name: 'بیرجند', province: 'خراسان جنوبی', lat: 32.866, lon: 59.221 },
  { name: 'گرگان', province: 'گلستان', lat: 36.843, lon: 54.445 },
  { name: 'خرم‌آباد', province: 'لرستان', lat: 33.488, lon: 48.356 },
  { name: 'زنجان', province: 'زنجان', lat: 36.678, lon: 48.479 },
  { name: 'قزوین', province: 'قزوین', lat: 36.269, lon: 50.005 },
  { name: 'بوشهر', province: 'بوشهر', lat: 28.923, lon: 50.82 },
  { name: 'شهرکرد', province: 'چهارمحال و بختیاری', lat: 32.329, lon: 50.863 },
  { name: 'بجنورد', province: 'خراسان شمالی', lat: 37.471, lon: 57.329 },
  { name: 'ایلام', province: 'ایلام', lat: 33.637, lon: 46.423 },
  { name: 'یاسوج', province: 'کهگیلویه و بویراحمد', lat: 30.668, lon: 51.588 },
  { name: 'سمنان', province: 'سمنان', lat: 35.573, lon: 53.4 },
];

// ---------- چینش برچسب بدون هم‌پوشانی — خالص و تست‌پذیر ----------

export interface PlacedLabel {
  cap: ProvinceCap;
  x: number;
  y: number;
  /** x نقطهٔ نشان (نقطهٔ مرکز استان) */
  dotX: number;
  dotY: number;
  anchor: 'start' | 'middle' | 'end';
  /** تخمین عرض برچسب برای برخورد */
  w: number;
  forced?: boolean;
}

/** تخمین عرض متن فارسی (فونت ۱۷) — نویسه‌های فارسی ~۹px + حاشیه. خالص. */
export function estLabelWidth(name: string): number {
  return (name || '').length * 9.4 + 6;
}

/** آیا دو جعبه (با بالشتک ۳px) برخورد دارند؟ — خالص */
function boxesHit(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  const pad = 3;
  return Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)) < (a.w + b.w) / 2 + pad
    && Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < (a.h + b.h) / 2 + pad;
}

/** چینش برچسب مراکز استان — بزرگ‌ها اولویت چینش؛ کاندیدهای جابه‌جایی تا یافتن جای بی‌برخورد.
 *  خروجی همیشه برای همهٔ ۳۱ مرکز جا دارد (آخرین کاندید در بدترین حالت تحمیلی). خالص تست‌پذیر. */
export function placeCapitalLabels(caps: ProvinceCap[] = [...PROVINCE_CAPS]): PlacedLabel[] {
  const order = [...caps].sort((a, b) => (b.big ? 1 : 0) - (a.big ? 1 : 0));
  const placed: PlacedLabel[] = [];
  for (const cap of order) {
    const [dotX, dotY] = mercProject(cap.lon, cap.lat);
    const w = estLabelWidth(cap.name);
    // کاندیدها: (dx از نقطهٔ لنگر متن، dy، anchor) — متن کنار/بالا/پایینِ نشان
    const cands: Array<{ dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }> = [
      { dx: -10, dy: -16, anchor: 'end' }, // بالای نشان، متن به چپ پایان می‌یابد
      { dx: 10, dy: -16, anchor: 'start' }, // بالای نشان، به راست
      { dx: -10, dy: 20, anchor: 'end' }, // پایین نشان
      { dx: 10, dy: 20, anchor: 'start' },
      { dx: 0, dy: -30, anchor: 'middle' }, // بالاتر وسط
      { dx: 0, dy: 34, anchor: 'middle' }, // پایین‌تر وسط
      { dx: -12, dy: 3, anchor: 'end' }, // هم‌سطح نشان
      { dx: 12, dy: 3, anchor: 'start' },
      { dx: 0, dy: -48, anchor: 'middle' },
      { dx: 0, dy: 52, anchor: 'middle' },
    ];
    let chosen: PlacedLabel | null = null;
    for (const c of cands) {
      // x مرکز متن برای anchor — جعبهٔ برخورد حول مرکز متن (هم‌قد با جعبهٔ ذخیره‌شده: ۲۲px)
      const cx = c.anchor === 'end' ? dotX + c.dx - w / 2 : c.anchor === 'start' ? dotX + c.dx + w / 2 : dotX + c.dx;
      const cy = dotY + c.dy;
      const box = { x: cx - w / 2, y: cy - 11, w, h: 22 };
      // درون بوم بماند
      if (box.x < 4 || box.x + box.w > MAP_W - 4 || box.y < 4 || box.y + box.h > MAP_H - 4) continue;
      if (placed.some((p) => boxesHit(box, { x: p.x - p.w / 2, y: p.y - 11, w: p.w, h: 22 }))) continue;
      chosen = { cap, x: cx, y: cy, dotX, dotY, anchor: c.anchor, w };
      break;
    }
    if (!chosen) {
      // بدترین حالت — بالای نشان با anchor وسط (تحمیلی؛ رخداد نادر)
      chosen = { cap, x: dotX, y: dotY - 30, dotX, dotY, anchor: 'middle', w, forced: true };
    }
    placed.push(chosen);
  }
  return placed;
}

// ---------- SVG — خالص ----------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rtl(s: string): string {
  return `\u202B${s}\u202C`;
}

const FONT_FA = "'B Nazanin', Vazirmatn, sans-serif";

function ringPath(ring: Array<[number, number]>): string {
  return ring
    .map(([lon, lat], i) => {
      const [x, y] = mercProject(lon, lat);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ') + ' Z';
}

/** پرکردن ملایم استان‌ها — دو ته‌رنگ یک‌نواخت برای تمایز «حیطهٔ هر استان». خالص. */
export function provinceFillsSvg(): string {
  return IRAN_PROVINCES
    .map((p, i) => {
      const fill = i % 2 === 0 ? '#122b46' : '#102540';
      return p.rings.map((r) => `<path d="${ringPath(r)}" fill="${fill}"/>`).join('');
    })
    .join('\n  ');
}

/** مرز استان‌ها — خط ظریف آبی. خالص. */
export function provinceBordersSvg(): string {
  return IRAN_PROVINCES
    .map((p) => p.rings.map((r) => `<path d="${ringPath(r)}" fill="none" stroke="#2b5d8a" stroke-width="1.1" stroke-opacity="0.85"/>`).join(''))
    .join('\n  ');
}

/** مرز کشور (IRAN_RINGS) — خط پررنگ‌تر. خالص. */
export function iranOutlineSvg(): string {
  return IRAN_RINGS.map((r) => `<path d="${ringPath(r)}" fill="none" stroke="#3f83c0" stroke-width="2.2"/>`).join('\n  ');
}

/** مسیر کلیپ مرز کشور — لایهٔ داده هرگز از خاک بیرون نمی‌زند. خالص. */
export function iranMapClipPath(id = 'iranClip'): string {
  const d = IRAN_RINGS.map((r) => ringPath(r)).join(' ');
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>`;
}

/** خطوط راهنمای جغرافیایی هر ۴ درجه — بسیار کم‌رنگ. خالص. */
export function graticuleSvg(): string {
  const L: string[] = [];
  for (let lat = 28; lat < 41; lat += 4) {
    const [, y] = mercProject(50, lat);
    L.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${MAP_W}" y2="${y.toFixed(1)}" stroke="#1e3d5f" stroke-width="1" opacity="0.45"/>`);
  }
  for (let lon = 44; lon < 64; lon += 4) {
    const [x] = mercProject(lon, 35);
    L.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${MAP_H}" stroke="#1e3d5f" stroke-width="1" opacity="0.45"/>`);
  }
  return L.join('\n  ');
}

/** نشان + برچسب مراکز استان — نقطهٔ روشن + متن با هالهٔ تیره (خوانا روی هر رنگ داده).
 *  خالص. */
export function capitalsSvg(placed: PlacedLabel[] = placeCapitalLabels()): string {
  return placed
    .map((p) => {
      const ax = p.anchor === 'end' ? p.x - p.w / 2 : p.anchor === 'start' ? p.x + p.w / 2 : p.x;
      const by = p.y + 6; // خط مبنا = مرکز جعبه + ~۶px (فونت ۱۷)
      return `
  <circle cx="${p.dotX.toFixed(1)}" cy="${p.dotY.toFixed(1)}" r="3.2" fill="#eaf4ff" stroke="#0a1c30" stroke-width="1.2"/>
  <text x="${ax.toFixed(1)}" y="${by.toFixed(1)}" font-family="${FONT_FA}" font-size="17" font-weight="700" fill="#0a1c30" stroke="#0a1c30" stroke-width="3" text-anchor="${p.anchor}" opacity="0.9">${rtl(esc(p.cap.name))}</text>
  <text x="${ax.toFixed(1)}" y="${by.toFixed(1)}" font-family="${FONT_FA}" font-size="17" font-weight="700" fill="#f2f8ff" text-anchor="${p.anchor}">${rtl(esc(p.cap.name))}</text>`;
    })
    .join('\n  ');
}
