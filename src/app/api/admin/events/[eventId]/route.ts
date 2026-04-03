import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isEventManagerRole } from "@/lib/auth/roles";
import { isEventPastByDateString } from "@/lib/event-date";

type Params = { params: Promise<{ eventId: string }> };

async function ensureAccess(eventId: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { ok: false as const, status: 401, error: "Не авторизован" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (isEventManagerRole(profile?.role)) {
    return { ok: true as const };
  }

  const { data: access } = await supabase
    .from("user_event_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!access) return { ok: false as const, status: 403, error: "Нет доступа к мероприятию" };

  return { ok: true as const };
}

export async function GET(_: Request, { params }: Params) {
  const { eventId } = await params;
  const check = await ensureAccess(eventId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("events")
    .select("id,title,city,event_date,is_active")
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
