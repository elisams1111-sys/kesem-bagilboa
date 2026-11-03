// יומן השינויים המרכזי ותור «דורש טיפול» של רונית.
// כאן רואים מה כל זוג שינה ומתי, גם כשרונית בחופש.
import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/dates";
import { eventName } from "@/lib/event-text";
import type { ChangeLogRow, EventRow } from "@/lib/types";
import { ResolveButton } from "./resolve-button";

export const metadata = { title: "שינויים – קסם בגלבוע" };

type Row = ChangeLogRow & { events: Pick<EventRow, "title" | "event_type" | "event_type_other" | "event_date"> | null; profiles: { full_name: string } | null };

export default async function ChangesPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const profile = await requireStaff();
  const canResolve = ["event_manager", "admin"].includes(profile.role);
  const { source } = await searchParams;
  const supabase = await createClient();

  const select = "*, events(title, event_type, event_type_other, event_date), profiles!change_log_changed_by_fkey(full_name)";
  const [{ data: open }, logRes] = await Promise.all([
    supabase.from("change_log").select(select).eq("needs_attention", true).is("resolved_at", null).order("created_at"),
    (() => {
      let q = supabase.from("change_log").select(select).order("created_at", { ascending: false }).limit(200);
      if (source === "agent" || source === "app" || source === "system") q = q.eq("source", source);
      return q;
    })(),
  ]);
  const openRows = (open ?? []) as unknown as Row[];
  const rows = (logRes.data ?? []) as unknown as Row[];

  return (
    <div>
      <PageHeader title="שינויים" subtitle="כל שינוי בכל תיק אירוע. רונית מקבלת סיכום יומי במייל." />

      <section className="card mb-6 border-amber-300">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          דורש טיפול <Badge tone={openRows.length ? "red" : "green"}>{openRows.length}</Badge>
        </h2>
        {openRows.length === 0 ? (
          <p className="text-sm text-muted">אין בקשות פתוחות 🎉</p>
        ) : (
          <ul className="space-y-2">
            {openRows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-sm">
                  <Link href={`/dashboard/events/${r.event_id}`} className="font-semibold text-brand underline">{r.events ? eventName(r.events) : "אירוע"}</Link>
                  <span className="text-xs text-muted"> · {formatDateTimeHe(r.created_at)}</span>
                  <div className="mt-1">{r.summary}</div>
                </div>
                {canResolve && <ResolveButton id={r.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">יומן מלא</h2>
          <div className="flex gap-1 text-sm">
            {[["", "הכל"], ["app", "טופס"], ["agent", "עוזר AI"], ["system", "מערכת"]].map(([v, l]) => (
              <Link key={v} href={v ? `/dashboard/changes?source=${v}` : "/dashboard/changes"}
                className={`rounded-lg px-3 py-1 ${(source ?? "") === v ? "bg-brand text-white" : "hover:bg-brand-light"}`}>{l}</Link>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <Empty>אין שינויים</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-std w-full min-w-[640px]">
              <thead><tr><th>מתי</th><th>אירוע</th><th>מי</th><th>מה השתנה</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs text-muted">{formatDateTimeHe(r.created_at)}</td>
                    <td><Link href={`/dashboard/events/${r.event_id}`} className="text-brand underline">{r.events ? eventName(r.events) : ""}</Link></td>
                    <td className="text-sm">{r.profiles?.full_name ?? "מערכת"} {r.source === "agent" && <Badge tone="gold">AI</Badge>}</td>
                    <td className="text-sm">{r.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
