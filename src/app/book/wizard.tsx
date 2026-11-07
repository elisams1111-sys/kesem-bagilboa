"use client";
// אשף הזמנת אירוע, לפי תרשים הזרימה (Flowchart 1.jpg):
// תאריך → בוקר/ערב → סוג אירוע → מוזמנים → פרטי קשר → 5 שלבי תפריט → תאריך טעימה → שעת טעימה → סיום.
//
// הטיוטה נשמרת בדפדפן (localStorage) כדי שרענון הדף לא ימחק אותה, אבל רק לזמן מוגבל:
// 5 דקות בלי פעולה בשלבי הפרטים, 10 דקות בשלבי התפריט והטעימה. אחרי זה היא נמחקת והאשף חוזר להתחלה.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { MonthCalendar } from "@/components/month-calendar";
import { ErrorList } from "@/components/ui";
import { formatDateHe, israelDateOf } from "@/lib/dates";
import { isExpired, timeoutFor, type StepKind } from "@/lib/inactivity";
import type { Course, EventType, GuestGroup, MenuItem, TastingSlot, TimeSlot } from "@/lib/types";
import { COURSE_LABELS, COURSES, EVENT_TYPE_LABELS, GROUP_LABELS, MAX_CONTACTS, MAX_GUESTS, MAX_TASTERS, MIN_TASTERS, SLOT_LABELS } from "@/lib/types";
import {
  emptyDraft, menuOptions, requiredGroups, requiredPicks, validateContactStep, validateDateStep, validateFinalStep,
  validateGuestsStep, validateMenuStep, validateSlotStep, validateTastingStep, validateTypeStep, type BookingDraft,
} from "@/lib/validation";
import { createBooking } from "./actions";

const STORAGE_KEY = "kesem-booking-draft";

type Step = { key: string; kind: StepKind; title: string; hint?: string; course?: Course };

const STEPS: Step[] = [
  { key: "date", kind: "details", title: "באיזה תאריך?", hint: "תאריכים שתפוסים גם בבוקר וגם בערב חסומים" },
  { key: "slot", kind: "details", title: "בוקר או ערב?" },
  { key: "type", kind: "details", title: "מה חוגגים?" },
  { key: "guests", kind: "details", title: "כמה מוזמנים?", hint: `עד ${MAX_GUESTS} מוזמנים` },
  { key: "contact", kind: "details", title: "פרטי קשר", hint: "עד 3 טלפונים ועד 3 כתובות מייל" },
  ...COURSES.map((c): Step => ({
    key: `menu:${c}`, kind: "menu", title: `תפריט טעימות: ${COURSE_LABELS[c]}`, course: c,
    hint: "בוחרים כמה מנות לטעום. את המנה הסופית לכל שלב בוחרים אחרי הטעימה, מתוך המנות שטעמתם",
  })),
  { key: "tastingDate", kind: "tasting", title: "תאריך לטעימות", hint: "מסומנים רק ימים עם שעות פנויות" },
  { key: "tastingTime", kind: "tasting", title: "שעה לטעימות" },
  { key: "final", kind: "final", title: "כמעט סיימנו" },
];

interface Stored {
  draft: BookingDraft;
  step: number;
  tastingDate: string;
  lastActivity: number;
}

