import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { EVENT_TICKETS_LOCKED_MESSAGE, isEventPastByDateString } from "@/lib/event-date";
import { ensureTicketMutationAccess } from "@/lib/auth/event-access";
import { writeAuditLog } from "@/lib/audit";

const bodySchema = z.object({
  ticketIds: z.array(z.number().int().positive()).min(1).max(200),
});

type Params = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { eventId } = await params;
  const check = await ensureTicketMutationAccess(eventId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const admin = createAdminSupabaseClient();
  const { data: evRow } = await admin.from("events").select("event_date").eq("id", eventId).maybeSingle();
  if (!evRow) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  if (isEventPastByDateString(evRow.event_date)) {
    return NextResponse.json({ error: EVENT_TICKETS_LOCKED_MESSAGE }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный список билетов" }, { status: 400 });
  }

  const { ticketIds } = parsed.data;
  const uniqueIds = [...new Set(ticketIds)];

  const { data: found, error: selErr } = await admin
    .from("tickets")
    .select("id")
    .eq("event_id", eventId)
    .in("id", uniqueIds);

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 400 });
  }

  if (!found || found.length !== uniqueIds.length) {
    return NextResponse.json({ error: "Часть билетов не найдена в этом мероприятии" }, { status: 400 });
  }

  const { error: delErr } = await admin.from("tickets").delete().eq("event_id", eventId).in("id", uniqueIds);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  void writeAuditLog({
    actorId: check.userId,
    action: "ticket.bulk_delete",
    resourceType: "event",
    resourceId: eventId,
    request,
    method: "POST",
    metadata: { ticketIds: uniqueIds },
  });

  return NextResponse.json({ ok: true, deleted: uniqueIds.length });
}
