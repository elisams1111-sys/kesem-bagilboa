// דף הנחיתה: איור על כל המסך, כותרת ענקית ושני כפתורי CTA בפינה.
// המבנה בהשראת Hero 12 של felipemenezes098 ב-21st.dev. הכפתור מותאם מ-Shiny Button של hyperiux (ראו globals.css).
import Link from "next/link";
import { homeFor } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { Karantina } from "next/font/google";
import { PhoneLink, SocialLinks } from "./contact";
import { TableScene } from "./scenes";

// הגופן של שם האולם: Karantina, צר ודרמטי כמו שלט. מ-Google Fonts עם תמיכה בעברית
const karantina = Karantina({ subsets: ["hebrew"], weight: "700" });
const BRAND = "קסם בגלבוע";

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
      <nav className="relative pt-4 text-center">
        <Link
          href="/"
          aria-label={BRAND}
          className={`inline-block leading-none text-white [text-shadow:0_2px_14px_rgb(0_0_0/0.7),0_0_28px_rgb(241_208_138/0.45)] ${karantina.className} text-[3rem] md:text-[4.2rem]`}
        >
          {/* כל אות נכנסת בנפרד, בהשראת Reveal Text של isaiahbjork ב-21st.dev. בעברית מותר לפצל לאותיות,
              כי אין חיבורים בין אותיות כמו בערבית. קורא מסך מקבל את השם השלם מ-aria-label */}
          {Array.from(BRAND).map((ch, i) =>
            ch === " " ? (
              " "
            ) : (
              <span key={i} aria-hidden className="brand-letter" style={{ animationDelay: `${i * 70}ms` }}>
                {ch}
              </span>
            ),
          )}
        </Link>
        {/* במחשב: חיוג בפינה הימנית ורשתות בשמאלית, משני צדי שם האולם. בנייד הם מתחת לכפתורים */}
        <div className="absolute start-5 top-5 hidden md:block lg:start-10">
          <PhoneLink />
        </div>
        <div className="absolute end-5 top-5 hidden md:block lg:end-10">
          <SocialLinks />
        </div>
      </nav>
      <div className="relative mx-auto mt-auto flex w-full max-w-7xl flex-col gap-6 px-5 lg:gap-8 pb-10 md:px-10 md:pb-14 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="font-display text-[2.6rem] font-bold leading-[1.05] text-balance [text-shadow:0_2px_18px_rgb(0_0_0/0.8)] sm:text-6xl lg:text-[min(6rem,10.5vh)]">
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
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 md:hidden">
            <PhoneLink compact />
            <SocialLinks />
          </div>
        </div>
      </div>
    </main>
  );
}
