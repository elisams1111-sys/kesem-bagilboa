// בדיקות תקינות לטופס הזמנת האירוע. אותן בדיקות רצות בדפדפן (משוב מיידי) ובשרת (אכיפה).
// המסד אוכף שוב את החשובות שבהן (500 מוזמנים, משבצת אחת לתאריך), כך שאין סמיכות על הדפדפן.

import type { Course, EventType, GuestGroup, TimeSlot } from "./types.ts";
import { COURSES, MAX_CONTACTS, MAX_GUESTS } from "./types.ts";

export interface BookingDraft {
  event_date: string; // YYYY-MM-DD
  time_slot: TimeSlot | "";
  event_type: EventType | "";
  event_type_other: string;
  title: string;
  guest_count: number;
  vegan_count: number;
  celiac_count: number;
  full_name: string;
  phones: string[];
  emails: string[];
  // בחירת תפריט: course → קבוצה → מזהה מנה
  menu: Partial<Record<Course, Partial<Record<GuestGroup, number>>>>;
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
  full_name: "",
  phones: [""],
  emails: [""],
  menu: {},
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
  const ints = [d.guest_count, d.vegan_count, d.celiac_count];
  if (ints.some((n) => !Number.isInteger(n) || n < 0)) return ["יש להזין מספרים שלמים"];
  if (d.guest_count < 1) errors.push("מספר המוזמנים חייב להיות לפחות 1");
  if (d.guest_count > MAX_GUESTS) errors.push(`האולם מוגבל ל-${MAX_GUESTS} מוזמנים`);
  if (d.vegan_count + d.celiac_count > d.guest_count) errors.push("סכום הטבעונים והצליאקים גדול ממספר המוזמנים");
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

/** אילו קבוצות סועדים צריכות בחירה בכל שלב: רגיל תמיד, ושאר הקבוצות רק אם יש בהן סועדים */
export function requiredGroups(d: Pick<BookingDraft, "vegan_count" | "celiac_count">): GuestGroup[] {
  const groups: GuestGroup[] = ["regular"];
  if (d.celiac_count > 0) groups.push("celiac");
  if (d.vegan_count > 0) groups.push("vegan");
  return groups;
}

export function validateMenuStep(d: BookingDraft, course: Course): string[] {
  const chosen = d.menu[course] ?? {};
  const missing = requiredGroups(d).filter((g) => !chosen[g]);
  if (missing.length === 0) return [];
  const names = { regular: "רגילה", celiac: "ללא גלוטן", vegan: "טבעונית" };
  return missing.map((g) => `יש לבחור מנה ${names[g]}`);
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

/** בדיקה מלאה לפני שמירה בשרת */
export function validateBooking(d: BookingDraft, today: string, booked: Set<string>): string[] {
  return [
    ...validateDateStep(d, today, booked),
    ...validateSlotStep(d, booked),
    ...validateTypeStep(d),
    ...validateGuestsStep(d),
    ...validateContactStep(d),
    ...COURSES.flatMap((c) => validateMenuStep(d, c)),
    ...validateTastingStep(d),
    ...validateFinalStep(d),
  ];
}
