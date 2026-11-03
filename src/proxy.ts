// Proxy (לשעבר middleware) של Next.js 16: רץ לפני כל בקשה.
// 1. מרענן את סשן ההתחברות של Supabase ושומר את העוגיות המעודכנות בתשובה.
// 2. מפנה משתמש לא מחובר שמנסה להיכנס לאזור מוגן לדף ההתחברות.
// בדיקת התפקיד המדויק (לקוח / שף / מנהל) נעשית בכל דף בשרת, וב-RLS במסד.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabaseConfigured } from "./lib/supabase/env";

const PROTECTED = ["/my", "/book", "/dashboard"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response; // בלי הגדרות, האתר מציג הודעת הגדרה ולא קורס

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // getClaims מאמת את ה-JWT. אין לשים קוד בין יצירת הלקוח לשורה הזו
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  if (!isLoggedIn && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // לא מריצים על קבצים סטטיים, תמונות ונתיבי Cron (שמאומתים בסוד משלהם)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
