"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailsForRoles, sendMailSafe } from "@/lib/notify";
import { bookedMail } from "@/lib/event-text";
import { emptyDraft, validateGuestsStep, validateNewClient, validateTypeStep } from "@/lib/validation";
import type { EventRow, EventType, Profile, TimeSlot } from "@/lib/types";

/**
 * יוצר חשבון לקוח חדש. רק המפתח הסודי יכול ליצור משתמש בשם מישהו אחר, ולכן בדיקת התפקיד כאן היא קו ההגנה.
 * התפקיד לא מגיע מהטופס: טריגר ההרשמה במסד יוצר פרופיל עם ברירת המחדל client.
 */
export async function createClientAccount(f: { full_name: string; phone: string; email: string }): Promise<
  { ok: true; client: { id: string; label: string }; tempPassword: string } | { ok: false; error: string }
> {
  await requireRole(["sales", "event_manager", "admin"]);
  const errs = validateNewClient(f);
  if (errs.length) return { ok: false, error: errs.join(", ") };
  if (!hasAdminKey()) return { ok: false, error: "השרת לא מוגדר ליצירת משתמשים (חסר SUPABASE_SECRET_KEY)" };

  const full_name = f.full_name.trim();
  const email = f.email.trim().toLowerCase();
  // 9 בתים אקראיים = 12 תווים. הסיסמה חוזרת פעם אחת למסך, ולא נשמרת ולא נכתבת ללוג
  const tempPassword = randomBytes(9).toString("base64url");
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true, // בלי אישור במייל: שירות המייל המובנה של Supabase שולח רק לחברי הצוות
    user_metadata: { full_name, phones: [f.phone.trim()] },
  });
  if (error || !data.user) {
    const taken = error?.code === "email_exists" || error?.code === "user_already_exists";
    return { ok: false, error: taken ? "כתובת המייל הזו כבר רשומה. אפשר לבחור את הלקוח מהרשימה" : "יצירת הלקוח נכשלה. נסו שוב" };
  }
  revalidatePath("/dashboard/events/new");
  return { ok: true, client: { id: data.user.id, label: `${full_name} · ${email}` }, tempPassword };
}

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
