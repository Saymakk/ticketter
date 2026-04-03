import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isEventManagerRole, isStaffRole } from "@/lib/auth/roles";
import { getAdminVisibleEventIds } from "@/lib/auth/event-access";

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !isStaffRole(profile.role)) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  if (isEventManagerRole(profile.role)) {
    const admin = createAdminSupabaseClient();
    if (profile.role === "admin") {
      const visibleEventIds = await getAdminVisibleEventIds(user.id);
      if (visibleEventIds.length === 0) return NextResponse.json({ events: [] });
      const { data, error } = await admin
        .from("events")
        .select("id,title,city,event_date,is_active")
        .in("id", visibleEventIds)
        .order("event_date", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ events: data ?? [] });
    }

    const { data, error } = await admin
      .from("events")
      .select("id,title,city,event_date,is_active")
      .order("event_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ events: data ?? [] });
  }

  const { data, error } = await supabase
    .from("user_event_access")
    .select("event:events(id,title,city,event_date,is_active)")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const events = (data ?? []).map((row: { event: unknown }) => row.event).filter(Boolean);
  return NextResponse.json({ events });
}
