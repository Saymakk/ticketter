import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import {
    EVENT_MANAGEMENT_LOCKED_MESSAGE,
    isEventPastByDateString,
    isValidOptionalEventTime,
} from "@/lib/event-date";
import { canAdminAccessEvent } from "@/lib/auth/event-access";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({
    title: z.string().min(2).optional(),
    city: z.string().min(2).optional(),
    eventDate: z.string().min(10).optional(),
    eventTime: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ eventId: string }> };

export async function PATCH(req: Request, { params }: Params) {
    const check = await requireEventManager();
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const { eventId } = await params;
    if (check.ctx.profile.role === "admin") {
        const allowed = await canAdminAccessEvent(check.ctx.user.id, eventId);
        if (!allowed) return NextResponse.json({ error: "Нет доступа к мероприятию" }, { status: 403 });
    }
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

    const p = parsed.data;
    if (p.eventTime !== undefined) {
        const tt = (p.eventTime ?? "").trim();
        if (tt && !isValidOptionalEventTime(tt)) {
            return NextResponse.json({ error: "Время: формат HH:MM" }, { status: 400 });
        }
    }
    const payload: Record<string, unknown> = {};
    if (p.title !== undefined) payload.title = p.title;
    if (p.city !== undefined) payload.city = p.city;
    if (p.eventDate !== undefined) payload.event_date = p.eventDate;
    if (p.isActive !== undefined) payload.is_active = p.isActive;
    if (p.eventTime !== undefined) {
        const tt = (p.eventTime ?? "").trim();
        payload.event_time = tt || null;
    }

    const admin = createAdminSupabaseClient();
    const { data: evRow } = await admin.from("events").select("event_date").eq("id", eventId).maybeSingle();
    if (!evRow) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
    if (isEventPastByDateString(evRow.event_date)) {
        return NextResponse.json({ error: EVENT_MANAGEMENT_LOCKED_MESSAGE }, { status: 403 });
    }

    const { error } = await admin.from("events").update(payload).eq("id", eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    void writeAuditLog({
        actorId: check.ctx.user.id,
        action: "event.update",
        resourceType: "event",
        resourceId: eventId,
        request: req,
        method: "PATCH",
        metadata: { payload },
    });

    return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
    const check = await requireEventManager();
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const { eventId } = await params;
    if (check.ctx.profile.role === "admin") {
        const allowed = await canAdminAccessEvent(check.ctx.user.id, eventId);
        if (!allowed) return NextResponse.json({ error: "Нет доступа к мероприятию" }, { status: 403 });
    }
    const admin = createAdminSupabaseClient();

    // Сработает clean delete, если в FK стоит ON DELETE CASCADE
    const { error } = await admin.from("events").delete().eq("id", eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    void writeAuditLog({
        actorId: check.ctx.user.id,
        action: "event.delete",
        resourceType: "event",
        resourceId: eventId,
        request: req,
        method: "DELETE",
    });

    return NextResponse.json({ ok: true });
}