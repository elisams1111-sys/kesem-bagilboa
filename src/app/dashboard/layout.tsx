// כל אזור הדשבורד מיועד לצוות בלבד. לקוח שמגיע לכאן מופנה ל«האירועים שלי»
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  return <AppShell profile={profile}>{children}</AppShell>;
}
