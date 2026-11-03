"use server";
// הרצה ידנית של המשימות המתוזמנות, להדגמה בכיתה: אפשר להראות את המייל לשף בלי לחכות לבוקר
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { runDailyJobs, runReminders } from "@/lib/jobs";

export async function runJobsNow(): Promise<string> {
  await requireRole(["event_manager", "admin"]);
  try {
    const r = await runDailyJobs();
    const reminders = await runReminders(new Date(), true);
    revalidatePath("/dashboard/outbox");
    return `נבדקו: ${r.chef5day} אירועים לשף, ${r.morning} אירועים היום, ${r.digest} שינויים לסיכום, ${reminders} תזכורות. מייל שכבר נשלח לא נשלח שוב.`;
  } catch (err) {
    return `שגיאה: ${err instanceof Error ? err.message : String(err)}`;
  }
}
