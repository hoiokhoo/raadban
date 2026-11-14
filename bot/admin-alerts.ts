/**
 * اعلان‌های مدیر — خواستهٔ کاربر (۱۵ نوامبر ۲۰۲۶):
 * «اگر N چرخهٔ پیاپی شکست یا منبعی چند روز خاموش شد، یک پیام به چت مدیر».
 *
 * دو سازوکار مستقل و خالص (تست‌پذیر):
 * ۱) زنجیرهٔ شکست چرخه‌ها — چرخهٔ «ناموفق» یعنی زنجیرهٔ هوش مصنوعی پاسخ معتبر نداد یا همهٔ
 *    منابع بی‌خروجی بودند. N چرخهٔ پیاپی (پیش‌فرض ۳) → یک پیام مدیر؛ اعلان مجدد فقط با فاصلهٔ
 *    ۲۴ ساعت (ضداسپم)؛ موفقیت → ریست کامل زنجیره.
 * ۲) خاموشی منبع — هر منبعی که در چرخه‌ها «هیچ آیتمی» ندهد، روزهای خاموشی‌اش از آخرین خروجیِ
 *    سالم شمرده می‌شود؛ ≥ آستانه (پیش‌فرض ۳ روز) → یک پیام مدیر با نام و تاریخ قطع؛ بازگشت منبع
 *    → شمارش از صفر و مجوز اعلان بعدی. نخستین مشاهدهٔ یک منبع دورهٔ مهلت است (روز اول شمرده نمی‌شود).
 * همهٔ توابع خالص‌اند؛ ارسال واقعی در bot.ts انجام می‌شود.
 */
import { faDigits } from './daily';

export const DAY_MS = 86_400_000;

// ---------- مدل دادهٔ پایدار (state) ----------

export interface SourceHealth {
  /** نام منبع → ISO آخرین چرخهٔ با خروجی */
  lastOkAt?: Record<string, string>;
  /** نام منبع → ISO آخرین اعلان خاموشیِ ارسال‌شده (ضداسپم) */
  alertedAt?: Record<string, string>;
}

export interface AdminHealth {
  /** شمار چرخه‌های پیاپی ناموفق */
  failStreak?: number;
  /** ISO آغاز زنجیرهٔ شکست فعلی */
  streakSince?: string;
  /** ISO آخرین اعلان زنجیرهٔ شکست (ضداسپم) */
  streakAlertedAt?: string;
}

/** نتیجهٔ هر منبع در یک چرخه — ok یعنی «حداقل یک آیتم» داده است */
export interface SourceStat {
  name: string;
  ok: boolean;
}

export interface SilentSourceAlert {
  name: string;
  /** ISO آخرین خروجی سالم */
  lastOkAt: string;
  /** روزهای سپری‌شده (کف) */
  silentDays: number;
}

export interface FailStreakAlert {
  streak: number;
  sinceIso: string;
}

// ---------- خاموشی منابع ----------

export interface SourceHealthOpts {
  /** آستانهٔ خاموشی به روز — پیش‌فرض ۳ */
  silentDays?: number;
  /** حداقل فاصلهٔ اعلان مجدد یک منبع به روز — پیش‌فرض ۳ */
  reAlertDays?: number;
}

/** به‌روزرسانی سلامت منابع + یافتن اعلان‌های خاموشی — خالص.
 *  منبعِ تازه (نخستین مشاهده) مهلت می‌گیرد؛ منبعِ بازگشته شمارش و اعلانش صفر می‌شود؛
 *  منبعِ حذف‌شده از فهرست فعلی هرس می‌شود. */
