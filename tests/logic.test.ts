// בדיקות ללוגיקה הטהורה: חישוב כמויות, בדיקות טופס, תאריכים והגבלת זמן.
// הרצה: npm test   (Node 24 מריץ TypeScript ישירות)
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeOrder, computeTastingOrder, formatOrderText, splitGuests } from "../src/lib/quantities.ts";
import type { MenuItem, MenuSelection } from "../src/lib/types.ts";
import {
  emptyDraft, requiredGroups, requiredPicks, validateContactStep, validateGuestsStep, validateMenuStep, validateNewClient,
  validateSlotStep, validateTypeStep, validateDateStep,
} from "../src/lib/validation.ts";
import { addDays, daysBetween, googleCalendarLink, isBusinessHours, monthGrid, todayInIsrael } from "../src/lib/dates.ts";
import { isExpired } from "../src/lib/inactivity.ts";

const item = (id: number, over: Partial<MenuItem> = {}): MenuItem => ({
  id, course: "main", diet: "regular", option_no: 1, title: `מנה ${id}`, description: "",
  is_vegan: false, beef_g: 0, poultry_g: 0, fish_g: 0, veg_g: 0, ...over,
});

// ---------- חישוב כמויות לשף ----------

test("חלוקת סועדים: רגיל = סה״כ פחות טבעונים פחות צליאק", () => {
  assert.deepEqual(splitGuests(200, 15, 3), { regular: 182, celiac: 3, vegan: 15 });
});

test("כמות בקר: 100 סועדים × 250 גרם + 5% רזרבה = 26.3 ק״ג", () => {
  const menu = [item(1, { beef_g: 250 })];
  const sel: MenuSelection[] = [{ course: "main", guest_group: "regular", menu_item_id: 1 }];
  const order = computeOrder(100, 0, 0, sel, menu);
  assert.equal(order.totals.beef_kg, 26.3); // 25,000 גרם × 1.05 = 26,250 → מעוגל למעלה
});

test("טבעונים מקבלים את המנה הטבעונית ולא נספרים בבקר", () => {
  const menu = [item(1, { beef_g: 250 }), item(2, { veg_g: 300, is_vegan: true })];
  const sel: MenuSelection[] = [
    { course: "main", guest_group: "regular", menu_item_id: 1 },
    { course: "main", guest_group: "vegan", menu_item_id: 2 },
  ];
  const order = computeOrder(100, 20, 0, sel, menu);
  assert.equal(order.totals.beef_kg, 21); // 80 × 250 = 20,000 → 21.0
  assert.equal(order.totals.veg_kg, 6.3); // 20 × 300 = 6,000 → 6.3
  assert.ok(!order.warnings.some((w) => w.includes("המנה העיקרית"))); // שאר השלבים לא נבחרו בבדיקה הזו
});

test("אין מנה לצליאק: סופרים את הרגילה ומתריעים", () => {
  const menu = [item(1, { fish_g: 200 })];
  const sel: MenuSelection[] = [{ course: "main", guest_group: "regular", menu_item_id: 1 }];
  const order = computeOrder(10, 0, 2, sel, menu);
  assert.equal(order.totals.fish_kg, 2.1); // 10 × 200 = 2,000 → 2.1
  assert.ok(order.warnings.some((w) => w.includes("ללא גלוטן")));
  assert.ok(order.lines.find((l) => l.course === "main" && l.group === "celiac")?.fellBackToRegular);
});

test("שלב בלי שום בחירה מופיע באזהרות", () => {
  const order = computeOrder(50, 0, 0, [], []);
  assert.ok(order.warnings.some((w) => w.includes("קבלת הפנים")));
});

// ---------- פירוט לפי רכיב ----------

const ing = (menu_item_id: number, category: "beef" | "poultry" | "fish" | "veg", ingredient: string, grams: number) =>
  ({ menu_item_id, category, ingredient, grams });

