"use server";
// שמירת ההזמנה בסוף האשף. כל הבדיקות רצות שוב כאן, כי אסור לסמוך על מה שהדפדפן שלח.
// הסדר: עדכון פרופיל → יצירת אירוע → שמירת תפריט → קביעת טעימה → מיילים.
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDateTimeHe, todayInIsrael } from "@/lib/dates";
import { validateBooking, type BookingDraft } from "@/lib/validation";
import { emailsForRoles, sendMailSafe } from "@/lib/notify";
import { bookedMail, eventName, eventSummary, menuText, siteUrl, tastingMail } from "@/lib/event-text";
import type { EventRow, GuestGroup, MenuItem, MenuSelection, Profile } from "@/lib/types";
import { COURSES } from "@/lib/types";

export type BookingResult = { ok: true; eventId: string; warning?: string } | { ok: false; errors: string[] };

export async function createBooking(draft: BookingDraft): Promise<BookingResult> {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();
  const today = todayInIsrael();

  // משבצות תפוסות עדכניות, ובדיקה מלאה
  const { data: booked } = await supabase.rpc("booked_slots", { from_date: today, to_date: addDays(today, 730) });
  const bookedSet = new Set(((booked ?? []) as { event_date: string; time_slot: string }[]).map((b) => `${b.event_date}:${b.time_slot}`));
  const { count: freeSlots } = await supabase
    .from("tasting_slots").select("id", { count: "exact", head: true })
    .is("event_id", null).gt("starts_at", new Date().toISOString());
  const errors = validateBooking(draft, today, bookedSet, (freeSlots ?? 0) > 0);
  if (errors.length) return { ok: false, errors };

  const phones = draft.phones.map((p) => p.trim()).filter(Boolean);
  const emails = draft.emails.map((e) => e.trim()).filter(Boolean);

  // 1. פרטי הלקוח: שם, עד 3 טלפונים ומיילים, כתובת
  const { data: updatedProfile } = await supabase
    .from("profiles")
    .update({ full_name: draft.full_name.trim(), phones, emails, address: draft.address.trim() })
    .eq("id", profile.id)
    .select()
    .single();

  // 2. האירוע. האינדקס הייחודי במסד חוסם הזמנה כפולה גם אם שני לקוחות לחצו באותה שנייה
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      client_id: profile.id,
      title: draft.title.trim(),
      event_type: draft.event_type,
      event_type_other: draft.event_type === "other" ? draft.event_type_other.trim() : null,
      event_date: draft.event_date,
      time_slot: draft.time_slot,
      guest_count: draft.guest_count,
      vegan_count: draft.vegan_count,
      celiac_count: draft.celiac_count,
      payment_method: draft.payment_method,
      deposit_confirmed: draft.deposit_confirmed,
      status: "booked",
    })
    .select()
    .single();
  if (eventError || !event) {
    const taken = eventError?.code === "23505";
    return { ok: false, errors: [taken ? "המשבצת נתפסה ברגע זה ע\"י הזמנה אחרת. נא לבחור תאריך או משבצת אחרים" : `שגיאה בשמירה: ${eventError?.message}`] };
  }

  // 3. התפריט
  const selections: MenuSelection[] = COURSES.flatMap((course) =>
    Object.entries(draft.menu[course] ?? {})
      .filter(([, id]) => Boolean(id))
      .map(([group, id]) => ({ event_id: event.id, course, guest_group: group as GuestGroup, menu_item_id: Number(id) })),
  );
  await supabase.from("event_menu_selections").insert(selections);

  // 4. הטעימה
  let warning: string | undefined;
  let tastingStart: string | null = null;
  const { error: tastingError } = draft.tasting_slot_id
    ? await supabase.rpc("book_tasting", { p_slot: draft.tasting_slot_id, p_event: event.id })
    : { error: null };
  if (!draft.tasting_slot_id) {
    warning = "האירוע נשמר. עוד לא נקבעה טעימה: מנהלת האירוע תיצור קשר לתיאום.";
  } else if (tastingError) {
    warning = "האירוע נשמר, אבל שעת הטעימה נתפסה בינתיים. אפשר לבחור שעה אחרת בתיק האירוע.";
  } else {
    const { data: slot } = await supabase.from("tasting_slots").select("starts_at").eq("id", draft.tasting_slot_id!).single();
    tastingStart = slot?.starts_at ?? null;
  }

  // 5. מיילים: לרונן ורונית על אירוע שנסגר, לשף ורונית על טעימה, ואישור ללקוח
  const { data: freshEvent } = await supabase.from("events").select("*").eq("id", event.id).single();
  const ev = (freshEvent ?? event) as EventRow;
  const client = (updatedProfile ?? profile) as Profile;
  const { data: items } = await supabase.from("menu_items").select("*");
  const menu = menuText(selections, (items ?? []) as MenuItem[]);

  const booked1 = bookedMail(ev, client);
  await sendMailSafe({ kind: "event_booked", to: await emailsForRoles(["admin", "event_manager"]).catch(() => []), ...booked1, eventId: ev.id, dedupeKey: `booked:${ev.id}` });
  if (tastingStart) {
    const t = tastingMail(ev, tastingStart, client, menu);
    await sendMailSafe({ kind: "tasting_booked", to: await emailsForRoles(["chef", "event_manager"]).catch(() => []), ...t, eventId: ev.id, dedupeKey: `tasting:${ev.id}:${tastingStart}` });
  }
  await sendMailSafe({
    kind: "client_confirmation",
    to: emails,
    subject: `ההזמנה שלכם התקבלה – ${eventName(ev)}`,
    body: `תודה שבחרתם בקסם בגלבוע!\n\n${eventSummary(ev)}${tastingStart ? `\nטעימה: ${formatDateTimeHe(tastingStart)}` : ""}\n\nבחירת התפריט:\n${menu}\n\nאפשר לעדכן פרטים ולשוחח עם עוזר האירוע באזור האישי:\n${siteUrl()}/my/events/${ev.id}`,
    eventId: ev.id,
    dedupeKey: `confirm:${ev.id}`,
  });

  return { ok: true, eventId: ev.id, warning };
}
