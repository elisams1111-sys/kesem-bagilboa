// דשבורד ראשי לצוות: תמונת מצב בזמן אמת (מה שרונן ביקש) וטבלת כל האירועים עם סינון
import Link from "next/link";
import { Badge, Empty, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, daysBetween, formatDateHe, formatDateTimeHe, todayInIsrael } from "@/lib/dates";
import { eventName } from "@/lib/event-text";
import type { EventRow, EventStatus, EventType } from "@/lib/types";
import { EVENT_TYPE_LABELS, SLOT_LABELS, STATUS_LABELS } from "@/lib/types";

export const metadata = { title: "דשבורד – קסם בגלבוע" };

type Search = { month?: string; status?: string; type?: string; q?: string };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole(["sales", "event_manager", "admin"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayInIsrael();
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = addDays(addDays(monthStart, 32).slice(0, 7) + "-01", -1);

  // ---------- מספרי מפתח ----------
  const [thisMonth, next7, openAttention, tastings7] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date", monthStart).lte("event_date", monthEnd).neq("status", "cancelled"),
    supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date", today).lte("event_date", addDays(today, 7)).neq("status", "cancelled"),
    supabase.from("change_log").select("id", { count: "exact", head: true }).eq("needs_attention", true).is("resolved_at", null),
    supabase.from("tasting_slots").select("starts_at, event_id, events(title, event_type, event_type_other)").not("event_id", "is", null)
      .gte("starts_at", new Date().toISOString()).lte("starts_at", new Date(Date.now() + 7 * 86_400_000).toISOString()).order("starts_at"),
  ]);

  // ---------- טבלת אירועים עם סינון ----------
  let q = supabase.from("events").select("*, profiles!events_client_id_fkey(full_name, phones)").order("event_date");
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    q = q.gte("event_date", `${sp.month}-01`).lte("event_date", addDays(addDays(`${sp.month}-01`, 32).slice(0, 7) + "-01", -1));
  } else {
    q = q.gte("event_date", addDays(today, -1)); // ברירת מחדל: אירועים קרובים
  }
  if (sp.status && sp.status in STATUS_LABELS) q = q.eq("status", sp.status);
  if (sp.type && sp.type in EVENT_TYPE_LABELS) q = q.eq("event_type", sp.type);
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_]/g, "")}%`);
  const { data } = await q.limit(200);
  const events = (data ?? []) as (EventRow & { profiles: { full_name: string; phones: string[] } | null })[];

  return (
    <div>
      <PageHeader title="תמונת מצב" subtitle={`נכון ל-${formatDateHe(today)}`}
        actions={<Link href="/dashboard/events/new" className="btn-gold">אירוע חדש</Link>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="אירועים החודש" value={thisMonth.count ?? 0} href={`/dashboard?month=${today.slice(0, 7)}`} />
        <Stat label="ב-7 הימים הקרובים" value={next7.count ?? 0} hint="כולל היום" />
        <Stat label="בקשות שדורשות טיפול" value={openAttention.count ?? 0} hint="תזכורת כל שעה עד לטיפול" href="/dashboard/changes" />
        <Stat label="טעימות השבוע" value={tastings7.data?.length ?? 0} href="/dashboard/tastings" />
      </div>

      {(tastings7.data?.length ?? 0) > 0 && (
        <div className="card mt-6">
          <h2 className="mb-3 font-semibold">טעימות קרובות</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {tastings7.data!.map((t) => {
              const ev = t.events as unknown as Pick<EventRow, "title" | "event_type" | "event_type_other"> | null;
              return (
                <li key={t.starts_at}>
                  <Link href={`/dashboard/events/${t.event_id}`} className="block rounded-lg border border-line px-3 py-2 hover:bg-brand-light">
                    <b>{formatDateTimeHe(t.starts_at)}</b> · {ev ? eventName(ev) : ""}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <section className="card mt-6">
        <form className="mb-4 grid gap-3 sm:grid-cols-5" method="get">
          <input type="month" name="month" defaultValue={sp.month} className="field" aria-label="חודש" />
          <select name="status" defaultValue={sp.status ?? ""} className="field" aria-label="סטטוס">
            <option value="">כל הסטטוסים</option>
            {(Object.keys(STATUS_LABELS) as EventStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select name="type" defaultValue={sp.type ?? ""} className="field" aria-label="סוג">
            <option value="">כל הסוגים</option>
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
          </select>
          <input name="q" defaultValue={sp.q} placeholder="חיפוש לפי שם אירוע" className="field" />
          <div className="flex gap-2">
            <button className="btn-primary flex-1">סינון</button>
            <Link href="/dashboard" className="btn-ghost">ניקוי</Link>
          </div>
        </form>

        {events.length === 0 ? (
          <Empty>אין אירועים שמתאימים לסינון</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-std w-full min-w-[760px]">
              <thead>
                <tr><th>תאריך</th><th>אירוע</th><th>לקוח</th><th>מוזמנים</th><th>סטטוס</th><th>מקדמה</th><th /></tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const days = daysBetween(today, e.event_date);
                  return (
                    <tr key={e.id} className="hover:bg-cream">
                      <td>
                        <div className="font-medium">{formatDateHe(e.event_date)}</div>
                        <div className="text-xs text-muted">{SLOT_LABELS[e.time_slot]}{days >= 0 && days <= 5 ? <> · <span className="text-red-700">עוד {days} ימים</span></> : ""}</div>
                      </td>
                      <td>
                        <div className="font-medium">{eventName(e)}</div>
                        <div className="text-xs text-muted">{EVENT_TYPE_LABELS[e.event_type]}</div>
                      </td>
                      <td>
                        <div>{e.profiles?.full_name}</div>
                        <div dir="ltr" className="text-end text-xs text-muted">{e.profiles?.phones?.[0]}</div>
                      </td>
                      <td>
                        {e.guest_count}
                        <div className="text-xs text-muted">🌱 {e.vegan_count} · ללא גלוטן {e.celiac_count}</div>
                      </td>
                      <td><StatusBadge status={e.status} /></td>
                      <td>{e.deposit_confirmed ? <Badge tone="green">התקבלה</Badge> : <Badge tone="red">חסרה</Badge>}</td>
                      <td><Link href={`/dashboard/events/${e.id}`} className="font-medium text-brand underline">לתיק</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
