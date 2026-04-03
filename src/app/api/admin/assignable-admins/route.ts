import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";

export async function GET() {
  const check = await requireEventManager();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const admin = createAdminSupabaseClient();
  let query = admin
    .from("profiles")
    .select("id,full_name,phone,role,region,created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: false });

  if (check.ctx.profile.role === "admin") {
    query = query.neq("id", check.ctx.user.id);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ admins: data ?? [] });
}
