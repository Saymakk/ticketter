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
    .select("ticket_valid_until")
    .eq("id", access.ticket.event_id)
    .maybeSingle();
  const ticketValidUntil =
    ev != null && typeof (ev as { ticket_valid_until?: unknown }).ticket_valid_until === "string"
      ? (ev as { ticket_valid_until: string }).ticket_valid_until
      : null;

  const base = publicSiteUrl();
  if (!base) {
    return NextResponse.json(
      { error: "Не настроен базовый URL сайта (NEXT_PUBLIC_APP_URL/APP_URL/SITE_URL)" },
      { status: 400 }
    );
  }

  const token = mintTicketQrLinkToken(uuid, ticketValidUntil);
  if (!token) {
    return NextResponse.json(
      { error: "Не настроен секрет публичной ссылки (TICKET_QR_LINK_SECRET)" },
      { status: 400 }
    );
  }

  return NextResponse.json({ url: `${base}/ticket-qr/${token}` });
}
