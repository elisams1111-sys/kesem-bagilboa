// Cron יומי (vercel.json: כל יום ב-04:00 UTC, כלומר 06:00–07:00 בישראל)
import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron, runDailyJobs, runReminders } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await runDailyJobs();
  // בחשבון Vercel Hobby אין Cron כל שעה, ולכן גם התזכורות רצות כאן (ראו docs/deploy.md לתזמון שעתי)
  const reminders = await runReminders(new Date(), true);
  return NextResponse.json({ ok: true, ...report, reminders });
}
