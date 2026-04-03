import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminVisibleEventIds } from "@/lib/auth/event-access";

export async function GET() {
    const supabase = await createServerSupabaseClient();

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

    // Авто-деактивация через дату: event_date >= today
    if (profile.role === "super_admin") {
        const { data, error } = await supabase
            .from("events")
            .select("id,title,city,event_date")
            .gte("event_date", new Date().toISOString().slice(0, 10))
            .order("event_date", { ascending: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ events: data ?? [] });
    }

    if (profile.role === "admin") {
        const visibleEventIds = await getAdminVisibleEventIds(user.id);
        if (visibleEventIds.length === 0) return NextResponse.json({ events: [] });
        const { data, error } = await supabase
            .from("events")
            .select("id,title,city,event_date")
            .in("id", visibleEventIds)
            .gte("event_date", new Date().toISOString().slice(0, 10))
            .order("event_date", { ascending: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ events: data ?? [] });
    }

    const { data, error } = await supabase
        .from("user_event_access")
        .select("event:events(id,title,city,event_date)")
        .eq("user_id", user.id)
        .gte("event.event_date", new Date().toISOString().slice(0, 10));

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const events = (data ?? []).map((r: any) => r.event).filter(Boolean);
    return NextResponse.json({ events });
}