import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type ActorCompanyProfile = {
  id: string;
  role: "user" | "admin" | "super_admin";
  company_id: string | null;
};

export async function getActorCompanyProfile(userId: string): Promise<ActorCompanyProfile | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("profiles")
    .select("id,role,company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data || (data.role !== "user" && data.role !== "admin" && data.role !== "super_admin")) {
    return null;
  }
  return {
    id: data.id,
    role: data.role,
    company_id: data.company_id ?? null,
  };
}

export async function getLegacyCompanyId(): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("companies")
    .select("id")
    .eq("is_legacy", true)
    .maybeSingle();
  return data?.id ?? null;
}

export async function canAdminAccessCompany(adminId: string, companyId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const [{ data: owned }, { data: delegated }] = await Promise.all([
    admin
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .eq("created_by", adminId)
      .maybeSingle(),
    admin
      .from("admin_company_access")
      .select("company_id")
      .eq("admin_id", adminId)
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);
  return Boolean(owned || delegated);
}

export async function resolveEventCompanyId(params: {
  actorId: string;
  requestedCompanyId?: string | null;
}): Promise<
  | { ok: true; companyId: string }
  | { ok: false; status: number; error: string }
> {
  const actor = await getActorCompanyProfile(params.actorId);
  if (!actor) return { ok: false, status: 403, error: "Нет доступа" };

  const req = params.requestedCompanyId?.trim() || null;
  const admin = createAdminSupabaseClient();

  if (actor.role === "admin") {
    if (actor.company_id) {
      if (req && req !== actor.company_id) {
        return { ok: false, status: 403, error: "Администратор привязан к другой компании" };
      }
      return { ok: true, companyId: actor.company_id };
    }
    if (req) {
      const allowed = await canAdminAccessCompany(actor.id, req);
      if (!allowed) return { ok: false, status: 403, error: "Нет доступа к компании" };
      return { ok: true, companyId: req };
    }
    const legacy = await getLegacyCompanyId();
    if (!legacy) return { ok: false, status: 400, error: "Не найдена legacy-компания" };
    return { ok: true, companyId: legacy };
  }

  if (actor.role === "super_admin") {
    if (req) {
      const { data } = await admin.from("companies").select("id").eq("id", req).maybeSingle();
      if (!data) return { ok: false, status: 404, error: "Компания не найдена" };
      return { ok: true, companyId: req };
    }
    const legacy = await getLegacyCompanyId();
    if (!legacy) return { ok: false, status: 400, error: "Не найдена legacy-компания" };
    return { ok: true, companyId: legacy };
  }

  return { ok: false, status: 403, error: "Роль не может создавать мероприятия" };
}

