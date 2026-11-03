"use server";
// פעולות שרת על תיק אירוע. משמשות גם את הלקוח וגם את הצוות, וגם את סוכן ה-AI (דרך src/lib/agent.ts).
// כל הפעולות רצות עם הסשן של המשתמש המחובר, ולכן ה-RLS והטריגרים במסד אוכפים את ההרשאות:
// לקוח לא יכול לעדכן אירוע של מישהו אחר, לא משנה סטטוס, ולא משנה סועדים פחות מ-5 ימים לפני.
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { emailsForRoles, sendMailSafe } from "@/lib/notify";
import { attentionMail, eventName, menuText, tastingMail } from "@/lib/event-text";
import { validateGuestsStep, emptyDraft } from "@/lib/validation";
import type { Course, EventRow, GuestGroup, MenuItem, MenuSelection, Profile } from "@/lib/types";

export type ActionResult = { ok: true; message?: string } | { ok: false, error: string };

// שדות שלקוח רשאי לערוך. הצוות (מכירות, מנהלת אירועים, מנהל כללי) רשאי לערוך גם את STAFF_FIELDS
const CLIENT_FIELDS = [
  "title", "table_design", "chuppah_song_url", "slideshow_time", "slideshow_folder_url",
  "special_requests", "guest_count", "vegan_count", "celiac_count",
] as const;
const STAFF_FIELDS = ["status", "event_date", "time_slot", "deposit_confirmed", "sales_rep_id", "payment_method"] as const;

export type EventPatch = Partial<Pick<EventRow, (typeof CLIENT_FIELDS)[number] | (typeof STAFF_FIELDS)[number]>>;

/** הודעות שגיאה של המסד שכבר כתובות בעברית (מהטריגרים) מוצגות כמו שהן */
function dbError(message: string): string {
  if (/[א-ת]/.test(message)) return message;
  if (message.includes("events_one_per_slot")) return "המשבצת הזו כבר תפוסה ע\"י אירוע אחר";
  if (message.includes("diet_counts_fit")) return "סכום הטבעונים והצליאקים גדול ממספר המוזמנים";
  if (message.includes("guest_count")) return "מספר המוזמנים חייב להיות בין 1 ל-500";
  return `שגיאה: ${message}`;
}

function revalidateEvent(eventId: string) {
  revalidatePath(`/my/events/${eventId}`);
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath("/dashboard");
}

export async function updateEventDetails(eventId: string, patch: EventPatch, source: "app" | "agent" = "app"): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "יש להתחבר מחדש" };
  if (profile.role === "chef") return { ok: false, error: "לשף יש הרשאת צפייה בלבד בתיק האירוע" };

  // מסננים לשדות המותרים לתפקיד. שדה לא מורשה פשוט לא נשלח למסד
  const allowed: readonly string[] = profile.role === "client" ? CLIENT_FIELDS : [...CLIENT_FIELDS, ...STAFF_FIELDS];
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.includes(k) || v === undefined) continue;
    clean[k] = typeof v === "string" ? v.trim() || null : v;
  }
  if (!Object.keys(clean).length) return { ok: false, error: "אין שינוי לשמור" };

  const supabase = await createClient();
  const { data: current } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!current) return { ok: false, error: "האירוע לא נמצא" };

  // בדיקת מספרים לפני שליחה, כדי לתת הודעה ברורה
  const merged = { ...current, ...clean } as EventRow;
  const guestErrors = validateGuestsStep({ ...emptyDraft(), guest_count: merged.guest_count, vegan_count: merged.vegan_count, celiac_count: merged.celiac_count });
  if (guestErrors.length) return { ok: false, error: guestErrors.join(", ") };

  const { error } = await supabase.from("events").update({ ...clean, last_change_source: source }).eq("id", eventId);
  if (error) return { ok: false, error: dbError(error.message) };
  revalidateEvent(eventId);
  return { ok: true, message: "נשמר. השינוי נרשם ביומן השינויים." };
}