export function updateSourceHealth(
  health: SourceHealth | undefined,
  stats: SourceStat[],
  now: Date,
  opts: SourceHealthOpts = {}
): { health: SourceHealth; alerts: SilentSourceAlert[] } {
  const silentMs = Math.max(1, opts.silentDays ?? 3) * DAY_MS;
  const reAlertMs = Math.max(1, opts.reAlertDays ?? 3) * DAY_MS;
  const nowIso = now.toISOString();
  const lastOkAt: Record<string, string> = {};
  for (const s of stats || []) {
    if (!s?.name) continue;
    if (s.ok) {
      lastOkAt[s.name] = nowIso;
    } else if (health?.lastOkAt?.[s.name]) {
      lastOkAt[s.name] = health.lastOkAt[s.name]!;
    } else {
      lastOkAt[s.name] = nowIso; // نخستین مشاهده — دورهٔ مهلت
    }
  }
  const alertedAt: Record<string, string> = {};
  const alerts: SilentSourceAlert[] = [];
  for (const [name, iso] of Object.entries(lastOkAt)) {
    const last = Date.parse(iso);
    const age = now.getTime() - last;
    if (Number.isFinite(last) && age >= silentMs) {
      const prior = health?.alertedAt?.[name];
      const lastAlert = prior ? Date.parse(prior) : 0;
      if (!(Number.isFinite(lastAlert) && now.getTime() - lastAlert < reAlertMs)) {
        alertedAt[name] = nowIso;
        alerts.push({ name, lastOkAt: iso, silentDays: Math.floor(age / DAY_MS) });
        continue;
      }
      alertedAt[name] = prior!; // اعلان قبلی هنوز معتبر — ضداسپم
    }
    // منبع سالم/دورهٔ مهلت — اعلانی نگه نمی‌داریم
  }
  return { health: { lastOkAt, alertedAt }, alerts };
}

// ---------- زنجیرهٔ شکست چرخه‌ها ----------

export interface FailStreakOpts {
  /** N چرخهٔ پیاپی شکست — پیش‌فرض ۳ */
  threshold?: number;
  /** فاصلهٔ اعلان مجدد زنجیرهٔ پابرجا به ساعت — پیش‌فرض ۲۴ */
  reAlertHours?: number;
}

/** به‌روزرسانی زنجیرهٔ شکست — خالص. موفقیت → ریست کامل؛ رسیدن به آستانه → اعلان (یک‌بار در هر
 *  دورهٔ ضداسپم). اعلان مجدد فقط اگر شکست پابرجا بماند. */
export function updateFailStreak(
  health: AdminHealth | undefined,
  failed: boolean,
  now: Date,
  opts: FailStreakOpts = {}
): { health: AdminHealth; alert: FailStreakAlert | null } {
  const threshold = Math.max(2, opts.threshold ?? 3);
  const reAlertMs = Math.max(1, opts.reAlertHours ?? 24) * 3_600_000;
  const nowIso = now.toISOString();
  if (!failed) return { health: { failStreak: 0 }, alert: null };
  const streak = (health?.failStreak || 0) + 1;
  const since = health?.streakSince || nowIso;
  const h: AdminHealth = { failStreak: streak, streakSince: since };
  const prior = health?.streakAlertedAt;
  const lastAlert = prior ? Date.parse(prior) : 0;
  const due = streak >= threshold && !(Number.isFinite(lastAlert) && now.getTime() - lastAlert < reAlertMs);
  if (due) h.streakAlertedAt = nowIso;
  return { health: h, alert: due ? { streak, sinceIso: since } : null };
}

// ---------- متن اعلان‌ها (HTML بله) ----------

function dayLabelOf(iso: string): string {
  return iso.slice(0, 10);
}

/** اعلان منابع خاموش — نام منبع، تاریخ آخرین خروجی، روزهای خاموشی */
export function buildSilentSourcesText(alerts: SilentSourceAlert[], dateFa: string): string {
  const lines = alerts.map(
    (a) => `• ${esc(a.name)} — آخرین خروجی ${dayLabelOf(a.lastOkAt)} (${faDigits(String(a.silentDays))} روز خاموشی)`
  );
  return [
    '<b>⚠️ رصدبان — منبع خاموش</b>',
    esc(dateFa),
    '',
    ...lines,
    '',
    'این منبع در چرخه‌های اخیر هیچ خبری نداده است؛ بررسی منبع/فیلتر لازم است. (اعلان خودکار مدیر)',
  ].join('\n');
}

/** اعلان زنجیرهٔ شکست — N چرخهٔ پیاپی + علت خاموشی */
export function buildFailStreakText(alert: FailStreakAlert, dateFa: string, reason: string): string {
  const since = dayLabelOf(alert.sinceIso);
  return [
    `<b>🚨 رصدبان — ${faDigits(String(alert.streak))} چرخهٔ پیاپی ناموفق</b>`,
    esc(dateFa),
    '',
    `زنجیرهٔ شکست از ${since} آغاز شده؛ علت: ${esc(reason || 'نامشخص')}.`,
    'بررسی سلامت ربات (کلیدهای مدل، شبکه، توکن بله) لازم است. (اعلان خودکار مدیر)',
  ].join('\n');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
