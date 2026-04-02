import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";

const bodySchema = z.object({
  userId: z.string().uuid(),
  eventId: z.string().uuid(),
});

export async function POST(request: Request) {
  const check = await requireEventManager();
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

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (targetProfile?.role !== "user") {
    return NextResponse.json(
      {
        error:
          "Назначать на мероприятие можно только учётные записи с ролью «пользователь».",
      },
      { status: 400 }
    );
  }

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