export async function changeMenuSelection(
  eventId: string, course: Course, group: GuestGroup, menuItemId: number | null, source: "app" | "agent" = "app",
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "chef") return { ok: false, error: "אין הרשאה לשנות תפריט" };
  const supabase = await createClient();

  if (menuItemId) {
    const { data: item } = await supabase.from("menu_items").select("*").eq("id", menuItemId).single();
    if (!item || item.course !== course) return { ok: false, error: "המנה לא שייכת לשלב הזה בתפריט" };
    if (group === "celiac" && item.diet !== "celiac") return { ok: false, error: "לסועדים ללא גלוטן יש לבחור מנה מהתפריט ללא גלוטן" };
    if (group === "vegan" && !item.is_vegan) return { ok: false, error: "המנה הזו לא טבעונית" };
    if (group === "regular" && item.diet !== "regular") return { ok: false, error: "לסועדים הרגילים יש לבחור מהתפריט הרגיל" };
  }

  // מקור השינוי נרשם על האירוע, והטריגר של התפריט מעתיק אותו ליומן
  await supabase.from("events").update({ last_change_source: source }).eq("id", eventId);
  const { error } = menuItemId
    ? await supabase.from("event_menu_selections").upsert({ event_id: eventId, course, guest_group: group, menu_item_id: menuItemId })
    : await supabase.from("event_menu_selections").delete().match({ event_id: eventId, course, guest_group: group });
  if (error) return { ok: false, error: dbError(error.message) };
  revalidateEvent(eventId);
  return { ok: true, message: "התפריט עודכן" };
}

export async function bookTastingSlot(eventId: string, slotId: number): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("book_tasting", { p_slot: slotId, p_event: eventId });
  if (error) return { ok: false, error: dbError(error.message) };

  // מייל לשף ולמנהלת האירוע, כדי שאף אחד לא יופתע מזוג שמגיע לטעימה
  const [{ data: ev }, { data: slot }, { data: sel }, { data: items }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).single(),
    supabase.from("tasting_slots").select("starts_at").eq("id", slotId).single(),
    supabase.from("event_menu_selections").select("*").eq("event_id", eventId),
    supabase.from("menu_items").select("*"),
  ]);
  if (ev && slot) {
    const { data: client } = await supabase.from("profiles").select("*").eq("id", ev.client_id).single();
    const mail = tastingMail(ev as EventRow, slot.starts_at, client as Profile, menuText((sel ?? []) as MenuSelection[], (items ?? []) as MenuItem[]));
    await sendMailSafe({ kind: "tasting_booked", to: await emailsForRoles(["chef", "event_manager"]).catch(() => []), ...mail, eventId, dedupeKey: `tasting:${eventId}:${slot.starts_at}` });
  }
  revalidateEvent(eventId);
  return { ok: true, message: "הטעימה נקבעה. השף ומנהלת האירוע קיבלו הודעה." };
}

/** בקשה שדורשת החלטה של מנהלת האירועים: נרשמת ב«דורש טיפול» ומייל נשלח מיד */
export async function escalateToManager(eventId: string, summary: string, source: "app" | "agent" = "app"): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("id, title, event_type, event_type_other").eq("id", eventId).single();
  if (!ev) return { ok: false, error: "האירוע לא נמצא" };
  const { error } = await supabase.from("change_log").insert({
    event_id: eventId, changed_by: profile.id, source, summary: `בקשה מ${profile.full_name || "הלקוח"}: ${summary}`, needs_attention: true,
  });
  if (error) return { ok: false, error: dbError(error.message) };
  const mail = attentionMail(ev as EventRow, `${profile.full_name} (${eventName(ev as EventRow)}): ${summary}`);
  await sendMailSafe({ kind: "attention", to: await emailsForRoles(["event_manager"]).catch(() => []), ...mail, eventId });
  revalidateEvent(eventId);
  revalidatePath("/dashboard/changes");
  return { ok: true, message: "הבקשה הועברה למנהלת האירוע. נחזור אליכם בשעות הפעילות." };
}

export async function resolveChange(changeId: number): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !["event_manager", "admin"].includes(profile.role)) return { ok: false, error: "אין הרשאה" };
  const supabase = await createClient();
  const { error } = await supabase.from("change_log").update({ resolved_at: new Date().toISOString(), resolved_by: profile.id }).eq("id", changeId);
  if (error) return { ok: false, error: dbError(error.message) };
  revalidatePath("/dashboard/changes");
  revalidatePath("/dashboard");
  return { ok: true };
}
