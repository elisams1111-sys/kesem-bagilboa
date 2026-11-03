import "server-only";
// לקוח Supabase לשרת (Server Components, Server Actions, Route Handlers).
// הוא קורא את עוגיות הסשן של המשתמש, ולכן כל שאילתה רצה בשם המשתמש המחובר ו-RLS חל עליה.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // נקרא מתוך Server Component, שבו אי אפשר לכתוב עוגיות. זה תקין: proxy.ts מרענן את הסשן.
        }
      },
    },
  });
}
