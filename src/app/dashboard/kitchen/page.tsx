// מסך המטבח של שף יובל: האירועים ב-14 הימים הקרובים, וחישוב הזמנה לכל אחד.
// אירוע שנכנס לחלון 5 הימים מסומן: זה הרגע להזמין מהספקים (ובאותו בוקר נשלח גם מייל).
// למעלה: הטעימות הקרובות, ולכל אחת המנות, מספר הטועמים וכמה להזמין בשבילן.
import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { OrderTable } from "@/components/event/order-table";
import { TastingDishes, TastingOrderTable } from "@/components/event/tasting-order";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, daysBetween, formatDateHe, formatDateTimeHe, todayInIsrael } from "@/lib/dates";
import { eventName, menuText } from "@/lib/event-text";
import { computeOrder, computeTastingOrder } from "@/lib/quantities";
import type { EventRow, MenuItem, MenuSelection, TastingPick } from "@/lib/types";
import { SLOT_LABELS } from "@/lib/types";

export const metadata = { title: "מטבח – קסם בגלבוע" };

export default async function KitchenPage() {
  await requireRole(["chef", "event_manager", "admin"]);
  const supabase = await createClient();
  const today = todayInIsrael();

  const [{ data: evData }, { data: items }, { data: tastings }] = await Promise.all([
    supabase.from("events").select("*, event_menu_selections(*)").gte("event_date", today).lte("event_date", addDays(today, 14)).neq("status", "cancelled").order("event_date"),
    supabase.from("menu_items").select("*, menu_item_ingredients(*)"), // כולל פירוט רכיבים לחישוב ההזמנה
    // לכל טעימה: האירוע, מספר הטועמים, המנות לטעימה, והתפריט הסופי (לאירועים ישנים בלי מנות לטעימה)
    supabase.from("tasting_slots")
      .select("starts_at, event_id, events(title, event_type, event_type_other, guest_count, tasters, event_tasting_picks(*), event_menu_selections(*))")
      .not("event_id", "is", null)
      .gte("starts_at", new Date().toISOString()).order("starts_at").limit(10),
  ]);
  const menuItems = (items ?? []) as MenuItem[];
  const events = (evData ?? []) as (EventRow & { event_menu_selections: MenuSelection[] })[];

  return (
    <div>
      <PageHeader title="מטבח" subtitle="אירועים בשבועיים הקרובים, עם כמויות להזמנה מהספקים" />

      {tastings && tastings.length > 0 && (
        <section className="mb-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-brand-dark">טעימות קרובות</h2>
          {tastings.map((t) => {
            const ev = t.events as unknown as (EventRow & { event_tasting_picks: TastingPick[]; event_menu_selections: MenuSelection[] }) | null;
            if (!ev) return null;
            const order = computeTastingOrder(ev.tasters, ev.event_tasting_picks ?? [], menuItems, ev.event_menu_selections ?? []);
            return (
              <article key={t.starts_at} className="card">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{formatDateTimeHe(t.starts_at)}</h3>
                    <p className="text-sm text-muted">{eventName(ev)} · {ev.tasters} טועמים · {ev.guest_count} מוזמנים לאירוע</p>
                  </div>
                  <Link href={`/dashboard/events/${t.event_id}`} className="btn-ghost text-sm">לתיק</Link>
                </div>
                <TastingDishes order={order} />
                <h4 className="mb-2 mt-4 text-sm font-semibold">להזמנה לטעימה</h4>
                <TastingOrderTable order={order} />
              </article>
            );
          })}
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
