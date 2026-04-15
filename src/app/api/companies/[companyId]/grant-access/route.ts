import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/api-guards";

type Params = { params: Promise<{ companyId: string }> };

const bodySchema = z.object({
  adminId: z.string().uuid(),
  allEvents: z.boolean(),
  eventIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: Request, { params }: Params) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { companyId } = await params;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  const { adminId, allEvents, eventIds } = parsed.data;

  const admin = createAdminSupabaseClient();
  const [{ data: company }, { data: targetAdmin }] = await Promise.all([
    admin.from("companies").select("id").eq("id", companyId).maybeSingle(),
    admin.from("profiles").select("id,role").eq("id", adminId).maybeSingle(),
  ]);
  if (!company) return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
  if (!targetAdmin || targetAdmin.role !== "admin") {
    return NextResponse.json({ error: "Доступ можно выдать только администратору" }, { status: 400 });
  }

  const { error: upsertErr } = await admin.from("admin_company_access").upsert(
    {
      admin_id: adminId,
      company_id: companyId,
      all_events: allEvents,
      granted_by: auth.ctx.user.id,
    },
    { onConflict: "admin_id,company_id" }
  );
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 400 });

  let grantedEvents = 0;
  if (!allEvents) {
    const uniq = [...new Set(eventIds ?? [])];
    if (uniq.length > 0) {
      const { data: existing, error: evErr } = await admin
        .from("events")
        .select("id")
        .eq("company_id", companyId)
        .in("id", uniq);
      if (evErr) return NextResponse.json({ error: evErr.message }, { status: 400 });
      const existingSet = new Set((existing ?? []).map((x) => x.id));
      const validIds = uniq.filter((id) => existingSet.has(id));
      if (validIds.length > 0) {
        const rows = validIds.map((eventId) => ({
          admin_id: adminId,
          event_id: eventId,
          granted_by: auth.ctx.user.id,
        }));
        const { error: grantErr } = await admin
          .from("admin_event_access")
          .upsert(rows, { onConflict: "admin_id,event_id" });
        if (grantErr) return NextResponse.json({ error: grantErr.message }, { status: 400 });
        grantedEvents = validIds.length;
      }
    }
  }

  return NextResponse.json({ ok: true, grantedEvents });
}

