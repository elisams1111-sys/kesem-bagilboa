// הטעימה של אירוע: אילו מנות טועמים, וכמה להזמין בשבילן. החישוב עצמו ב-computeTastingOrder (src/lib/quantities.ts)
import { CATEGORIES, CATEGORY_LABELS, UNSPECIFIED, type TastingOrder } from "@/lib/quantities";
import { COURSE_LABELS, COURSES, GROUP_LABELS, TASTING_PORTION } from "@/lib/types";

/** גרמים לתצוגה, עם מפריד אלפים: 1,250 גרם */
const grams = (g: number) => `${g.toLocaleString("he-IL")} גרם`;

/** המנות לטעימה, שלב בכל שורה. ליד מנה שנבחרה לקבוצה מיוחדת מצוין לאיזו */
export function TastingDishes({ order }: { order: TastingOrder }) {
  if (order.dishes.length === 0) return <p className="text-sm text-muted">עוד לא נבחרו מנות לטעימה</p>;
  return (
    <div className="space-y-2 text-sm">
      {order.fromFinalMenu && (
        <p className="text-xs text-muted">האירוע הוזמן לפני שנבחרו מנות לטעימה, ולכן מוצג התפריט הסופי.</p>
      )}
      <dl className="space-y-1.5">
        {COURSES.map((c) => {
          const dishes = order.dishes.filter((d) => d.course === c);
          if (!dishes.length) return null;
          return (
            <div key={c} className="grid grid-cols-[6.5rem_1fr] gap-2">
              <dt className="font-medium text-muted">{COURSE_LABELS[c]}</dt>
              <dd>
                {dishes.map((d, i) => (
                  <span key={d.item.id}>
                    {i > 0 && " · "}
                    {d.item.title}
                    {!d.groups.includes("regular") && <span className="text-muted"> ({d.groups.map((g) => GROUP_LABELS[g]).join(", ")})</span>}
                  </span>
                ))}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** כמה להזמין לטעימה: לכל סוג סך הכל בגרמים, ומתחתיו פירוט לפי רכיב. סוג בלי כמות לא מוצג */
export function TastingOrderTable({ order }: { order: TastingOrder }) {
  const cats = CATEGORIES.filter((c) => order.totals[c] > 0);
  if (!cats.length) return null;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cats.map((cat) => (
          <div key={cat} className="rounded-xl border border-line bg-cream p-3">
            <div className="text-xs text-muted">{CATEGORY_LABELS[cat]}</div>
            <div className="font-display text-xl font-bold text-brand">{grams(order.totals[cat])}</div>
            <ul className="mt-2 space-y-1 border-t border-line pt-2 text-sm">
              {order.breakdown[cat].map((l) => (
                <li key={l.ingredient} className="flex justify-between gap-3">
                  <span className={l.ingredient === UNSPECIFIED ? "text-muted" : ""}>{l.ingredient}</span>
                  <span className="shrink-0 tabular-nums">{grams(l.grams)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {order.tasters} טועמים × {TASTING_PORTION === 0.5 ? "חצי מנה" : `${TASTING_PORTION} מנה`} מכל מנה · מעוגל למעלה ל-10 גרם, בלי רזרבה
      </p>
    </div>
  );
}
