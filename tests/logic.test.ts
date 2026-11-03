// בדיקות ללוגיקה הטהורה: חישוב כמויות, בדיקות טופס, תאריכים והגבלת זמן.
// הרצה: npm test   (Node 24 מריץ TypeScript ישירות)
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeOrder, splitGuests } from "../src/lib/quantities.ts";
import type { MenuItem, MenuSelection } from "../src/lib/types.ts";
import {
  emptyDraft, requiredGroups, validateContactStep, validateGuestsStep, validateMenuStep,
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

test("תפריט: צריך בחירה לכל קבוצה שיש בה סועדים", () => {
  const d = { ...emptyDraft(), vegan_count: 5, celiac_count: 0, menu: { main: { regular: 401 } } };
  assert.deepEqual(requiredGroups(d), ["regular", "vegan"]);
  assert.equal(validateMenuStep(d, "main").length, 1);
  assert.equal(validateMenuStep({ ...d, menu: { main: { regular: 401, vegan: 404 } } }, "main").length, 0);
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
