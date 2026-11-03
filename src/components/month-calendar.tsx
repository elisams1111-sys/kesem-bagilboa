"use client";
// יומן חודשי פשוט (ראשון עד שבת), לבחירת תאריך אירוע ותאריך טעימה.
// הקומפוננטה לא יודעת מה תפוס: היא מקבלת פונקציות שאומרות לה מה לחסום ומה לסמן.
import { useState } from "react";
import { monthGrid } from "@/lib/dates";

const DAY_NAMES = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export type DayMark = "partial" | "full" | "available" | null;

export function MonthCalendar(props: {
  selected: string;
  onSelect: (date: string) => void;
  isDisabled: (date: string) => boolean;
  mark?: (date: string) => DayMark;
  initialMonth?: string; // YYYY-MM-DD
  minMonth?: string;
}) {
  const start = props.selected || props.initialMonth || new Date().toISOString().slice(0, 10);
  const [ym, setYm] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const weeks = monthGrid(ym.y, ym.m);
  const title = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(ym.y, ym.m, 1)),
  );
  const minKey = props.minMonth ? Number(props.minMonth.slice(0, 4)) * 12 + Number(props.minMonth.slice(5, 7)) - 1 : -Infinity;
  const canGoBack = ym.y * 12 + ym.m > minKey;
  const move = (delta: number) => {
    const total = ym.y * 12 + ym.m + delta;
    setYm({ y: Math.floor(total / 12), m: total % 12 });
  };

  return (
    <div className="mx-auto w-full max-w-md select-none">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="btn-ghost px-3 py-1" onClick={() => move(-1)} disabled={!canGoBack} aria-label="החודש הקודם">
          ›
        </button>
        <div className="font-display text-lg font-bold">{title}</div>
        <button type="button" className="btn-ghost px-3 py-1" onClick={() => move(1)} aria-label="החודש הבא">
          ‹
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const disabled = props.isDisabled(date);
          const mark = props.mark?.(date) ?? null;
          const selected = props.selected === date;
          return (
            <button
              type="button"
              key={date}
              disabled={disabled}
              onClick={() => props.onSelect(date)}
              aria-pressed={selected}
              aria-label={date}
              className={[
                "relative aspect-square rounded-lg text-sm transition",
                selected ? "bg-brand font-bold text-white" : "bg-white hover:bg-brand-light",
                disabled ? "cursor-not-allowed bg-gray-50 text-gray-300 line-through hover:bg-gray-50" : "",
                mark === "available" && !selected ? "ring-2 ring-gold/60" : "",
              ].join(" ")}
            >
              {Number(date.slice(8))}
              {mark === "partial" && !selected && <span className="absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-gold" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-gold" /> משבצת אחת תפוסה</span>
        <span className="flex items-center gap-1"><span className="text-gray-300 line-through">12</span> תפוס / לא זמין</span>
      </div>
    </div>
  );
}
