"use client";
// קביעה או החלפה של שעת טעימה מתוך השעות הפנויות
import { useState, useTransition } from "react";
import { bookTastingSlot } from "@/lib/actions/events";
import { formatDateTimeHe } from "@/lib/dates";
import type { TastingSlot } from "@/lib/types";

export function TastingPicker({ eventId, current, freeSlots }: { eventId: string; current: string | null; freeSlots: TastingSlot[] }) {
  const [slotId, setSlotId] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <p>{current ? <>הטעימה נקבעה ל-<b>{formatDateTimeHe(current)}</b></> : <span className="text-muted">עוד לא נקבעה טעימה</span>}</p>
      {freeSlots.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <select className="field max-w-xs" value={slotId} onChange={(e) => setSlotId(Number(e.target.value))}>
            <option value={0}>{current ? "להחליף לשעה אחרת…" : "בחירת שעה…"}</option>
            {freeSlots.map((s) => <option key={s.id} value={s.id}>{formatDateTimeHe(s.starts_at)}</option>)}
          </select>
          <button className="btn-ghost" disabled={!slotId || pending}
            onClick={() => start(async () => {
              const res = await bookTastingSlot(eventId, slotId);
              setMsg(res.ok ? { ok: true, text: res.message ?? "נקבע" } : { ok: false, text: res.error });
              setSlotId(0);
            })}>
            {pending ? "קובעים…" : "קביעה"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">אין כרגע שעות טעימה פנויות.</p>
      )}
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-brand" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
