import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_: Request, { params }: Params) {
    const { eventId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (!profile || !["user", "admin", "super_admin"].includes(profile.role)) {
        return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    if (profile.role === "user") {
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
        .from("tickets")
        .select("uuid,buyer_name,checked_in_at")
        .eq("event_id", eventId)
        .eq("status", "checked_in")
        .order("checked_in_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ tickets: data ?? [] });
}