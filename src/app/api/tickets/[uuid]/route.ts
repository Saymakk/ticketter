import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isEventManagerRole } from "@/lib/auth/roles";
import { canAdminAccessEvent } from "@/lib/auth/event-access";

type Params = { params: Promise<{ uuid: string }> };

export async function GET(_: Request, { params }: Params) {
    const { uuid } = await params;
    const supabase = await createServerSupabaseClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { data: ticket, error } = await supabase
        .from("tickets")
        .select("id,uuid,event_id,buyer_name,phone,ticket_type,region,status,custom_data,created_at,receipt_image_url")
        .eq("uuid", uuid)
        .single();

    if (error || !ticket) {
        return NextResponse.json({ error: "Билет не найден" }, { status: 404 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    const isManager = isEventManagerRole(profile?.role);
    if (profile?.role === "admin") {
        const allowed = await canAdminAccessEvent(user.id, ticket.event_id);
        if (!allowed) return NextResponse.json({ error: "Нет доступа к билету" }, { status: 403 });
    }

    const { data: access } = await supabase
        .from("user_event_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", ticket.event_id)
        .maybeSingle();

    if (!access && !isManager) {
        return NextResponse.json({ error: "Нет доступа к билету" }, { status: 403 });
    }

    const { data: event } = await supabase
        .from("events")
        .select("company_id,ticket_valid_until")
        .eq("id", ticket.event_id)
        .maybeSingle();

    let companyName: string | null = null;
    let companyImageUrl: string | null = null;
    if (event?.company_id) {
        const { data: company } = await supabase
            .from("companies")
            .select("name,image_url")
            .eq("id", event.company_id)
            .maybeSingle();
        companyName = company?.name ?? null;
        companyImageUrl = company?.image_url ?? null;
    }

    return NextResponse.json({
        ticket: {
            ...ticket,
            ticket_valid_until: event?.ticket_valid_until ?? null,
            company_name: companyName,
            company_image_url: companyImageUrl,
        },
    });
}