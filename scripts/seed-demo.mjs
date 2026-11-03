// נתוני דמו להצגה בכיתה: משתמשים לכל תפקיד, אירועים, תפריטים, טעימות, שינויים ושיחה עם העוזר.
// הרצה (אחרי המיגרציות, עם .env.local מלא):  npm run seed
// אפשר להריץ שוב: הסקריפט מוחק את האירועים של לקוחות הדמו ויוצר אותם מחדש, ולא נוגע במשתמשים אמיתיים.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("חסרים NEXT_PUBLIC_SUPABASE_URL או SUPABASE_SECRET_KEY בקובץ .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
/** עוצר את הסקריפט אם פעולה במסד נכשלה, במקום להמשיך בשקט */
function must(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res;
}
const PASSWORD = process.env.DEMO_PASSWORD || "Kesem2026!";

// ---------- תאריכים ----------
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const plusDays = (n) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** שעה בישראל → ISO ב-UTC */
const israelTime = (date, hhmm) => {
  const guess = new Date(`${date}T${hhmm}:00Z`);
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hour: "numeric", hourCycle: "h23" }).format(guess));
  return new Date(guess.getTime() - (((h - guess.getUTCHours()) + 24) % 24) * 3_600_000).toISOString();
};

// ---------- משתמשים ----------
const USERS = [
  { key: "ronen", email: "ronen.kesem@example.com", full_name: "רונן כהן", role: "admin", phone: "050-1111111" },
  { key: "ronit", email: "ronit.kesem@example.com", full_name: "רונית לוי", role: "event_manager", phone: "050-2222222" },
  { key: "yuval", email: "yuval.kesem@example.com", full_name: "שף יובל מזרחי", role: "chef", phone: "050-3333333" },
  { key: "avi", email: "avi.kesem@example.com", full_name: "אבי פרץ", role: "sales", phone: "050-4444444" },
  { key: "dana", email: "dana.client@example.com", full_name: "דנה אברהם", role: "client", phone: "052-5555555" },
  { key: "yossi", email: "yossi.client@example.com", full_name: "יוסי ושרה גולן", role: "client", phone: "054-6666666" },
  { key: "noa", email: "noa.client@example.com", full_name: "נועה ברק", role: "client", phone: "053-7777777" },
];

async function ensureUser(u) {
  const { data: created, error } = await db.auth.admin.createUser({
    email: u.email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: u.full_name, phones: [u.phone] },
  });
  let id = created?.user?.id;
  if (error) {
    // המשתמש כבר קיים: מחפשים אותו
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    id = list.users.find((x) => x.email === u.email)?.id;
    if (!id) throw error;
  }
  await db.from("profiles").update({ role: u.role, full_name: u.full_name, phones: [u.phone], emails: [u.email] }).eq("id", id);
  return id;
}

const ids = {};
for (const u of USERS) {
  ids[u.key] = await ensureUser(u);
  console.log(`✓ ${u.role.padEnd(13)} ${u.email}`);
}

// ---------- שעות טעימה: ראשון–חמישי, 3 שעות ביום, 30 ימים קדימה ----------
const slots = [];
for (let i = 1; i <= 30; i++) {
  const date = plusDays(i);
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (dow > 4) continue; // שישי ושבת
  for (const t of ["17:00", "18:00", "19:00"]) slots.push({ starts_at: israelTime(date, t) });
}
must(await db.from("tasting_slots").upsert(slots, { onConflict: "starts_at", ignoreDuplicates: true }), "tasting_slots");
console.log(`✓ ${slots.length} שעות טעימה`);

// ---------- אירועים ----------
const clientIds = [ids.dana, ids.yossi, ids.noa];
must(await db.from("events").delete().in("client_id", clientIds), "delete events");