test("פירוט ירקות: אותו רכיב משתי מנות מתאחד לשורה אחת, מהגדול לקטן", () => {
  const menu = [
    item(1, { course: "first", veg_g: 120, menu_item_ingredients: [ing(1, "veg", "עגבניות שרי", 80), ing(1, "veg", "בצל סגול", 40)] }),
    item(2, { course: "main", beef_g: 250, veg_g: 100, menu_item_ingredients: [ing(2, "beef", "צלי כתף בקר", 250), ing(2, "veg", "עגבניות שרי", 100)] }),
  ];
  const sel: MenuSelection[] = [
    { course: "first", guest_group: "regular", menu_item_id: 1 },
    { course: "main", guest_group: "regular", menu_item_id: 2 },
  ];
  const order = computeOrder(100, 0, 0, sel, menu);
  // עגבניות שרי: 100 × (80 + 100) = 18,000 גרם × 1.05 = 18.9 ק"ג
  assert.deepEqual(order.breakdown.veg, [
    { ingredient: "עגבניות שרי", kg: 18.9 },
    { ingredient: "בצל סגול", kg: 4.2 },
  ]);
  assert.deepEqual(order.breakdown.beef, [{ ingredient: "צלי כתף בקר", kg: 26.3 }]);
  assert.deepEqual(order.breakdown.fish, []);
  assert.equal(order.totals.veg_kg, 23.1); // הסכום של הסוג לא השתנה בגלל הפירוט
});

test("מנה בלי פירוט, או עם פירוט חלקי: היתרה נספרת ב«לא מפורט» ומופיעה אחרונה", () => {
  const menu = [item(1, { veg_g: 100, menu_item_ingredients: [ing(1, "veg", "גזר", 70)] })];
  const sel: MenuSelection[] = [{ course: "main", guest_group: "regular", menu_item_id: 1 }];
  const order = computeOrder(10, 0, 0, sel, menu);
  assert.deepEqual(order.breakdown.veg, [
    { ingredient: "גזר", kg: 0.8 }, // 700 × 1.05 = 735 → 0.8
    { ingredient: "לא מפורט", kg: 0.4 }, // 300 × 1.05 = 315 → 0.4
  ]);
});

test("טבעונים: הפירוט מגיע מהמנה הטבעונית שלהם, לא מהרגילה", () => {
  const menu = [
    item(1, { poultry_g: 300, menu_item_ingredients: [ing(1, "poultry", "כרעי עוף", 300)] }),
    item(2, { veg_g: 300, is_vegan: true, menu_item_ingredients: [ing(2, "veg", "גרגרי חומוס", 300)] }),
  ];
  const sel: MenuSelection[] = [
    { course: "main", guest_group: "regular", menu_item_id: 1 },
    { course: "main", guest_group: "vegan", menu_item_id: 2 },
  ];
  const order = computeOrder(50, 10, 0, sel, menu);
  assert.deepEqual(order.breakdown.poultry, [{ ingredient: "כרעי עוף", kg: 12.6 }]); // 40 × 300 = 12,000 → 12.6
  assert.deepEqual(order.breakdown.veg, [{ ingredient: "גרגרי חומוס", kg: 3.2 }]); // 10 × 300 = 3,000 → 3.2
});

test("המייל לשף כולל את הפירוט מתחת לכל סוג", () => {
  const menu = [item(1, { fish_g: 200, menu_item_ingredients: [ing(1, "fish", "סלמון", 200)] })];
  const sel: MenuSelection[] = [{ course: "main", guest_group: "regular", menu_item_id: 1 }];
  const text = formatOrderText(computeOrder(10, 0, 0, sel, menu));
  assert.match(text, /דגים: 2\.1 ק"ג\n {2}- סלמון: 2\.1 ק"ג/);
});

// ---------- בדיקות טופס ההזמנה ----------

test("מוגבל ל-500 מוזמנים", () => {
  const d = { ...emptyDraft(), guest_count: 501 };
  assert.ok(validateGuestsStep(d).some((e) => e.includes("500")));
  assert.deepEqual(validateGuestsStep({ ...d, guest_count: 500 }), []);
});

test("טבעונים + צליאק לא יותר ממספר המוזמנים", () => {
  const d = { ...emptyDraft(), guest_count: 10, vegan_count: 8, celiac_count: 3 };
  assert.equal(validateGuestsStep(d).length, 1);
});

test("משבצת תפוסה נחסמת", () => {
  const booked = new Set(["2027-06-10:evening"]);
  const d = { ...emptyDraft(), event_date: "2027-06-10", time_slot: "evening" as const };
  assert.equal(validateSlotStep(d, booked).length, 1);
  assert.equal(validateSlotStep({ ...d, time_slot: "morning" }, booked).length, 0);
});

test("תאריך שתפוס בבוקר ובערב נחסם, ותאריך עבר נחסם", () => {
  const booked = new Set(["2027-06-10:evening", "2027-06-10:morning"]);
  assert.equal(validateDateStep({ ...emptyDraft(), event_date: "2027-06-10" }, "2027-01-01", booked).length, 1);
  assert.equal(validateDateStep({ ...emptyDraft(), event_date: "2026-01-01" }, "2027-01-01", new Set()).length, 1);
});

