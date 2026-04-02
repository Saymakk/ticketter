import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/api-guards";

/** Список администраторов (без суперадминов). */
export async function GET() {
  const check = await requireSuperAdmin();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,full_name,phone,role,region,created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ admins: data ?? [] });
}
