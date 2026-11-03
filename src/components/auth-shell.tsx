import { Logo } from "./ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// מסגרת משותפת לדפי התחברות והרשמה
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-brand-dark px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo light />
        </div>
        <div className="card p-7">
          <h1 className="font-display text-2xl font-bold text-brand-dark">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>
          {isSupabaseConfigured() ? children : <SetupNotice />}
        </div>
      </div>
    </div>
  );
}

export function SetupNotice() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      המערכת עוד לא מחוברת ל-Supabase. יש להגדיר את NEXT_PUBLIC_SUPABASE_URL ואת NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      (פירוט ב-README).
    </div>
  );
}