const EVENTS = [
  {
    key: "dana", client_id: ids.dana, sales_rep_id: ids.avi, title: "החתונה של דנה ויואב", event_type: "wedding",
    event_date: plusDays(4), time_slot: "evening", guest_count: 220, vegan_count: 18, celiac_count: 4,
    table_design: "מפות שמנת, פרחים לבנים ואקליפטוס, נרות נמוכים בכל שולחן",
    chuppah_song_url: "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv",
    slideshow_time: "אחרי המנה העיקרית, בערך 22:15", slideshow_folder_url: "https://drive.google.com/drive/folders/demo-dana-yoav",
    special_requests: "שולחן 12: סבתא בכיסא גלגלים, צריך גישה נוחה", payment_method: "bank_transfer", deposit_confirmed: true, status: "menu_final",
    menu: { reception: { regular: 101, celiac: 151, vegan: 105 }, first: { regular: 201, celiac: 252, vegan: 204 }, intermediate: { regular: 304, celiac: 351, vegan: 302 }, main: { regular: 401, celiac: 451, vegan: 404 }, dessert: { regular: 503, celiac: 551, vegan: 505 } },
  },
  {
    key: "yossi", client_id: ids.yossi, sales_rep_id: ids.avi, title: "בר המצווה של איתי", event_type: "bar_mitzvah",
    event_date: plusDays(20), time_slot: "morning", guest_count: 150, vegan_count: 6, celiac_count: 2,
    table_design: "כחול ולבן, מרכזי שולחן עם תמונות של איתי", slideshow_time: "אחרי ברכת הבר מצווה",
    payment_method: "credit_card", deposit_confirmed: true, status: "booked",
    menu: { reception: { regular: 102, celiac: 153, vegan: 105 }, first: { regular: 205, celiac: 252, vegan: 204 }, intermediate: { regular: 303, celiac: 353, vegan: 302 }, main: { regular: 402, celiac: 452, vegan: 404 }, dessert: { regular: 501, celiac: 553, vegan: 505 } },
    tastingInDays: 3,
  },
  {
    key: "noa", client_id: ids.noa, sales_rep_id: null, title: "כנס לקוחות שנתי – ברק טכנולוגיות", event_type: "business",
    event_date: plusDays(9), time_slot: "morning", guest_count: 320, vegan_count: 40, celiac_count: 12,
    special_requests: "במה עם מקרן, 4 מיקרופונים אלחוטיים", payment_method: "bank_transfer", deposit_confirmed: false, status: "tasting_scheduled",
    menu: { reception: { regular: 104, celiac: 151, vegan: 105 }, first: { regular: 202, celiac: 251, vegan: 204 }, intermediate: { regular: 305, celiac: 351, vegan: 352 }, main: { regular: 403, celiac: 452, vegan: 453 }, dessert: { regular: 504, celiac: 552, vegan: 505 } },
  },
  {
    key: "dana2", client_id: ids.dana, title: "יום הולדת 60 לאבא", event_type: "birthday",
    event_date: plusDays(45), time_slot: "evening", guest_count: 80, vegan_count: 0, celiac_count: 1,
    payment_method: "check", deposit_confirmed: true, status: "booked",
    menu: { reception: { regular: 103, celiac: 152 }, first: { regular: 203, celiac: 253 }, intermediate: { regular: 301, celiac: 351 }, main: { regular: 405, celiac: 451 }, dessert: { regular: 502, celiac: 553 } },
  },
  {
    key: "yossi2", client_id: ids.yossi, title: "ברית לנכד", event_type: "brit",
    event_date: plusDays(12), time_slot: "morning", guest_count: 90, vegan_count: 5, celiac_count: 0,
    payment_method: "credit_card", deposit_confirmed: true, status: "booked",
    menu: { reception: { regular: 101, vegan: 105 }, first: { regular: 202, vegan: 204 }, intermediate: { regular: 301, vegan: 302 }, main: { regular: 403, vegan: 404 }, dessert: { regular: 504, vegan: 505 } },
  },
];

