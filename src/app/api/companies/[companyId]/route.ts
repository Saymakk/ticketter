import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { getActorCompanyProfile } from "@/lib/auth/company-access";

type Params = { params: Promise<{ companyId: string }> };

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  imageUrl: z.string().nullable().optional(),
  customData: z.record(z.string(), z.any()).optional(),
});

async function canMutateCompany(actorId: string, role: string, companyId: string): Promise<boolean> {
  if (role === "super_admin") return true;
  if (role !== "admin") return false;
  const actor = await getActorCompanyProfile(actorId);
  if (!actor) return false;
  if (actor.company_id) return false;
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("created_by", actorId)
    .maybeSingle();
  return Boolean(data);
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireEventManager();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { companyId } = await params;
  const canMutate = await canMutateCompany(auth.ctx.user.id, auth.ctx.profile.role, companyId);
  if (!canMutate) return NextResponse.json({ error: "Нет прав на редактирование компании" }, { status: 403 });

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

  const payload: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) payload.name = parsed.data.name.trim();
  if (parsed.data.imageUrl !== undefined) payload.image_url = parsed.data.imageUrl;
  if (parsed.data.customData !== undefined) payload.custom_data = parsed.data.customData;
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("companies")
    .update(payload)
    .eq("id", companyId)
    .eq("is_legacy", false)
    .select("id,name,image_url,custom_data,is_legacy,created_by,created_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Компания не найдена или недоступна для редактирования" }, { status: 404 });
  return NextResponse.json({ ok: true, company: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireEventManager();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { companyId } = await params;
  const canMutate = await canMutateCompany(auth.ctx.user.id, auth.ctx.profile.role, companyId);
  if (!canMutate) return NextResponse.json({ error: "Нет прав на удаление компании" }, { status: 403 });

  const admin = createAdminSupabaseClient();
  const { data: events } = await admin.from("events").select("id").eq("company_id", companyId).limit(1);
  if ((events ?? []).length > 0) {
    return NextResponse.json({ error: "Нельзя удалить компанию, у которой есть мероприятия" }, { status: 400 });
  }

  const { data: row, error } = await admin
    .from("companies")
    .delete()
    .eq("id", companyId)
    .eq("is_legacy", false)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!row) return NextResponse.json({ error: "Компания не найдена или недоступна для удаления" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

