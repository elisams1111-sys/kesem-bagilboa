// «האירועים שלי»: רשימת האירועים של הלקוח המחובר. ה-RLS מחזיר רק אירועים שלו
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { daysBetween, formatDateHe, todayInIsrael } from "@/lib/dates";
import { eventName } from "@/lib/event-text";
import type { EventRow } from "@/lib/types";
import { EVENT_TYPE_LABELS, SLOT_LABELS } from "@/lib/types";

export const metadata = { title: "האירועים שלי – קסם בגלבוע" };

export default async function MyEvents() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").order("event_date");
  const events = (data ?? []) as EventRow[];
  const today = todayInIsrael();

  return (
    <AppShell profile={profile}>
      <PageHeader title={`שלום ${profile.full_name.split(" ")[0] || ""}`} subtitle="כל האירועים שלכם בקסם בגלבוע"
        actions={<Link href="/book" className="btn-gold">הזמנת אירוע חדש</Link>} />
      {events.length === 0 ? (
        <Empty>
          עוד אין לכם אירועים. <Link href="/book" className="font-medium text-brand underline">מתחילים להזמין</Link>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const days = daysBetween(today, e.event_date);
            return (
              <Link key={e.id} href={`/my/events/${e.id}`} className="card block transition hover:border-brand/50 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl font-bold text-brand-dark">{eventName(e)}</h2>
                  <StatusBadge status={e.status} />
                </div>
                <p className="mt-2 text-sm text-muted">{EVENT_TYPE_LABELS[e.event_type]} · {SLOT_LABELS[e.time_slot]}</p>
                <p className="mt-1">{formatDateHe(e.event_date)}</p>
                <p className="mt-3 text-sm">
                  {e.guest_count} מוזמנים
                  {days >= 0 && <span className="text-gold"> · עוד {days} ימים</span>}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
