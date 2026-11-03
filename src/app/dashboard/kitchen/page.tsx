// מסך המטבח של שף יובל: האירועים ב-14 הימים הקרובים, וחישוב הזמנה לכל אחד.
// אירוע שנכנס לחלון 5 הימים מסומן: זה הרגע להזמין מהספקים (ובאותו בוקר נשלח גם מייל).
import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { OrderTable } from "@/components/event/order-table";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, daysBetween, formatDateHe, formatDateTimeHe, todayInIsrael } from "@/lib/dates";
import { eventName, menuText } from "@/lib/event-text";
import { computeOrder } from "@/lib/quantities";
import type { EventRow, MenuItem, MenuSelection } from "@/lib/types";
import { SLOT_LABELS } from "@/lib/types";

export const metadata = { title: "מטבח – קסם בגלבוע" };

export default async function KitchenPage() {
  await requireRole(["chef", "event_manager", "admin"]);
  const supabase = await createClient();
  const today = todayInIsrael();

  const [{ data: evData }, { data: items }, { data: tastings }] = await Promise.all([
    supabase.from("events").select("*, event_menu_selections(*)").gte("event_date", today).lte("event_date", addDays(today, 14)).neq("status", "cancelled").order("event_date"),
    supabase.from("menu_items").select("*"),
    supabase.from("tasting_slots").select("starts_at, event_id, events(title, event_type, event_type_other, guest_count)").not("event_id", "is", null)
      .gte("starts_at", new Date().toISOString()).order("starts_at").limit(10),
  ]);
  const menuItems = (items ?? []) as MenuItem[];
  const events = (evData ?? []) as (EventRow & { event_menu_selections: MenuSelection[] })[];

  return (
    <div>
      <PageHeader title="מטבח" subtitle="אירועים בשבועיים הקרובים, עם כמויות להזמנה מהספקים" />

      {tastings && tastings.length > 0 && (
        <section className="card mb-6">
          <h2 className="mb-3 font-semibold">טעימות קרובות</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tastings.map((t) => {
              const ev = t.events as unknown as EventRow | null;
              return (
                <li key={t.starts_at}>
                  <Link href={`/dashboard/events/${t.event_id}`} className="block rounded-lg border border-line p-3 text-sm hover:bg-brand-light">
                    <div className="font-semibold">{formatDateTimeHe(t.starts_at)}</div>
                    <div className="text-muted">{ev ? eventName(ev) : ""}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {events.length === 0 ? (
        <Empty>אין אירועים בשבועיים הקרובים</Empty>
      ) : (
        <div className="space-y-6">
          {events.map((e) => {
            const days = daysBetween(today, e.event_date);
            const order = computeOrder(e.guest_count, e.vegan_count, e.celiac_count, e.event_menu_selections, menuItems);
            return (
              <section key={e.id} className={`card ${days <= 5 ? "border-gold" : ""}`}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl font-bold text-brand-dark">{eventName(e)}</h2>
                    <p className="text-sm text-muted">{formatDateHe(e.event_date)} · {SLOT_LABELS[e.time_slot]} · {e.guest_count} סועדים</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {days <= 5 ? <Badge tone="gold">עוד {days} ימים: להזמין עכשיו</Badge> : <Badge>עוד {days} ימים</Badge>}
                    <Link href={`/dashboard/events/${e.id}`} className="btn-ghost text-sm">לתיק</Link>
                  </div>
                </div>
                <OrderTable order={order} compact />
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium text-brand">התפריט המלא</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-muted">{menuText(e.event_menu_selections, menuItems)}</pre>
                </details>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
