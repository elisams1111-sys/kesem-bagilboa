import "server-only";
// שליחת מיילים ושמירתם בדואר היוצא (טבלת notifications).
// כל התראה נשמרת תמיד בטבלה, כך שרונן ורונית רואים מה נשלח. אם מוגדר RESEND_API_KEY היא גם נשלחת באמת.
// dedupe_key מונע שליחה כפולה של אותה התראה מתוזמנת (למשל «5 ימים לפני» לאותו אירוע, אם ה-Cron רץ פעמיים).
import { createAdminClient } from "./supabase/admin";
import type { UserRole } from "./types";

export interface OutgoingMail {
  kind: string;
  to: string[];
  subject: string;
  body: string;
  eventId?: string | null;
  dedupeKey?: string; // לכל נמען מתווספת הכתובת שלו למפתח
}

/** כתובות המייל של כל המשתמשים בתפקידים האלה (למשל כל מנהלות האירועים) */
export async function emailsForRoles(roles: UserRole[]): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("emails").in("role", roles);
  return [...new Set((data ?? []).map((p) => p.emails?.[0]).filter(Boolean) as string[])];
}

async function sendViaResend(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "no-key" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Kesem Bagilboa <onboarding@resend.dev>",
      to: [to],
      subject,
      // גוף טקסט פשוט, עטוף ב-HTML מימין לשמאל כדי שהעברית תוצג נכון
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${escapeHtml(body)}</div>`,
      text: body,
    }),
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: `${res.status} ${(await res.text()).slice(0, 300)}` };
}

export async function sendMail(mail: OutgoingMail): Promise<void> {
  const admin = createAdminClient();
  const override = process.env.DEMO_EMAIL_OVERRIDE?.trim();

  for (const recipient of mail.to) {
    const dedupe = mail.dedupeKey ? `${mail.dedupeKey}:${recipient}` : null;
    // שומרים קודם. אם המפתח כבר קיים, ההתראה כבר נשלחה ומדלגים
    const { data: row, error } = await admin
      .from("notifications")
      .insert({
        kind: mail.kind,
        event_id: mail.eventId ?? null,
        recipient_email: recipient,
        subject: mail.subject,
        body: mail.body,
        status: "logged",
        dedupe_key: dedupe,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") continue; // כפילות: כבר נשלח
      console.error("notification insert failed", error);
      continue;
    }

    // בהדגמה: שולחים לכתובת אחת קבועה, ומציינים בנושא למי זה היה מיועד
    const actualTo = override || recipient;
    const subject = override ? `[ל: ${recipient}] ${mail.subject}` : mail.subject;
    const result = await sendViaResend(actualTo, subject, mail.body);
    if (result.ok) {
      await admin.from("notifications").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
    } else if (result.error !== "no-key") {
      await admin.from("notifications").update({ status: "failed", error: result.error }).eq("id", row.id);
    }
  }
}

/** כמו sendMail, אבל לא מפיל את הפעולה של המשתמש אם המייל נכשל (למשל חסר מפתח סודי) */
export async function sendMailSafe(mail: OutgoingMail): Promise<void> {
  try {
    await sendMail(mail);
  } catch (err) {
    console.error("sendMail failed", err);
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
