"use client";
// הרשמה של לקוח חדש (בתרשים: «משתמש לא קיים → יצירת משתמש עם נתוני הטלפון והמייל בדאטה בייס»).
// השם והטלפון נשלחים כ-metadata, וטריגר במסד יוצר מהם את הפרופיל עם התפקיד «לקוח».
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorList } from "@/components/ui";
import { isValidEmail, isValidPhone } from "@/lib/validation";

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (form.full_name.trim().length < 2) errs.push("יש להזין שם מלא");
    if (!isValidPhone(form.phone)) errs.push("מספר טלפון לא תקין (למשל 050-1234567)");
    if (!isValidEmail(form.email)) errs.push("כתובת מייל לא תקינה");
    if (form.password.length < 8) errs.push("הסיסמה צריכה לפחות 8 תווים");
    setErrors(errs);
    if (errs.length) return;

    setBusy(true);
    const { data, error } = await createClient().auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim(), phones: [form.phone.trim()] },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/book`,
      },
    });
    setBusy(false);
    if (error) {
      setErrors([error.message.includes("already registered") ? "המייל כבר רשום. אפשר להתחבר" : error.message]);
      return;
    }
    // אם אימות מייל כבוי ב-Supabase, מתקבל סשן מיד וממשיכים להזמנה
    if (data.session) {
      router.replace("/book");
      router.refresh();
    } else {
      setSent(true);
    }
  }

  if (sent)
    return (
      <div className="space-y-3 text-center">
        <p className="text-lg font-semibold text-brand">כמעט סיימנו!</p>
        <p className="text-muted">שלחנו קישור אימות אל {form.email}. אחרי הלחיצה עליו תגיעו ישר להזמנת האירוע.</p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label className="label" htmlFor="full_name">שם מלא</label>
        <input id="full_name" className="field" value={form.full_name} onChange={set("full_name")} autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="phone">טלפון</label>
        <input id="phone" dir="ltr" className="field text-end" placeholder="050-1234567" value={form.phone} onChange={set("phone")} autoComplete="tel" />
      </div>
      <div>
        <label className="label" htmlFor="email">מייל</label>
        <input id="email" type="email" dir="ltr" className="field" value={form.email} onChange={set("email")} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">סיסמה (8 תווים לפחות)</label>
        <input id="password" type="password" dir="ltr" className="field" value={form.password} onChange={set("password")} autoComplete="new-password" />
      </div>
      <ErrorList errors={errors} />
      <button className="btn-primary w-full" disabled={busy}>{busy ? "נרשמים…" : "יצירת חשבון"}</button>
      <p className="text-center text-sm text-muted">
        כבר רשומים? <Link href="/login" className="font-medium text-brand underline">התחברות</Link>
      </p>
    </form>
  );
}
