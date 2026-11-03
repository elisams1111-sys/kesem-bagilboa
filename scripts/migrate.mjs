// מריץ את קובצי ה-SQL שב-supabase/migrations על מסד הנתונים, לפי הסדר, כל קובץ פעם אחת בלבד.
// הרצה: npm run migrate   (קורא POSTGRES_URL_NON_POOLING מ-.env.local, שנוצר ע"י vercel env pull)
// אילו קבצים כבר רצו נשמר בטבלה app_private.schema_migrations, מחוץ לסכמה public כדי שלא תיחשף ב-API.
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const raw = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!raw) {
  console.error("חסר POSTGRES_URL_NON_POOLING ב-.env.local");
  process.exit(1);
}
// Supabase דורש SSL. מאמתים את השרת מול תעודת השורש הרשמית של Supabase (supabase/certs),
// כי השרתים שלהם חתומים ב-CA משלהם ולא ב-CA ציבורי. ה-SSL מוגדר כאן, ולכן מסירים את sslmode מהכתובת.
const url = new URL(raw);
url.searchParams.delete("sslmode");
url.searchParams.delete("supa");
const ca = readFileSync("supabase/certs/prod-ca-2021.crt", "utf8");
const client = new pg.Client({ connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } });
await client.connect();

await client.query(`
  create schema if not exists app_private;
  create table if not exists app_private.schema_migrations (name text primary key, applied_at timestamptz not null default now());
`);
const { rows } = await client.query("select name from app_private.schema_migrations");
const done = new Set(rows.map((r) => r.name));

const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  if (done.has(file)) {
    console.log(`- ${file} (כבר רץ)`);
    continue;
  }
  const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
  try {
    // כל קובץ בטרנזקציה: או שהכל נכנס, או שלא נכנס כלום
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into app_private.schema_migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log(`✓ ${file}`);
  } catch (err) {
    await client.query("rollback");
    console.error(`✗ ${file}: ${err.message}`);
    process.exit(1);
  }
}
await client.end();
