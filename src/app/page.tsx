// דף הנחיתה: מסביר את הבעיה והפתרון ומוביל להרשמה או להתחברות (docs/spec.md §6)
import Link from "next/link";
import { Logo } from "@/components/ui";
import { getCurrentProfile, homeFor } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const STEPS = [
  { n: "1", title: "בוחרים תאריך", text: "יומן זמינות חי: רואים מיד אילו ימים פנויים בבוקר ובערב." },
  { n: "2", title: "מרכיבים תפריט", text: "חמישה שלבים, מנות רגילות, ללא גלוטן וטבעוניות, מהתפריטים של השף." },
  { n: "3", title: "קובעים טעימה", text: "בוחרים שעה פנויה, והשף ומנהלת האירוע מקבלים מייל באותו רגע." },
  { n: "4", title: "מעדכנים עד האירוע", text: "כל שינוי נרשם בתיק, וכל בעל תפקיד מקבל את מה שהוא צריך לדעת." },
];

const ROLES = [
  {
    who: "לזוג ולבעלי האירוע",
    points: ["אזור אישי עם כל מה שסוכם", "עוזר AI שזמין גם בעשר בלילה", "היסטוריית שינויים, בלי לרדוף אחרי אף אחד"],
  },
  {
    who: "למנהלת האירועים",
    points: ["כל הפרטים של כל זוג במקום אחד", "סיכום שינויים יומי במייל", "תור «דורש טיפול» עם תזכורות עד שמטפלים"],
  },
  {
    who: "לשף",
    points: ["מייל 5 ימים לפני כל אירוע", "חישוב כמויות בשר, עוף, דגים וירקות", "מספר טבעונים וצליאק מעודכן, לא דף מודפס"],
  },
  {
    who: "להנהלה",
    points: ["תמונת מצב של כל האירועים בזמן אמת", "מייל על כל אירוע שנסגר ובבוקר האירוע", "קישור ישיר ליומן Google"],
  },
];

const TESTIMONIALS = [
  { quote: "פעם ראשונה שאני יודע בכל רגע מה המצב של כל אירוע, בלי להתקשר לאף אחד.", who: "רונן", role: "בעלים ומנכ\"ל" },
  { quote: "השינויים של הזוגות כבר לא נופלים בין הכיסאות. בבוקר אני מקבלת סיכום אחד, וזהו.", who: "רונית", role: "מנהלת אירועים" },
  { quote: "חמישה ימים לפני כל אירוע יש לי מספרים מדויקים להזמנה. זורקים הרבה פחות לפח.", who: "שף יובל", role: "שף ראשי" },
];

const FAQ = [
  { q: "צריך להתקין משהו?", a: "לא. המערכת עובדת בדפדפן, במחשב ובנייד. כל משתמש נכנס עם מייל וסיסמה." },
  { q: "מה קורה אם שולחים שינוי באמצע הלילה?", a: "עוזר האירוע מקבל את הבקשה מיד. שינוי פשוט (עיצוב, שיר, מצגת) נרשם בתיק. בקשה שדורשת החלטה של הצוות מועברת למנהלת האירוע, ותקבלו מענה בשעות הפעילות." },
  { q: "אפשר לשנות את מספר הטבעונים או הצליאקים?", a: "כן, עד 5 ימים לפני האירוע, ישירות מהאזור האישי. אחרי זה השף כבר הזמין חומרי גלם, ולכן השינוי עובר דרך מנהלת האירוע." },
  { q: "מי רואה את הפרטים שלי?", a: "רק אתם וצוות האולם. לקוחות אחרים לא רואים שום פרט על האירוע שלכם, אפילו לא את השם. ההרשאות נאכפות במסד הנתונים עצמו." },
  { q: "האם המערכת שומרת את פרטי האשראי?", a: "לא. המערכת שומרת רק את אמצעי התשלום שבחרתם ואישור מקדמה, ואף פעם לא מספר כרטיס." },
];

