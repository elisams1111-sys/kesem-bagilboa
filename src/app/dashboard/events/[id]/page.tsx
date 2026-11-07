// תיק האירוע לצוות: כל הפרטים במקום אחד. כל תפקיד רואה ועורך לפי ההרשאות שלו:
// מכירות, מנהלת אירועים ומנהל כללי עורכים; השף צופה ורואה את חישוב ההזמנה.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader, StatusBadge } from "@/components/ui";
import { ChangeLog } from "@/components/event/change-log";
import { DetailsForm } from "@/components/event/details-form";
import { MenuEditor } from "@/components/event/menu-editor";
import { OrderTable } from "@/components/event/order-table";
import { TastingPicker } from "@/components/event/tasting-picker";
import { TastingDishes } from "@/components/event/tasting-order";
import { requireStaff } from "@/lib/auth";
import { formatDateHe, formatDateTimeHe } from "@/lib/dates";
import { loadEventFile } from "@/lib/event-data";
import { calendarLinkFor, eventName } from "@/lib/event-text";
import { computeOrder, computeTastingOrder } from "@/lib/quantities";
import { EVENT_TYPE_LABELS, SLOT_LABELS } from "@/lib/types";

export default async function StaffEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireStaff();
  const canSeeOutbox = ["event_manager", "admin"].includes(profile.role);
  const file = await loadEventFile(id, profile.id, canSeeOutbox);
  if (!file) notFound();
  const { event, client } = file;
  const canEdit = profile.role !== "chef";
  const order = computeOrder(event.guest_count, event.vegan_count, event.celiac_count, file.selections, file.menuItems);

  return (
    <div>
      <Link href={profile.role === "chef" ? "/dashboard/kitchen" : "/dashboard"} className="text-sm text-muted hover:text-brand">→ חזרה</Link>
      <PageHeader
        title={eventName(event)}
        subtitle={`${EVENT_TYPE_LABELS[event.event_type]}${event.event_type_other ? ` (${event.event_type_other})` : ""} · ${formatDateHe(event.event_date)} · ${SLOT_LABELS[event.time_slot]}${file.daysLeft >= 0 ? ` · עוד ${file.daysLeft} ימים` : ""}`}
        actions={
          <>
            <StatusBadge status={event.status} />
            <a href={calendarLinkFor(event)} target="_blank" rel="noreferrer" className="btn-ghost text-sm">הוספה ליומן Google</a>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-4 text-lg font-semibold">פרטי האירוע</h2>
            <DetailsForm event={event} mode={canEdit ? "staff" : "readonly"} locked={file.locked} />
          </section>

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">התפריט</h2>
            <MenuEditor eventId={event.id} selections={file.selections} picks={file.picks} menuItems={file.menuItems} groups={file.groups} editable={canEdit} />
          </section>

          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">חישוב הזמנה למטבח</h2>
              {file.daysLeft <= 5 && file.daysLeft >= 0 && <Badge tone="gold">נשלח לשף</Badge>}
            </div>
            <OrderTable order={order} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card text-sm">
            <h2 className="mb-3 text-lg font-semibold">הלקוח</h2>
            <p className="font-medium">{client?.full_name}</p>
            {client?.phones.map((p) => <p key={p} dir="ltr" className="text-end">{p}</p>)}
            {client?.emails.map((e) => <p key={e} dir="ltr" className="text-end text-muted">{e}</p>)}
            {client?.address && <p className="mt-2 text-muted">{client.address}</p>}
            <p className="mt-3">
              מקדמה: {event.deposit_confirmed ? <Badge tone="green">התקבלה</Badge> : <Badge tone="red">חסרה</Badge>}
              {event.payment_method && <span className="text-muted"> · {{ credit_card: "אשראי", bank_transfer: "העברה בנקאית", check: "צ׳ק" }[event.payment_method] ?? event.payment_method}</span>}
            </p>
          </section>

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">טעימה</h2>
            {canEdit ? (
              <TastingPicker eventId={event.id} current={file.tasting?.starts_at ?? null} freeSlots={file.freeSlots} />
            ) : (
              <p>{file.tasting ? formatDateTimeHe(file.tasting.starts_at) : "לא נקבעה"}</p>
            )}
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-sm font-medium">מנות לטעימה · {event.tasters} טועמים</p>
              <TastingDishes order={computeTastingOrder(event.tasters, file.picks, file.menuItems, file.selections)} />
            </div>
          </section>

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">יומן שינויים</h2>
            <ChangeLog rows={file.changes} names={file.names} />
          </section>

          {canSeeOutbox && (
            <section className="card">
              <h2 className="mb-3 text-lg font-semibold">מיילים שנשלחו</h2>
              {file.outbox.length === 0 ? (
                <p className="text-sm text-muted">עוד לא נשלחו מיילים לאירוע הזה</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {file.outbox.map((n) => (
                    <li key={n.id} className="rounded-lg border border-line p-2">
                      <div className="font-medium">{n.subject}</div>
                      <div className="text-xs text-muted" dir="ltr">{n.recipient_email} · {formatDateTimeHe(n.created_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
