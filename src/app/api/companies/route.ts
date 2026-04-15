import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { getActorCompanyProfile } from "@/lib/auth/company-access";

const bodySchema = z.object({
  name: z.string().min(2),
  imageUrl: z.string().min(1).optional().nullable(),
  customData: z.record(z.string(), z.any()).optional(),
  adminIds: z.array(z.string().uuid()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
});

export async function GET() {
  const auth = await requireEventManager();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const actor = await getActorCompanyProfile(auth.ctx.user.id);
  if (!actor) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

  const admin = createAdminSupabaseClient();

  if (actor.role === "super_admin") {
    const { data, error } = await admin
      .from("companies")
      .select("id,name,image_url,custom_data,is_legacy,created_by,created_at")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ companies: data ?? [], canCreate: true, boundCompanyId: null });
  }

  if (actor.role === "admin" && actor.company_id) {
    const { data, error } = await admin
      .from("companies")
      .select("id,name,image_url,custom_data,is_legacy,created_by,created_at")
      .eq("id", actor.company_id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({
      companies: data ?? [],
      canCreate: false,
      boundCompanyId: actor.company_id,
    });
  }

  const [{ data: own, error: ownErr }, { data: delegated, error: delErr }] = await Promise.all([
    admin
      .from("companies")
      .select("id,name,image_url,custom_data,is_legacy,created_by,created_at")
      .eq("created_by", actor.id),
    admin
      .from("admin_company_access")
      .select("company:companies(id,name,image_url,custom_data,is_legacy,created_by,created_at)")
      .eq("admin_id", actor.id),
  ]);
  if (ownErr || delErr) {
    return NextResponse.json({ error: ownErr?.message ?? delErr?.message ?? "Ошибка" }, { status: 400 });
  }

  const delegatedRows = (delegated ?? [])
    .map((x) => (x as { company?: unknown }).company)
    .filter(Boolean) as Array<Record<string, unknown>>;
  const uniq = Array.from(
    new Map(
      [...(own ?? []), ...delegatedRows].map((c) => [String((c as { id: string }).id), c])
    ).values()
  );

  return NextResponse.json({ companies: uniq, canCreate: true, boundCompanyId: null });
}

export async function POST(request: Request) {
  const auth = await requireEventManager();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const actor = await getActorCompanyProfile(auth.ctx.user.id);
  if (!actor) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  if (actor.role === "admin" && actor.company_id) {
    return NextResponse.json(
      { error: "Администратор привязан к компании и не может создавать компании" },
      { status: 403 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные компании" }, { status: 400 });
  }

  const { name, imageUrl, customData, adminIds, userIds } = parsed.data;
  const admin = createAdminSupabaseClient();
  const { data: company, error } = await admin
    .from("companies")
    .insert({
      name: name.trim(),
      image_url: imageUrl ?? null,
      custom_data: customData ?? {},
      created_by: actor.id,
    })
    .select("id,name,image_url,custom_data,is_legacy,created_by,created_at")
    .single();

  if (error || !company) {
    return NextResponse.json({ error: error?.message ?? "Ошибка создания компании" }, { status: 400 });
  }

  const profileIds = [...new Set([...(adminIds ?? []), ...(userIds ?? [])])];
  if (profileIds.length > 0) {
    if (actor.role !== "super_admin") {
      return NextResponse.json(
        { error: "Назначать админов и пользователей при создании компании может только суперадмин" },
        { status: 403 }
      );
    }

    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id,role")
      .in("id", profileIds);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

    const toBind = (profiles ?? [])
      .filter((p) => p.role === "admin" || p.role === "user")
      .map((p) => p.id);

    if (toBind.length > 0) {
      const { error: updErr } = await admin
        .from("profiles")
        .update({ company_id: company.id })
        .in("id", toBind);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, company });
}

