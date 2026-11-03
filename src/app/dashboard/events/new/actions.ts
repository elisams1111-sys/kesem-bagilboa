"use server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { emailsForRoles, sendMailSafe } from "@/lib/notify";
import { bookedMail } from "@/lib/event-text";
import { emptyDraft, validateGuestsStep, validateTypeStep } from "@/lib/validation";
import type { EventRow, EventType, Profile, TimeSlot } from "@/lib/types";

export async function createEventForClient(f: {
  client_id: string; event_date: string; time_slot: TimeSlot | ""; event_type: EventType | ""; event_type_other: string;
  title: string; guest_count: number; vegan_count: number; celiac_count: number;
}): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> {
  const profile = await requireRole(["sales", "event_manager", "admin"]);
  const errs = [...validateTypeStep({ ...emptyDraft(), ...f }), ...validateGuestsStep({ ...emptyDraft(), ...f })];
  if (errs.length || !f.time_slot || !f.event_date) return { ok: false, error: errs.join(", ") || "חסרים פרטים" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").insert({
    client_id: f.client_id,
    sales_rep_id: profile.role === "sales" ? profile.id : null,
    title: f.title.trim(),
    event_type: f.event_type,
    event_type_other: f.event_type === "other" ? f.event_type_other.trim() : null,
    event_date: f.event_date,
    time_slot: f.time_slot,
    guest_count: f.guest_count,
    vegan_count: f.vegan_count,
    celiac_count: f.celiac_count,
    status: "booked",
  }).select().single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "המשבצת הזו כבר תפוסה" : `שגיאה: ${error?.message}` };

  // מייל לרונן ולרונית על אירוע שנסגר, כולל קישור ליומן Google
  const { data: client } = await supabase.from("profiles").select("*").eq("id", f.client_id).single();
  const mail = bookedMail(data as EventRow, client as Profile);
  await sendMailSafe({ kind: "event_booked", to: await emailsForRoles(["admin", "event_manager"]).catch(() => []), ...mail, eventId: data.id, dedupeKey: `booked:${data.id}` });
  return { ok: true, eventId: data.id };
}
