// בדיקות תקינות לטופס הזמנת האירוע. אותן בדיקות רצות בדפדפן (משוב מיידי) ובשרת (אכיפה).
// המסד אוכף שוב את החשובות שבהן (500 מוזמנים, משבצת אחת לתאריך), כך שאין סמיכות על הדפדפן.

import type { Course, EventType, GuestGroup, MenuItem, TimeSlot } from "./types.ts";
import { COURSES, MAX_CONTACTS, MAX_GUESTS, MAX_TASTERS, MIN_TASTERS, TASTING_PICKS } from "./types.ts";

export interface BookingDraft {
  event_date: string; // YYYY-MM-DD
  time_slot: TimeSlot | "";
  event_type: EventType | "";
  event_type_other: string;
  title: string;
  guest_count: number;
  vegan_count: number;
  celiac_count: number;
  tasters: number; // כמה מגיעים לטעימה
  full_name: string;
  phones: string[];
  emails: string[];
  // מנות לטעימה: course → קבוצה → מזהי מנות (3 רגילות, 2 ללא גלוטן, 2 טבעוניות). התפריט הסופי נבחר אחרי הטעימה
  tasting_picks: Partial<Record<Course, Partial<Record<GuestGroup, number[]>>>>;
  tasting_slot_id: number | null;
  address: string;
  payment_method: string;
  deposit_confirmed: boolean;
}

export const emptyDraft = (): BookingDraft => ({
  event_date: "",
  time_slot: "",
  event_type: "",
  event_type_other: "",
  title: "",
  guest_count: 100,
  vegan_count: 0,
  celiac_count: 0,
  tasters: MIN_TASTERS,
  full_name: "",
  phones: [""],
  emails: [""],
  tasting_picks: {},
  tasting_slot_id: null,
  address: "",
  payment_method: "",
  deposit_confirmed: false,
});

const PHONE_RE = /^0\d{1,2}-?\d{7}$/; // 050-1234567 / 04-6123456
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidPhone = (p: string) => PHONE_RE.test(p.replace(/\s/g, ""));
export const isValidEmail = (e: string) => EMAIL_RE.test(e.trim());

/** האם התאריך עתידי (לפחות מחר) לפי תאריך הייחוס */
export function isFutureDate(dateIso: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateIso) && dateIso > today;
}

// כל פונקציה בודקת שלב אחד באשף ומחזירה רשימת שגיאות. רשימה ריקה = אפשר להמשיך.

export function validateDateStep(d: BookingDraft, today: string, booked: Set<string>): string[] {
  const errors: string[] = [];
  if (!isFutureDate(d.event_date, today)) errors.push("יש לבחור תאריך עתידי");
  if (booked.has(`${d.event_date}:morning`) && booked.has(`${d.event_date}:evening`))
    errors.push("התאריך תפוס בבוקר ובערב");
  return errors;
}

export function validateSlotStep(d: BookingDraft, booked: Set<string>): string[] {
  if (!d.time_slot) return ["יש לבחור בוקר או ערב"];
  if (booked.has(`${d.event_date}:${d.time_slot}`)) return ["המשבצת הזו כבר תפוסה"];
  return [];
}

export function validateTypeStep(d: BookingDraft): string[] {
  if (!d.event_type) return ["יש לבחור סוג אירוע"];
  if (d.event_type === "other" && d.event_type_other.trim().length < 2) return ["יש לתאר את האירוע ולתת לו שם"];
  return [];
}

export function validateGuestsStep(d: BookingDraft): string[] {
  const errors: string[] = [];
  const ints = [d.guest_count, d.vegan_count, d.celiac_count, d.tasters];
  if (ints.some((n) => !Number.isInteger(n) || n < 0)) return ["יש להזין מספרים שלמים"];
  if (d.guest_count < 1) errors.push("מספר המוזמנים חייב להיות לפחות 1");
  if (d.guest_count > MAX_GUESTS) errors.push(`האולם מוגבל ל-${MAX_GUESTS} מוזמנים`);
  if (d.vegan_count + d.celiac_count > d.guest_count) errors.push("סכום הטבעונים והצליאקים גדול ממספר המוזמנים");
  if (d.tasters < MIN_TASTERS || d.tasters > MAX_TASTERS) errors.push(`לטעימה מגיעים בין ${MIN_TASTERS} ל-${MAX_TASTERS} אנשים`);
  return errors;
}

