import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/api-guards";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { companyId } = await params;

  const admin = createAdminSupabaseClient();
  const { data: company } = await admin.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (!company) return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });

  const [{ data: companyAccess, error: caErr }, { data: events, error: evErr }] = await Promise.all([
    admin
      .from("admin_company_access")
      .select("admin_id,all_events,created_at,granted_by")
      .eq("company_id", companyId),
    admin.from("events").select("id,title").eq("company_id", companyId),
  ]);

  if (caErr || evErr) {
    return NextResponse.json({ error: caErr?.message ?? evErr?.message ?? "Ошибка загрузки" }, { status: 400 });
  }

  const adminIds = [...new Set((companyAccess ?? []).map((x) => x.admin_id))];
  let eventRows: Array<{ admin_id: string; event_id: string }> = [];
  if (adminIds.length > 0 && (events ?? []).length > 0) {
    const eventIds = (events ?? []).map((e) => e.id);
    const { data: rows, error: rowsErr } = await admin
      .from("admin_event_access")
      .select("admin_id,event_id")
      .in("admin_id", adminIds)
      .in("event_id", eventIds);
    if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 400 });
    eventRows = rows ?? [];
  }

  const byAdmin = new Map<string, string[]>();
  for (const r of eventRows) {
    byAdmin.set(r.admin_id, [...(byAdmin.get(r.admin_id) ?? []), r.event_id]);
  }

  const profileIds = [...new Set((companyAccess ?? []).map((x) => x.admin_id))];
  let profilesById = new Map<string, { full_name: string | null; phone: string | null }>();
  if (profileIds.length > 0) {
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id,full_name,phone")
      .in("id", profileIds);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
    profilesById = new Map(
      (profiles ?? []).map((p) => [p.id, { full_name: p.full_name ?? null, phone: p.phone ?? null }])
    );
  }

  const access = (companyAccess ?? []).map((row) => ({
    adminId: row.admin_id,
    adminName: profilesById.get(row.admin_id)?.full_name ?? null,
    adminPhone: profilesById.get(row.admin_id)?.phone ?? null,
    allEvents: row.all_events,
    eventIds: row.all_events ? (events ?? []).map((e) => e.id) : byAdmin.get(row.admin_id) ?? [],
    createdAt: row.created_at,
    grantedBy: row.granted_by,
  }));

  return NextResponse.json({
    companyId,
    events: events ?? [],
    access,
  });
}

