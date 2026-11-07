import "server-only";
// משימות מתוזמנות (docs/spec.md §3.4). רצות עם המפתח הסודי, כי אין משתמש מחובר ב-Cron.
// כל מייל נשלח עם dedupe_key, כך שהרצה כפולה (או הרצה ידנית בהדגמה) לא שולחת אותו פעמיים.
import { createAdminClient } from "./supabase/admin";
import { emailsForRoles, sendMail } from "./notify";
import { attentionMail, chefMail, digestMail, eventName, morningMail } from "./event-text";
import { addDays, isBusinessHours, todayInIsrael } from "./dates";
import type { ChangeLogRow, EventRow, MenuItem, MenuSelection, Profile } from "./types";

export interface JobReport {
  chef5day: number;
  morning: number;
  digest: number;
  reminders: number;
}

export async function runDailyJobs(now = new Date()): Promise<JobReport> {
  const admin = createAdminClient();
  const today = todayInIsrael(now);
  const report: JobReport = { chef5day: 0, morning: 0, digest: 0, reminders: 0 };

  const [chefs, managers, bosses] = await Promise.all([
    emailsForRoles(["chef"]),
    emailsForRoles(["event_manager"]),
    emailsForRoles(["admin"]),
  ]);
  const { data: items } = await admin.from("menu_items").select("*, menu_item_ingredients(*)"); // כולל פירוט רכיבים למייל לשף
  const menuItems = (items ?? []) as MenuItem[];

  // 1. השף: כל אירוע שנמצא בעוד 5 ימים או פחות ועוד לא קיבל מייל (dedupe לכל אירוע)
  const { data: soon } = await admin
    .from("events").select("*, event_menu_selections(*)")
    .gt("event_date", today).lte("event_date", addDays(today, 5)).neq("status", "cancelled");
  for (const e of (soon ?? []) as (EventRow & { event_menu_selections: MenuSelection[] })[]) {
    await sendMail({ kind: "chef_5day", to: chefs, ...chefMail(e, e.event_menu_selections, menuItems), eventId: e.id, dedupeKey: `chef5:${e.id}` });
    report.chef5day++;
  }

  // 2. בוקר האירוע: לרונן ולרונית
  const { data: todays } = await admin.from("events").select("*, profiles!events_client_id_fkey(*)").eq("event_date", today).neq("status", "cancelled");
  for (const e of (todays ?? []) as (EventRow & { profiles: Profile | null })[]) {
    await sendMail({ kind: "event_morning", to: [...bosses, ...managers], ...morningMail(e, e.profiles), eventId: e.id, dedupeKey: `morning:${e.id}` });
    report.morning++;
  }

  // 3. סיכום שינויים יומי לרונית: כל השינויים מ-24 השעות האחרונות, וגם בקשות פתוחות
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const { data: changes } = await admin
    .from("change_log").select("*, events(title, event_type, event_type_other)")
    .or(`created_at.gte.${since},and(needs_attention.eq.true,resolved_at.is.null)`)
    .order("created_at");
  const rows = ((changes ?? []) as (ChangeLogRow & { events: EventRow | null })[]).map((c) => ({
    ...c,
    event_title: c.events ? eventName(c.events) : "אירוע",
  }));
  if (rows.length) {
    await sendMail({ kind: "change_digest", to: managers, ...digestMail(rows), dedupeKey: `digest:${today}` });
    report.digest = rows.length;
  }

  return report;
}

/** תזכורת לכל בקשה פתוחה. רץ כל שעה, ושולח רק בשעות הפעילות (ראשון–חמישי 09:00–18:00) */
export async function runReminders(now = new Date(), force = false): Promise<number> {
  if (!force && !isBusinessHours(now)) return 0;
  const admin = createAdminClient();
  const managers = await emailsForRoles(["event_manager"]);
  const { data } = await admin
    .from("change_log").select("*, events(id, title, event_type, event_type_other)")
    .eq("needs_attention", true).is("resolved_at", null)
    // תזכורת רק אחרי שעה לפחות מהפנייה, כי המייל הראשון כבר נשלח ברגע הפנייה
    .lt("created_at", new Date(now.getTime() - 3_600_000).toISOString());
  const hourKey = now.toISOString().slice(0, 13);
  let sent = 0;
  for (const c of (data ?? []) as (ChangeLogRow & { events: EventRow | null })[]) {
    if (!c.events) continue;
    await sendMail({ kind: "attention_reminder", to: managers, ...attentionMail(c.events, c.summary, true), eventId: c.event_id, dedupeKey: `reminder:${c.id}:${hourKey}` });
    sent++;
  }
  return sent;
}

/** בדיקת הסוד שמגיע מ-Vercel Cron בכותרת Authorization */
export function isAuthorizedCron(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && authHeader === `Bearer ${secret}`;
}