export function validateContactStep(d: BookingDraft): string[] {
  const errors: string[] = [];
  if (d.full_name.trim().length < 2) errors.push("יש להזין שם מלא");
  const phones = d.phones.map((p) => p.trim()).filter(Boolean);
  const emails = d.emails.map((e) => e.trim()).filter(Boolean);
  if (phones.length === 0) errors.push("יש להזין לפחות טלפון אחד");
  if (emails.length === 0) errors.push("יש להזין לפחות מייל אחד");
  if (phones.length > MAX_CONTACTS || emails.length > MAX_CONTACTS) errors.push("אפשר עד 3 טלפונים ועד 3 מיילים");
  phones.filter((p) => !isValidPhone(p)).forEach((p) => errors.push(`מספר טלפון לא תקין: ${p}`));
  emails.filter((e) => !isValidEmail(e)).forEach((e) => errors.push(`כתובת מייל לא תקינה: ${e}`));
  return errors;
}

/** לקוח חדש שאיש מכירות מוסיף: שם, טלפון ומייל */
export function validateNewClient(c: { full_name: string; phone: string; email: string }): string[] {
  const errors: string[] = [];
  if (c.full_name.trim().length < 2) errors.push("יש להזין שם מלא");
  if (!isValidPhone(c.phone.trim())) errors.push("מספר הטלפון לא תקין");
  if (!isValidEmail(c.email)) errors.push("כתובת המייל לא תקינה");
  return errors;
}

/** אילו קבוצות סועדים צריכות בחירה בכל שלב: רגיל תמיד, ושאר הקבוצות רק אם יש בהן סועדים */
export function requiredGroups(d: Pick<BookingDraft, "vegan_count" | "celiac_count">): GuestGroup[] {
  const groups: GuestGroup[] = ["regular"];
  if (d.celiac_count > 0) groups.push("celiac");
  if (d.vegan_count > 0) groups.push("vegan");
  return groups;
}

/** המנות שאפשר לבחור לקבוצה בשלב: רגיל מהתפריט הרגיל, ללא גלוטן מהתפריט ללא גלוטן, טבעוני מכל מנה טבעונית */
export function menuOptions(items: MenuItem[], course: Course, group: GuestGroup): MenuItem[] {
  return items.filter((m) => m.course === course && (group === "vegan" ? m.is_vegan : m.diet === group));
}

/** כמה מנות צריך לבחור לטעימה: המספר הקבוע (3 או 2), או פחות אם בשלב אין מספיק מנות לקבוצה */
export function requiredPicks(items: MenuItem[], course: Course, group: GuestGroup): number {
  return Math.min(TASTING_PICKS[group], menuOptions(items, course, group).length);
}

/** בכל קבוצה נדרשת בדיוק הכמות. יותר מזה האשף לא מאפשר, והמסד חוסם */
export function validateMenuStep(d: BookingDraft, course: Course, items: MenuItem[]): string[] {
  const plural = { regular: "רגילות", celiac: "ללא גלוטן", vegan: "טבעוניות" };
  const single = { regular: "רגילה", celiac: "ללא גלוטן", vegan: "טבעונית" };
  return requiredGroups(d).flatMap((g) => {
    const need = requiredPicks(items, course, g);
    const ids = d.tasting_picks[course]?.[g] ?? [];
    // סופרים רק מזהים תקינים ושונים, כדי שטיוטה משובשת לא תעבור
    const valid = new Set(menuOptions(items, course, g).map((m) => m.id));
    const chosen = new Set(ids.filter((id) => valid.has(id))).size;
    if (chosen === need && ids.length === need) return [];
    return [need === 1 ? `יש לבחור מנה ${single[g]} לטעימה` : `יש לבחור ${need} מנות ${plural[g]} לטעימה (נבחרו ${chosen})`];
  });
}

export function validateTastingStep(d: BookingDraft): string[] {
  return d.tasting_slot_id ? [] : ["יש לבחור שעת טעימה"];
}

export function validateFinalStep(d: BookingDraft): string[] {
  const errors: string[] = [];
  if (d.full_name.trim().length < 2) errors.push("יש להזין שם מלא");
  if (d.address.trim().length < 4) errors.push("יש להזין כתובת");
  if (!d.payment_method) errors.push("יש לבחור אמצעי תשלום");
  if (!d.deposit_confirmed) errors.push("יש לאשר את תנאי המקדמה");
  return errors;
}

/**
 * בדיקה מלאה לפני שמירה בשרת.
 * requireTasting=false כשאין אף שעת טעימה פנויה: אז אפשר לסיים בלי טעימה ולקבוע אותה בהמשך.
 */
export function validateBooking(d: BookingDraft, today: string, booked: Set<string>, items: MenuItem[], requireTasting = true): string[] {
  return [
    ...validateDateStep(d, today, booked),
    ...validateSlotStep(d, booked),
    ...validateTypeStep(d),
    ...validateGuestsStep(d),
    ...validateContactStep(d),
    ...COURSES.flatMap((c) => validateMenuStep(d, c, items)),
    ...(requireTasting || d.tasting_slot_id ? validateTastingStep(d) : []),
    ...validateFinalStep(d),
  ];
}
