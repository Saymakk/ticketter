import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/api-guards";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export async function GET(request: Request) {
  const check = await requireSuperAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const url = new URL(request.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT)
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const actorId = url.searchParams.get("actorId")?.trim() || undefined;
  const actionEq = url.searchParams.get("action")?.trim() || undefined;

  const admin = createAdminSupabaseClient();
  let q = admin
    .from("audit_logs")
    .select(
      "id,created_at,actor_id,action,resource_type,resource_id,path,method,metadata,ip,user_agent"
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actorId) q = q.eq("actor_id", actorId);
  if (actionEq) q = q.eq("action", actionEq);

  const { data: logs, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id))];
  let profiles: { id: string; full_name: string | null; phone: string | null; role: string }[] =
    [];
  if (actorIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id,full_name,phone,role")
      .in("id", actorIds);
    profiles = profs ?? [];
  }

  const map = new Map(profiles.map((p) => [p.id, p]));
  const enriched = (logs ?? []).map((l) => ({
    ...l,
    actorProfile: map.get(l.actor_id) ?? null,
  }));

  return NextResponse.json({ logs: enriched, limit, offset });
}
