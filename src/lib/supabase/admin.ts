import "server-only";
// לקוח Supabase עם המפתח הסודי: עוקף RLS. משמש רק בשרת, למשימות מערכת:
// כתיבה לדואר היוצא, משימות Cron וחיפוש נמענים לפי תפקיד. לעולם לא מגיע לדפדפן.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) throw new Error("חסר SUPABASE_SECRET_KEY בהגדרות הסביבה");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const hasAdminKey = () => Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
