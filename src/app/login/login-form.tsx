"use client";
// טופס התחברות במייל וסיסמה. אחרי התחברות, /go מפנה כל תפקיד לדף הבית שלו
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorList } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError([]);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError([error.message === "Invalid login credentials" ? "מייל או סיסמה שגויים" : error.message]);
      setBusy(false);
      return;
    }
    router.replace(`/go${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">מייל</label>
        <input id="email" type="email" dir="ltr" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">סיסמה</label>
        <input id="password" type="password" dir="ltr" required className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      <ErrorList errors={error} />
      <button className="btn-primary w-full" disabled={busy}>{busy ? "מתחברים…" : "התחברות"}</button>
      <p className="text-center text-sm text-muted">
        עוד אין לכם חשבון? <Link href="/signup" className="font-medium text-brand underline">הרשמה</Link>
      </p>
    </form>
  );
}
