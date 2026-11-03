"use client";
import { useState, useTransition } from "react";
import { addTastingSlots, deleteTastingSlot } from "./actions";

export function AddSlotsForm({ today }: { today: string }) {
  const [date, setDate] = useState("");
  const [times, setTimes] = useState("17:00, 18:00, 19:00");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addTastingSlots(date, times);
          setMsg(res.ok ? { ok: true, text: `נוספו ${res.added} שעות` } : { ok: false, text: res.error });
        });
      }}
    >
      <div>
        <label className="label" htmlFor="d">תאריך</label>
        <input id="d" type="date" min={today} required className="field" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="min-w-60 flex-1">
        <label className="label" htmlFor="t">שעות (מופרדות בפסיק)</label>
        <input id="t" dir="ltr" className="field" value={times} onChange={(e) => setTimes(e.target.value)} />
      </div>
      <button className="btn-primary" disabled={pending}>{pending ? "מוסיפים…" : "הוספה"}</button>
      {msg && <span role="status" className={`text-sm ${msg.ok ? "text-brand" : "text-red-700"}`}>{msg.text}</span>}
    </form>
  );
}

export function DeleteSlotButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button className="text-sm text-red-700 underline" disabled={pending} onClick={() => start(async () => { await deleteTastingSlot(id); })}>
      מחיקה
    </button>
  );
}
