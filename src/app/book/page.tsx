// אשף הזמנת אירוע ללקוח. השרת טוען את מה שהאשף צריך: פרופיל, מנות, משבצות תפוסות ושעות טעימה פנויות
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayInIsrael } from "@/lib/dates";
import type { MenuItem, TastingSlot } from "@/lib/types";
import { BookingWizard } from "./wizard";

export const metadata = { title: "הזמנת אירוע – קסם בגלבוע" };

export default async function BookPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();
  const today = todayInIsrael();

  const [menu, booked, slots] = await Promise.all([
    supabase.from("menu_items").select("*").order("id"),
    // שנתיים קדימה: מספיק לכל הזמנה סבירה
    supabase.rpc("booked_slots", { from_date: today, to_date: addDays(today, 730) }),
    supabase.from("tasting_slots").select("id, starts_at, event_id").is("event_id", null).gt("starts_at", new Date().toISOString()).order("starts_at"),
  ]);

  return (
    <AppShell profile={profile}>
      <BookingWizard
        today={today}
        profile={{ full_name: profile.full_name, phones: profile.phones, emails: profile.emails, address: profile.address ?? "" }}
        menuItems={(menu.data ?? []) as MenuItem[]}
        bookedSlots={((booked.data ?? []) as { event_date: string; time_slot: string }[]).map((b) => `${b.event_date}:${b.time_slot}`)}
        tastingSlots={(slots.data ?? []) as TastingSlot[]}
      />
    </AppShell>
  );
}
