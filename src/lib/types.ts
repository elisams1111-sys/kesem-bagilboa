// טיפוסים ותוויות בעברית שמשותפים לכל האפליקציה.
// הקובץ טהור (בלי React ובלי Supabase) כדי שגם הבדיקות ב-Node יוכלו לטעון אותו.

export type UserRole = "client" | "sales" | "event_manager" | "chef" | "admin";
export type EventType = "wedding" | "bar_mitzvah" | "bat_mitzvah" | "brit" | "birthday" | "business" | "other";
export type TimeSlot = "morning" | "evening";
export type EventStatus = "booked" | "tasting_scheduled" | "menu_final" | "completed" | "cancelled";
export type Course = "reception" | "first" | "intermediate" | "main" | "dessert";
export type MenuDiet = "regular" | "celiac";
export type GuestGroup = "regular" | "celiac" | "vegan";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phones: string[];
  emails: string[];
  address: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  client_id: string;
  sales_rep_id: string | null;
  title: string;
  event_type: EventType;
  event_type_other: string | null;
  event_date: string; // YYYY-MM-DD
  time_slot: TimeSlot;
  guest_count: number;
  vegan_count: number;
  celiac_count: number;
  table_design: string | null;
  chuppah_song_url: string | null;
  slideshow_time: string | null;
  slideshow_folder_url: string | null;
  special_requests: string | null;
  payment_method: string | null;
  deposit_confirmed: boolean;
  status: EventStatus;
  last_change_source: "app" | "agent" | "system";
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: number;
  course: Course;
  diet: MenuDiet;
  option_no: number;
  title: string;
  description: string;
  is_vegan: boolean;
  beef_g: number;
  poultry_g: number;
  fish_g: number;
  veg_g: number;
}

export interface MenuSelection {
  event_id?: string;
  course: Course;
  guest_group: GuestGroup;
  menu_item_id: number;
}

export interface TastingSlot {
  id: number;
  starts_at: string;
  event_id: string | null;
}

export interface ChangeLogRow {
  id: number;
  event_id: string;
  changed_by: string | null;
  source: "app" | "agent" | "system";
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  summary: string;
  needs_attention: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: number;
  event_id: string | null;
  kind: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: "sent" | "logged" | "failed";
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

// ---------- תוויות בעברית ----------

export const ROLE_LABELS: Record<UserRole, string> = {
  client: "לקוח",
  sales: "איש מכירות",
  event_manager: "מנהלת אירועים",
  chef: "שף",
  admin: "מנהל כללי",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "חתונה",
  bar_mitzvah: "בר מצווה",
  bat_mitzvah: "בת מצווה",
  brit: "ברית",
  birthday: "יום הולדת",
  business: "אירוע עסקי",
  other: "אחר",
};

export const SLOT_LABELS: Record<TimeSlot, string> = { morning: "בוקר", evening: "ערב" };

export const STATUS_LABELS: Record<EventStatus, string> = {
  booked: "נסגר",
  tasting_scheduled: "נקבעה טעימה",
  menu_final: "תפריט סופי",
  completed: "התקיים",
  cancelled: "בוטל",
};

// סדר השלבים בתפריט, כמו בתרשים הזרימה
export const COURSES: Course[] = ["reception", "first", "intermediate", "main", "dessert"];

export const COURSE_LABELS: Record<Course, string> = {
  reception: "קבלת פנים",
  first: "מנה ראשונה",
  intermediate: "מנת ביניים",
  main: "מנה עיקרית",
  dessert: "קינוחים",
};

export const GROUP_LABELS: Record<GuestGroup, string> = {
  regular: "רגיל",
  celiac: "ללא גלוטן",
  vegan: "טבעוני/צמחוני",
};

export const STAFF_ROLES: UserRole[] = ["sales", "event_manager", "chef", "admin"];
export const MAX_GUESTS = 500;
export const MAX_CONTACTS = 3;
