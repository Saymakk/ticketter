import { getAuthedProfile, type AuthResult } from "@/lib/auth/api-guards";
import { isSuperAdminRole } from "@/lib/auth/roles";

/** Owner email always has Workspace admin access (same person as Ticketter super-admin). */
export const WORKSPACE_OWNER_EMAIL = "vladsarana@gmail.com";

/**
 * Workspace admin = existing super_admin role, or the owner email.
 * No separate login / roles.
 */
export async function requireWorkspaceAdmin(): Promise<AuthResult> {
  const auth = await getAuthedProfile();
  if (!auth.ok) return auth;

  if (isSuperAdminRole(auth.ctx.profile.role)) {
    return auth;
  }

  const {
    data: { user },
  } = await auth.ctx.supabase.auth.getUser();

  const email = user?.email?.trim().toLowerCase() ?? "";
  if (email === WORKSPACE_OWNER_EMAIL) {
    return auth;
  }

  return { ok: false, status: 403, error: "Доступ запрещен" };
}

export function isWorkspaceOwnerEmail(email: string | null | undefined): boolean {
  return (email?.trim().toLowerCase() ?? "") === WORKSPACE_OWNER_EMAIL;
}
