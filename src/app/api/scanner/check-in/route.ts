import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isEventPastByDateString, SCAN_EVENT_ENDED_TICKET_INVALID } from "@/lib/event-date";
import { ensureEventAccess } from "@/lib/auth/event-access";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
    uuid: z.string().uuid(),
    eventId: z.string().uuid(),
});

export async function POST(request: Request) {
    const supabase = await createServerSupabaseClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const { uuid, eventId } = parsed.data;
    const access = await ensureEventAccess(eventId);
    if (!access.ok) return NextResponse.json({ error: access.error, success: false }, { status: access.status });

    const { data: evRow } = await supabase.from("events").select("event_date").eq("id", eventId).maybeSingle();
    if (!evRow) {
        return NextResponse.json({ error: "Мероприятие не найдено", success: false }, { status: 404 });
    }
    if (isEventPastByDateString(evRow.event_date)) {
        return NextResponse.json({ error: SCAN_EVENT_ENDED_TICKET_INVALID, success: false }, { status: 403 });
    }

    // В Supabase убедитесь, что RPC check_in_ticket_scoped разрешает роль «user» (не только admin).
    const { data, error } = await supabase.rpc("check_in_ticket_scoped", {
        p_ticket_uuid: uuid,
        p_event_id: eventId,
        p_user_id: user.id,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const row = data?.[0];
    const success = !!row?.success;
    if (success) {
        void writeAuditLog({
            actorId: user.id,
            action: "ticket.check_in",
            resourceType: "ticket",
            resourceId: uuid,
            request,
            method: "POST",
            metadata: { eventId },
        });
    }
    return NextResponse.json({
        success,
        message: row?.message ?? "Неизвестный ответ",
    });
}