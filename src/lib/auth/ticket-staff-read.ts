import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isEventManagerRole } from "@/lib/auth/roles";
import { canAdminAccessEvent } from "@/lib/auth/event-access";

export type StaffReadableTicket = {
  uuid: string;
  event_id: string;
  buyer_name: string | null;
  phone: string | null;
  region: string | null;
  status: string;
  created_at: string;
  checked_in_at: string | null;
  receipt_image_url: string | null;
  custom_data: unknown;
};

/**
 * Билет доступен сотруднику (как в GET /api/tickets/[uuid]/qr): менеджер, админ с доступом к событию, user_event_access.
 */
export async function getStaffReadableTicket(ticketUuid: string): Promise<
  { ok: true; ticket: StaffReadableTicket } | { ok: false; status: number; error: string }
> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "Не авторизован" };
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("uuid,event_id,buyer_name,phone,region,status,created_at,checked_in_at,receipt_image_url,custom_data")
    .eq("uuid", ticketUuid)
    .single();

  if (ticketError || !ticket) {
    return { ok: false, status: 404, error: "Билет не найден" };
  }

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
    if (!allowed) return { ok: false, status: 403, error: "Нет доступа к билету" };
  }

  if (!access && !isManager) {
    return { ok: false, status: 403, error: "Нет доступа к билету" };
  }

  return { ok: true, ticket };
}
