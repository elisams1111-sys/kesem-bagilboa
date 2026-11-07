// דף הנחיתה: איור על כל המסך, כותרת ענקית ושני כפתורי CTA בפינה.
// המבנה בהשראת Hero 12 של felipemenezes098 ב-21st.dev. הכפתור מותאם מ-Shiny Button של hyperiux (ראו globals.css).
import Link from "next/link";
import { homeFor } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { TableScene } from "./scenes";

export function Landing({ profile }: { profile: Profile | null }) {
  // אורח נרשם או מתחבר. משתמש מחובר ממשיך להזמנה או לאזור שלו
  const primaryHref = profile ? "/book" : "/signup";
  const secondaryHref = profile ? homeFor(profile.role) : "/login";
  const secondaryLabel = profile ? "לאזור שלי" : "כבר יש לי תיק";

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-brand-dark text-white">
      <TableScene />
      {/* שכבה כהה בתחתית, כדי שהטקסט יישאר קריא על כל איור */}
      {/* בנייד הכותרת עולה גבוה יותר על האיור, ולכן השכבה שם חזקה יותר */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent lg:from-black/65 lg:via-black/10" />
      {/* שם האולם, במרכז ומעל הפרגולה והאורות. גובה השורה נשמר נמוך כדי שלא יגיע אל קורת הפרגולה */}
      <nav className="relative pt-4 text-center md:pt-4">
        <Link href="/" className="font-display text-4xl font-bold leading-none text-white [text-shadow:0_2px_14px_rgb(0_0_0/0.7)] md:text-[3.25rem]">
          קסם בגלבוע
        </Link>
      </nav>
      <div className="relative mx-auto mt-auto flex w-full max-w-7xl flex-col gap-8 px-5 pb-10 md:px-10 md:pb-14 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="font-display text-5xl font-bold leading-[1.05] text-balance [text-shadow:0_2px_18px_rgb(0_0_0/0.8)] sm:text-6xl lg:text-[min(6rem,10.5vh)]">
          יש אירועים שזוכרים כל החיים.
          <span className="mt-3 block text-[#f1d08a]">שלכם עדיין פנוי ביומן.</span>
        </h1>
        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row lg:flex-col">
          <Link href={primaryHref} className="cta-shiny">
            תפסו את התאריך
            {/* חץ קדימה. בעברית «קדימה» הוא שמאלה */}
            <svg aria-hidden viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </Link>
          <Link href={secondaryHref} className="btn min-h-14 rounded-full border-2 border-white/70 px-8 text-lg font-semibold text-white backdrop-blur-sm hover:bg-white hover:text-brand-dark focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white">
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
