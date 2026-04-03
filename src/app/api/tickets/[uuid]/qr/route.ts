import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isEventManagerRole } from "@/lib/auth/roles";
import { contentDispositionWithUtf8Name, qrImageFileName } from "@/lib/qr-filename";
import { canAdminAccessEvent } from "@/lib/auth/event-access";

type Params = { params: Promise<{ uuid: string }> };

async function ensureTicketReadable(ticketUuid: string) {
    const supabase = await createServerSupabaseClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return { ok: false as const, status: 401, error: "Не авторизован" };

    // Находим билет + event_id
    const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("uuid,event_id,buyer_name")
        .eq("uuid", ticketUuid)
        .single();

    if (ticketError || !ticket) {
        return { ok: false as const, status: 404, error: "Билет не найден" };
    }

    // Проверяем доступ через user_event_access
    const { data: access } = await supabase
        .from("user_event_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", ticket.event_id)
        .maybeSingle();

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    const isManager = isEventManagerRole(profile?.role);
    if (profile?.role === "admin") {
        const allowed = await canAdminAccessEvent(user.id, ticket.event_id);
        if (!allowed) return { ok: false as const, status: 403, error: "Нет доступа к билету" };
    }

    if (!access && !isManager) {
        return { ok: false as const, status: 403, error: "Нет доступа к билету" };
    }

    return { ok: true as const, ticketUuid: ticket.uuid, buyerName: ticket.buyer_name };
}

export async function GET(request: Request, { params }: Params) {
    const { uuid } = await params;
    const check = await ensureTicketReadable(uuid);

    if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const pngBuffer = await QRCode.toBuffer(check.ticketUuid, {
        type: "png",
        width: 512,
        margin: 1,
    });

    const body = new Uint8Array(pngBuffer);
    const url = new URL(request.url);
    const inline = url.searchParams.get("inline") === "1";
    const fileName = qrImageFileName(check.buyerName, check.ticketUuid);
    const disposition = contentDispositionWithUtf8Name(inline ? "inline" : "attachment", fileName);

    return new NextResponse(body, {
        status: 200,
        headers: {
            "Content-Type": "image/png",
            "Content-Disposition": disposition,
            "Cache-Control": "no-store",
        },
    });
}