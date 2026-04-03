import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { EVENT_ENDED_MESSAGE, isEventPastByDateString } from "@/lib/event-date";
import { ensureEventAccess } from "@/lib/auth/event-access";
import { writeAuditLog } from "@/lib/audit";

const bodySchema = z.object({
  sourceUuids: z.array(z.string().uuid()).min(1).max(50),
  copies: z.number().int().min(1).max(30),
});

const MAX_INSERTS = 100;

type Params = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { eventId } = await params;
  const check = await ensureEventAccess(eventId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const admin = createAdminSupabaseClient();
  const { data: evRow } = await admin.from("events").select("event_date").eq("id", eventId).maybeSingle();
  if (!evRow) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  if (isEventPastByDateString(evRow.event_date)) {
    return NextResponse.json({ error: EVENT_ENDED_MESSAGE }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const { sourceUuids, copies } = parsed.data;
  const total = sourceUuids.length * copies;
  if (total > MAX_INSERTS) {
    return NextResponse.json(
      { error: `Слишком много копий за раз (максимум ${MAX_INSERTS} новых билетов)` },
      { status: 400 }
    );
  }

  const { data: sources, error: fetchError } = await admin
    .from("tickets")
    .select("buyer_name,phone,ticket_type,region,custom_data,uuid")
    .eq("event_id", eventId)
    .in("uuid", sourceUuids);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }

  if (!sources?.length) {
    return NextResponse.json({ error: "Билеты не найдены" }, { status: 404 });
  }

  if (sources.length !== sourceUuids.length) {
    return NextResponse.json({ error: "Часть билетов не найдена в этом мероприятии" }, { status: 400 });
  }

  const rows = sources.flatMap((src) =>
    Array.from({ length: copies }, () => ({
      event_id: eventId,
      buyer_name: src.buyer_name,
      phone: src.phone,
      ticket_type: src.ticket_type,
      region: src.region,
      custom_data:
        src.custom_data && typeof src.custom_data === "object" && !Array.isArray(src.custom_data)
          ? { ...(src.custom_data as Record<string, unknown>) }
          : {},
      manager_id: check.userId,
      status: "new" as const,
    }))
  );

  const { error: insertError } = await admin.from("tickets").insert(rows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  void writeAuditLog({
    actorId: check.userId,
    action: "ticket.duplicate",
    resourceType: "event",
    resourceId: eventId,
    request,
    method: "POST",
    metadata: { created: rows.length, copies, sourceCount: sourceUuids.length },
  });

  return NextResponse.json({ ok: true, created: rows.length });
}
