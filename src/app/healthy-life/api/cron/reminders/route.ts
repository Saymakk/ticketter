import { NextResponse } from "next/server";
import { getHealthyLifeCronSecret } from "@/lib/healthy-life/push-config";
import { runHealthyLifeReminders } from "@/lib/healthy-life/reminders";

function authorize(request: Request): boolean {
  const secret = getHealthyLifeCronSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const query = new URL(request.url).searchParams.get("secret");
  return bearer === secret || query === secret;
}

/** Same cron on Healthy Life host path (after proxy rewrite). */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runHealthyLifeReminders();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reminder run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
