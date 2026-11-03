// ניהול שעות טעימה (בתרשים: «הגדרת תאריכים פנויים / הגדרת שעות»).
// השף, מנהלת האירועים ומנהל כללי מוסיפים שעות; לקוחות רואים רק את השעות הפנויות.
import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe, todayInIsrael } from "@/lib/dates";
import { eventName } from "@/lib/event-text";
import type { EventRow } from "@/lib/types";
import { AddSlotsForm, DeleteSlotButton } from "./slot-forms";

export const metadata = { title: "טעימות – קסם בגלבוע" };

export default async function TastingsPage() {
  const profile = await requireStaff();
  const canManage = ["chef", "event_manager", "admin"].includes(profile.role);
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasting_slots")
    .select("id, starts_at, event_id, events(title, event_type, event_type_other, guest_count)")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(200);
  const slots = data ?? [];

  return (
    <div>
      <PageHeader title="טעימות" subtitle="שעות פנויות ושעות שנקבעו. השף ומנהלת האירוע מקבלים מייל על כל טעימה שנקבעת." />
      {canManage && (
        <section className="card mb-6">
          <h2 className="mb-3 font-semibold">הוספת שעות טעימה</h2>
          <AddSlotsForm today={todayInIsrael()} />
        </section>
      )}
      {slots.length === 0 ? (
        <Empty>אין שעות טעימה עתידיות</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-std w-full min-w-[520px]">
            <thead><tr><th>מועד</th><th>מצב</th><th>אירוע</th><th /></tr></thead>
            <tbody>
              {slots.map((s) => {
                const ev = s.events as unknown as EventRow | null;
                return (
                  <tr key={s.id}>
                    <td className="font-medium">{formatDateTimeHe(s.starts_at)}</td>
                    <td>{s.event_id ? <Badge tone="gold">נקבעה</Badge> : <Badge tone="green">פנויה</Badge>}</td>
                    <td>{s.event_id && ev ? <Link href={`/dashboard/events/${s.event_id}`} className="text-brand underline">{eventName(ev)} ({ev.guest_count})</Link> : "—"}</td>
                    <td>{canManage && !s.event_id && <DeleteSlotButton id={s.id} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
