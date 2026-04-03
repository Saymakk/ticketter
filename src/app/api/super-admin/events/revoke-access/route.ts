import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import {
  canAdminAccessEvent,
  canRevokeExplicitAdminDelegation,
  canRevokeExplicitUserAccess,
} from "@/lib/auth/event-access";
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

  const actorCanManageEvent =
    actorRole === "super_admin" ||
    (actorRole === "admin" && (await canAdminAccessEvent(actorId, eventId)));

  const { data: eventRow } = await admin
    .from("events")
    .select("event_date, created_by")
    .eq("id", eventId)
    .maybeSingle();

  if (!eventRow) {
    return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  }
  if (isEventPastByDateString(eventRow.event_date)) {
    return NextResponse.json({ error: EVENT_ASSIGNMENTS_LOCKED_MESSAGE }, { status: 403 });
  }

  const eventCreatorId = eventRow.created_by ?? null;

  let revoked = 0;
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
        error: "Снимать доступ можно только у пользователей или администраторов с явным назначением.",
      });
      continue;
    }

    if (targetProfile.role === "user") {
      const allowed = canRevokeExplicitUserAccess({
        actorRole,
        eventCreatorId,
        targetProfileId: userId,
        actorCanManageEvent,
      });
      if (!allowed) {
        failures.push({
          userId,
          error: "Нельзя снять доступ у создателя мероприятия (только суперадмин).",
        });
        continue;
      }

      const { data: row, error: selErr } = await admin
        .from("user_event_access")
        .select("user_id")
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .maybeSingle();

      if (selErr || !row) {
        failures.push({ userId, error: "Нет явного назначения для этого пользователя." });
        continue;
      }

      const { error: delErr } = await admin
        .from("user_event_access")
        .delete()
        .eq("user_id", userId)
        .eq("event_id", eventId);

      if (delErr) {
        failures.push({ userId, error: delErr.message });
        continue;
      }

      revoked += 1;
      void writeAuditLog({
        actorId,
        action: "event.revoke_access",
        resourceType: "event",
        resourceId: eventId,
        request,
        method: "POST",
        metadata: { targetUserId: userId, targetRole: "user" },
      });
      continue;
    }

    const { data: admRow, error: admSelErr } = await admin
      .from("admin_event_access")
      .select("admin_id, granted_by")
      .eq("admin_id", userId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (admSelErr || !admRow) {
      failures.push({ userId, error: "Нет явного назначения для этого администратора." });
      continue;
    }

    const allowed = canRevokeExplicitAdminDelegation({
      actorRole,
      actorId,
      eventCreatorId,
      targetAdminId: userId,
      grantedBy: admRow.granted_by ?? null,
    });

    if (!allowed) {
      failures.push({
        userId,
        error: "Недостаточно прав: снять доступ может создатель мероприятия, выдавший доступ или суперадмин.",
      });
      continue;
    }

    const { error: delErr } = await admin
      .from("admin_event_access")
      .delete()
      .eq("admin_id", userId)
      .eq("event_id", eventId);

    if (delErr) {
      failures.push({ userId, error: delErr.message });
      continue;
    }

    revoked += 1;
    void writeAuditLog({
      actorId,
      action: "event.revoke_access",
      resourceType: "event",
      resourceId: eventId,
      request,
      method: "POST",
      metadata: { targetUserId: userId, targetRole: "admin" },
    });
  }

  if (revoked === 0 && failures.length === uniqueIds.length) {
    return NextResponse.json(
      {
        error: "Не удалось снять доступ",
        revoked: 0,
        failures,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    revoked,
    failures,
  });
}
