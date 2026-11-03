"use client";
// חלון השיחה עם עוזר האירוע. ההודעות נשמרות במסד (agent_messages), כך שהשיחה נשארת גם אחרי רענון.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["החלפנו את הפרחים הסגולים בלבנים", "המצגת תעלה אחרי המנה העיקרית", "יש לנו עוד 4 טבעונים", "אפשר להזיז את האירוע בשבוע?"];

export function AgentChat({ eventId, initial }: { eventId: string; initial: Msg[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, message }),
      });
      const data = (await res.json()) as { reply?: string; actions?: string[]; error?: string };
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? data.error ?? "שגיאה" }]);
      // אם העוזר עדכן משהו, מרעננים את הדף כדי שהטופס, התפריט והיומן יראו את השינוי
      if (data.actions?.some((a) => a !== "get_event_details" && a !== "list_menu_options")) router.refresh();
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "אין חיבור כרגע. נסו שוב." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[480px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-cream p-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="p-2 text-sm text-muted">
            כתבו כאן כל שינוי או שאלה על האירוע, כמו בוואטסאפ. העוזר מעדכן את התיק, ומה שדורש החלטה של הצוות עובר למנהלת האירוע.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "ms-auto rounded-se-sm bg-brand text-white" : "rounded-ss-sm bg-white shadow-sm"}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="w-16 rounded-2xl bg-white px-4 py-2 text-center text-sm shadow-sm">…</div>}
        <div ref={endRef} />
      </div>
      {messages.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="rounded-full border border-line bg-white px-3 py-1 text-xs hover:bg-brand-light" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input className="field" value={input} onChange={(e) => setInput(e.target.value)} placeholder="כתבו הודעה…" disabled={busy} aria-label="הודעה לעוזר" />
        <button className="btn-primary" disabled={busy || !input.trim()}>שליחה</button>
      </form>
    </div>
  );
}
