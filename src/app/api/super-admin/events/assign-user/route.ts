import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  userId: z.string().uuid(),
  eventId: z.string().uuid(),
});

async function ensureSuperAdmin() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, status: 401, error: "Не авторизован" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "super_admin") {
    return { ok: false as const, status: 403, error: "Доступ запрещен" };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  const check = await ensureSuperAdmin();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const payload = await request.json();
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const { userId, eventId } = parsed.data;

  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("user_event_access").insert({
    user_id: userId,
    event_id: eventId,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Пользователь уже назначен на данное мероприятие" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}