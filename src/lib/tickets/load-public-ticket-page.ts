import { cache } from "react";
import { formatEventDateTimeLine } from "@/lib/event-date";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyTicketQrLinkToken } from "@/lib/tickets/ticket-qr-link-token";

export type PublicTicketPageModel = {
  token: string;
  eventLine: string;
  event: {
    title: string;
    city: string | null;
    event_date: string;
    event_time: string | null;
  };
  ticket: {
    uuid: string;
    buyer_name: string | null;
    phone: string | null;
    ticket_type: string | null;
    region: string | null;
    status: string;
    created_at: string;
    checked_in_at: string | null;
    custom_data: unknown;
  };
};

export const loadPublicTicketPageModel = cache(async function loadPublicTicketPageModel(
  token: string
): Promise<PublicTicketPageModel | null> {
  const verified = verifyTicketQrLinkToken(token);
  if (!verified) return null;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const { data: ticket, error: tErr } = await admin
    .from("tickets")
    .select(
      "uuid,event_id,buyer_name,phone,ticket_type,region,status,created_at,checked_in_at,custom_data"
    )
    .eq("uuid", verified.uuid)
    .maybeSingle();

  if (tErr || !ticket) return null;

  const { data: ev, error: eErr } = await admin
    .from("events")
    .select("title,city,event_date,event_time")
    .eq("id", ticket.event_id)
    .maybeSingle();

  if (eErr || !ev) return null;

  const title = ev.title != null ? String(ev.title) : "Мероприятие";
  const event_date = typeof ev.event_date === "string" ? ev.event_date : "";
  const event_time = ev.event_time != null ? String(ev.event_time) : null;
  const city = ev.city != null ? String(ev.city) : null;

  return {
    token,
    eventLine: formatEventDateTimeLine(event_date, event_time),
    event: {
      title,
      city,
      event_date,
      event_time,
    },
    ticket: {
      uuid: ticket.uuid,
      buyer_name: ticket.buyer_name,
      phone: ticket.phone,
      ticket_type: ticket.ticket_type,
      region: ticket.region,
      status: String(ticket.status ?? "new"),
      created_at: String(ticket.created_at ?? ""),
      checked_in_at: ticket.checked_in_at != null ? String(ticket.checked_in_at) : null,
      custom_data: ticket.custom_data,
    },
  };
});
