import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/api-guards";

type Params = { params: Promise<{ companyId: string }> };

const bodySchema = z.object({
  adminId: z.string().uuid(),
  mode: z.enum(["all", "selected"]).default("all"),
  eventIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: Request, { params }: Params) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { companyId } = await params;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

  const { adminId, mode, eventIds } = parsed.data;
  const admin = createAdminSupabaseClient();
  const { data: company } = await admin.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (!company) return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });

  const { data: companyEvents, error: evErr } = await admin
    .from("events")
    .select("id")
    .eq("company_id", companyId);
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 400 });
  const companyEventIds = (companyEvents ?? []).map((x) => x.id);

  if (mode === "all") {
    const { error: companyErr } = await admin
      .from("admin_company_access")
      .delete()
      .eq("company_id", companyId)
      .eq("admin_id", adminId);
    if (companyErr) return NextResponse.json({ error: companyErr.message }, { status: 400 });

    if (companyEventIds.length > 0) {
      const { error: eventErr } = await admin
        .from("admin_event_access")
        .delete()
        .eq("admin_id", adminId)
        .in("event_id", companyEventIds);
      if (eventErr) return NextResponse.json({ error: eventErr.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const selected = [...new Set(eventIds ?? [])];
  if (selected.length === 0) {
    return NextResponse.json({ error: "Выберите мероприятия для снятия доступа" }, { status: 400 });
  }
  const validSelected = selected.filter((id) => companyEventIds.includes(id));
  if (validSelected.length === 0) {
    return NextResponse.json({ error: "Нет валидных мероприятий для этой компании" }, { status: 400 });
  }

  const { data: accessRow, error: accessErr } = await admin
    .from("admin_company_access")
    .select("all_events")
    .eq("company_id", companyId)
    .eq("admin_id", adminId)
    .maybeSingle();
  if (accessErr) return NextResponse.json({ error: accessErr.message }, { status: 400 });
  if (!accessRow) return NextResponse.json({ error: "У администратора нет доступа к компании" }, { status: 404 });

  if (accessRow.all_events) {
    const keepEventIds = companyEventIds.filter((id) => !validSelected.includes(id));
    if (keepEventIds.length === 0) {
      const { error: delCompanyErr } = await admin
        .from("admin_company_access")
        .delete()
        .eq("company_id", companyId)
        .eq("admin_id", adminId);
      if (delCompanyErr) return NextResponse.json({ error: delCompanyErr.message }, { status: 400 });
      const { error: delEventsErr } = await admin
        .from("admin_event_access")
        .delete()
        .eq("admin_id", adminId)
        .in("event_id", companyEventIds);
      if (delEventsErr) return NextResponse.json({ error: delEventsErr.message }, { status: 400 });
      return NextResponse.json({ ok: true, mode: "all_revoked_via_selected" });
    }

    const rows = keepEventIds.map((eventId) => ({
      admin_id: adminId,
      event_id: eventId,
      granted_by: auth.ctx.user.id,
    }));
    const { error: upsertErr } = await admin
      .from("admin_event_access")
      .upsert(rows, { onConflict: "admin_id,event_id" });
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 400 });

    const { error: updErr } = await admin
      .from("admin_company_access")
      .update({ all_events: false, granted_by: auth.ctx.user.id })
      .eq("company_id", companyId)
      .eq("admin_id", adminId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, mode: "selected" });
  }

  const { error: delErr } = await admin
    .from("admin_event_access")
    .delete()
    .eq("admin_id", adminId)
    .in("event_id", validSelected);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  const { data: remains, error: remainsErr } = await admin
    .from("admin_event_access")
    .select("event_id")
    .eq("admin_id", adminId)
    .in("event_id", companyEventIds)
    .limit(1);
  if (remainsErr) return NextResponse.json({ error: remainsErr.message }, { status: 400 });

  if (!remains || remains.length === 0) {
    const { error: delCompanyErr } = await admin
      .from("admin_company_access")
      .delete()
      .eq("company_id", companyId)
      .eq("admin_id", adminId);
    if (delCompanyErr) return NextResponse.json({ error: delCompanyErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, mode: "selected" });
}

