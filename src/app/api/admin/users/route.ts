import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { getAdminVisibleEventIds } from "@/lib/auth/event-access";

/** Список учётных записей с ролью «пользователь» (для назначения на мероприятия и управления). */
export async function GET() {
  const check = await requireEventManager();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const admin = createAdminSupabaseClient();
  if (check.ctx.profile.role === "super_admin") {
    const { data, error } = await admin
      .from("profiles")
      .select("id,full_name,phone,role,region,created_at,created_by")
      .eq("role", "user")
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ users: data ?? [] });
  }

  const myId = check.ctx.user.id;
  const visibleEventIds = await getAdminVisibleEventIds(myId);

  const [{ data: ownUsers, error: ownErr }, { data: superAdmins, error: saErr }] = await Promise.all([
    admin
      .from("profiles")
      .select("id,full_name,phone,role,region,created_at,created_by")
      .eq("role", "user")
      .eq("created_by", myId),
    admin.from("profiles").select("id").eq("role", "super_admin"),
  ]);

  if (ownErr || saErr) {
    return NextResponse.json({ error: ownErr?.message ?? saErr?.message ?? "Ошибка загрузки" }, { status: 400 });
  }

  const superAdminIds = (superAdmins ?? []).map((x) => x.id);
  let sharedUsers: Array<Record<string, unknown>> = [];
  if (visibleEventIds.length > 0) {
    const { data: links, error: linksErr } = await admin
      .from("user_event_access")
      .select("user_id")
      .in("event_id", visibleEventIds);
    if (linksErr) return NextResponse.json({ error: linksErr.message }, { status: 400 });

    const sharedIds = [...new Set((links ?? []).map((x) => x.user_id))];
    if (sharedIds.length > 0) {
      const { data: shared, error: sharedErr } = await admin
        .from("profiles")
        .select("id,full_name,phone,role,region,created_at,created_by")
        .eq("role", "user")
        .in("id", sharedIds);
      if (sharedErr) return NextResponse.json({ error: sharedErr.message }, { status: 400 });
      sharedUsers = (shared ?? []) as Array<Record<string, unknown>>;
    }
  }

  let superCreatedUnassigned: Array<Record<string, unknown>> = [];
  if (superAdminIds.length > 0) {
    const { data: supUsers, error: supUsersErr } = await admin
      .from("profiles")
      .select("id,full_name,phone,role,region,created_at,created_by")
      .eq("role", "user")
      .in("created_by", superAdminIds);
    if (supUsersErr) return NextResponse.json({ error: supUsersErr.message }, { status: 400 });

    const supUserIds = (supUsers ?? []).map((u) => u.id);
    if (supUserIds.length > 0) {
      const { data: links, error: linksErr } = await admin
        .from("user_event_access")
        .select("user_id")
        .in("user_id", supUserIds);
      if (linksErr) return NextResponse.json({ error: linksErr.message }, { status: 400 });
      const assigned = new Set((links ?? []).map((x) => x.user_id));
      superCreatedUnassigned = ((supUsers ?? []).filter((u) => !assigned.has(u.id)) ?? []) as Array<Record<string, unknown>>;
    }
  }

  const all = [...(ownUsers ?? []), ...sharedUsers, ...superCreatedUnassigned] as Array<{
    id: string;
    full_name: string | null;
    phone: string | null;
    role: string;
    region: string | null;
    created_at: string;
    created_by: string | null;
  }>;
  const dedup = Array.from(new Map(all.map((u) => [u.id, u])).values()).sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );

  return NextResponse.json({ users: dedup });
}