const eventIds = {};
for (const e of EVENTS) {
  const { key, menu, tastingInDays, ...row } = e;
  const { data, error } = await db.from("events").insert({ ...row, last_change_source: "system" }).select("id").single();
  if (error) throw new Error(`${key}: ${error.message}`);
  eventIds[key] = data.id;
  const selections = Object.entries(menu).flatMap(([course, groups]) =>
    Object.entries(groups).map(([guest_group, menu_item_id]) => ({ event_id: data.id, course, guest_group, menu_item_id })));
  must(await db.from("event_menu_selections").insert(selections), `menu ${key}`);
  if (tastingInDays) {
    const { data: slot } = await db.from("tasting_slots").select("id").is("event_id", null)
      .gte("starts_at", israelTime(plusDays(tastingInDays), "00:00")).order("starts_at").limit(1).single();
    if (slot) {
      await db.from("tasting_slots").update({ event_id: data.id }).eq("id", slot.id);
      await db.from("events").update({ status: "tasting_scheduled", last_change_source: "system" }).eq("id", data.id);
    }
  }
  console.log(`✓ אירוע: ${row.title} (${row.event_date})`);
}

// ---------- יומן שינויים: שינויים «אמיתיים» מהשבועות האחרונים ----------
const ago = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();
// כל השורות עם אותם שדות: בהכנסה מרובה, שדה חסר נשלח כ-null ולא מקבל את ברירת המחדל
const logRow = (r) => ({ field: null, old_value: null, new_value: null, needs_attention: false, ...r });
must(await db.from("change_log").insert([
  { event_id: eventIds.dana, changed_by: ids.dana, source: "agent", field: "table_design", old_value: "פרחים סגולים", new_value: "פרחים לבנים ואקליפטוס",
    summary: "עיצוב שולחנות: «מפות שמנת, פרחים סגולים» ← «מפות שמנת, פרחים לבנים ואקליפטוס, נרות נמוכים בכל שולחן»", created_at: ago(30) },
  { event_id: eventIds.dana, changed_by: ids.dana, source: "app", field: "vegan_count", old_value: "15", new_value: "18",
    summary: "טבעונים/צמחונים: «15» ← «18»", created_at: ago(20) },
  { event_id: eventIds.dana, changed_by: ids.dana, source: "agent", summary: "בקשה מדנה אברהם: אפשר להקדים את החופה ל-19:30 במקום 20:00?", needs_attention: true, created_at: ago(5) },
  { event_id: eventIds.yossi, changed_by: ids.yossi, source: "app", field: "slideshow_time", old_value: null, new_value: "אחרי ברכת הבר מצווה",
    summary: "שעת המצגת: «—» ← «אחרי ברכת הבר מצווה»", created_at: ago(10) },
  { event_id: eventIds.noa, changed_by: ids.noa, source: "agent", summary: "בקשה מנועה ברק: צריך חשבונית מס על שם החברה לפני התשלום", needs_attention: true, created_at: ago(26) },
  { event_id: eventIds.noa, changed_by: ids.ronit, source: "app", field: "guest_count", old_value: "300", new_value: "320",
    summary: "מספר מוזמנים: «300» ← «320»", created_at: ago(48) },
].map(logRow)), "change_log");
console.log("✓ יומן שינויים");

// ---------- שיחה לדוגמה עם עוזר האירוע ----------
await db.from("agent_messages").delete().in("user_id", clientIds);
must(await db.from("agent_messages").insert([
  { event_id: eventIds.dana, user_id: ids.dana, role: "user", content: "היי! החלפנו את הפרחים הסגולים בלבנים עם אקליפטוס", created_at: ago(30.1) },
  { event_id: eventIds.dana, user_id: ids.dana, role: "assistant", content: "מעולה! עדכנתי בתיק האירוע: פרחים לבנים ואקליפטוס במקום סגולים. רונית תראה את זה בסיכום השינויים. משהו נוסף?", created_at: ago(30) },
  { event_id: eventIds.dana, user_id: ids.dana, role: "user", content: "אפשר להקדים את החופה ל-19:30?", created_at: ago(5.1) },
  { event_id: eventIds.dana, user_id: ids.dana, role: "assistant", content: "שינוי בשעת החופה דורש תיאום עם הצוות, אז העברתי את הבקשה למנהלת האירוע. נחזור אליכם בשעות הפעילות.", created_at: ago(5) },
]), "agent_messages");
console.log("✓ שיחה עם העוזר");

console.log(`\nסיסמה לכל משתמשי הדמו: ${PASSWORD}`);
