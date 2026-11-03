# פריסה: Supabase + Vercel

המדריך מוביל מאפס לקישור חי. זמן משוער: 20 דקות.
המקבילה לשלבי «שלב 3: בנייה ב-Base44» בהנחיות:

| שלב בהנחיות (Base44) | כאן |
|---|---|
| הקמת מסד הנתונים | `supabase/migrations/0001_schema.sql` + `0002_menu_seed.sql` |
| הגדרת הרשאות ומשתמשים | מדיניות RLS בתוך 0001, ותפקידים במסך «משתמשים» |
| בניית המסכים | `src/app/` |
| בניית הסוכן | `src/lib/agent.ts` + `ANTHROPIC_API_KEY` |
| פרסום (Deploy) | Vercel |

## מה בוצע בפועל (2026-11-03)

- פרויקט Vercel `kesem-bagilboa` מחובר למאגר `elisams1111-sys/kesem-bagilboa`. כל push ל-`main` נפרס אוטומטית.
- Supabase נוצר דרך האינטגרציה של Vercel (`vercel integration add supabase --meta region=fra1`).
  האינטגרציה הוסיפה לבד את כל המפתחות למשתני הסביבה ב-Vercel, ולכן שלבים 1.1 ו-1.5 למטה לא היו נחוצים.
- המיגרציות רצו ב-`npm run migrate` (`scripts/migrate.mjs`), עם אימות TLS מול תעודת השורש של Supabase
  ב-`supabase/certs/`. כל קובץ רץ פעם אחת, ומה שכבר רץ נרשם ב-`app_private.schema_migrations`.
- `CRON_SECRET` ו-`NEXT_PUBLIC_SITE_URL=https://kesem-bagilboa.vercel.app` הוגדרו ב-Vercel.
- **עוד לא הוגדרו:** `ANTHROPIC_API_KEY` (לסוכן), ובהגדרות ה-Auth ב-Supabase: Site URL וכיבוי Confirm email (שלבים 1.4 ו-1.6).
  לפאנל של Supabase נכנסים מ-Vercel: Project → Storage → kesem-bagilboa → Open in Supabase.

## 1. Supabase: מסד הנתונים וההתחברות

1. נכנסים ל-[supabase.com](https://supabase.com) ← **New project**. אזור: `eu-central-1` (פרנקפורט, הכי קרוב לישראל).
2. **SQL Editor** ← New query ← מדביקים את כל התוכן של `supabase/migrations/0001_schema.sql` ← **Run**.
3. שוב, עם `supabase/migrations/0002_menu_seed.sql` ← **Run**. (40 מנות מתיקיית `תפריטים/`.)
4. **Authentication → Sign In / Providers → Email**: להדגמה אפשר לכבות את **Confirm email**, כדי שהרשמה תיכנס מיד.
   אם משאירים אותו פועל, צריך את שלב 6.
5. **Project Settings → API Keys**: מעתיקים את
   - Project URL ← `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key ← `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key ← `SUPABASE_SECRET_KEY` (סודי! רק בשרת)
6. אחרי שיש כתובת ב-Vercel: **Authentication → URL Configuration** ← Site URL = כתובת האתר,
   ו-Redirect URLs: `https://<האתר>/auth/callback`.

## 2. מקומית (לא חובה)

```bash
cp .env.example .env.local   # וממלאים את הערכים
npm install
npm run seed                 # משתמשי דמו, אירועים, טעימות ושינויים
npm run dev                  # http://localhost:3000
```

## 3. Vercel: פרסום

1. מעלים את הפרויקט ל-GitHub (מאגר פרטי מספיק).
2. [vercel.com](https://vercel.com) ← **Add New → Project** ← בוחרים את המאגר. Framework: Next.js (מזוהה לבד).
3. **Environment Variables**: כל המשתנים מ-`.env.example`:

| משתנה | חובה | הערה |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✔ | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✔ | |
| `SUPABASE_SECRET_KEY` | ✔ | מיילים, Cron וחיפוש נמענים |
| `NEXT_PUBLIC_SITE_URL` | ✔ | הכתובת של האתר ב-Vercel, לקישורים במיילים |
| `CRON_SECRET` | ✔ | מחרוזת אקראית ארוכה. Vercel שולח אותה לנתיבי ה-Cron |
| `ANTHROPIC_API_KEY` | לסוכן | בלי מפתח, העוזר מציג הודעה שהוא לא מוגדר |
| `RESEND_API_KEY`, `EMAIL_FROM` | לא | בלי מפתח, המיילים נרשמים בדואר היוצא בלבד |
| `DEMO_EMAIL_OVERRIDE` | לא | כל המיילים יגיעו לכתובת אחת (נוח להדגמה) |

4. **Deploy**. אחרי הפריסה: מעדכנים את `NEXT_PUBLIC_SITE_URL` לכתובת הסופית, ופורסים שוב.
5. משלימים את שלב 1.6 ב-Supabase.

## 4. Cron

- `vercel.json` מגדיר ריצה יומית של `/api/cron/daily` ב-04:00 UTC (06:00–07:00 בישראל): מייל לשף 5 ימים לפני,
  מייל בוקר האירוע, סיכום שינויים לרונית ותזכורות. זה עובד גם בחשבון Hobby החינמי.
- **תזכורות כל שעה** (ראשון–חמישי 09:00–18:00): Hobby מגביל Cron לפעם ביום. אפשרויות:
  - חשבון Vercel Pro: להוסיף ל-`vercel.json` את `{ "path": "/api/cron/reminders", "schedule": "0 * * * *" }`.
  - או Supabase (חינמי): Database → Extensions → להפעיל `pg_cron` ו-`pg_net`, ואז ב-SQL Editor:

```sql
select cron.schedule('kesem-reminders', '0 * * * *', $$
  select net.http_get(
    url := 'https://<האתר>/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  )
$$);
```

- להדגמה בכיתה: מסך **דואר יוצא** ← «הרצת המשימות היומיות עכשיו».

## 5. משתמשי צוות

כל מי שנרשם מתחיל כ«לקוח». יש שתי דרכים לתת תפקיד:
- `npm run seed` יוצר את כל משתמשי הדמו עם תפקידים (הסיסמה מודפסת בסוף).
- או: נרשמים באתר, ואז ב-Supabase ← Table Editor ← `profiles` ← משנים `role` ל-`admin` למשתמש הראשון.
  מכאן רונן (admin) משייך תפקידים במסך «משתמשים».
