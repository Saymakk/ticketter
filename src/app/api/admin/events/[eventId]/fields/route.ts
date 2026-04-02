import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isEventManagerRole } from "@/lib/auth/roles";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_: Request, { params }: Params) {
    const { eventId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

    if (!isEventManagerRole(profile?.role)) {
        const { data: access } = await supabase
            .from("user_event_access")
            .select("id")
            .eq("user_id", user.id)
            .eq("event_id", eventId)
            .maybeSingle();

        if (!access) {
            return NextResponse.json({ error: "Нет доступа к мероприятию" }, { status: 403 });
        }
    }

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