"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

export async function setUserRole(userId: string, role: UserRole): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireRole(["admin"]);
  if (!(role in ROLE_LABELS)) return { ok: false, error: "תפקיד לא מוכר" };
  if (userId === me.id) return { ok: false, error: "אי אפשר לשנות את התפקיד של עצמך" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/users");
  return { ok: true };
}
