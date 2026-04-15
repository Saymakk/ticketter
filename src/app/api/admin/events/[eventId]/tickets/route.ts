import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { EVENT_ENDED_MESSAGE, isEventPastByDateString } from "@/lib/event-date";
import { ensureEventAccess, ensureTicketMutationAccess } from "@/lib/auth/event-access";
import { writeAuditLog } from "@/lib/audit";

const createTicketSchema = z.object({
    buyerName: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    ticketType: z.enum(["vip", "standard", "vip+"]).optional().nullable(),
    region: z.string().optional().nullable(),
    customData: z.record(z.string(), z.any()),
});

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_: Request, { params }: Params) {
    const { eventId } = await params;
    const check = await ensureEventAccess(eventId);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const admin = createAdminSupabaseClient();

    const { data: ev, error: evErr } = await admin
        .from("events")
        .select("title,city,event_date,event_time,company_id")
        .eq("id", eventId)
        .single();

    if (evErr || !ev) {
        return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
    }

    let companyName: string | null = null;
    let companyImageUrl: string | null = null;
    if (ev.company_id) {
        const { data: company } = await admin
            .from("companies")
            .select("name,image_url")
            .eq("id", ev.company_id)
            .maybeSingle();
        companyName = company?.name ?? null;
        companyImageUrl = company?.image_url ?? null;
    }

    const { data, error } = await admin
        .from("tickets")
        .select("id,uuid,buyer_name,phone,ticket_type,region,status,created_at,custom_data")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const tickets = data ?? [];
    const checkedIn = tickets.filter((t) => t.status === "checked_in").length;

    return NextResponse.json({
        event: {
            title: ev.title,
            city: ev.city,
            event_date: ev.event_date,
            event_time: ev.event_time ?? null,
            company_name: companyName,
            company_image_url: companyImageUrl,
            isPast: isEventPastByDateString(ev.event_date),
        },
        stats: { total: tickets.length, checkedIn },
        tickets,
    });
}

export async function POST(request: Request, { params }: Params) {
    const { eventId } = await params;
    const check = await ensureTicketMutationAccess(eventId);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const admin = createAdminSupabaseClient();
    const { data: evRow } = await admin.from("events").select("event_date").eq("id", eventId).maybeSingle();
    if (!evRow) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
    if (isEventPastByDateString(evRow.event_date)) {
        return NextResponse.json({ error: EVENT_ENDED_MESSAGE }, { status: 403 });
    }

    const payload = await request.json();
    const parsed = createTicketSchema.safeParse(payload);
    if (!parsed.success) {
        return NextResponse.json({ error: "Некорректные данные билета" }, { status: 400 });
    }

    const p = parsed.data;

    const { data, error } = await admin
        .from("tickets")
        .insert({
            event_id: eventId,
            buyer_name: p.buyerName ?? null,
            phone: p.phone ?? null,
            ticket_type: p.ticketType ?? null,
            region: p.region ?? null,
            manager_id: check.userId,
            status: "new",
            custom_data: p.customData ?? {},
        })
        .select("id,uuid")
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    void writeAuditLog({
        actorId: check.userId,
        action: "ticket.create",
        resourceType: "ticket",
        resourceId: String(data.id),
        request,
        method: "POST",
        metadata: { eventId, uuid: data.uuid },
    });

    return NextResponse.json({ ok: true, ticket: data });
}