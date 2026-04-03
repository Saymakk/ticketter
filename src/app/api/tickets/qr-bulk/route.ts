import { NextResponse } from "next/server";
import QRCode from "qrcode";
import JSZip from "jszip";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isEventManagerRole } from "@/lib/auth/roles";
import { qrImageFileName } from "@/lib/qr-filename";

const bodySchema = z.object({
    uuids: z.array(z.string().uuid()).min(1),
});

export async function POST(request: Request) {
    const supabase = await createServerSupabaseClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json({ error: "Некорректный список uuid" }, { status: 400 });
    }

    const uuids = parsed.data.uuids;

    const { data: tickets, error } = await supabase
        .from("tickets")
        .select("uuid,event_id,buyer_name")
        .in("uuid", uuids);

    if (error || !tickets) {
        return NextResponse.json({ error: "Не удалось получить билеты" }, { status: 400 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    const isManager = isEventManagerRole(profile?.role);

    if (!isManager) {
        // Проверяем, что у пользователя есть доступ ко всем event_id
        const eventIds = [...new Set(tickets.map((t) => t.event_id))];
        const { data: access } = await supabase
            .from("user_event_access")
            .select("event_id")
            .eq("user_id", user.id)
            .in("event_id", eventIds);

        const allowedSet = new Set((access ?? []).map((a) => a.event_id));
        const hasForbidden = eventIds.some((id) => !allowedSet.has(id));

        if (hasForbidden) {
            return NextResponse.json({ error: "Нет доступа к части билетов" }, { status: 403 });
        }
    }

    const zip = new JSZip();

    for (const t of tickets) {
        const png = await QRCode.toBuffer(t.uuid, { type: "png", width: 512, margin: 1 });
        zip.file(qrImageFileName(t.buyer_name, t.uuid), png);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const body = new Uint8Array(zipBuffer);

    return new NextResponse(body, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="tickets-qr.zip"`,
            "Cache-Control": "no-store",
        },
    });
}