import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isEventManagerRole } from "@/lib/auth/roles";
import { EVENT_TICKETS_LOCKED_MESSAGE, isEventPastByDateString } from "@/lib/event-date";

const ticketTypeValue = z.union([z.enum(["vip", "standard", "vip+"]), z.null()]);

const patchSchema = z.object({
    buyerName: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    ticketType: ticketTypeValue.optional(),
    region: z.string().nullable().optional(),
    customData: z.record(z.string(), z.any()).optional(),
});

type Params = { params: Promise<{ eventId: string; ticketId: string }> };

async function ensureAccess(eventId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false as const, status: 401, error: "Не авторизован" };

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (isEventManagerRole(profile?.role)) return { ok: true as const };

    const { data: access } = await supabase
        .from("user_event_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", eventId)
        .maybeSingle();

    if (!access) return { ok: false as const, status: 403, error: "Нет доступа" };
    return { ok: true as const };
}

export async function PATCH(req: Request, { params }: Params) {
    const { eventId, ticketId } = await params;
    const check = await ensureAccess(eventId);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const adminGuard = createAdminSupabaseClient();
    const { data: evRow } = await adminGuard.from("events").select("event_date").eq("id", eventId).maybeSingle();
    if (!evRow) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
    if (isEventPastByDateString(evRow.event_date)) {
        return NextResponse.json({ error: EVENT_TICKETS_LOCKED_MESSAGE }, { status: 403 });
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

    const p = parsed.data;
    const payload: Record<string, unknown> = {};
    if (p.buyerName !== undefined) payload.buyer_name = p.buyerName;
    if (p.phone !== undefined) payload.phone = p.phone;
    if (p.ticketType !== undefined) payload.ticket_type = p.ticketType;
    if (p.region !== undefined) payload.region = p.region;
    if (p.customData !== undefined) payload.custom_data = p.customData;

    const { error } = await adminGuard.from("tickets").update(payload).eq("id", Number(ticketId)).eq("event_id", eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
    const { eventId, ticketId } = await params;
    const check = await ensureAccess(eventId);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const admin = createAdminSupabaseClient();
    const { data: evRow } = await admin.from("events").select("event_date").eq("id", eventId).maybeSingle();
    if (!evRow) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
    if (isEventPastByDateString(evRow.event_date)) {
        return NextResponse.json({ error: EVENT_TICKETS_LOCKED_MESSAGE }, { status: 403 });
    }

    const { error } = await admin.from("tickets").delete().eq("id", Number(ticketId)).eq("event_id", eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
}