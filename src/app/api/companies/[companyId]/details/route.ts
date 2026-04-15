import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { canAdminAccessCompany, getActorCompanyProfile } from "@/lib/auth/company-access";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireEventManager();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { companyId } = await params;

  const actor = await getActorCompanyProfile(auth.ctx.user.id);
  if (!actor) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  if (actor.role === "admin") {
    const allowed = actor.company_id === companyId || (await canAdminAccessCompany(actor.id, companyId));
    if (!allowed) return NextResponse.json({ error: "Нет доступа к компании" }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();
  const [{ data: company, error: cErr }, { data: events, error: eErr }] = await Promise.all([
    admin
      .from("companies")
      .select("id,name,image_url,custom_data,is_legacy,created_by,created_at")
      .eq("id", companyId)
      .maybeSingle(),
    admin
      .from("events")
      .select("id,title,city,event_date,event_time,is_active,created_by,created_at")
      .eq("company_id", companyId)
      .order("event_date", { ascending: false }),
  ]);
  if (cErr || !company) return NextResponse.json({ error: cErr?.message ?? "Компания не найдена" }, { status: 404 });
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 400 });

  const eventIds = (events ?? []).map((e) => e.id);
  const [
    { data: tickets, error: tErr },
    { data: companyAdminAccess, error: caErr },
    { data: eventAdminAccess, error: eaErr },
    { data: eventUserAccess, error: uaErr },
  ] = await Promise.all([
    eventIds.length
      ? admin
          .from("tickets")
          .select("id,uuid,event_id,buyer_name,phone,status,ticket_type,region,created_at,checked_in_at")
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null } as any),
    admin
      .from("admin_company_access")
      .select("admin_id")
      .eq("company_id", companyId),
    eventIds.length
      ? admin
          .from("admin_event_access")
          .select("admin_id,event_id")
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null } as any),
    eventIds.length
      ? admin
          .from("user_event_access")
          .select("user_id,event_id")
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (tErr || caErr || eaErr || uaErr) {
    return NextResponse.json(
      { error: tErr?.message ?? caErr?.message ?? eaErr?.message ?? uaErr?.message ?? "Ошибка загрузки" },
      { status: 400 }
    );
  }

  const adminIds = new Set<string>();
  const userIds = new Set<string>();

  // Администраторы: только имеющие доступ к мероприятиям компании
  // (через all_events компании, явный доступ к событию, либо создатель события).
  for (const row of companyAdminAccess ?? []) adminIds.add(row.admin_id);
  for (const row of eventAdminAccess ?? []) adminIds.add(row.admin_id);
  // Пользователи: только привязанные к мероприятиям компании.
  for (const row of eventUserAccess ?? []) userIds.add(row.user_id);
  for (const ev of events ?? []) {
    if (ev.created_by) adminIds.add(ev.created_by);
  }

  const profileIds = [...new Set([...adminIds, ...userIds])];
  let allRelatedProfiles: Array<{
    id: string;
    full_name: string | null;
    phone: string | null;
    role: string;
    company_id: string | null;
    created_by: string | null;
    can_edit_tickets: boolean | null;
  }> = [];

  if (profileIds.length > 0) {
    const { data: relatedProfiles, error: relErr } = await admin
      .from("profiles")
      .select("id,full_name,phone,role,company_id,created_by,can_edit_tickets")
      .in("id", profileIds);
    if (relErr) {
      return NextResponse.json({ error: relErr.message }, { status: 400 });
    }
    allRelatedProfiles = relatedProfiles ?? [];
  }

  const admins = allRelatedProfiles.filter((p) => p.role === "admin");
  const users = allRelatedProfiles.filter((p) => p.role === "user");

  return NextResponse.json({
    company,
    events: events ?? [],
    tickets: tickets ?? [],
    admins,
    users,
  });
}

