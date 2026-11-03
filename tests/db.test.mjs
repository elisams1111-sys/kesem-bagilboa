// בדיקות למסד הנתונים: המיגרציות, ההרשאות (RLS) והטריגרים, על Postgres אמיתי שרץ בזיכרון (PGlite).
// כאן נבדק מה שבאמת מגן על המידע: שלקוח לא רואה אירוע של לקוח אחר, שאי אפשר להזמין משבצת פעמיים, וכו'.
// הסביבה מחקה את Supabase: תפקידי anon/authenticated, טבלת auth.users ופונקציה auth.uid().
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();

// מזהים קבועים למשתמשי הבדיקה
const U = {
  dana: "11111111-1111-1111-1111-111111111111", // לקוחה
  yossi: "22222222-2222-2222-2222-222222222222", // לקוח אחר
  ronit: "33333333-3333-3333-3333-333333333333", // מנהלת אירועים
  yuval: "44444444-4444-4444-4444-444444444444", // שף
  ronen: "55555555-5555-5555-5555-555555555555", // מנהל כללי
};

/** מריץ שאילתה בשם משתמש מחובר, כמו ש-Supabase עושה עם JWT */
async function as(userId, sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(userId ? "set role authenticated" : "set role anon");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

/** שאילתה בהרשאות מלאות (כמו המפתח הסודי בשרת) */
async function admin(sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  return db.query(sql, params);
}

const futureDate = (days) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

before(async () => {
  // ---- מעטפת שמחקה את Supabase ----
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  // ---- המיגרציות של הפרויקט, בדיוק כמו שירוצו ב-Supabase ----
  await db.exec(readFileSync("supabase/migrations/0001_schema.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/0002_menu_seed.sql", "utf8"));

  // ---- משתמשים: ההרשמה יוצרת פרופיל דרך הטריגר ----
  for (const [name, id] of Object.entries(U)) {
    await admin(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
      id, `${name}@example.com`, JSON.stringify({ full_name: name, phones: ["050-1234567"] }),
    ]);
  }
  await admin(`update profiles set role = 'event_manager' where id = $1`, [U.ronit]);
  await admin(`update profiles set role = 'chef' where id = $1`, [U.yuval]);
  await admin(`update profiles set role = 'admin' where id = $1`, [U.ronen]);
});

test("ההרשמה יצרה פרופיל לקוח עם הטלפון והמייל", async () => {
  const { rows } = await admin(`select * from profiles where id = $1`, [U.dana]);
  assert.equal(rows[0].role, "client");
  assert.deepEqual(rows[0].phones, ["050-1234567"]);
  assert.deepEqual(rows[0].emails, ["dana@example.com"]);
});

test("נטענו 40 מנות (5 רגילות + 3 ללא גלוטן × 5 שלבים) מתיקיית התפריטים, ואורח יכול לקרוא אותן", async () => {
  const { rows } = await as(null, `select count(*)::int as n from menu_items`);
  assert.equal(rows[0].n, 40);
});

let danaEvent;

test("לקוחה פותחת אירוע לעצמה, ונרשמת שורת «האירוע נפתח»", async () => {
  const { rows } = await as(U.dana,
    `insert into events (client_id, event_type, event_date, time_slot, guest_count, vegan_count, celiac_count)
     values ($1, 'wedding', $2, 'evening', 200, 15, 3) returning id`, [U.dana, futureDate(60)]);
  danaEvent = rows[0].id;
  const log = await admin(`select summary from change_log where event_id = $1`, [danaEvent]);
  assert.match(log.rows[0].summary, /האירוע נפתח/);
});

test("לקוחה לא יכולה לפתוח אירוע על שם לקוח אחר", async () => {
  await assert.rejects(as(U.dana,
    `insert into events (client_id, event_type, event_date, time_slot, guest_count) values ($1, 'brit', $2, 'morning', 50)`,
    [U.yossi, futureDate(70)]));
});

test("אי אפשר להזמין את אותה משבצת פעמיים", async () => {
  await assert.rejects(
    as(U.yossi, `insert into events (client_id, event_type, event_date, time_slot, guest_count) values ($1, 'brit', $2, 'evening', 80)`,
      [U.yossi, futureDate(60)]),
    /events_one_per_slot|duplicate/);
});

test("יותר מ-500 מוזמנים נחסם במסד", async () => {
  await assert.rejects(as(U.yossi,
    `insert into events (client_id, event_type, event_date, time_slot, guest_count) values ($1, 'brit', $2, 'morning', 501)`,
    [U.yossi, futureDate(61)]));
});

