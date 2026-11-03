// מפנה כל משתמש אחרי התחברות לדף שמתאים לתפקיד שלו (או לדף שביקש לפני ההתחברות)
import { redirect } from "next/navigation";
import { getCurrentProfile, homeFor } from "@/lib/auth";

export default async function Go({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  // לקוח לא נשלח לדשבורד, וצוות לא נשלח לאזור הלקוח
  const isClient = profile.role === "client";
  const allowed = Boolean(next?.startsWith("/") && (isClient ? !next.startsWith("/dashboard") : next.startsWith("/dashboard")));
  redirect(allowed && next ? next : homeFor(profile.role));
}
