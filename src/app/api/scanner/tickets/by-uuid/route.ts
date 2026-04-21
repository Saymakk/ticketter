import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isTicketExpiredByDateString } from "@/lib/event-date";
import { ensureEventAccess } from "@/lib/auth/event-access";

export async function GET(request: Request) {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const uuid = searchParams.get("uuid");
    const eventId = searchParams.get("eventId");

    if (!uuid || !eventId) {
        return NextResponse.json({ error: "uuid и eventId обязательны" }, { status: 400 });
    }

    const check = await ensureEventAccess(eventId);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const { data: ticket, error } = await supabase
        .from("tickets")
        .select(
            "id,uuid,event_id,buyer_name,phone,ticket_type,region,status,created_at,checked_in_at,custom_data"
        )
        .eq("uuid", uuid)
        .eq("event_id", eventId)
        .single();

    if (error || !ticket) {
        return NextResponse.json({ error: "Билет не найден в выбранном мероприятии" }, { status: 404 });
    }

    const { data: ev } = await supabase
        .from("events")
        .select("ticket_valid_until,company_id")
        .eq("id", eventId)
        .maybeSingle();
    const eventPast = ev ? isTicketExpiredByDateString(ev.ticket_valid_until) : false;
    let companyName: string | null = null;
    let companyImageUrl: string | null = null;
    if (ev?.company_id) {
        const admin = createAdminSupabaseClient();
        const { data: company } = await admin
            .from("companies")
            .select("name,image_url")
            .eq("id", ev.company_id)
            .maybeSingle();
        companyName = company?.name ?? null;
        companyImageUrl = company?.image_url ?? null;
    }

    return NextResponse.json({
        ticket: {
            ...ticket,
            ticket_valid_until: ev?.ticket_valid_until ?? null,
            company_name: companyName,
            company_image_url: companyImageUrl,
        },
        eventPast,
    });
}