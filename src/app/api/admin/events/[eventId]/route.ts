import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isEventPastByDateString } from "@/lib/event-date";
import { ensureEventAccess } from "@/lib/auth/event-access";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { eventId } = await params;
  const check = await ensureEventAccess(eventId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("events")
    .select("id,title,city,event_date,event_time,is_active")
    .eq("id", eventId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  }

  const isPast = isEventPastByDateString(data.event_date);

  return NextResponse.json({
    event: {
      ...data,
      isPast,
    },
  });
}
