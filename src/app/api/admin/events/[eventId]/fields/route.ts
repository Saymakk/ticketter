import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureEventAccess } from "@/lib/auth/event-access";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_: Request, { params }: Params) {
    const { eventId } = await params;
    const check = await ensureEventAccess(eventId);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from("event_fields")
        .select("id,field_key,field_label,field_type,is_required,sort_order,options")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ fields: data ?? [] });
}