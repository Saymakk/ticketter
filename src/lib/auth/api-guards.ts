import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isEventManagerRole, isStaffRole, isSuperAdminRole } from "@/lib/auth/roles";

type ProfileRow = { role: string };

export type AuthedContext = {
  user: { id: string };
  profile: ProfileRow;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
};

export type AuthResult =
  | { ok: true; ctx: AuthedContext }
  | { ok: false; status: number; error: string };

export async function getAuthedProfile(): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "Не авторизован" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.role) {
    return { ok: false, status: 403, error: "Профиль не найден" };
  }

  return { ok: true, ctx: { user, profile, supabase } };
}

export async function requireStaff(): Promise<AuthResult> {
  const r = await getAuthedProfile();
  if (!r.ok) return r;
  if (!isStaffRole(r.ctx.profile.role)) {
    return { ok: false, status: 403, error: "Доступ запрещен" };
  }
  return r;
}

export async function requireEventManager(): Promise<AuthResult> {
  const r = await getAuthedProfile();
  if (!r.ok) return r;
  if (!isEventManagerRole(r.ctx.profile.role)) {
    return { ok: false, status: 403, error: "Доступ запрещен" };
  }
  return r;
}

export async function requireSuperAdmin(): Promise<AuthResult> {
  const r = await getAuthedProfile();
  if (!r.ok) return r;
  if (!isSuperAdminRole(r.ctx.profile.role)) {
    return { ok: false, status: 403, error: "Доступ запрещен" };
  }
  return r;
}
