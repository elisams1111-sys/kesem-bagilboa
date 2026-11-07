// חישוב הזמנת חומרי גלם לשף (docs/spec.md §7.2).
// פונקציה טהורה ודטרמיניסטית: אותו קלט תמיד נותן אותו פלט, ולכן אפשר לבדוק אותה ולסמוך עליה.
//
// הרעיון: הסועדים מתחלקים לשלוש קבוצות (רגיל, ללא גלוטן, טבעוני). לכל שלב בתפריט, כל קבוצה
// מקבלת את המנה שנבחרה עבורה. כמות = מספר סועדים בקבוצה × גרמים למנה, ועוד רזרבה של 5%.
// בנוסף לסכום לכל סוג, יש פירוט לפי רכיב (עגבניות, פילה בקר וכו'), מתוך item.menu_item_ingredients.

import type { Course, GuestGroup, IngredientCategory, MenuItem, MenuSelection, TastingPick } from "./types.ts";
import { COURSES, TASTING_PORTION } from "./types.ts";

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

/** סוכם גרמים של מנות: לכל סוג, ולכל רכיב בתוך הסוג. משותף להזמנה לאירוע ולהזמנה לטעימה */
function createTally() {
  const grams: Record<IngredientCategory, number> = { beef: 0, poultry: 0, fish: 0, veg: 0 };
  // גרמים לכל רכיב בכל סוג
  const perIngredient: Record<IngredientCategory, Map<string, number>> = {
    beef: new Map(), poultry: new Map(), fish: new Map(), veg: new Map(),
  };
  const addIngredient = (cat: IngredientCategory, name: string, g: number) =>
    perIngredient[cat].set(name, (perIngredient[cat].get(name) ?? 0) + g);

  /** מוסיף מנה × מספר מנות (servings יכול להיות שבר, למשל חצי מנה בטעימה) */
  function add(item: MenuItem, servings: number) {
    for (const cat of CATEGORIES) {
      const total = item[GRAMS_FIELD[cat]];
      grams[cat] += total * servings;
      let listed = 0;
      for (const ing of item.menu_item_ingredients ?? []) {
        if (ing.category !== cat) continue;
        addIngredient(cat, ing.ingredient, ing.grams * servings);
        listed += ing.grams;
      }
      // מה שהמנה מחייבת ולא פורט לרכיבים, נספר ב«לא מפורט». כך הפירוט תמיד מסתכם לסכום של הסוג
      if (total > listed) addIngredient(cat, UNSPECIFIED, (total - listed) * servings);
    }
  }
  return { grams, perIngredient, add };
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
  const tally = createTally();
  const { grams, perIngredient } = tally;

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
        tally.add(item, guests);
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
  return [...map].map(([ingredient, g]) => ({ ingredient, kg: toKg(g) })).sort(byAmount((l) => l.kg));
}

/** מהגדול לקטן, ובשוויון לפי א"ב. «לא מפורט» תמיד בסוף */
function byAmount<T extends { ingredient: string }>(amount: (x: T) => number) {
  return (a: T, b: T) =>
    a.ingredient === UNSPECIFIED ? 1 : b.ingredient === UNSPECIFIED ? -1 : amount(b) - amount(a) || a.ingredient.localeCompare(b.ingredient, "he");
}

// ---------- הזמנה לטעימה ----------

export interface TastingDish {
  course: Course;
  item: MenuItem;
  groups: GuestGroup[]; // לאילו קבוצות המנה נבחרה (מנה טבעונית יכולה להיבחר גם כרגילה)
}

export interface TastingOrder {
  tasters: number;
  dishes: TastingDish[];
  /** גרמים לכל סוג, ולכל רכיב בתוך הסוג. בלי רזרבה, מעוגל למעלה ל-10 גרם */
  totals: Record<IngredientCategory, number>;
  breakdown: Record<IngredientCategory, { ingredient: string; grams: number }[]>;
  /** true כשאין מנות שנבחרו לטעימה, ולכן הוצג התפריט הסופי (אירועים שהוזמנו לפני שהיו מנות לטעימה) */
  fromFinalMenu: boolean;
}

/** עיגול למעלה ל-10 גרם. בטעימה הכמויות קטנות, ולכן גרמים ולא ק"ג */
const toTens = (g: number) => Math.ceil(g / 10) * 10;

/**
 * כמה להכין לטעימה: כל טועם מקבל חצי מנה (TASTING_PORTION) מכל מנה שנבחרה.
 * מנה שנבחרה לכמה קבוצות (למשל רגילה וגם טבעונית) מוכנה פעם אחת.
 * אם לאירוע אין מנות לטעימה, משתמשים בתפריט הסופי (fallbackSelections).
 */
export function computeTastingOrder(
  tasters: number,
  picks: TastingPick[],
  menuItems: MenuItem[],
  fallbackSelections: MenuSelection[] = [],
): TastingOrder {
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  const fromFinalMenu = picks.length === 0 && fallbackSelections.length > 0;
  const source = picks.length ? picks : fallbackSelections;

  // מאחדים לפי מנה, ושומרים לאילו קבוצות היא נבחרה
  const dishes = new Map<number, TastingDish>();
  for (const p of source) {
    const item = byId.get(p.menu_item_id);
    if (!item) continue;
    const dish = dishes.get(item.id) ?? { course: p.course, item, groups: [] };
    if (!dish.groups.includes(p.guest_group)) dish.groups.push(p.guest_group);
    dishes.set(item.id, dish);
  }
  const ordered = [...dishes.values()].sort((a, b) => COURSES.indexOf(a.course) - COURSES.indexOf(b.course) || a.item.id - b.item.id);

  const tally = createTally();
  for (const d of ordered) tally.add(d.item, tasters * TASTING_PORTION);

  const lines = (map: Map<string, number>) =>
    [...map].map(([ingredient, g]) => ({ ingredient, grams: toTens(g) })).sort(byAmount((l) => l.grams));
  return {
    tasters,
    dishes: ordered,
    totals: {
      beef: toTens(tally.grams.beef), poultry: toTens(tally.grams.poultry),
      fish: toTens(tally.grams.fish), veg: toTens(tally.grams.veg),
    },
    breakdown: {
      beef: lines(tally.perIngredient.beef), poultry: lines(tally.perIngredient.poultry),
      fish: lines(tally.perIngredient.fish), veg: lines(tally.perIngredient.veg),
    },
    fromFinalMenu,
  };
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