export function BookingWizard(props: {
  today: string;
  profile: { full_name: string; phones: string[]; emails: string[]; address: string };
  menuItems: MenuItem[];
  bookedSlots: string[];
  tastingSlots: TastingSlot[];
}) {
  const booked = useMemo(() => new Set(props.bookedSlots), [props.bookedSlots]);

  // טיוטה חדשה, עם פרטי הלקוח שכבר שמורים במערכת («משתמש קיים: זיהוי לפי הנתונים בדאטה בייס»)
  const freshDraft = useCallback((): BookingDraft => ({
    ...emptyDraft(),
    full_name: props.profile.full_name,
    phones: props.profile.phones.length ? props.profile.phones : [""],
    emails: props.profile.emails.length ? props.profile.emails : [""],
    address: props.profile.address,
  }), [props.profile]);

  const [draft, setDraft] = useState<BookingDraft>(freshDraft);
  const [step, setStep] = useState(0);
  const [tastingDate, setTastingDate] = useState("");
  const [lastActivity, setLastActivity] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState<{ eventId: string; warning?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const current = STEPS[step];

  // ---------- טעינה ושמירה של הטיוטה ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Stored;
        const kind = STEPS[saved.step]?.kind ?? "details";
        if (isExpired(saved.lastActivity, Date.now(), kind)) {
          localStorage.removeItem(STORAGE_KEY);
          setNotice("הטיוטה הקודמת נמחקה כי עבר יותר מדי זמן בלי פעולה. מתחילים מחדש.");
        } else {
          // טיוטה שנשמרה לפני שהיו מנות לטעימה (שדה menu ישן): לוקחים את הפרטים, ואת התפריט בוחרים מחדש
          const { menu: _old, ...rest } = saved.draft as BookingDraft & { menu?: unknown };
          setDraft({ ...emptyDraft(), ...rest, tasting_picks: rest.tasting_picks ?? {}, tasters: rest.tasters ?? MIN_TASTERS });
          setStep(saved.step);
          setTastingDate(saved.tastingDate);
          setLastActivity(saved.lastActivity);
        }
      }
    } catch {
      // localStorage חסום (גלישה פרטית): ממשיכים בלי שמירה
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || done) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ draft, step, tastingDate, lastActivity } satisfies Stored));
    } catch {}
  }, [draft, step, tastingDate, lastActivity, loaded, done]);

  // ---------- הגבלת זמן בלי פעולה ----------
  const touch = useCallback(() => setLastActivity(Date.now()), []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!loaded || done || step === 0) return;
    if (isExpired(lastActivity, now, current.kind)) {
      const minutes = timeoutFor(current.kind) / 60_000;
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      setDraft(freshDraft());
      setStep(0);
      setTastingDate("");
      setErrors([]);
      setLastActivity(Date.now());
      setNotice(`עברו ${minutes} דקות בלי פעולה, ולכן הטיוטה נמחקה וההזמנה התחילה מחדש.`);
    }
  }, [now, lastActivity, current.kind, loaded, done, step, freshDraft]);
  const remainingMin = Math.max(0, Math.ceil((timeoutFor(current.kind) - (now - lastActivity)) / 60_000));

  const update = (patch: Partial<BookingDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors([]);
    touch();
  };

  // ---------- בדיקה לכל שלב ----------
  function validateCurrent(): string[] {
    switch (current.key) {
      case "date": return validateDateStep(draft, props.today, booked);
      case "slot": return validateSlotStep(draft, booked);
      case "type": return validateTypeStep(draft);
      case "guests": return validateGuestsStep(draft);
      case "contact": return validateContactStep(draft);
      // אין שעות טעימה פנויות בכלל: מדלגים, והטעימה תתואם בהמשך
      case "tastingDate": return tastingDate || !props.tastingSlots.length ? [] : ["יש לבחור תאריך לטעימות"];
      case "tastingTime": return props.tastingSlots.length ? validateTastingStep(draft) : [];
      case "final": return validateFinalStep(draft);
      default: return current.course ? validateMenuStep(draft, current.course, props.menuItems) : [];
    }
  }

  function next() {
    touch();
    const errs = validateCurrent();
    setErrors(errs);
    if (errs.length) return;
    setNotice("");
    if (current.key === "final") return submit();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    touch();
    setErrors([]);
    setStep((s) => Math.max(0, s - 1));
  }

  function submit() {
    startTransition(async () => {
      const res = await createBooking(draft);
      if (!res.ok) {
        setErrors(res.errors);
        return;
      }
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      setDone({ eventId: res.eventId, warning: res.warning });
    });
  }

  // ---------- מסך הסיום ----------
  if (done)
    return (
      <div className="card mx-auto max-w-xl py-10 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-light text-3xl text-brand">✓</div>
        <h1 className="mt-4 font-display text-3xl font-bold text-brand-dark">ההזמנה התקבלה!</h1>
        <p className="mt-2 text-muted">
          שלחנו אישור למייל. מנהלת האירוע והשף כבר קיבלו את הפרטים, כולל מועד הטעימה.
        </p>
        {done.warning && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{done.warning}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/my/events/${done.eventId}`} className="btn-primary">לתיק האירוע</Link>
          <Link href="/my" className="btn-ghost">האירועים שלי</Link>
        </div>
      </div>
    );

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="mx-auto max-w-3xl" onPointerDown={touch} onKeyDown={touch}>
      {/* התקדמות */}
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-sm text-muted">
          <span>שלב {step + 1} מתוך {STEPS.length}</span>
          {step > 0 && <span>הטיוטה נשמרת עוד כ-{remainingMin} דק׳ ללא פעולה</span>}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {notice && <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</div>}

      <section className="card p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-brand-dark md:text-3xl">{current.title}</h1>
        {current.hint && <p className="mt-1 text-sm text-muted">{current.hint}</p>}
        <div className="mt-6">
          <StepBody
            step={current}
            draft={draft}
            update={update}
            today={props.today}
            booked={booked}
            menuItems={props.menuItems}
            tastingSlots={props.tastingSlots}
            tastingDate={tastingDate}
            setTastingDate={(d) => { setTastingDate(d); update({ tasting_slot_id: null }); }}
          />
        </div>
        <ErrorList errors={errors} />
        <div className="mt-8 flex justify-between gap-3">
          <button type="button" onClick={back} className="btn-ghost" disabled={step === 0 || pending}>חזרה</button>
          <button type="button" onClick={next} className={current.key === "final" ? "btn-gold px-8" : "btn-primary px-8"} disabled={pending}>
            {current.key === "final" ? (pending ? "שומרים…" : "אישור ההזמנה") : "המשך"}
          </button>
        </div>
      </section>
    </div>
  );
}

// ---------- גוף כל שלב ----------

function StepBody(p: {
  step: Step;
  draft: BookingDraft;
  update: (patch: Partial<BookingDraft>) => void;
  today: string;
  booked: Set<string>;
  menuItems: MenuItem[];
  tastingSlots: TastingSlot[];
  tastingDate: string;
  setTastingDate: (d: string) => void;
}) {
  const { draft, update } = p;

  if (p.step.key === "date") {
    const both = (d: string) => p.booked.has(`${d}:morning`) && p.booked.has(`${d}:evening`);
    return (
      <div>
        <MonthCalendar
          selected={draft.event_date}
          initialMonth={p.today}
          minMonth={p.today}
          isDisabled={(d) => d <= p.today || both(d)}
          mark={(d) => (p.booked.has(`${d}:morning`) || p.booked.has(`${d}:evening`) ? "partial" : null)}
          onSelect={(d) => update({ event_date: d, time_slot: "" })}
        />
        {draft.event_date && <p className="mt-4 text-center font-medium">נבחר: {formatDateHe(draft.event_date)}</p>}
      </div>
    );
  }

  if (p.step.key === "slot") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {(["morning", "evening"] as TimeSlot[]).map((s) => {
          const taken = p.booked.has(`${draft.event_date}:${s}`);
          return (
            <ChoiceCard key={s} selected={draft.time_slot === s} disabled={taken} onClick={() => update({ time_slot: s })}
              title={SLOT_LABELS[s]} text={taken ? "תפוס בתאריך הזה" : s === "morning" ? "10:00–15:00" : "19:00–00:00"} />
          );
        })}
      </div>
    );
  }

  if (p.step.key === "type") {
    return (
      <div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
            <ChoiceCard key={t} selected={draft.event_type === t} onClick={() => update({ event_type: t })} title={EVENT_TYPE_LABELS[t]} />
          ))}
        </div>
        {draft.event_type === "other" && (
          <div className="mt-4">
            <label className="label" htmlFor="other">תיאור ושם האירוע</label>
            <input id="other" className="field" value={draft.event_type_other} onChange={(e) => update({ event_type_other: e.target.value })} placeholder="למשל: מסיבת פרישה של אבא" />
          </div>
        )}
        <div className="mt-4">
          <label className="label" htmlFor="title">שם לאירוע (לא חובה)</label>
          <input id="title" className="field" value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder="למשל: החתונה של דנה ויואב" />
        </div>
      </div>
    );
  }

  if (p.step.key === "guests") {
    const num = (k: "guest_count" | "vegan_count" | "celiac_count" | "tasters") => (
      <input id={k} type="number" min={k === "tasters" ? MIN_TASTERS : 0} max={k === "tasters" ? MAX_TASTERS : MAX_GUESTS} className="field" value={draft[k]}
        onChange={(e) => update({ [k]: e.target.value === "" ? 0 : Math.floor(Number(e.target.value)) } as Partial<BookingDraft>)} />
    );
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="label" htmlFor="guest_count">סך הכל מוזמנים</label>{num("guest_count")}</div>
        <div><label className="label" htmlFor="vegan_count">מתוכם טבעונים/צמחונים</label>{num("vegan_count")}</div>
        <div><label className="label" htmlFor="celiac_count">מתוכם ללא גלוטן</label>{num("celiac_count")}</div>
        <p className="text-sm text-muted sm:col-span-3">אפשר לעדכן את המספרים עד 5 ימים לפני האירוע.</p>
        <div className="border-t border-line pt-4 sm:col-span-3">
          <label className="label" htmlFor="tasters">כמה אנשים יגיעו לטעימה?</label>
          <div className="max-w-40">{num("tasters")}</div>
          <p className="mt-1 text-sm text-muted">בין {MIN_TASTERS} ל-{MAX_TASTERS}. השף מכין לפי המספר הזה.</p>
        </div>
      </div>
    );
  }

  if (p.step.key === "contact") {
    const list = (k: "phones" | "emails", label: string, placeholder: string) => (
      <div>
        <label className="label">{label}</label>
        <div className="space-y-2">
          {draft[k].map((v, i) => (
            <div key={i} className="flex gap-2">
              <input dir="ltr" className="field text-end" value={v} placeholder={placeholder}
                onChange={(e) => update({ [k]: draft[k].map((x, j) => (j === i ? e.target.value : x)) } as Partial<BookingDraft>)} />
              {draft[k].length > 1 && (
                <button type="button" className="btn-ghost px-3" aria-label="הסרה" onClick={() => update({ [k]: draft[k].filter((_, j) => j !== i) } as Partial<BookingDraft>)}>✕</button>
              )}
            </div>
          ))}
          {draft[k].length < MAX_CONTACTS && (
            <button type="button" className="text-sm font-medium text-brand underline" onClick={() => update({ [k]: [...draft[k], ""] } as Partial<BookingDraft>)}>
              + הוספה
            </button>
          )}
        </div>
      </div>
    );
    return (
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="name">שם מלא</label>
          <input id="name" className="field" value={draft.full_name} onChange={(e) => update({ full_name: e.target.value })} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {list("phones", "טלפונים", "050-1234567")}
          {list("emails", "מיילים", "name@example.com")}
        </div>
      </div>
    );
  }

  if (p.step.course) {
    const course = p.step.course;
    const counts = { regular: draft.guest_count - draft.vegan_count - draft.celiac_count, celiac: draft.celiac_count, vegan: draft.vegan_count };
    // לחיצה מוסיפה מנה או מסירה אותה. כשכבר נבחר המספר המלא, שאר המנות נחסמות עד שמסירים אחת
    const toggle = (group: GuestGroup, id: number) => {
      const current = draft.tasting_picks[course]?.[group] ?? [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      update({ tasting_picks: { ...draft.tasting_picks, [course]: { ...draft.tasting_picks[course], [group]: next } } });
    };
    return (
      <div className="space-y-8">
        {requiredGroups(draft).map((group) => {
          const need = requiredPicks(p.menuItems, course, group);
          const chosen = draft.tasting_picks[course]?.[group] ?? [];
          const full = chosen.length >= need;
          return (
            <div key={group}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  {GROUP_LABELS[group]} <span className="text-sm font-normal text-muted">({counts[group]} סועדים)</span>
                </h2>
                {/* aria-live: קורא מסך מודיע על כל שינוי במונה */}
                <p aria-live="polite" className={`text-sm font-medium ${full ? "text-brand" : "text-muted"}`}>
                  {need === 1 ? `בוחרים מנה אחת לטעימה` : `בוחרים ${need} מנות לטעימה`} · נבחרו {chosen.length}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {menuOptions(p.menuItems, course, group).map((m) => {
                  const selected = chosen.includes(m.id);
                  return (
                    <ChoiceCard key={m.id} selected={selected} disabled={full && !selected} title={m.title} text={m.description}
                      onClick={() => toggle(group, m.id)} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (p.step.key === "tastingDate") {
    const dates = new Set(p.tastingSlots.map((s) => israelDateOf(s.starts_at)));
    const first = [...dates].sort()[0];
    if (!first) return <p className="text-muted">כרגע אין שעות טעימה פנויות. אפשר לסיים את ההזמנה ולקבוע טעימה בהמשך מול מנהלת האירוע.</p>;
    return (
      <MonthCalendar selected={p.tastingDate} initialMonth={first} minMonth={p.today} isDisabled={(d) => !dates.has(d)}
        mark={(d) => (dates.has(d) ? "available" : null)} onSelect={p.setTastingDate} />
    );
  }

  if (p.step.key === "tastingTime") {
    const slots = p.tastingSlots.filter((s) => israelDateOf(s.starts_at) === p.tastingDate);
    const fmt = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
    return (
      <div>
        <p className="mb-4 text-muted">{p.tastingDate && formatDateHe(p.tastingDate)}</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {slots.map((s) => (
            <ChoiceCard key={s.id} selected={draft.tasting_slot_id === s.id} onClick={() => update({ tasting_slot_id: s.id })} title={fmt.format(new Date(s.starts_at))} />
          ))}
        </div>
      </div>
    );
  }

  // שלב הסיום: שם, כתובת ואמצעי תשלום. אין שדה למספר כרטיס, בכוונה (docs/spec.md §5.3)
  const menuCount = COURSES.filter((c) => validateMenuStep(draft, c, p.menuItems).length === 0).length;
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-cream p-4 text-sm leading-7">
        <div><b>{draft.title || (draft.event_type ? EVENT_TYPE_LABELS[draft.event_type as EventType] : "")}</b></div>
        <div>{draft.event_date && formatDateHe(draft.event_date)}, {draft.time_slot && SLOT_LABELS[draft.time_slot as TimeSlot]}</div>
        <div>{draft.guest_count} מוזמנים · {draft.vegan_count} טבעונים · {draft.celiac_count} ללא גלוטן</div>
        <div>מנות לטעימה: {menuCount}/5 שלבים נבחרו · {draft.tasters} טועמים</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="fn">שם מלא</label>
          <input id="fn" className="field" value={draft.full_name} onChange={(e) => update({ full_name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="addr">כתובת</label>
          <input id="addr" className="field" value={draft.address} onChange={(e) => update({ address: e.target.value })} placeholder="רחוב, מספר, עיר" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="pay">אמצעי תשלום למקדמה</label>
        <select id="pay" className="field" value={draft.payment_method} onChange={(e) => update({ payment_method: e.target.value })}>
          <option value="">בחירה…</option>
          <option value="credit_card">כרטיס אשראי (קישור תשלום יישלח במייל)</option>
          <option value="bank_transfer">העברה בנקאית</option>
          <option value="check">צ׳ק</option>
        </select>
      </div>
      <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-brand" checked={draft.deposit_confirmed} onChange={(e) => update({ deposit_confirmed: e.target.checked })} />
        <span>
          אני מאשר/ת את תשלום המקדמה ואת תנאי ההזמנה. <span className="text-muted">(הדגמה: לא נגבה תשלום, ופרטי אשראי לא נשמרים במערכת)</span>
        </span>
      </label>
    </div>
  );
}

function ChoiceCard(p: { title: string; text?: string; selected: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={p.onClick} disabled={p.disabled} aria-pressed={p.selected}
      className={[
        "rounded-xl border p-4 text-start transition",
        p.selected ? "border-brand bg-brand-light ring-2 ring-brand/30" : "border-line bg-white hover:border-brand/50",
        p.disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}>
      <div className="font-semibold">{p.title}</div>
      {p.text && <div className="mt-1 text-sm text-muted">{p.text}</div>}
    </button>
  );
}
