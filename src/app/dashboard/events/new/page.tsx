// פתיחת אירוע ע"י איש מכירות, ללקוח קיים או חדש (בעבר: מחברת של איש המכירות)
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayInIsrael } from "@/lib/dates";
import { NewEventForm } from "./form";

export default async function NewEventPage() {
  await requireRole(["sales", "event_manager", "admin"]);
  const supabase = await createClient();
  const today = todayInIsrael();
  const [{ data: clients }, { data: booked }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, emails, phones").eq("role", "client").order("full_name"),
    supabase.rpc("booked_slots", { from_date: today, to_date: addDays(today, 730) }),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="אירוע חדש" subtitle="פתיחת תיק אירוע ללקוח רשום או ללקוח חדש. הלקוח יראה אותו מיד באזור האישי שלו." />
      <NewEventForm
        today={today}
        clients={(clients ?? []).map((c) => ({ id: c.id, label: `${c.full_name || "ללא שם"} · ${c.emails?.[0] ?? ""}` }))}
        booked={((booked ?? []) as { event_date: string; time_slot: string }[]).map((b) => `${b.event_date}:${b.time_slot}`)}
      />
    </div>
  );
}
