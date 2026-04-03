import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { canAdminAccessEvent } from "@/lib/auth/event-access";
import { isEventPastByDateString, EVENT_ASSIGNMENTS_LOCKED_MESSAGE } from "@/lib/event-date";
import { writeAuditLog } from "@/lib/audit";

const bodySchema = z.object({
  eventId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1).max(100),
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

  const { eventId, userIds } = parsed.data;
  const uniqueIds = [...new Set(userIds)];

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

  let assigned = 0;
  let duplicate = 0;
  const failures: { userId: string; error: string }[] = [];

  for (const userId of uniqueIds) {
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!targetProfile || (targetProfile.role !== "user" && targetProfile.role !== "admin")) {
      failures.push({
        userId,
        error: "Назначать на мероприятие можно только пользователей или администраторов.",
      });
      continue;
    }

    if (targetProfile.role === "admin" && actorRole !== "super_admin" && userId === actorId) {
      failures.push({ userId, error: "Нельзя выдавать доступ самому себе" });
      continue;
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
        duplicate += 1;
        continue;
      }
      failures.push({ userId, error: error.message });
      continue;
    }

    assigned += 1;
    void writeAuditLog({
      actorId,
      action: "event.assign_access",
      resourceType: "event",
      resourceId: eventId,
      request,
      method: "POST",
      metadata: { targetUserId: userId, targetRole: targetProfile.role },
    });
  }

  if (assigned === 0 && duplicate === 0 && failures.length === uniqueIds.length) {
    return NextResponse.json(
      {
        error: "Не удалось назначить доступ",
        assigned: 0,
        duplicate: 0,
        failures,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    assigned,
    duplicate,
    failures,
  });
}
