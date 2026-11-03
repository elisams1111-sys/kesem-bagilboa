import "server-only";
// טוען את כל מה שתיק אירוע צריך, בשאילתות במקביל. רץ בשם המשתמש, ולכן לקוח מקבל רק אירוע שלו
import { createClient } from "./supabase/server";
import { daysBetween, todayInIsrael } from "./dates";
import { requiredGroups } from "./validation";
import type { ChangeLogRow, EventRow, MenuItem, MenuSelection, NotificationRow, Profile, TastingSlot } from "./types";

export async function loadEventFile(eventId: string, viewerId: string, withOutbox = false) {
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return null;
  const ev = event as EventRow;

  const [client, selections, items, tasting, freeSlots, changes, chat, outbox] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", ev.client_id).maybeSingle(),
    supabase.from("event_menu_selections").select("*").eq("event_id", eventId),
    supabase.from("menu_items").select("*").order("id"),
    supabase.from("tasting_slots").select("*").eq("event_id", eventId).maybeSingle(),
    supabase.from("tasting_slots").select("*").is("event_id", null).gt("starts_at", new Date().toISOString()).order("starts_at").limit(60),
    supabase.from("change_log").select("*").eq("event_id", eventId).order("created_at", { ascending: false }).limit(100),
    supabase.from("agent_messages").select("role, content").eq("event_id", eventId).eq("user_id", viewerId).order("created_at").limit(50),
    withOutbox
      ? supabase.from("notifications").select("*").eq("event_id", eventId).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
  ]);

  // שמות של מי ששינה, ליומן השינויים (לקוח רואה רק את עצמו; לשאר כתוב «משתמש»)
  const changeRows = (changes.data ?? []) as ChangeLogRow[];
  const ids = [...new Set(changeRows.map((c) => c.changed_by).filter(Boolean) as string[])];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name, role").in("id", ids) : { data: [] };
  const names = Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name || "משתמש"]));

  const daysLeft = daysBetween(todayInIsrael(), ev.event_date);
  return {
    event: ev,
    client: (client.data ?? null) as Profile | null,
    selections: (selections.data ?? []) as MenuSelection[],
    menuItems: (items.data ?? []) as MenuItem[],
    tasting: (tasting.data ?? null) as TastingSlot | null,
    freeSlots: (freeSlots.data ?? []) as TastingSlot[],
    changes: changeRows,
    names,
    chat: (chat.data ?? []) as { role: "user" | "assistant"; content: string }[],
    outbox: (outbox.data ?? []) as NotificationRow[],
    daysLeft,
    locked: daysLeft < 5, // פחות מ-5 ימים: השף כבר הזמין
    groups: requiredGroups(ev),
  };
}
