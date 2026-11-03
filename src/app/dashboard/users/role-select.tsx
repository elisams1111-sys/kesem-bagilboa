"use client";
import { useState, useTransition } from "react";
import type { UserRole } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { setUserRole } from "./actions";

export function RoleSelect({ userId, role, disabled }: { userId: string; role: UserRole; disabled: boolean }) {
  const [value, setValue] = useState(role);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div>
      <select className="field py-1.5 text-sm" value={value} disabled={disabled || pending} title={disabled ? "אי אפשר לשנות את התפקיד של עצמך" : undefined}
        onChange={(e) => {
          const next = e.target.value as UserRole;
          start(async () => {
            const res = await setUserRole(userId, next);
            if (res.ok) { setValue(next); setError(""); } else setError(res.error);
          });
        }}>
        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
