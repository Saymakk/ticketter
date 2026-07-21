import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isTicketExpiredByDateString, SCAN_EVENT_ENDED_TICKET_INVALID } from "@/lib/event-date";
import { ensureEventAccess } from "@/lib/auth/event-access";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
    uuid: z.string().uuid(),
    eventId: z.string().uuid(),
});

export async function POST(request: Request) {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const { uuid, eventId } = parsed.data;
    const access = await ensureEventAccess(eventId);
    if (!access.ok) {
        return NextResponse.json({ error: access.error, success: false }, { status: access.status });
    }

    const admin = createAdminSupabaseClient();
    const { data: evRow } = await admin
      .from("events")
      .select("ticket_valid_until")
      .eq("id", eventId)
      .maybeSingle();
    if (!evRow) {
        return NextResponse.json({ error: "Мероприятие не найдено", success: false }, { status: 404 });
    }
    if (isTicketExpiredByDateString(evRow.ticket_valid_until)) {
        return NextResponse.json({ error: SCAN_EVENT_ENDED_TICKET_INVALID, success: false }, { status: 403 });
    }

    const { data: ticket, error: ticketError } = await admin
      .from("tickets")
      .select("id,status")
      .eq("uuid", uuid)
      .eq("event_id", eventId)
      .maybeSingle();

    if (ticketError || !ticket) {
        return NextResponse.json(
          { error: "Билет не найден в выбранном мероприятии", success: false },
          { status: 404 }
        );
    }

    if (ticket.status === "checked_in") {
        return NextResponse.json({ success: false, message: "Билет уже пробит" });
    }

    const checkedInAt = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("tickets")
      .update({ status: "checked_in", checked_in_at: checkedInAt })
      .eq("id", ticket.id)
      .eq("status", "new")
      .select("id")
      .maybeSingle();

    if (updateError) {
        return NextResponse.json({ error: updateError.message, success: false }, { status: 400 });
    }

    if (!updated) {
        return NextResponse.json({ success: false, message: "Билет уже пробит" });
    }

    void writeAuditLog({
        actorId: access.userId,
        action: "ticket.check_in",
        resourceType: "ticket",
        resourceId: uuid,
        request,
        method: "POST",
        metadata: { eventId },
    });

    return NextResponse.json({
        success: true,
        message: "Билет пробит",
    });
}
