import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { EVENT_MANAGEMENT_LOCKED_MESSAGE, isEventPastByDateString } from "@/lib/event-date";

const patchSchema = z.object({
    title: z.string().min(2).optional(),
    city: z.string().min(2).optional(),
    eventDate: z.string().min(10).optional(),
    isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ eventId: string }> };

export async function PATCH(req: Request, { params }: Params) {
    const check = await requireEventManager();
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const { eventId } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

    const p = parsed.data;
    const payload: Record<string, unknown> = {};
    if (p.title !== undefined) payload.title = p.title;
    if (p.city !== undefined) payload.city = p.city;
    if (p.eventDate !== undefined) payload.event_date = p.eventDate;
    if (p.isActive !== undefined) payload.is_active = p.isActive;

    const admin = createAdminSupabaseClient();
    const { data: evRow } = await admin.from("events").select("event_date").eq("id", eventId).maybeSingle();
    if (!evRow) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
    if (isEventPastByDateString(evRow.event_date)) {
        return NextResponse.json({ error: EVENT_MANAGEMENT_LOCKED_MESSAGE }, { status: 403 });
    }

    const { error } = await admin.from("events").update(payload).eq("id", eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
    const check = await requireEventManager();
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const { eventId } = await params;
    const admin = createAdminSupabaseClient();

    // Сработает clean delete, если в FK стоит ON DELETE CASCADE
    const { error } = await admin.from("events").delete().eq("id", eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
}