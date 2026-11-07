"use client";
// התפריט הסופי של האירוע: לכל שלב ולכל קבוצת סועדים, מנה אחת. במצב עריכה, בחירה מתוך רשימה נשמרת מיד.
// כשיש מנות שנבחרו לטעימה, הרשימה מציעה רק אותן: התפריט הסופי נבחר אחרי הטעימה, מתוך מה שטעמו.
import { useState, useTransition } from "react";
import { changeMenuSelection } from "@/lib/actions/events";
import type { Course, GuestGroup, MenuItem, MenuSelection, TastingPick } from "@/lib/types";
import { COURSE_LABELS, COURSES, GROUP_LABELS } from "@/lib/types";

export function MenuEditor(props: {
  eventId: string;
  selections: MenuSelection[];
  picks: TastingPick[];
  menuItems: MenuItem[];
  groups: GuestGroup[]; // אילו קבוצות קיימות באירוע הזה
  editable: boolean;
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const byId = new Map(props.menuItems.map((m) => [m.id, m]));

  const options = (course: Course, group: GuestGroup) => {
    const all = props.menuItems.filter((m) => m.course === course && (group === "vegan" ? m.is_vegan : m.diet === group));
    const tasted = new Set(props.picks.filter((p) => p.course === course && p.guest_group === group).map((p) => p.menu_item_id));
    return tasted.size ? all.filter((m) => tasted.has(m.id)) : all;
  };
  const selected = (course: Course, group: GuestGroup) =>
    props.selections.find((s) => s.course === course && s.guest_group === group)?.menu_item_id ?? 0;

  function change(course: Course, group: GuestGroup, id: number) {
    start(async () => {
      const res = await changeMenuSelection(props.eventId, course, group, id || null);
      setMsg(res.ok ? { ok: true, text: res.message ?? "עודכן" } : { ok: false, text: res.error });
    });
  }

  return (
    <div>
      {props.picks.length > 0 && props.editable && (
        <p className="mb-3 text-sm text-muted">אחרי הטעימה בוחרים כאן מנה אחת לכל שלב, מתוך המנות שטעמתם.</p>
      )}
      <div className="overflow-x-auto">
        <table className="table-std w-full min-w-[520px]">
          <thead>
            <tr>
              <th>שלב</th>
              {props.groups.map((g) => <th key={g}>{GROUP_LABELS[g]}</th>)}
            </tr>
          </thead>
          <tbody>
            {COURSES.map((c) => (
              <tr key={c}>
                <td className="font-medium">{COURSE_LABELS[c]}</td>
                {props.groups.map((g) => (
                  <td key={g}>
                    {props.editable ? (
                      <select className="field py-1.5 text-sm" disabled={pending} value={selected(c, g)} onChange={(e) => change(c, g, Number(e.target.value))}>
                        <option value={0}>לא נבחר</option>
                        {options(c, g).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    ) : (
                      <span className={selected(c, g) ? "" : "text-muted"}>{byId.get(selected(c, g))?.title ?? "לא נבחר"}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-brand" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
