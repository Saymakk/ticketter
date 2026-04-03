import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { canAdminAccessEvent } from "@/lib/auth/event-access";
import { isEventPastByDateString, EVENT_ASSIGNMENTS_LOCKED_MESSAGE } from "@/lib/event-date";

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
  const actorRole = check.ctx.profile.role;
  const actorId = check.ctx.user.id;

  if (actorRole === "admin") {
    const canManage = await canAdminAccessEvent(actorId, eventId);
    if (!canManage) {
      return NextResponse.json({ error: "Нет доступа к мероприятию" }, { status: 403 });
    }
  }

  const { data: eventRow } = await admin.from("events").select("event_date").eq("id", eventId).maybeSingle();
  if (!eventRow) {
    return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  }
  if (isEventPastByDateString(eventRow.event_date)) {
    return NextResponse.json({ error: EVENT_ASSIGNMENTS_LOCKED_MESSAGE }, { status: 403 });
  }

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!targetProfile || (targetProfile.role !== "user" && targetProfile.role !== "admin")) {
    return NextResponse.json(
      {
        error: "Назначать на мероприятие можно только пользователей или администраторов.",
      },
      { status: 400 }
    );
  }

  if (targetProfile.role === "admin" && actorRole !== "super_admin" && userId === actorId) {
    return NextResponse.json({ error: "Нельзя выдавать доступ самому себе" }, { status: 400 });
  }

  const { error } =
    targetProfile.role === "admin"
      ? await admin.from("admin_event_access").insert({
          admin_id: userId,
          event_id: eventId,
          granted_by: actorId,
        })
      : await admin.from("user_event_access").insert({
          user_id: userId,
          event_id: eventId,
        });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Доступ уже назначен" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}