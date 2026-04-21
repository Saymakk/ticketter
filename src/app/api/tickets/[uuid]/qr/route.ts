import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getStaffReadableTicket } from "@/lib/auth/ticket-staff-read";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { formatEventDateTimeLine } from "@/lib/event-date";
import { buildTicketImageSvg } from "@/lib/tickets/ticket-image-svg";
import {
  contentDispositionWithUtf8Name,
  qrImageFileName,
  ticketImageFileName,
} from "@/lib/qr-filename";

type Params = { params: Promise<{ uuid: string }> };

export async function GET(request: Request, { params }: Params) {
    const { uuid } = await params;
    const check = await getStaffReadableTicket(uuid);

    if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const url = new URL(request.url);
    const inline = url.searchParams.get("inline") === "1";
    if (inline) {
      const pngBuffer = await QRCode.toBuffer(check.ticket.uuid, {
        type: "png",
        width: 512,
        margin: 1,
      });
      const fileName = qrImageFileName(check.ticket.buyer_name, check.ticket.uuid);
      const disposition = contentDispositionWithUtf8Name("inline", fileName);
      return new NextResponse(new Uint8Array(pngBuffer), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": disposition,
          "Cache-Control": "no-store",
        },
      });
    }

    const admin = createAdminSupabaseClient();
    const { data: event } = await admin
      .from("events")
      .select("title,city,event_date,event_time,address,dress_code,description,social_links")
      .eq("id", check.ticket.event_id)
      .maybeSingle();
    const svg = await buildTicketImageSvg(
      {
        title: event?.title ?? "Билет",
        city: event?.city ?? null,
        eventLine: event ? formatEventDateTimeLine(event.event_date, event.event_time ?? null) : null,
        address: event?.address ?? null,
        dressCode: event?.dress_code ?? null,
        description: event?.description ?? null,
        socialLinks: Array.isArray(event?.social_links)
          ? event.social_links.map((x) => String(x))
          : [],
        uuid: check.ticket.uuid,
        buyerName: check.ticket.buyer_name,
        phone: check.ticket.phone,
        region: check.ticket.region,
        status: check.ticket.status,
      },
      false
    );
    const fileName = ticketImageFileName(check.ticket.buyer_name, check.ticket.uuid);
    const disposition = contentDispositionWithUtf8Name("attachment", fileName);

    return new NextResponse(svg, {
        status: 200,
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Content-Disposition": disposition,
            "Cache-Control": "no-store",
        },
    });
}