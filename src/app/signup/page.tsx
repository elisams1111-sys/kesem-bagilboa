import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthShell title="הרשמה" subtitle="פותחים חשבון ומתחילים לתכנן את האירוע">
      <SignupForm />
    </AuthShell>
  );
}
