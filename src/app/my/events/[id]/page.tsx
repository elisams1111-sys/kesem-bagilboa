// תיק האירוע של הלקוח: פרטים לעריכה, תפריט, טעימה, עוזר AI ויומן שינויים
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader, StatusBadge } from "@/components/ui";
import { AgentChat } from "@/components/event/agent-chat";
import { ChangeLog } from "@/components/event/change-log";
import { DetailsForm } from "@/components/event/details-form";
import { MenuEditor } from "@/components/event/menu-editor";
import { TastingPicker } from "@/components/event/tasting-picker";
import { TastingDishes } from "@/components/event/tasting-order";
import { computeTastingOrder } from "@/lib/quantities";
import { requireRole } from "@/lib/auth";
import { formatDateHe } from "@/lib/dates";
import { loadEventFile } from "@/lib/event-data";
import { eventName } from "@/lib/event-text";
import { EVENT_TYPE_LABELS, SLOT_LABELS } from "@/lib/types";

export default async function ClientEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireRole(["client"]);
  const file = await loadEventFile(id, profile.id);
  if (!file) notFound();
  const { event } = file;
  const past = file.daysLeft < 0 || event.status === "cancelled";

  return (
    <AppShell profile={profile}>
      <Link href="/my" className="text-sm text-muted hover:text-brand">→ האירועים שלי</Link>
      <PageHeader
        title={eventName(event)}
        subtitle={`${EVENT_TYPE_LABELS[event.event_type]} · ${formatDateHe(event.event_date)} · ${SLOT_LABELS[event.time_slot]}${file.daysLeft >= 0 ? ` · עוד ${file.daysLeft} ימים` : ""}`}
        actions={<StatusBadge status={event.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-4 text-lg font-semibold">פרטי האירוע</h2>
            <DetailsForm event={event} mode={past ? "readonly" : "client"} locked={file.locked} />
          </section>

          <section className="card">
            <h2 className="mb-1 text-lg font-semibold">התפריט</h2>
            {file.locked && !past && <p className="mb-3 text-sm text-amber-800">פחות מ-5 ימים לאירוע: שינויים בתפריט דרך מנהלת האירוע.</p>}
            <MenuEditor eventId={event.id} selections={file.selections} picks={file.picks} menuItems={file.menuItems} groups={file.groups} editable={!file.locked && !past} />
          </section>

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">טעימות</h2>
            <div className="mb-4 rounded-xl bg-cream p-3">
              <p className="mb-2 text-sm font-medium">המנות שבחרתם לטעום · {event.tasters} טועמים</p>
              <TastingDishes order={computeTastingOrder(event.tasters, file.picks, file.menuItems)} />
            </div>
            {past ? (
              <p className="text-muted">האירוע כבר עבר.</p>
            ) : (
              <TastingPicker eventId={event.id} current={file.tasting?.starts_at ?? null} freeSlots={file.freeSlots} />
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card">
            <h2 className="text-lg font-semibold">עוזר האירוע</h2>
            <p className="mb-3 text-sm text-muted">זמין 24/7. מה שדורש החלטה של הצוות עובר למנהלת האירוע.</p>
            <AgentChat eventId={event.id} initial={file.chat} />
          </section>
          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">היסטוריית שינויים</h2>
            <ChangeLog rows={file.changes} names={file.names} />
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
