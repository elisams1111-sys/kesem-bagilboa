"use client";
// הוספת לקוח חדש מתוך מסך «אירוע חדש». טופס נפרד, כי טופס בתוך טופס אינו HTML תקין.
// אחרי היצירה מוצגת סיסמה זמנית פעם אחת. היא לא נשמרת, ואם סוגרים את ההודעה אי אפשר לראות אותה שוב.
import { useState, useTransition } from "react";
import { ErrorList } from "@/components/ui";
import { validateNewClient } from "@/lib/validation";
import { createClientAccount } from "./actions";

const EMPTY = { full_name: "", phone: "", email: "" };

export function NewClientPanel({ onCreated }: { onCreated: (client: { id: string; label: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof f>) => { setF({ ...f, ...patch }); setErrors([]); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateNewClient(f);
    setErrors(errs);
    if (errs.length) return;
    start(async () => {
      const res = await createClientAccount(f);
      if (!res.ok) return setErrors([res.error]);
      onCreated(res.client);
      setCreated({ name: f.full_name.trim(), email: f.email.trim().toLowerCase(), password: res.tempPassword });
      setF(EMPTY);
      setOpen(false);
    });
  }

  return (
    <div className="space-y-4">
      {created && (
        <div role="status" className="card border-gold bg-gold-light/40">
          <p className="font-semibold">הלקוח {created.name} נוסף ונבחר בטופס.</p>
          <p className="mt-1 text-sm">יש להעביר ללקוח את פרטי הכניסה. הסיסמה מוצגת כאן פעם אחת בלבד:</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">מייל</dt>
            <dd dir="ltr" className="text-end font-medium">{created.email}</dd>
            <dt className="text-muted">סיסמה זמנית</dt>
            <dd dir="ltr" className="select-all text-end font-mono font-medium">{created.password}</dd>
          </dl>
          <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => setCreated(null)}>סגירה</button>
        </div>
      )}

      {open ? (
        <form onSubmit={submit} className="card space-y-4">
          <h2 className="font-semibold">לקוח חדש</h2>
          <div>
            <label className="label" htmlFor="nc-name">שם מלא</label>
            <input id="nc-name" className="field" autoComplete="off" value={f.full_name} onChange={(e) => set({ full_name: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="nc-phone">טלפון</label>
              <input id="nc-phone" dir="ltr" type="tel" className="field text-end" autoComplete="off" placeholder="050-1234567" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="nc-email">מייל</label>
              <input id="nc-email" dir="ltr" type="email" className="field text-end" autoComplete="off" placeholder="name@example.com" value={f.email} onChange={(e) => set({ email: e.target.value })} />
            </div>
          </div>
          <ErrorList errors={errors} />
          <div className="flex gap-3">
            <button className="btn-primary" disabled={pending}>{pending ? "מוסיפים…" : "הוספת הלקוח"}</button>
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => { setOpen(false); setErrors([]); }}>ביטול</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>+ לקוח חדש</button>
      )}
    </div>
  );
}
