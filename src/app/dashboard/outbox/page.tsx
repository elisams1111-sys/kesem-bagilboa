// דואר יוצא: כל מייל שהמערכת שלחה (או רשמה, אם שירות המייל לא מוגדר). רונן ורונית בלבד
import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/dates";
import type { NotificationRow } from "@/lib/types";
import { RunJobsButton } from "./run-jobs";

export const metadata = { title: "דואר יוצא – קסם בגלבוע" };

const KINDS: Record<string, string> = {
  event_booked: "אירוע נסגר",
  tasting_booked: "טעימה נקבעה",
  client_confirmation: "אישור ללקוח",
  chef_5day: "5 ימים לשף",
  event_morning: "בוקר האירוע",
  change_digest: "סיכום שינויים",
  attention: "דורש טיפול",
  attention_reminder: "תזכורת",
};
const STATUS = { sent: ["נשלח", "green"], logged: ["נרשם בלבד", "gray"], failed: ["נכשל", "red"] } as const;

export default async function OutboxPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireRole(["event_manager", "admin"]);
  const { kind } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(150);
  if (kind && kind in KINDS) q = q.eq("kind", kind);
  const { data } = await q;
  const rows = (data ?? []) as NotificationRow[];
  const live = Boolean(process.env.RESEND_API_KEY);

  return (
    <div>
      <PageHeader title="דואר יוצא" subtitle={live ? "המיילים נשלחים דרך Resend" : "שירות המייל לא מוגדר: המיילים נרשמים כאן בלבד (מתאים להדגמה)"}
        actions={<RunJobsButton />} />
      <div className="mb-4 flex flex-wrap gap-1 text-sm">
        <Link href="/dashboard/outbox" className={`rounded-lg px-3 py-1 ${!kind ? "bg-brand text-white" : "bg-white hover:bg-brand-light"}`}>הכל</Link>
        {Object.entries(KINDS).map(([k, l]) => (
          <Link key={k} href={`/dashboard/outbox?kind=${k}`} className={`rounded-lg px-3 py-1 ${kind === k ? "bg-brand text-white" : "bg-white hover:bg-brand-light"}`}>{l}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>אין מיילים</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((n) => (
            <details key={n.id} className="card p-4">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                <Badge tone="gold">{KINDS[n.kind] ?? n.kind}</Badge>
                <span className="font-medium">{n.subject}</span>
                <span className="ms-auto text-xs text-muted" dir="ltr">{n.recipient_email} · {formatDateTimeHe(n.created_at)}</span>
                <Badge tone={STATUS[n.status][1]}>{STATUS[n.status][0]}</Badge>
              </summary>
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-cream p-3 font-sans text-sm">{n.body}</pre>
              {n.error && <p className="mt-2 text-xs text-red-700" dir="ltr">{n.error}</p>}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
