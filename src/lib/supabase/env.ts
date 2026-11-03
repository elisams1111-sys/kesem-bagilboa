// משתני הסביבה של Supabase. תומך בשמות החדשים (publishable/secret) ובישנים (anon/service_role).
// הערכים NEXT_PUBLIC_* נכנסים לקוד הדפדפן בזמן build, ולכן כותבים את השמות במלואם (לא process.env[name]).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);
