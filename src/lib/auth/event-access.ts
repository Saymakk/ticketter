import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type StaffRole = "user" | "admin" | "super_admin";

export async function getAuthedStaff() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, status: 401, error: "Не авторизован" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["user", "admin", "super_admin"].includes(profile.role)) {
    return { ok: false as const, status: 403, error: "Доступ запрещен" };
  }

  return {
    ok: true as const,
    userId: user.id,
    role: profile.role as StaffRole,
    supabase,
  };
}

export async function getAdminVisibleEventIds(adminId: string): Promise<string[]> {
  const admin = createAdminSupabaseClient();
  const [{ data: owned }, { data: delegated }] = await Promise.all([
    admin.from("events").select("id").eq("created_by", adminId),
    admin.from("admin_event_access").select("event_id").eq("admin_id", adminId),
  ]);

  return [...new Set([...(owned ?? []).map((x) => x.id), ...(delegated ?? []).map((x) => x.event_id)])];
}

export async function canAdminAccessEvent(adminId: string, eventId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { data: owned } = await admin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("created_by", adminId)
    .maybeSingle();
  if (owned) return true;

  const { data: delegated } = await admin
    .from("admin_event_access")
    .select("event_id")
    .eq("admin_id", adminId)
    .eq("event_id", eventId)
    .maybeSingle();
  return !!delegated;
}

export async function ensureEventAccess(eventId: string) {
  const auth = await getAuthedStaff();
  if (!auth.ok) return auth;

  if (auth.role === "super_admin") {
    return { ok: true as const, userId: auth.userId, role: auth.role };
  }

  if (auth.role === "admin") {
    const allowed = await canAdminAccessEvent(auth.userId, eventId);
    if (!allowed) return { ok: false as const, status: 403, error: "Нет доступа к мероприятию" };
    return { ok: true as const, userId: auth.userId, role: auth.role };
  }

  const { data: access } = await auth.supabase
    .from("user_event_access")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!access) return { ok: false as const, status: 403, error: "Нет доступа к мероприятию" };
  return { ok: true as const, userId: auth.userId, role: auth.role };
}
