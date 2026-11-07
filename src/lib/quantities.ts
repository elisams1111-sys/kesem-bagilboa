// חישוב הזמנת חומרי גלם לשף (docs/spec.md §7.2).
// פונקציה טהורה ודטרמיניסטית: אותו קלט תמיד נותן אותו פלט, ולכן אפשר לבדוק אותה ולסמוך עליה.
//
// הרעיון: הסועדים מתחלקים לשלוש קבוצות (רגיל, ללא גלוטן, טבעוני). לכל שלב בתפריט, כל קבוצה
// מקבלת את המנה שנבחרה עבורה. כמות = מספר סועדים בקבוצה × גרמים למנה, ועוד רזרבה של 5%.
// בנוסף לסכום לכל סוג, יש פירוט לפי רכיב (עגבניות, פילה בקר וכו'), מתוך item.menu_item_ingredients.

import type { Course, GuestGroup, IngredientCategory, MenuItem, MenuSelection } from "./types.ts";
import { COURSES } from "./types.ts";

export const CATEGORIES: IngredientCategory[] = ["beef", "poultry", "fish", "veg"];
export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  beef: "בקר / בשר אדום",
  poultry: "עוף",
  fish: "דגים",
  veg: "ירקות ופירות",
};
/** שם השורה לגרמים של מנה שאין לה פירוט לפי רכיב (למשל מנה חדשה שהשף הוסיף) */
export const UNSPECIFIED = "לא מפורט";
const GRAMS_FIELD = { beef: "beef_g", poultry: "poultry_g", fish: "fish_g", veg: "veg_g" } as const;

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

export interface IngredientLine {
  ingredient: string;
  kg: number;
}

export interface OrderResult {
  split: GuestSplit;
  lines: CourseLine[];
  totals: OrderTotals;
  /** לכל סוג: הרכיבים וק"ג לכל אחד (כולל רזרבה), מהגדול לקטן. «לא מפורט» תמיד בסוף */
  breakdown: Record<IngredientCategory, IngredientLine[]>;
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
  // גרמים לכל רכיב בכל סוג. Map שומר על סדר ההכנסה, וממילא ממיינים בסוף
  const perIngredient: Record<IngredientCategory, Map<string, number>> = {
    beef: new Map(), poultry: new Map(), fish: new Map(), veg: new Map(),
  };
  const addIngredient = (cat: IngredientCategory, name: string, g: number) =>
    perIngredient[cat].set(name, (perIngredient[cat].get(name) ?? 0) + g);

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
        for (const cat of CATEGORIES) {
          const total = item[GRAMS_FIELD[cat]];
          let listed = 0;
          for (const ing of item.menu_item_ingredients ?? []) {
            if (ing.category !== cat) continue;
            addIngredient(cat, ing.ingredient, ing.grams * guests);
            listed += ing.grams;
          }
          // מה שהמנה מחייבת ולא פורט לרכיבים, נספר ב«לא מפורט». כך הפירוט תמיד מסתכם לסכום של הסוג
          if (total > listed) addIngredient(cat, UNSPECIFIED, (total - listed) * guests);
        }
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
    breakdown: {
      beef: toLines(perIngredient.beef),
      poultry: toLines(perIngredient.poultry),
      fish: toLines(perIngredient.fish),
      veg: toLines(perIngredient.veg),
    },
    warnings: [...new Set(warnings)],
  };
}

/** ממיר גרמים לשורות בק"ג: מהגדול לקטן, ו«לא מפורט» בסוף. כל רכיב מעוגל למעלה בנפרד,
 *  ולכן סכום השורות יכול לצאת עד 0.1 ק"ג לרכיב יותר מהסכום של הסוג. זה מכוון: עדיף מעט יותר מאשר חסר */
function toLines(map: Map<string, number>): IngredientLine[] {
  return [...map]
    .map(([ingredient, g]) => ({ ingredient, kg: toKg(g) }))
    .sort((a, b) =>
      a.ingredient === UNSPECIFIED ? 1 : b.ingredient === UNSPECIFIED ? -1 : b.kg - a.kg || a.ingredient.localeCompare(b.ingredient, "he"));
}

function courseName(c: Course): string {
  return { reception: "קבלת הפנים", first: "המנה הראשונה", intermediate: "מנת הביניים", main: "המנה העיקרית", dessert: "הקינוחים" }[c];
}

/** טקסט קצר להצגה במייל לשף */
export function formatOrderText(order: OrderResult): string {
  const t = order.totals;
  const totalKg = { beef: t.beef_kg, poultry: t.poultry_kg, fish: t.fish_kg, veg: t.veg_kg };
  // כל סוג בשורה, ומתחתיו הרכיבים שלו מוזחים פנימה
  const rows = CATEGORIES.map((cat) =>
    [`${CATEGORY_LABELS[cat]}: ${totalKg[cat]} ק"ג`, ...order.breakdown[cat].map((l) => `  - ${l.ingredient}: ${l.kg} ק"ג`)].join("\n"),
  );
  const warn = order.warnings.length ? `\nלתשומת לב:\n- ${order.warnings.join("\n- ")}` : "";
  return `${rows.join("\n")}\n(כולל ${BUFFER * 100}% רזרבה)${warn}`;
}
