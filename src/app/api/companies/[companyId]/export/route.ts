import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { canAdminAccessCompany, getActorCompanyProfile } from "@/lib/auth/company-access";

type Params = { params: Promise<{ companyId: string }> };

function attachmentDisposition(utf8FileName: string, asciiFallback: string): string {
  const safeAscii = asciiFallback.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(utf8FileName)}`;
}

export async function GET(request: Request, { params }: Params) {
  const auth = await requireEventManager();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { companyId } = await params;
  const url = new URL(request.url);
  const onlyEventId = url.searchParams.get("eventId");

  const actor = await getActorCompanyProfile(auth.ctx.user.id);
  if (!actor) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  if (actor.role === "admin") {
    const allowed = actor.company_id === companyId || (await canAdminAccessCompany(actor.id, companyId));
    if (!allowed) return NextResponse.json({ error: "Нет доступа к компании" }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();
  const { data: company } = await admin
    .from("companies")
    .select("id,name")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });

  let eventsQuery = admin
    .from("events")
    .select("id,title,city,event_date,event_time,is_active,created_by,created_at")
    .eq("company_id", companyId);
  if (onlyEventId) eventsQuery = eventsQuery.eq("id", onlyEventId);
  const { data: events, error: eErr } = await eventsQuery.order("event_date", { ascending: false });
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 400 });

  const eventIds = (events ?? []).map((e) => e.id);
  const [{ data: tickets, error: tErr }, { data: profiles, error: pErr }] = await Promise.all([
    eventIds.length
      ? admin
          .from("tickets")
          .select("id,uuid,event_id,buyer_name,phone,status,ticket_type,region,created_at,checked_in_at")
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null } as any),
    admin
      .from("profiles")
      .select("id,full_name,phone,role,company_id,created_by,can_edit_tickets")
      .eq("company_id", companyId),
  ]);
  if (tErr || pErr) return NextResponse.json({ error: tErr?.message ?? pErr?.message ?? "Ошибка" }, { status: 400 });

  const wb = XLSX.utils.book_new();
  const meta = [
    ["company_id", company.id],
    ["company_name", company.name],
    ["exported_at", new Date().toISOString()],
    ["event_filter", onlyEventId ?? ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["field", "value"], ...meta]), "company");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(events ?? []), "events");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tickets ?? []), "tickets");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(profiles ?? []), "profiles");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const base = String(company.name || "company").replace(/[^\w\-\s\u0400-\u04FF]+/g, "_").slice(0, 80);
  const xlsxName = `${base}-${onlyEventId ? "event" : "full"}.xlsx`;
  const ascii = `company-${company.id.slice(0, 8)}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": attachmentDisposition(xlsxName, ascii),
    },
  });
}