test("«אחר» דורש תיאור", () => {
  assert.equal(validateTypeStep({ ...emptyDraft(), event_type: "other" }).length, 1);
  assert.equal(validateTypeStep({ ...emptyDraft(), event_type: "other", event_type_other: "מסיבת פרישה" }).length, 0);
});

test("פרטי קשר: עד 3 טלפונים, ופורמט תקין", () => {
  const ok = { ...emptyDraft(), full_name: "דנה לוי", phones: ["050-1234567"], emails: ["dana@example.com"] };
  assert.deepEqual(validateContactStep(ok), []);
  assert.ok(validateContactStep({ ...ok, phones: ["1", "2", "3", "4"] }).length > 0);
  assert.ok(validateContactStep({ ...ok, emails: ["not-an-email"] }).some((e) => e.includes("מייל")));
});

// ---------- מנות לטעימה (progress/2026-11-08-0009-tasting-picks.md) ----------

// תפריט מוקטן לבדיקות: במנה העיקרית 5 רגילות (אחת טבעונית) ו-3 ללא גלוטן (אחת טבעונית), כמו בתפריט האמיתי
const mainMenu = [
  item(401), item(402), item(403), item(404, { is_vegan: true }), item(405),
  item(451, { diet: "celiac" }), item(452, { diet: "celiac" }), item(453, { diet: "celiac", is_vegan: true }),
  item(101, { course: "reception" }), item(105, { course: "reception", is_vegan: true }),
];

test("טעימה: 3 רגילות ו-2 ללא גלוטן; טבעוניות 2, או כמה שיש אם פחות", () => {
  assert.equal(requiredPicks(mainMenu, "main", "regular"), 3);
  assert.equal(requiredPicks(mainMenu, "main", "celiac"), 2);
  assert.equal(requiredPicks(mainMenu, "main", "vegan"), 2); // 404 ו-453
  assert.equal(requiredPicks(mainMenu, "reception", "vegan"), 1); // בקבלת הפנים יש רק 105
});

test("טעימה: השלב לא עובר בלי בדיוק הכמות, לכל קבוצה שיש בה סועדים", () => {
  const d = { ...emptyDraft(), vegan_count: 5, celiac_count: 2, tasting_picks: { main: { regular: [401, 402], celiac: [451, 452], vegan: [404, 453] } } };
  assert.deepEqual(requiredGroups(d), ["regular", "celiac", "vegan"]);
  assert.deepEqual(validateMenuStep(d, "main", mainMenu), ["יש לבחור 3 מנות רגילות לטעימה (נבחרו 2)"]);
  const ok = { ...d, tasting_picks: { main: { ...d.tasting_picks.main, regular: [401, 402, 403] } } };
  assert.deepEqual(validateMenuStep(ok, "main", mainMenu), []);
  // יותר מדי, מנה כפולה או מנה מהתפריט הלא נכון: לא עובר
  assert.equal(validateMenuStep({ ...ok, tasting_picks: { main: { ...ok.tasting_picks.main, regular: [401, 402, 403, 405] } } }, "main", mainMenu).length, 1);
  assert.equal(validateMenuStep({ ...ok, tasting_picks: { main: { ...ok.tasting_picks.main, regular: [401, 401, 402] } } }, "main", mainMenu).length, 1);
  assert.equal(validateMenuStep({ ...ok, tasting_picks: { main: { ...ok.tasting_picks.main, celiac: [451, 401] } } }, "main", mainMenu).length, 1);
});

test("טעימה: מספר הטועמים בין 2 ל-6", () => {
  assert.deepEqual(validateGuestsStep({ ...emptyDraft(), tasters: 2 }), []);
  assert.deepEqual(validateGuestsStep({ ...emptyDraft(), tasters: 6 }), []);
  assert.equal(validateGuestsStep({ ...emptyDraft(), tasters: 1 }).length, 1);
  assert.equal(validateGuestsStep({ ...emptyDraft(), tasters: 7 }).length, 1);
});

