// דף הנחיתה: דף אחד בלי גלילה שמוביל להזמנת אירוע או להתחברות (docs/spec.md, סעיף 6)
import { Landing } from "@/components/landing/landing";
import { getCurrentProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LandingPage() {
  const profile = isSupabaseConfigured() ? await getCurrentProfile() : null;
  return <Landing profile={profile} />;
}
