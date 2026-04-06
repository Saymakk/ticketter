import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdminRole } from "@/lib/auth/roles";

type StaffRole = "user" | "admin" | "super_admin";

/** Снятие user_event_access: у создателя мероприятия — только суперадмин; иначе суперадмин или админ с правом на мероприятие. */
export function canRevokeExplicitUserAccess(params: {
  actorRole: string;
  eventCreatorId: string | null;
  targetProfileId: string;
  actorCanManageEvent: boolean;
}): boolean {
  const { actorRole, eventCreatorId, targetProfileId, actorCanManageEvent } = params;

  if (eventCreatorId && targetProfileId === eventCreatorId) {
    return isSuperAdminRole(actorRole);
  }
  if (isSuperAdminRole(actorRole)) return true;
  return actorRole === "admin" && actorCanManageEvent;
}

/** Снятие admin_event_access: у создателя мероприятия — только суперадмин; иначе суперадмин, создатель мероприятия или тот, кто выдал доступ (granted_by). */
export function canRevokeExplicitAdminDelegation(params: {
  actorRole: string;
  actorId: string;
  eventCreatorId: string | null;
  targetAdminId: string;
  grantedBy: string | null;
}): boolean {
  const { actorRole, actorId, eventCreatorId, targetAdminId, grantedBy } = params;

  if (eventCreatorId && targetAdminId === eventCreatorId) {
    return isSuperAdminRole(actorRole);
  }
  if (isSuperAdminRole(actorRole)) return true;
  if (eventCreatorId && actorId === eventCreatorId) return true;
  if (grantedBy && grantedBy === actorId) return true;
  return false;
}

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

export const TICKET_EDIT_FORBIDDEN_MESSAGE =
  "Нет права создавать и изменять билеты. Доступны просмотр и работа в сканере.";

/** Доступ к изменению билетов (создание, правка, удаление, массовые операции, выгрузки). Для роли user учитывается profiles.can_edit_tickets. */
export async function ensureTicketMutationAccess(
  eventId: string
): Promise<
  | { ok: true; userId: string; role: StaffRole }
  | { ok: false; status: number; error: string }
> {
  const check = await ensureEventAccess(eventId);
  if (!check.ok) return check;

  if (check.role === "super_admin" || check.role === "admin") {
    return check;
  }

  const admin = createAdminSupabaseClient();
  const { data: row, error } = await admin
    .from("profiles")
    .select("can_edit_tickets")
    .eq("id", check.userId)
    .maybeSingle();

  if (!error && row?.can_edit_tickets === false) {
    return { ok: false, status: 403, error: TICKET_EDIT_FORBIDDEN_MESSAGE };
  }

  return check;
}
