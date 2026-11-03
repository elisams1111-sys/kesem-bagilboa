// פונקציות תאריך ושעה. האולם בישראל, ולכן כל החישובים «של היום» נעשים לפי Asia/Jerusalem,
// גם כשהשרת (Vercel) רץ ב-UTC.

export const TZ = "Asia/Jerusalem";

/** התאריך של היום בישראל, בפורמט YYYY-MM-DD */
export function todayInIsrael(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** מוסיף ימים לתאריך בפורמט YYYY-MM-DD (בלי בעיות שעון קיץ, כי עובדים ב-UTC טהור) */
export function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** כמה ימים מ-from עד to (חיובי אם to אחרי from) */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** רשת חודש ליומן: מערך שבועות, כל שבוע 7 תאים (ראשון עד שבת). תא ריק = null */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month0, 1));
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(Date.UTC(year, month0, day)).toISOString().slice(0, 10));
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** שעות הפעילות של רונית: ראשון–חמישי, 09:00–18:00 שעון ישראל */
export function isBusinessHours(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", hourCycle: "h23" })
    .formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
  return ["Sun", "Mon", "Tue", "Wed", "Thu"].includes(weekday) && hour >= 9 && hour < 18;
}

/** קישור «הוסף ליומן Google» לאירוע של יום שלם או לשעות. לא דורש חיבור OAuth */
export function googleCalendarLink(opts: { title: string; dateIso: string; slot?: "morning" | "evening"; details?: string }): string {
  const compact = opts.dateIso.replaceAll("-", "");
  // בוקר 10:00–15:00, ערב 19:00–00:00 (שעון ישראל)
  let dates = `${compact}/${addDays(opts.dateIso, 1).replaceAll("-", "")}`;
  if (opts.slot === "morning") dates = `${compact}T100000/${compact}T150000`;
  if (opts.slot === "evening") dates = `${compact}T190000/${addDays(opts.dateIso, 1).replaceAll("-", "")}T000000`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates,
    ctz: TZ,
    details: opts.details ?? "",
    location: "קסם בגלבוע",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function formatDateHe(dateIso: string): string {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${dateIso}T00:00:00Z`));
}

export function formatDateTimeHe(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso));
}

/** תאריך YYYY-MM-DD של חותמת זמן, לפי שעון ישראל */
export function israelDateOf(iso: string): string {
  return todayInIsrael(new Date(iso));
}
