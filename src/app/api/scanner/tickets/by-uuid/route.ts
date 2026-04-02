import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const uuid = searchParams.get("uuid");
    const eventId = searchParams.get("eventId");

    if (!uuid || !eventId) {
        return NextResponse.json({ error: "uuid и eventId обязательны" }, { status: 400 });
    }

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

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

    const { data: ticket, error } = await supabase
        .from("tickets")
        .select("id,uuid,event_id,buyer_name,phone,ticket_type,region,status,created_at,custom_data")
        .eq("uuid", uuid)
        .eq("event_id", eventId)
        .single();

    if (error || !ticket) {
        return NextResponse.json({ error: "Билет не найден в выбранном мероприятии" }, { status: 404 });
    }

    return NextResponse.json({ ticket });
}