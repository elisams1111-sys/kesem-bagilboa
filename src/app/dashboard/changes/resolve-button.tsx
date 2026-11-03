"use client";
import { useTransition } from "react";
import { resolveChange } from "@/lib/actions/events";

export function ResolveButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn-primary px-3 py-1.5 text-sm" disabled={pending} onClick={() => start(async () => { await resolveChange(id); })}>
      {pending ? "…" : "סימון «טופל»"}
    </button>
  );
}
