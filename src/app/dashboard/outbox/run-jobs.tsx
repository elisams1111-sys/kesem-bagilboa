"use client";
import { useState, useTransition } from "react";
import { runJobsNow } from "./actions";

export function RunJobsButton() {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn-gold" disabled={pending} onClick={() => start(async () => setMsg(await runJobsNow()))}>
        {pending ? "מריצים…" : "הרצת המשימות היומיות עכשיו"}
      </button>
      {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
