import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell title="התחברות" subtitle="ברוכים השבים לקסם בגלבוע">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
