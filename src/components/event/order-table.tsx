// חישוב ההזמנה לשף: סה"כ ק"ג לכל סוג חומר גלם, ופירוט לפי שלב וקבוצת סועדים
import { Badge } from "@/components/ui";
import { BUFFER, type OrderResult } from "@/lib/quantities";
import { COURSE_LABELS, GROUP_LABELS } from "@/lib/types";

export function OrderTable({ order, compact = false }: { order: OrderResult; compact?: boolean }) {
  const t = order.totals;
  const totals = [
    ["בקר / בשר אדום", t.beef_kg],
    ["עוף", t.poultry_kg],
    ["דגים", t.fish_kg],
    ["ירקות ופירות", t.veg_kg],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {totals.map(([label, kg]) => (
          <div key={label} className="rounded-xl border border-line bg-cream p-3">
            <div className="text-xs text-muted">{label}</div>
            <div className="font-display text-2xl font-bold text-brand">{kg} <span className="text-sm font-normal">ק״ג</span></div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        כולל {BUFFER * 100}% רזרבה · {order.split.regular} רגילים · {order.split.vegan} טבעונים · {order.split.celiac} ללא גלוטן
      </p>
      {order.warnings.length > 0 && (
        <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {order.warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
        </ul>
      )}
      {!compact && (
        <div className="overflow-x-auto">
          <table className="table-std w-full min-w-[480px]">
            <thead><tr><th>שלב</th><th>קבוצה</th><th>סועדים</th><th>מנה</th></tr></thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={`${l.course}-${l.group}`}>
                  <td>{COURSE_LABELS[l.course]}</td>
                  <td>{GROUP_LABELS[l.group]}</td>
                  <td>{l.guests}</td>
                  <td>
                    {l.item?.title ?? <span className="text-red-700">לא נבחר</span>}
                    {l.fellBackToRegular && <> <Badge tone="red">נספרה המנה הרגילה</Badge></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
