"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** הופך תאריך ושעה בשעון ישראל לחותמת זמן UTC (מתחשב בשעון קיץ/חורף) */
function israelToIso(date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  // ההפרש בין UTC לשעון ישראל באותו רגע
  const israelHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hour: "numeric", hourCycle: "h23" }).format(guess));
  const offset = (israelHour - guess.getUTCHours() + 24) % 24;
  return new Date(guess.getTime() - offset * 3_600_000).toISOString();
}

export async function addTastingSlots(date: string, times: string): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  await requireRole(["chef", "event_manager", "admin"]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "תאריך לא תקין" };
  const list = times.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
  if (!list.length || list.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) return { ok: false, error: "שעות בפורמט 17:00, 18:30" };

  const supabase = await createClient();
  const rows = list.map((t) => ({ starts_at: israelToIso(date, t) }));
  // ignoreDuplicates: שעה שכבר קיימת לא נכפלת
  const { data, error } = await supabase.from("tasting_slots").upsert(rows, { onConflict: "starts_at", ignoreDuplicates: true }).select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/tastings");
  return { ok: true, added: data?.length ?? 0 };
}

export async function deleteTastingSlot(id: number) {
  await requireRole(["chef", "event_manager", "admin"]);
  const supabase = await createClient();
  await supabase.from("tasting_slots").delete().eq("id", id).is("event_id", null);
  revalidatePath("/dashboard/tastings");
}
