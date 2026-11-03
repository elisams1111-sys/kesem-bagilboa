import "server-only";
// מי המשתמש המחובר ומה התפקיד שלו. כל דף מוגן קורא ל-requireRole בתחילתו.
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import type { Profile, UserRole } from "./types";
import { STAFF_ROLES } from "./types";

// cache: גם אם ה-layout וגם הדף שואלים, השאילתה רצה פעם אחת בכל בקשה
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  if (!isSupabaseConfigured()) return null; // בלי הגדרות: מתנהגים כמו «לא מחובר», ודף ההתחברות מסביר מה חסר
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return (data as Profile) ?? null;
});

/** מחזיר את הפרופיל אם התפקיד מורשה. אחרת מפנה: לא מחובר → התחברות, תפקיד אחר → הדף שלו */
export async function requireRole(allowed: UserRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!allowed.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}

export const requireStaff = () => requireRole(STAFF_ROLES);

/** דף הבית של כל תפקיד אחרי התחברות */
export function homeFor(role: UserRole): string {
  if (role === "client") return "/my";
  if (role === "chef") return "/dashboard/kitchen";
  return "/dashboard";
}
