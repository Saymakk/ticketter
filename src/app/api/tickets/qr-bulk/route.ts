import { NextResponse } from "next/server";
import JSZip from "jszip";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isEventManagerRole } from "@/lib/auth/roles";
import { formatEventDateTimeLine } from "@/lib/event-date";
import { buildTicketImageSvg } from "@/lib/tickets/ticket-image-svg";
import { sanitizeForFileSegment } from "@/lib/qr-filename";
import { canAdminAccessEvent, TICKET_EDIT_FORBIDDEN_MESSAGE } from "@/lib/auth/event-access";

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
        .select("uuid,event_id,buyer_name,phone,region,status,checked_in_at,custom_data,receipt_image_url")
        .in("uuid", uuids);

    if (error || !tickets) {
        return NextResponse.json({ error: "Не удалось получить билеты" }, { status: 400 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role, can_edit_tickets")
        .eq("id", user.id)
        .single();

    const isManager = isEventManagerRole(profile?.role);
    const isAdmin = profile?.role === "admin";

    if (profile?.role === "user" && profile?.can_edit_tickets === false) {
        return NextResponse.json({ error: TICKET_EDIT_FORBIDDEN_MESSAGE }, { status: 403 });
    }

    if (isAdmin) {
        const eventIds = [...new Set(tickets.map((t) => t.event_id))];
        for (const eventId of eventIds) {
            const allowed = await canAdminAccessEvent(user.id, eventId);
            if (!allowed) {
                return NextResponse.json({ error: "Нет доступа к части билетов" }, { status: 403 });
            }
        }
    } else if (!isManager) {
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
    const eventIds = [...new Set(tickets.map((t) => t.event_id))];
    const { data: events } = await supabase
      .from("events")
      .select("id,title,city,event_date,event_time,address,dress_code,description,social_links,ticket_valid_until,company_id")
      .in("id", eventIds);
    const eventById = new Map((events ?? []).map((e) => [e.id, e]));
    const companyIds = [...new Set((events ?? []).map((e) => e.company_id).filter(Boolean))];
    const { data: companies } = companyIds.length
      ? await supabase.from("companies").select("id,name").in("id", companyIds)
      : { data: [] as { id: string; name: string }[] };
    const companyNameById = new Map((companies ?? []).map((c) => [c.id, c.name]));

    async function toDataUrlFromRemoteImage(src: string | null): Promise<string | null> {
      if (!src) return null;
      try {
        const res = await fetch(src, { cache: "no-store" });
        if (!res.ok) return null;
        const type = res.headers.get("content-type") || "image/jpeg";
        const buf = Buffer.from(await res.arrayBuffer());
        return `data:${type};base64,${buf.toString("base64")}`;
      } catch {
        return null;
      }
    }

    for (const t of tickets) {
        const ev = eventById.get(t.event_id);
        const receiptThumbDataUrl = await toDataUrlFromRemoteImage(t.receipt_image_url ?? null);
        const svg = await buildTicketImageSvg(
          {
            title: ev?.title ?? "Билет",
            city: ev?.city ?? null,
            eventLine: ev ? formatEventDateTimeLine(ev.event_date, ev.event_time ?? null) : null,
            companyName: ev?.company_id ? companyNameById.get(ev.company_id) ?? null : null,
            address: ev?.address ?? null,
            dressCode: ev?.dress_code ?? null,
            description: ev?.description ?? null,
            socialLinks: Array.isArray(ev?.social_links) ? ev.social_links.map((x) => String(x)) : [],
            ticketValidUntil: ev?.ticket_valid_until ?? null,
            uuid: t.uuid,
            buyerName: t.buyer_name,
            phone: t.phone,
            region: t.region,
            checkedInAt: t.checked_in_at ?? null,
            customData:
              t.custom_data && typeof t.custom_data === "object" && !Array.isArray(t.custom_data)
                ? (t.custom_data as Record<string, unknown>)
                : null,
            receiptThumbDataUrl,
            status: t.status,
          },
          false
        );
        const base = sanitizeForFileSegment(t.buyer_name);
        zip.file(base ? `${base}_${t.uuid}.svg` : `${t.uuid}.svg`, svg);
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