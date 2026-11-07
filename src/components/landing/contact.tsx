// כפתור חיוג וקישורים לוואטסאפ ולרשתות בדף הנחיתה. הפרטים עצמם ב-src/lib/contact.ts.
// הלוגואים הרשמיים מ-svgl.app (הספרייה שעליה נשען חיפוש הלוגואים של 21st), בתיקייה public/social.
import { CONTACT, PHONE_DISPLAY } from "@/lib/contact";

const SOCIAL = [
  { href: CONTACT.whatsappHref, label: "וואטסאפ", icon: "/social/whatsapp.svg" },
  { href: CONTACT.facebookHref, label: "פייסבוק", icon: "/social/facebook.svg" },
  { href: CONTACT.instagramHref, label: "אינסטגרם", icon: "/social/instagram.svg" },
  { href: CONTACT.tiktokHref, label: "טיקטוק", icon: "/social/tiktok.svg" },
];

const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white";

/** compact: עיגול עם אייקון בלבד, לנייד, כדי שהחיוג והרשתות ייכנסו בשורה אחת */
export function PhoneLink({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={CONTACT.phoneHref}
      aria-label={`התקשרו אלינו: ${PHONE_DISPLAY}`}
      className={
        compact
          ? `grid size-11 place-items-center rounded-full bg-[#dcb661] text-brand-dark shadow-lg ${focusRing}`
          : `inline-flex min-h-11 items-center gap-2 rounded-full border border-white/40 bg-black/30 px-4 text-lg font-semibold text-white backdrop-blur-sm transition hover:bg-white hover:text-brand-dark ${focusRing}`
      }
    >
      {/* שפופרת טלפון */}
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
      {/* ltr: בלי זה, המקפים במספר מתהפכים בתוך טקסט עברי */}
      {!compact && <span dir="ltr">{PHONE_DISPLAY}</span>}
    </a>
  );
}

export function SocialLinks() {
  return (
    <ul className="flex items-center gap-2">
      {SOCIAL.map((s) => (
        <li key={s.label}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${s.label} (נפתח בחלון חדש)`}
            className={`grid size-11 place-items-center rounded-full bg-white shadow-lg transition hover:scale-110 motion-reduce:transition-none ${focusRing}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG קטן וקבוע, אין צורך באופטימיזציה */}
            <img src={s.icon} alt="" width={24} height={24} className="size-6" />
          </a>
        </li>
      ))}
    </ul>
  );
}
