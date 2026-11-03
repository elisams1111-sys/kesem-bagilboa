"use client";
// לקוח Supabase לדפדפן. משתמש במפתח הציבורי בלבד; ההרשאות נאכפות ב-RLS במסד.
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
}
