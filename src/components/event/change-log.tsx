// יומן השינויים של אירוע: מי שינה, מתי, ומה. בקשות שדורשות טיפול מסומנות
import { Badge, Empty } from "@/components/ui";
import { formatDateTimeHe } from "@/lib/dates";
import type { ChangeLogRow } from "@/lib/types";

const SOURCE: Record<ChangeLogRow["source"], string> = { app: "טופס", agent: "עוזר AI", system: "מערכת" };

export function ChangeLog({ rows, names }: { rows: ChangeLogRow[]; names: Record<string, string> }) {
  if (!rows.length) return <Empty>עוד אין שינויים</Empty>;
  return (
    <ol className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className={`rounded-lg border p-3 text-sm ${r.needs_attention && !r.resolved_at ? "border-amber-300 bg-amber-50" : "border-line bg-white"}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{formatDateTimeHe(r.created_at)}</span>
            <span>·</span>
            <span>{r.changed_by ? names[r.changed_by] ?? "צוות האולם" : "מערכת"}</span>
            <Badge tone={r.source === "agent" ? "gold" : "gray"}>{SOURCE[r.source]}</Badge>
            {r.needs_attention && (r.resolved_at ? <Badge tone="green">טופל</Badge> : <Badge tone="red">דורש טיפול</Badge>)}
          </div>
          <div className="mt-1">{r.summary}</div>
        </li>
      ))}
    </ol>
  );
}
