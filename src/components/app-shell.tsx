// מסגרת לאזורים המחוברים: סרגל עליון עם קישורים לפי תפקיד, שם המשתמש ויציאה.
// הקישורים כאן הם נוחות בלבד. ההגנה האמיתית היא requireRole בכל דף ו-RLS במסד.
import Link from "next/link";
import { signOut } from "@/app/actions";
import { Logo } from "./ui";
import type { Profile, UserRole } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

const NAV: { href: string; label: string; roles: UserRole[] }[] = [
  { href: "/my", label: "האירועים שלי", roles: ["client"] },
  { href: "/book", label: "הזמנת אירוע", roles: ["client"] },
  { href: "/dashboard", label: "דשבורד", roles: ["sales", "event_manager", "admin"] },
  { href: "/dashboard/kitchen", label: "מטבח", roles: ["chef", "event_manager", "admin"] },
  { href: "/dashboard/tastings", label: "טעימות", roles: ["chef", "event_manager", "admin", "sales"] },
  { href: "/dashboard/changes", label: "שינויים", roles: ["event_manager", "admin", "sales", "chef"] },
  { href: "/dashboard/outbox", label: "דואר יוצא", roles: ["event_manager", "admin"] },
  { href: "/dashboard/users", label: "משתמשים", roles: ["admin"] },
];

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const links = NAV.filter((n) => n.roles.includes(profile.role));
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Logo />
          <nav className="flex flex-1 flex-wrap gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink hover:bg-brand-light">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">
              {profile.full_name || profile.emails[0]} · <span className="font-medium text-brand">{ROLE_LABELS[profile.role]}</span>
            </span>
            <form action={signOut}>
              <button className="btn-ghost px-3 py-1.5 text-sm">יציאה</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
