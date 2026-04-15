import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureEventAccess } from "@/lib/auth/event-access";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_: Request, { params }: Params) {
    const { eventId } = await params;
    const check = await ensureEventAccess(eventId);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
    const supabase = await createServerSupabaseClient();
    const { data: ev } = await supabase
        .from("events")
        .select("company_id")
        .eq("id", eventId)
        .maybeSingle();
    let companyName: string | null = null;
    let companyImageUrl: string | null = null;
    if (ev?.company_id) {
        const { data: company } = await supabase
            .from("companies")
            .select("name,image_url")
            .eq("id", ev.company_id)
            .maybeSingle();
        companyName = company?.name ?? null;
        companyImageUrl = company?.image_url ?? null;
    }

    const { data, error } = await supabase
        .from("tickets")
        .select("uuid,buyer_name,phone,region,ticket_type,custom_data,checked_in_at")
        .eq("event_id", eventId)
        .eq("status", "checked_in")
        .order("checked_in_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ tickets: data ?? [], companyName, companyImageUrl });
}