// טקסטים של מיילים ותקצירי אירוע. פונקציות טהורות: מקבלות נתונים ומחזירות מחרוזת.
import type { ChangeLogRow, EventRow, MenuItem, MenuSelection, Profile } from "./types.ts";
import { COURSE_LABELS, COURSES, EVENT_TYPE_LABELS, GROUP_LABELS, SLOT_LABELS, STATUS_LABELS } from "./types.ts";
import { formatDateHe, formatDateTimeHe, googleCalendarLink } from "./dates.ts";
import { computeOrder, formatOrderText } from "./quantities.ts";

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export function eventName(e: Pick<EventRow, "title" | "event_type" | "event_type_other">): string {
  if (e.title) return e.title;
  return e.event_type === "other" ? e.event_type_other || "אירוע" : EVENT_TYPE_LABELS[e.event_type];
}

export function eventSummary(e: EventRow, client?: Pick<Profile, "full_name" | "phones" | "emails"> | null): string {
  const lines = [
    `אירוע: ${eventName(e)} (${EVENT_TYPE_LABELS[e.event_type]})`,
    `תאריך: ${formatDateHe(e.event_date)}, ${SLOT_LABELS[e.time_slot]}`,
    `מוזמנים: ${e.guest_count} (טבעונים/צמחונים: ${e.vegan_count}, ללא גלוטן: ${e.celiac_count})`,
    `סטטוס: ${STATUS_LABELS[e.status]}`,
  ];
  if (client) lines.push(`לקוח: ${client.full_name}, ${client.phones.join(", ")}, ${client.emails.join(", ")}`);
  if (e.table_design) lines.push(`עיצוב שולחנות: ${e.table_design}`);
  if (e.chuppah_song_url) lines.push(`שיר כניסה: ${e.chuppah_song_url}`);
  if (e.slideshow_time) lines.push(`מצגת: ${e.slideshow_time}${e.slideshow_folder_url ? ` (${e.slideshow_folder_url})` : ""}`);
  if (e.special_requests) lines.push(`בקשות מיוחדות: ${e.special_requests}`);
  return lines.join("\n");
}

export function menuText(selections: MenuSelection[], items: MenuItem[]): string {
  const byId = new Map(items.map((m) => [m.id, m]));
  return COURSES.map((c) => {
    const picks = selections
      .filter((s) => s.course === c)
      .map((s) => `${GROUP_LABELS[s.guest_group]}: ${byId.get(s.menu_item_id)?.title ?? "?"}`);
    return `${COURSE_LABELS[c]}: ${picks.length ? picks.join(" | ") : "לא נבחר"}`;
  }).join("\n");
}

export function calendarLinkFor(e: EventRow): string {
  return googleCalendarLink({
    title: `${eventName(e)} – קסם בגלבוע`,
    dateIso: e.event_date,
    slot: e.time_slot,
    details: `${e.guest_count} מוזמנים. תיק האירוע: ${siteUrl()}/dashboard/events/${e.id}`,
  });
}

// ---------- המיילים עצמם ----------

export function bookedMail(e: EventRow, client: Profile | null) {
  return {
    subject: `אירוע חדש נסגר: ${eventName(e)}, ${formatDateHe(e.event_date)}`,
    body: `נסגר אירוע חדש באולם.\n\n${eventSummary(e, client)}\n\nהוספה ליומן Google:\n${calendarLinkFor(e)}\n\nתיק האירוע:\n${siteUrl()}/dashboard/events/${e.id}`,
  };
}

export function tastingMail(e: EventRow, startsAt: string, client: Profile | null, menu: string) {
  return {
    subject: `טעימה נקבעה: ${eventName(e)}, ${formatDateTimeHe(startsAt)}`,
    body: `נקבעה טעימה.\n\nמועד הטעימה: ${formatDateTimeHe(startsAt)}\n${eventSummary(e, client)}\n\nמה בחרו לטעום:\n${menu}\n\nתיק האירוע:\n${siteUrl()}/dashboard/events/${e.id}`,
  };
}

export function chefMail(e: EventRow, selections: MenuSelection[], items: MenuItem[]) {
  const order = computeOrder(e.guest_count, e.vegan_count, e.celiac_count, selections, items);
  return {
    subject: `5 ימים לאירוע: ${eventName(e)} (${e.guest_count} סועדים) – הזמנת חומרי גלם`,
    body: `בעוד 5 ימים: ${eventName(e)}\n\n${eventSummary(e)}\n\nהתפריט:\n${menuText(selections, items)}\n\nחישוב הזמנה:\n${formatOrderText(order)}\n\nפירוט מלא:\n${siteUrl()}/dashboard/kitchen`,
  };
}

export function morningMail(e: EventRow, client: Profile | null) {
  return {
    subject: `היום באולם: ${eventName(e)}, ${SLOT_LABELS[e.time_slot]}`,
    body: `בוקר טוב! היום מתקיים אירוע.\n\n${eventSummary(e, client)}\n\nתיק האירוע:\n${siteUrl()}/dashboard/events/${e.id}`,
  };
}

export function digestMail(changes: (ChangeLogRow & { event_title: string })[]) {
  const byEvent = new Map<string, string[]>();
  for (const c of changes) {
    const key = c.event_title;
    byEvent.set(key, [...(byEvent.get(key) ?? []), `${c.needs_attention ? "⚠️ " : ""}${c.summary}`]);
  }
  const body = [...byEvent.entries()].map(([title, rows]) => `${title}:\n- ${rows.join("\n- ")}`).join("\n\n");
  return {
    subject: `סיכום שינויים יומי: ${changes.length} שינויים ב-${byEvent.size} אירועים`,
    body: `השינויים מ-24 השעות האחרונות:\n\n${body}\n\nיומן מלא:\n${siteUrl()}/dashboard/changes`,
  };
}

export function attentionMail(e: Pick<EventRow, "id" | "title" | "event_type" | "event_type_other">, summary: string, reminder = false) {
  return {
    subject: `${reminder ? "תזכורת: " : ""}בקשה שדורשת טיפול – ${eventName(e)}`,
    body: `${reminder ? "הבקשה הזו עדיין לא סומנה כ«טופל».\n\n" : ""}הלקוח ביקש:\n${summary}\n\nלטיפול ולסימון «טופל»:\n${siteUrl()}/dashboard/changes`,
  };
}
