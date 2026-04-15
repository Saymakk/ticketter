import { NextResponse } from "next/server";
import { publicSiteUrl } from "@/lib/site-public-url";
import { getStaffReadableTicket } from "@/lib/auth/ticket-staff-read";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mintTicketQrLinkToken } from "@/lib/tickets/ticket-qr-link-token";

type Params = { params: Promise<{ uuid: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { uuid } = await params;
  const access = await getStaffReadableTicket(uuid);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const supabase = await createServerSupabaseClient();
  const { data: ev } = await supabase
    .from("events")
    .select("event_date")
    .eq("id", access.ticket.event_id)
    .maybeSingle();
  const eventDate =
    ev != null && typeof (ev as { event_date?: unknown }).event_date === "string"
      ? (ev as { event_date: string }).event_date
      : null;

  const base = publicSiteUrl();
  if (!base) {
    return NextResponse.json(
      { error: "Не настроен базовый URL сайта (NEXT_PUBLIC_APP_URL/APP_URL/SITE_URL)" },
      { status: 400 }
    );
  }

  const token = mintTicketQrLinkToken(uuid, eventDate);
  if (!token) {
    return NextResponse.json(
      { error: "Не настроен секрет публичной ссылки (TICKET_QR_LINK_SECRET)" },
      { status: 400 }
    );
  }

  return NextResponse.json({ url: `${base}/ticket-qr/${token}` });
}