export default async function LandingPage() {
  const profile = isSupabaseConfigured() ? await getCurrentProfile() : null;

  return (
    <div>
      {/* ---------- כותרת וגיבור ---------- */}
      <header className="relative overflow-hidden bg-brand-dark text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 15% 20%, rgba(184,145,63,.55), transparent 40%), radial-gradient(circle at 85% 70%, rgba(231,239,233,.25), transparent 45%)",
          }}
        />
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Logo light />
          <div className="flex gap-2">
            {profile ? (
              <Link href={homeFor(profile.role)} className="btn-gold">לאזור שלי</Link>
            ) : (
              <>
                <Link href="/login" className="btn border border-white/30 text-white hover:bg-white/10">התחברות</Link>
                <Link href="/signup" className="btn-gold">הרשמה</Link>
              </>
            )}
          </div>
        </nav>
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 md:pb-28 md:pt-16">
          <p className="mb-3 text-sm font-medium tracking-wide text-gold">אולמי וגני אירועים · עמק יזרעאל והגלבוע</p>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight md:text-6xl">
            כל האירוע שלכם.
            <br />
            <span className="text-gold">תיק אחד. צוות אחד מעודכן.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/80">
            בלי מחברות, בלי וואטסאפים מפוזרים ובלי דפים מודפסים. הזוג, אנשי המכירות, מנהלת האירוע והשף עובדים מאותו
            תיק, וכל שינוי מגיע אוטומטית למי שצריך לדעת עליו.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={profile ? "/book" : "/signup"} className="btn-gold px-6 py-3 text-lg">הזמנת אירוע</Link>
            <a href="#how" className="btn border border-white/30 px-6 py-3 text-lg text-white hover:bg-white/10">איך זה עובד</a>
          </div>
          <dl className="mt-14 grid max-w-3xl grid-cols-3 gap-6 border-t border-white/15 pt-8">
            {[
              ["15–20", "אירועים בחודש"],
              ["עד 500", "מוזמנים לאירוע"],
              ["5 ימים", "מראש: הזמנה מדויקת לשף"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-2xl font-bold text-gold md:text-3xl">{v}</dt>
                <dd className="mt-1 text-sm text-white/70">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* ---------- הבעיה ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold text-brand-dark">למה בכלל צריך את זה?</h2>
            <p className="mt-4 text-lg text-muted">
              באירוע אחד יש עשרות פרטים: סוג מנה, טבעונים, צליאק, עיצוב שולחנות, שיר לחופה ומתי עולה המצגת. כשהם
              מפוזרים בין חמישה אנשים וחמישה ערוצים, משהו תמיד נופל.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              "זוג הגיע לטעימה, והשף בכלל לא ידע שהם מגיעים",
              "«שכחנו להגיד לך: יש 15 טבעונים» – שעות לפני האירוע",
              "שולחנות שלא קיבלו את המנה הצמחונית שהוזמנה מראש",
              "מנהלת האירוע בחופש, ואף אחד לא יודע מה סוכם",
            ].map((p) => (
              <li key={p} className="flex gap-3 rounded-xl border border-line bg-white p-4">
                <span className="text-red-500">✕</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- איך זה עובד ---------- */}
      <section id="how" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-display text-3xl font-bold text-brand-dark">איך זה עובד</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="card">
                <div className="grid size-10 place-items-center rounded-full bg-gold-light font-display text-lg font-bold text-gold">{s.n}</div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- לכל בעל תפקיד ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center font-display text-3xl font-bold text-brand-dark">כל אחד רואה בדיוק את מה שהוא צריך</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r.who} className="card border-t-4 border-t-gold">
              <h3 className="font-semibold text-brand">{r.who}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-gold">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- עוזר AI ---------- */}
      <section className="bg-brand-light/60 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-medium text-gold">עוזר האירוע</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-brand-dark">כותבים כמו בוואטסאפ. זה פשוט נרשם.</h2>
            <p className="mt-4 text-muted">
              העוזר מבין בקשות בשפה חופשית, מעדכן את תיק האירוע ורושם כל שינוי ביומן. כשבקשה דורשת החלטה של הצוות, הוא
              מעביר אותה למנהלת האירוע ומעדכן אתכם שתקבלו תשובה בשעות הפעילות.
            </p>
          </div>
          <div className="card space-y-3 bg-white">
            <div className="ms-auto max-w-[85%] rounded-2xl rounded-se-sm bg-brand px-4 py-2 text-white">
              החלפנו את הפרחים הסגולים בלבנים!
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-ss-sm bg-cream px-4 py-2">
              עדכנתי בתיק האירוע: עיצוב השולחנות עם פרחים לבנים במקום סגולים. רונית תקבל את זה בסיכום השינויים. משהו נוסף?
            </div>
            <div className="ms-auto max-w-[85%] rounded-2xl rounded-se-sm bg-brand px-4 py-2 text-white">
              ואפשר להזיז את החתונה בשבוע?
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-ss-sm bg-cream px-4 py-2">
              שינוי תאריך דורש בדיקה של הצוות, אז העברתי את הבקשה לרונית. נחזור אליכם בשעות הפעילות.
            </div>
          </div>
        </div>
      </section>

      {/* ---------- עדויות ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center font-display text-3xl font-bold text-brand-dark">מה אומר הצוות</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.who} className="card">
              <blockquote className="text-lg leading-relaxed">«{t.quote}»</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold text-brand">{t.who}</span>
                <span className="text-muted"> · {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ---------- שאלות נפוצות ---------- */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center font-display text-3xl font-bold text-brand-dark">שאלות נפוצות</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl border border-line bg-cream/60 p-4 open:bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                  {f.q}
                  <span className="text-gold transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- הנעה לפעולה ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-3xl bg-brand-dark px-6 py-12 text-center text-white">
          <h2 className="font-display text-3xl font-bold">מתחילים לתכנן?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/75">פותחים חשבון, בוחרים תאריך פנוי, ותוך כמה דקות יש לכם תיק אירוע.</p>
          <Link href={profile ? "/book" : "/signup"} className="btn-gold mt-6 px-8 py-3 text-lg">להזמנת אירוע</Link>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        קסם בגלבוע · אולמי וגני אירועים · פרויקט גמר, 2026
      </footer>
    </div>
  );
}