test("הזמנה לטעימה: חצי מנה לכל טועם מכל מנה, מנה שנבחרה פעמיים מוכנה פעם אחת", () => {
  const ing = (menu_item_id: number, category: "beef" | "poultry" | "fish" | "veg", ingredient: string, grams: number) =>
    ({ menu_item_id, category, ingredient, grams });
  const menu = [
    item(401, { beef_g: 250, veg_g: 150, menu_item_ingredients: [ing(401, "beef", "צלי כתף בקר", 250), ing(401, "veg", "תפוחי אדמה", 100), ing(401, "veg", "שעועית ירוקה", 50)] }),
    item(404, { is_vegan: true, veg_g: 300, menu_item_ingredients: [ing(404, "veg", "גרגרי חומוס", 300)] }),
  ];
  const picks: MenuSelection[] = [
    { course: "main", guest_group: "regular", menu_item_id: 401 },
    { course: "main", guest_group: "regular", menu_item_id: 404 },
    { course: "main", guest_group: "vegan", menu_item_id: 404 }, // אותה מנה גם לטבעונים: לא מכפילים
  ];
  const order = computeTastingOrder(4, picks, menu);
  assert.equal(order.dishes.length, 2);
  assert.deepEqual(order.dishes.find((d) => d.item.id === 404)?.groups, ["regular", "vegan"]);
  // 4 טועמים × חצי מנה = 2 מנות: בקר 500 גרם, ירקות (150 + 300) × 2 = 900 גרם
  assert.equal(order.totals.beef, 500);
  assert.equal(order.totals.veg, 900);
  assert.deepEqual(order.breakdown.veg, [
    { ingredient: "גרגרי חומוס", grams: 600 },
    { ingredient: "תפוחי אדמה", grams: 200 },
    { ingredient: "שעועית ירוקה", grams: 100 },
  ]);
  assert.equal(order.fromFinalMenu, false);
});

test("הזמנה לטעימה: מעגלים למעלה ל-10 גרם; אירוע ישן בלי מנות לטעימה מקבל את התפריט הסופי", () => {
  const menu = [item(205, { course: "first", fish_g: 80, veg_g: 5 })];
  const finalMenu: MenuSelection[] = [{ course: "first", guest_group: "regular", menu_item_id: 205 }];
  const order = computeTastingOrder(3, [], menu, finalMenu);
  assert.equal(order.fromFinalMenu, true);
  assert.equal(order.totals.fish, 120); // 3 × 0.5 × 80 = 120
  assert.equal(order.totals.veg, 10); // 7.5 → 10
  assert.deepEqual(order.breakdown.veg, [{ ingredient: "לא מפורט", grams: 10 }]);
});

test("לקוח חדש: צריך שם, טלפון תקין ומייל תקין", () => {
  const ok = { full_name: "רות כהן", phone: "050-1234567", email: "ruth@example.com" };
  assert.deepEqual(validateNewClient(ok), []);
  assert.equal(validateNewClient({ ...ok, full_name: " א " }).length, 1);
  assert.equal(validateNewClient({ ...ok, phone: "12345" }).length, 1);
  assert.equal(validateNewClient({ ...ok, email: "ruth@" }).length, 1);
  assert.equal(validateNewClient({ full_name: "", phone: "", email: "" }).length, 3);
});

// ---------- תאריכים ----------

test("חישובי תאריכים", () => {
  assert.equal(addDays("2026-12-30", 5), "2027-01-04");
  assert.equal(daysBetween("2026-11-03", "2026-11-08"), 5);
  assert.equal(todayInIsrael(new Date("2026-11-03T23:30:00Z")), "2026-11-04"); // כבר אחרי חצות בישראל
});

test("רשת חודש: נובמבר 2026 מתחיל ביום ראשון", () => {
  const weeks = monthGrid(2026, 10);
  assert.equal(weeks[0][0], "2026-11-01");
  assert.ok(weeks.every((w) => w.length === 7));
});

test("שעות פעילות: ראשון 10:00 כן, שישי 10:00 לא, ראשון 20:00 לא", () => {
  assert.equal(isBusinessHours(new Date("2026-11-01T08:00:00Z")), true); // ראשון 10:00 בישראל
  assert.equal(isBusinessHours(new Date("2026-11-06T08:00:00Z")), false); // שישי
  assert.equal(isBusinessHours(new Date("2026-11-01T18:00:00Z")), false); // ראשון 20:00
});

test("קישור יומן Google כולל את התאריך", () => {
  const url = googleCalendarLink({ title: "חתונה", dateIso: "2027-03-15", slot: "evening" });
  assert.ok(url.includes("20270315T190000"));
});

// ---------- הגבלת זמן באשף ----------

test("5 דקות בפרטים, 10 דקות בתפריט", () => {
  const sixMin = 6 * 60 * 1000;
  assert.equal(isExpired(0, sixMin, "details"), true);
  assert.equal(isExpired(0, sixMin, "menu"), false);
  assert.equal(isExpired(0, 11 * 60 * 1000, "menu"), true);
});
