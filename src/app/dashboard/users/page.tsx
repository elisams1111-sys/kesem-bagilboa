// ניהול משתמשים ותפקידים: רונן (מנהל כללי) בלבד. גם המסד חוסם שינוי תפקיד ע"י מישהו אחר
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/dates";
import type { Profile } from "@/lib/types";
import { RoleSelect } from "./role-select";

export const metadata = { title: "משתמשים – קסם בגלבוע" };

export default async function UsersPage() {
  const me = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("role").order("full_name");
  const users = (data ?? []) as Profile[];

  return (
    <div>
      <PageHeader title="משתמשים ותפקידים" subtitle="כל מי שנרשם מתחיל כלקוח. כאן משייכים אנשי צוות לתפקיד שלהם." />
      <div className="card overflow-x-auto">
        <table className="table-std w-full min-w-[640px]">
          <thead><tr><th>שם</th><th>מייל</th><th>טלפון</th><th>נרשם</th><th>תפקיד</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.full_name || "—"}</td>
                <td dir="ltr" className="text-end">{u.emails[0]}</td>
                <td dir="ltr" className="text-end">{u.phones[0]}</td>
                <td className="text-xs text-muted">{formatDateTimeHe(u.created_at)}</td>
                <td><RoleSelect userId={u.id} role={u.role} disabled={u.id === me.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
