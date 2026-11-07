// חישוב ההזמנה לשף: סה"כ ק"ג לכל סוג חומר גלם, ומתחתיו פירוט לפי רכיב. בנוסף, פירוט לפי שלב וקבוצת סועדים
import { Badge } from "@/components/ui";
import { BUFFER, CATEGORIES, CATEGORY_LABELS, UNSPECIFIED, type OrderResult } from "@/lib/quantities";
import { COURSE_LABELS, GROUP_LABELS } from "@/lib/types";

export function OrderTable({ order, compact = false }: { order: OrderResult; compact?: boolean }) {
  const t = order.totals;
  const totalKg = { beef: t.beef_kg, poultry: t.poultry_kg, fish: t.fish_kg, veg: t.veg_kg };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="rounded-xl border border-line bg-cream p-3">
            <div className="text-xs text-muted">{CATEGORY_LABELS[cat]}</div>
            <div className="font-display text-2xl font-bold text-brand">{totalKg[cat]} <span className="text-sm font-normal">ק״ג</span></div>
            {order.breakdown[cat].length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-line pt-2 text-sm">
                {order.breakdown[cat].map((l) => (
                  <li key={l.ingredient} className="flex justify-between gap-3">
                    <span className={l.ingredient === UNSPECIFIED ? "text-muted" : ""}>{l.ingredient}</span>
                    {/* tabular-nums: הספרות באותו רוחב, כך שהמספרים מיושרים בעמודה */}
                    <span className="shrink-0 tabular-nums">{l.kg} ק״ג</span>
                  </li>
                ))}
              </ul>
            )}
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
