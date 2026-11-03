// הגבלת זמן בלי פעולה באשף ההזמנה, לפי תרשים הזרימה:
// בשלבי פרטי האירוע הטיוטה נשמרת עד 5 דקות בלי פעולה, ובשלבי התפריט עד 10 דקות.
// אחרי זה הטיוטה נמחקת והאשף חוזר להתחלה. כאן רק החישוב הטהור; הטיימר עצמו נמצא בקומפוננטה.

export const DETAILS_TIMEOUT_MS = 5 * 60 * 1000;
export const MENU_TIMEOUT_MS = 10 * 60 * 1000;

export type StepKind = "details" | "menu" | "tasting" | "final";

export function timeoutFor(kind: StepKind): number {
  // שלבי הטעימה והסיום ממשיכים את מגבלת התפריט (10 דקות), כמו בתרשים
  return kind === "details" ? DETAILS_TIMEOUT_MS : MENU_TIMEOUT_MS;
}

export function isExpired(lastActivityMs: number, nowMs: number, kind: StepKind): boolean {
  return nowMs - lastActivityMs > timeoutFor(kind);
}
