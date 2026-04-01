import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

    if (profile?.role !== "super_admin") {
        return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const { data, error } = await supabase
        .from("event_ticket_stats")
        .select("*")
        .order("event_date", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ rows: data ?? [] });
}