// נקודת הקצה של עוזר האירוע: POST { eventId, message } → { reply, actions }
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agent";

export const maxDuration = 60; // שניות. סבב כלים יכול לקחת זמן

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { eventId?: string; message?: string } | null;
  const message = body?.message?.trim().slice(0, 2000);
  if (!body?.eventId || !message) return NextResponse.json({ error: "חסרה הודעה" }, { status: 400 });

  // בדיקת גישה: אם ה-RLS לא מחזיר את האירוע, המשתמש לא רשאי לדבר עליו
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("id").eq("id", body.eventId).maybeSingle();
  if (!ev) return NextResponse.json({ error: "האירוע לא נמצא" }, { status: 404 });

  try {
    return NextResponse.json(await runAgent(body.eventId, profile.id, message));
  } catch (err) {
    // מהספציפי לכללי: עומס, בעיית רשת, שגיאת API אחרת
    console.error("agent failed", err);
    if (err instanceof Anthropic.RateLimitError)
      return NextResponse.json({ error: "העוזר עמוס כרגע. נסו שוב בעוד דקה." }, { status: 429 });
    if (err instanceof Anthropic.APIConnectionError)
      return NextResponse.json({ error: "אין חיבור לעוזר כרגע. נסו שוב בעוד רגע." }, { status: 503 });
    return NextResponse.json({ error: "העוזר לא זמין כרגע. אפשר לנסות שוב בעוד רגע." }, { status: 502 });
  }
}
