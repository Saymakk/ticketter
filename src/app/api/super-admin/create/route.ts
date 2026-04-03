import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { isValidOptionalEventTime } from "@/lib/event-date";

const bodySchema = z.object({
  title: z.string().min(2),
  city: z.string().min(2),
  eventDate: z.string().min(10), // формат YYYY-MM-DD
  eventTime: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const check = await requireEventManager();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const payload = await request.json();
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const { title, city, eventDate, eventTime } = parsed.data;
  const timeTrim = typeof eventTime === "string" ? eventTime.trim() : "";
  if (timeTrim && !isValidOptionalEventTime(timeTrim)) {
    return NextResponse.json({ error: "Время: формат HH:MM" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("events")
    .insert({
      title,
      city,
      event_date: eventDate,
      event_time: timeTrim || null,
      is_active: true,
    })
    .select("id,title,city,event_date,event_time,is_active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, event: data });
}