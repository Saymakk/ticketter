import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminVisibleEventIds } from "@/lib/auth/event-access";

type ScannerEventRow = {
    id: string;
    title: string;
    city: string;
    event_date: string;
    event_time?: string | null;
    ticket_valid_until?: string | null;
};

async function enrichEventsWithTicketStats(
    supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
    events: ScannerEventRow[]
): Promise<
    | { ok: true; events: (ScannerEventRow & { tickets_total: number; tickets_checked_in: number })[] }
    | { ok: false; response: NextResponse }
> {
    if (events.length === 0) {
        return { ok: true, events: [] };
    }

    const ids = events.map((e) => e.id);
    const { data: ticketRows, error } = await supabase
        .from("tickets")
        .select("event_id,status")
        .in("event_id", ids);

    if (error) {
        return { ok: false, response: NextResponse.json({ error: error.message }, { status: 400 }) };
    }

    const counts = new Map<string, { total: number; checkedIn: number }>();
    for (const id of ids) {
        counts.set(id, { total: 0, checkedIn: 0 });
    }
    for (const row of ticketRows ?? []) {
        const eid = row.event_id as string;
        const cur = counts.get(eid);
        if (!cur) continue;
        cur.total++;
        if (row.status === "checked_in") cur.checkedIn++;
    }

    return {
        ok: true,
        events: events.map((ev) => ({
            ...ev,
            tickets_total: counts.get(ev.id)?.total ?? 0,
            tickets_checked_in: counts.get(ev.id)?.checkedIn ?? 0,
        })),
    };
}

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

    const today = new Date().toISOString().slice(0, 10);

    // Показываем события, где билеты еще действительны
    if (profile.role === "super_admin") {
        const { data, error } = await supabase
            .from("events")
            .select("id,title,city,event_date,event_time,ticket_valid_until")
            .gte("ticket_valid_until", today)
            .order("event_date", { ascending: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        const enriched = await enrichEventsWithTicketStats(supabase, data ?? []);
        if (!enriched.ok) return enriched.response;
        return NextResponse.json({ events: enriched.events });
    }

    if (profile.role === "admin") {
        const visibleEventIds = await getAdminVisibleEventIds(user.id);
        if (visibleEventIds.length === 0) return NextResponse.json({ events: [] });
        const { data, error } = await supabase
            .from("events")
            .select("id,title,city,event_date,event_time,ticket_valid_until")
            .in("id", visibleEventIds)
            .gte("ticket_valid_until", today)
            .order("event_date", { ascending: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        const enriched = await enrichEventsWithTicketStats(supabase, data ?? []);
        if (!enriched.ok) return enriched.response;
        return NextResponse.json({ events: enriched.events });
    }

    const { data, error } = await supabase
        .from("user_event_access")
        .select("event:events(id,title,city,event_date,event_time,ticket_valid_until)")
        .eq("user_id", user.id)
        .gte("event.ticket_valid_until", today);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const events = (data ?? []).map((r: any) => r.event).filter(Boolean) as ScannerEventRow[];
    const enriched = await enrichEventsWithTicketStats(supabase, events);
    if (!enriched.ok) return enriched.response;
    return NextResponse.json({ events: enriched.events });
}