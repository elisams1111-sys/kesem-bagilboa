// תזכורות שעתיות לבקשות פתוחות. מופעל ע"י מתזמן חיצוני (Supabase pg_cron או Vercel Pro), ראו docs/deploy.md
import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron, runReminders } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, reminders: await runReminders() });
}