test("לקוח אחר לא רואה את האירוע, אבל רואה שהמשבצת תפוסה", async () => {
  const seen = await as(U.yossi, `select id from events where id = $1`, [danaEvent]);
  assert.equal(seen.rows.length, 0);
  const slots = await as(U.yossi, `select * from booked_slots($1, $2)`, [futureDate(59), futureDate(61)]);
  assert.equal(slots.rows.length, 1);
  assert.deepEqual(Object.keys(slots.rows[0]).sort(), ["event_date", "time_slot"]); // בלי פרטי לקוח
});

test("הצוות רואה את האירוע", async () => {
  for (const id of [U.ronit, U.yuval, U.ronen]) {
    const { rows } = await as(id, `select id from events where id = $1`, [danaEvent]);
    assert.equal(rows.length, 1);
  }
});

test("עדכון של הלקוחה נרשם ביומן השינויים עם שם השדה בעברית", async () => {
  await as(U.dana, `update events set table_design = 'פרחים לבנים' where id = $1`, [danaEvent]);
  const { rows } = await as(U.dana, `select summary, changed_by from change_log where event_id = $1 and field = 'table_design'`, [danaEvent]);
  assert.match(rows[0].summary, /עיצוב שולחנות/);
  assert.match(rows[0].summary, /פרחים לבנים/);
  assert.equal(rows[0].changed_by, U.dana);
});

test("לקוחה לא משנה סטטוס או תאריך בעצמה", async () => {
  await assert.rejects(as(U.dana, `update events set status = 'completed' where id = $1`, [danaEvent]));
  await assert.rejects(as(U.dana, `update events set event_date = $2 where id = $1`, [danaEvent, futureDate(90)]));
});

test("לקוחה לא משנה את התפקיד של עצמה", async () => {
  await assert.rejects(as(U.dana, `update profiles set role = 'admin' where id = $1`, [U.dana]), /מנהל כללי/);
});

test("השף קורא אירועים אבל לא עורך", async () => {
  const res = await as(U.yuval, `update events set guest_count = 10 where id = $1 returning id`, [danaEvent]);
  assert.equal(res.rows.length, 0); // RLS מסנן: אין שורות שמותר לו לעדכן
});

test("לקוח לא רואה את הדואר היוצא, מנהלת האירועים כן", async () => {
  await admin(`insert into notifications (kind, recipient_email, subject, body) values ('test', 'x@example.com', 's', 'b')`);
  assert.equal((await as(U.dana, `select * from notifications`)).rows.length, 0);
  assert.equal((await as(U.ronit, `select * from notifications`)).rows.length, 1);
});

test("קביעת טעימה: תופסת שעה פנויה, מעדכנת סטטוס, וחוסמת לקוח אחר", async () => {
  const { rows } = await as(U.ronit, `insert into tasting_slots (starts_at) values (now() + interval '10 days') returning id`);
  const slot = rows[0].id;
  await as(U.dana, `select book_tasting($1, $2)`, [slot, danaEvent]);
  const ev = await admin(`select status from events where id = $1`, [danaEvent]);
  assert.equal(ev.rows[0].status, "tasting_scheduled");

  const yossiEvent = (await as(U.yossi,
    `insert into events (client_id, event_type, event_date, time_slot, guest_count) values ($1, 'birthday', $2, 'morning', 40) returning id`,
    [U.yossi, futureDate(80)])).rows[0].id;
  await assert.rejects(as(U.yossi, `select book_tasting($1, $2)`, [slot, yossiEvent]), /נתפסה/);
  // ולקוח לא יכול לקבוע טעימה לאירוע של מישהו אחר
  await assert.rejects(as(U.yossi, `select book_tasting($1, $2)`, [slot, danaEvent]), /הרשאה/);
});

test("פחות מ-5 ימים לפני האירוע: לקוח לא משנה מספר סועדים, מנהלת האירועים כן", async () => {
  const soon = (await as(U.dana,
    `insert into events (client_id, event_type, event_date, time_slot, guest_count) values ($1, 'birthday', $2, 'morning', 40) returning id`,
    [U.dana, futureDate(3)])).rows[0].id;
  await assert.rejects(as(U.dana, `update events set vegan_count = 5 where id = $1`, [soon]), /5 ימים/);
  await as(U.dana, `update events set table_design = 'בלונים' where id = $1`, [soon]); // שדה אחר מותר
  const ok = await as(U.ronit, `update events set vegan_count = 5 where id = $1 returning vegan_count`, [soon]);
  assert.equal(ok.rows[0].vegan_count, 5);
});

test("בקשה «דורשת טיפול» נפתחת רק על אירוע שהמשתמש רואה", async () => {
  await as(U.dana, `insert into change_log (event_id, changed_by, source, summary, needs_attention) values ($1, $2, 'agent', 'בקשה', true)`,
    [danaEvent, U.dana]);
  await assert.rejects(as(U.yossi,
    `insert into change_log (event_id, changed_by, source, summary, needs_attention) values ($1, $2, 'agent', 'בקשה', true)`,
    [danaEvent, U.yossi]));
});
