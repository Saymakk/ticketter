import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import {
  canAdminAccessEvent,
  canRevokeExplicitAdminDelegation,
  canRevokeExplicitUserAccess,
} from "@/lib/auth/event-access";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const check = await requireEventManager();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { eventId } = await params;
  const idParsed = z.string().uuid().safeParse(eventId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Некорректный идентификатор" }, { status: 400 });
  }

  if (check.ctx.profile.role === "admin") {
    const allowed = await canAdminAccessEvent(check.ctx.user.id, eventId);
    if (!allowed) {
      return NextResponse.json({ error: "Нет доступа к мероприятию" }, { status: 403 });
    }
  }

  const admin = createAdminSupabaseClient();
  const actorRole = check.ctx.profile.role;
  const actorId = check.ctx.user.id;
  const actorCanManageEvent =
    actorRole === "super_admin" ||
    (actorRole === "admin" && (await canAdminAccessEvent(actorId, eventId)));

  const [{ data: eventRow }, { data: userRows }, { data: adminRows }] = await Promise.all([
    admin.from("events").select("created_by").eq("id", eventId).maybeSingle(),
    admin.from("user_event_access").select("user_id").eq("event_id", eventId),
    admin.from("admin_event_access").select("admin_id, granted_by").eq("event_id", eventId),
  ]);

  if (!eventRow) {
    return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  }

  const assigned = new Set<string>();
  for (const r of userRows ?? []) assigned.add(r.user_id);
  for (const r of adminRows ?? []) assigned.add(r.admin_id);

  const creatorId = eventRow.created_by ?? null;
  const revokable = new Set<string>();

  for (const r of userRows ?? []) {
    if (
      canRevokeExplicitUserAccess({
        actorRole,
        eventCreatorId: creatorId,
        targetProfileId: r.user_id,
        actorCanManageEvent,
      })
    ) {
      revokable.add(r.user_id);
    }
  }

  for (const r of adminRows ?? []) {
    if (
      canRevokeExplicitAdminDelegation({
        actorRole,
        actorId,
        eventCreatorId: creatorId,
        targetAdminId: r.admin_id,
        grantedBy: r.granted_by ?? null,
      })
    ) {
      revokable.add(r.admin_id);
    }
  }

  return NextResponse.json({
    creatorId,
    assignedProfileIds: [...assigned],
    revokableProfileIds: [...revokable],
  });
}
