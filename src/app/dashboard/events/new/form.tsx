"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ErrorList } from "@/components/ui";
import { emptyDraft, validateDateStep, validateGuestsStep, validateSlotStep, validateTypeStep } from "@/lib/validation";
import type { EventType, TimeSlot } from "@/lib/types";
import { EVENT_TYPE_LABELS, SLOT_LABELS } from "@/lib/types";
import { createEventForClient } from "./actions";

export function NewEventForm({ today, clients, booked }: { today: string; clients: { id: string; label: string }[]; booked: string[] }) {
  const router = useRouter();
  const bookedSet = useMemo(() => new Set(booked), [booked]);
  const [f, setF] = useState({ client_id: "", event_date: "", time_slot: "" as TimeSlot | "", event_type: "" as EventType | "", event_type_other: "", title: "", guest_count: 100, vegan_count: 0, celiac_count: 0 });
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof f>) => { setF({ ...f, ...patch }); setErrors([]); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const d = { ...emptyDraft(), ...f };
    const errs = [
      ...(f.client_id ? [] : ["יש לבחור לקוח"]),
      ...validateDateStep(d, today, bookedSet), ...validateSlotStep(d, bookedSet), ...validateTypeStep(d), ...validateGuestsStep(d),
    ];
    setErrors(errs);
    if (errs.length) return;
    start(async () => {
      const res = await createEventForClient(f);
      if (res.ok) router.push(`/dashboard/events/${res.eventId}`);
      else setErrors([res.error]);
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label className="label" htmlFor="client">לקוח</label>
        <select id="client" className="field" value={f.client_id} onChange={(e) => set({ client_id: e.target.value })}>
          <option value="">בחירה…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-muted">לקוח חדש נרשם בעצמו בדף ההרשמה ומופיע כאן מיד.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="date">תאריך</label>
          <input id="date" type="date" min={today} className="field" value={f.event_date} onChange={(e) => set({ event_date: e.target.value, time_slot: "" })} />
        </div>
        <div>
          <label className="label" htmlFor="slot">בוקר/ערב</label>
          <select id="slot" className="field" value={f.time_slot} onChange={(e) => set({ time_slot: e.target.value as TimeSlot })}>
            <option value="">בחירה…</option>
            {(["morning", "evening"] as TimeSlot[]).map((s) => (
              <option key={s} value={s} disabled={bookedSet.has(`${f.event_date}:${s}`)}>
                {SLOT_LABELS[s]}{bookedSet.has(`${f.event_date}:${s}`) ? " (תפוס)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="type">סוג האירוע</label>
          <select id="type" className="field" value={f.event_type} onChange={(e) => set({ event_type: e.target.value as EventType })}>
            <option value="">בחירה…</option>
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="title">שם האירוע</label>
          <input id="title" className="field" value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
      </div>
      {f.event_type === "other" && (
        <div>
          <label className="label" htmlFor="other">תיאור</label>
          <input id="other" className="field" value={f.event_type_other} onChange={(e) => set({ event_type_other: e.target.value })} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {(["guest_count", "vegan_count", "celiac_count"] as const).map((k) => (
          <div key={k}>
            <label className="label" htmlFor={k}>{{ guest_count: "מוזמנים", vegan_count: "טבעונים", celiac_count: "ללא גלוטן" }[k]}</label>
            <input id={k} type="number" min={0} max={500} className="field" value={f[k]} onChange={(e) => set({ [k]: Math.floor(Number(e.target.value) || 0) })} />
          </div>
        ))}
      </div>
      <ErrorList errors={errors} />
      <button className="btn-primary" disabled={pending}>{pending ? "שומרים…" : "פתיחת האירוע"}</button>
    </form>
  );
}
