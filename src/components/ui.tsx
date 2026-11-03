// רכיבי תצוגה קטנים שחוזרים בכל האפליקציה
import Link from "next/link";
import type { EventStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

const STATUS_COLORS: Record<EventStatus, string> = {
  booked: "bg-blue-50 text-blue-800 border-blue-200",
  tasting_scheduled: "bg-amber-50 text-amber-800 border-amber-200",
  menu_final: "bg-emerald-50 text-emerald-800 border-emerald-200",
  completed: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "gold" | "red" | "green" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700",
    gold: "bg-gold-light text-[#7a5d1d]",
    red: "bg-red-50 text-red-700",
    green: "bg-brand-light text-brand",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const body = (
    <div className="card h-full transition hover:border-brand/40">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold text-brand">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-dark">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line bg-white/60 p-8 text-center text-muted">{children}</div>;
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul role="alert" className="mt-3 space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {errors.map((e) => (
        <li key={e}>• {e}</li>
      ))}
    </ul>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className={`grid size-9 place-items-center rounded-full ${light ? "bg-white/15" : "bg-brand"} font-display text-lg font-bold text-gold`}>
        ק
      </span>
      <span className={`font-display text-xl font-bold ${light ? "text-white" : "text-brand-dark"}`}>קסם בגלבוע</span>
    </Link>
  );
}
