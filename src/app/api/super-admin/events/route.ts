import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { getAdminVisibleEventIds } from "@/lib/auth/event-access";

export async function GET() {
  const check = await requireEventManager();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const admin = createAdminSupabaseClient();
  if (check.ctx.profile.role === "admin") {
    const visibleEventIds = await getAdminVisibleEventIds(check.ctx.user.id);
    if (visibleEventIds.length === 0) return NextResponse.json({ events: [] });
    const { data, error } = await admin
      .from("events")
      .select("id,title,city,event_date,event_time,is_active,created_at,company_id")
      .in("id", visibleEventIds)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ events: data ?? [] });
  }

  const { data, error } = await admin
    .from("events")
    .select("id,title,city,event_date,event_time,is_active,created_at,company_id")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ events: data ?? [] });
}
