// חישוב הזמנת חומרי גלם לשף (docs/spec.md §7.2).
// פונקציה טהורה ודטרמיניסטית: אותו קלט תמיד נותן אותו פלט, ולכן אפשר לבדוק אותה ולסמוך עליה.
//
// הרעיון: הסועדים מתחלקים לשלוש קבוצות (רגיל, ללא גלוטן, טבעוני). לכל שלב בתפריט, כל קבוצה
// מקבלת את המנה שנבחרה עבורה. כמות = מספר סועדים בקבוצה × גרמים למנה, ועוד רזרבה של 5%.

import type { Course, GuestGroup, MenuItem, MenuSelection } from "./types.ts";
import { COURSES } from "./types.ts";

export const BUFFER = 0.05; // 5% רזרבה

export interface GuestSplit {
  regular: number;
  celiac: number;
  vegan: number;
}

/** מחלק את המוזמנים לקבוצות. מי שלא טבעוני ולא צליאק נספר ב«רגיל». */
export function splitGuests(guestCount: number, veganCount: number, celiacCount: number): GuestSplit {
  const vegan = Math.max(0, veganCount);
  const celiac = Math.max(0, celiacCount);
  return { regular: Math.max(0, guestCount - vegan - celiac), celiac, vegan };
}

export interface CourseLine {
  course: Course;
  group: GuestGroup;
  guests: number;
  item: MenuItem | null; // null = לא נבחרה מנה לקבוצה הזו
  fellBackToRegular: boolean; // לא נבחרה מנה לקבוצה, ולכן נספרה המנה הרגילה
}

export interface OrderTotals {
  beef_kg: number;
  poultry_kg: number;
  fish_kg: number;
  veg_kg: number;
}

export interface OrderResult {
  split: GuestSplit;
  lines: CourseLine[];
  totals: OrderTotals;
  warnings: string[];
}

/** עיגול לק"ג עם ספרה אחת אחרי הנקודה, כלפי מעלה (עדיף מעט יותר מאשר חסר). */
function toKg(grams: number): number {
  return Math.ceil((grams * (1 + BUFFER)) / 100) / 10;
}

export function computeOrder(
  guestCount: number,
  veganCount: number,
  celiacCount: number,
  selections: MenuSelection[],
  menuItems: MenuItem[],
): OrderResult {
  const split = splitGuests(guestCount, veganCount, celiacCount);
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  const lines: CourseLine[] = [];
  const warnings: string[] = [];
  const grams = { beef: 0, poultry: 0, fish: 0, veg: 0 };

  const pick = (course: Course, group: GuestGroup) => {
    const sel = selections.find((s) => s.course === course && s.guest_group === group);
    return sel ? byId.get(sel.menu_item_id) ?? null : null;
  };

  for (const course of COURSES) {
    const regularItem = pick(course, "regular");
    for (const group of ["regular", "celiac", "vegan"] as GuestGroup[]) {
      const guests = split[group];
      if (guests === 0) continue;
      let item = pick(course, group);
      let fellBack = false;
      if (!item && group !== "regular" && regularItem) {
        // אין מנה מיוחדת לקבוצה: סופרים את המנה הרגילה, ומתריעים כדי שמישהו יחליט
        item = regularItem;
        fellBack = true;
        warnings.push(`לא נבחרה מנה ${group === "celiac" ? "ללא גלוטן" : "טבעונית"} ל${courseName(course)}`);
      }
      if (!item) {
        warnings.push(`לא נבחרה מנה ל${courseName(course)}`);
      } else {
        grams.beef += item.beef_g * guests;
        grams.poultry += item.poultry_g * guests;
        grams.fish += item.fish_g * guests;
        grams.veg += item.veg_g * guests;
      }
      lines.push({ course, group, guests, item, fellBackToRegular: fellBack });
    }
  }

  return {
    split,
    lines,
    totals: {
      beef_kg: toKg(grams.beef),
      poultry_kg: toKg(grams.poultry),
      fish_kg: toKg(grams.fish),
      veg_kg: toKg(grams.veg),
    },
    warnings: [...new Set(warnings)],
  };
}

function courseName(c: Course): string {
  return { reception: "קבלת הפנים", first: "המנה הראשונה", intermediate: "מנת הביניים", main: "המנה העיקרית", dessert: "הקינוחים" }[c];
}

/** טקסט קצר להצגה במייל לשף */
export function formatOrderText(order: OrderResult): string {
  const t = order.totals;
  const rows = [
    `בקר/בשר אדום: ${t.beef_kg} ק"ג`,
    `עוף: ${t.poultry_kg} ק"ג`,
    `דגים: ${t.fish_kg} ק"ג`,
    `ירקות ופירות: ${t.veg_kg} ק"ג`,
  ];
  const warn = order.warnings.length ? `\nלתשומת לב:\n- ${order.warnings.join("\n- ")}` : "";
  return `${rows.join("\n")}\n(כולל ${BUFFER * 100}% רזרבה)${warn}`;
}
