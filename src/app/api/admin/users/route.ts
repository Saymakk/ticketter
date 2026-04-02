import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";

/** Список учётных записей с ролью «пользователь» (для назначения на мероприятия и управления). */
export async function GET() {
  const check = await requireEventManager();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,full_name,phone,role,region,created_at")
    .eq("role", "user")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ users: data ?? [] });
}
