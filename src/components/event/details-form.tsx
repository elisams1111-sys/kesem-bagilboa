"use client";
// טופס פרטי האירוע: עיצוב, שיר, מצגת, מספרי סועדים ובקשות. לצוות מתווספים סטטוס, תאריך ומקדמה.
// השמירה עוברת דרך updateEventDetails, והמסד אוכף שוב את ההרשאות.
import { useState, useTransition } from "react";
import { updateEventDetails, type EventPatch } from "@/lib/actions/events";
import type { EventRow, EventStatus, TimeSlot } from "@/lib/types";
import { SLOT_LABELS, STATUS_LABELS } from "@/lib/types";

export function DetailsForm({ event, mode, locked }: { event: EventRow; mode: "client" | "staff" | "readonly"; locked: boolean }) {
  const [form, setForm] = useState({
    title: event.title ?? "",
    table_design: event.table_design ?? "",
    chuppah_song_url: event.chuppah_song_url ?? "",
    slideshow_time: event.slideshow_time ?? "",
    slideshow_folder_url: event.slideshow_folder_url ?? "",
    special_requests: event.special_requests ?? "",
    guest_count: event.guest_count,
    vegan_count: event.vegan_count,
    celiac_count: event.celiac_count,
    status: event.status,
    event_date: event.event_date,
    time_slot: event.time_slot,
    deposit_confirmed: event.deposit_confirmed,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const disabled = mode === "readonly";
  // פחות מ-5 ימים לפני האירוע: הלקוח לא משנה מספרי סועדים בעצמו
  const countsLocked = disabled || (mode === "client" && locked);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    // שולחים רק שדות שהשתנו, כדי שיומן השינויים יהיה נקי
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      const before = (event as unknown as Record<string, unknown>)[k] ?? "";
      if (String(v) !== String(before)) patch[k] = v;
    }
    if (mode === "client") ["status", "event_date", "time_slot", "deposit_confirmed"].forEach((k) => delete patch[k]);
    if (countsLocked) ["guest_count", "vegan_count", "celiac_count"].forEach((k) => delete patch[k]);
    start(async () => {
      const res = await updateEventDetails(event.id, patch as EventPatch);
      setMsg(res.ok ? { ok: true, text: res.message ?? "נשמר" } : { ok: false, text: res.error });
    });
  }

  const text = (k: "title" | "chuppah_song_url" | "slideshow_time" | "slideshow_folder_url", label: string, opts: { ltr?: boolean; placeholder?: string } = {}) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} className="field" dir={opts.ltr ? "ltr" : undefined} disabled={disabled} value={form[k]} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  const num = (k: "guest_count" | "vegan_count" | "celiac_count", label: string) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} type="number" min={0} max={500} className="field" disabled={countsLocked} value={form[k]} onChange={(e) => set(k, Math.floor(Number(e.target.value) || 0))} />
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-4">
      {mode === "staff" && (
        <div className="grid gap-4 rounded-xl bg-gold-light/50 p-4 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="status">סטטוס</label>
            <select id="status" className="field" value={form.status} onChange={(e) => set("status", e.target.value as EventStatus)}>
              {(Object.keys(STATUS_LABELS) as EventStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="event_date">תאריך</label>
            <input id="event_date" type="date" className="field" value={form.event_date} onChange={(e) => set("event_date", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="time_slot">בוקר/ערב</label>
            <select id="time_slot" className="field" value={form.time_slot} onChange={(e) => set("time_slot", e.target.value as TimeSlot)}>
              {(["morning", "evening"] as TimeSlot[]).map((s) => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" className="size-4 accent-brand" checked={form.deposit_confirmed} onChange={(e) => set("deposit_confirmed", e.target.checked)} />
            מקדמה התקבלה
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {num("guest_count", "מוזמנים")}
        {num("vegan_count", "טבעונים/צמחונים")}
        {num("celiac_count", "ללא גלוטן")}
      </div>
      {mode === "client" && locked && (
        <p className="text-sm text-amber-800">פחות מ-5 ימים לאירוע: שינוי במספר הסועדים נעשה דרך מנהלת האירוע (אפשר לבקש מהעוזר).</p>
      )}

      {text("title", "שם האירוע")}
      <div>
        <label className="label" htmlFor="table_design">עיצוב שולחנות ופרחים</label>
        <textarea id="table_design" rows={3} className="field" disabled={disabled} value={form.table_design} onChange={(e) => set("table_design", e.target.value)} placeholder="למשל: מפות שמנת, פרחים לבנים, נרות בגובה נמוך" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("chuppah_song_url", "שיר כניסה לחופה (קישור Spotify)", { ltr: true, placeholder: "https://open.spotify.com/track/…" })}
        {text("slideshow_time", "מתי המצגת עולה", { placeholder: "למשל: אחרי המנה העיקרית, 22:00" })}
      </div>
      {text("slideshow_folder_url", "קישור לתיקיית המצגת", { ltr: true, placeholder: "https://drive.google.com/…" })}
      <div>
        <label className="label" htmlFor="special_requests">בקשות מיוחדות</label>
        <textarea id="special_requests" rows={3} className="field" disabled={disabled} value={form.special_requests} onChange={(e) => set("special_requests", e.target.value)} />
      </div>

      {!disabled && (
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={pending}>{pending ? "שומרים…" : "שמירת שינויים"}</button>
          {msg && <span role="status" className={msg.ok ? "text-sm text-brand" : "text-sm text-red-700"}>{msg.text}</span>}
        </div>
      )}
    </form>
  );
}
