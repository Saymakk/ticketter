import QRCode from "qrcode";
import { getStaffReadableTicket } from "@/lib/auth/ticket-staff-read";
import { qrImageFileName } from "@/lib/qr-filename";
import {
  extractEmailFromCustomData,
  normalizePhoneForWhatsAppLink,
} from "@/lib/ticket-contact";
import { sendTicketQrEmailResend } from "@/lib/send-ticket-qr-email";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SendQrChannel = "email" | "whatsapp";

export type SendQrExecuteResult = {
  email: {
    to: string | null;
    sent: boolean;
    skippedReason: "no_email" | "not_configured" | "api_error" | null;
    errorDetail: string | null;
  };
  whatsapp: { url: string | null };
};

function mailFrom(): string {
  return (
    process.env.MAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "Ticketter <onboarding@resend.dev>"
  );
}

function buildWhatsAppMessage(eventTitle: string | null, ticketUuid: string): string {
  const title = eventTitle?.trim();
  if (title) {
    return `Билет: ${title}. Покажите QR на входе. Код билета: ${ticketUuid}`;
  }
  return `Покажите QR на входе. Код билета: ${ticketUuid}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Одна попытка отправки QR по выбранному каналу (для API и bulk).
 */
export async function executeTicketSendQr(
  uuid: string,
  channel: SendQrChannel
): Promise<
  | { ok: true; data: SendQrExecuteResult }
  | { ok: false; status: number; error: string }
> {
  const access = await getStaffReadableTicket(uuid);

  if (!access.ok) {
    return { ok: false, status: access.status, error: access.error };
  }

  const ticket = access.ticket;
  const emailAddr = extractEmailFromCustomData(ticket.custom_data);
  const waDigits = normalizePhoneForWhatsAppLink(ticket.phone);

  if (channel === "email" && !emailAddr) {
    return {
      ok: false,
      status: 400,
      error: "В полях билета нет email",
    };
  }

  if (channel === "whatsapp" && !waDigits) {
    return {
      ok: false,
      status: 400,
      error: "Некорректный телефон для WhatsApp",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: ev } = await supabase
    .from("events")
    .select("title")
    .eq("id", ticket.event_id)
    .maybeSingle();

  const eventTitle = ev?.title ? String(ev.title) : null;
  const pngBuffer = await QRCode.toBuffer(ticket.uuid, {
    type: "png",
    width: 512,
    margin: 1,
  });
  const attachmentName = qrImageFileName(ticket.buyer_name, ticket.uuid);

  let emailSent = false;
  let emailSkippedReason: "no_email" | "not_configured" | "api_error" | null = null;
  let emailErrorDetail: string | undefined;

  if (channel === "email" && emailAddr) {
    const subject = eventTitle
      ? `Билет: ${eventTitle}`
      : `Билет ${ticket.uuid.slice(0, 8)}…`;
    const html = `
      <p>Здравствуйте${ticket.buyer_name ? `, ${escapeHtml(ticket.buyer_name)}` : ""}.</p>
      <p>Во вложении — QR-код для входа.</p>
      <p style="font-size:12px;color:#64748b;">Код билета: <code>${escapeHtml(ticket.uuid)}</code></p>
    `;

    const result = await sendTicketQrEmailResend({
      to: emailAddr,
      from: mailFrom(),
      subject,
      html,
      pngBuffer,
      attachmentFileName: attachmentName,
    });

    if (result.ok) {
      emailSent = true;
    } else if (result.reason === "not_configured") {
      emailSkippedReason = "not_configured";
    } else {
      emailSkippedReason = "api_error";
      emailErrorDetail = result.detail;
    }
  }

  const whatsappUrl =
    channel === "whatsapp" && waDigits
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
          buildWhatsAppMessage(eventTitle, ticket.uuid)
        )}`
      : null;

  return {
    ok: true,
    data: {
      email:
        channel === "email"
          ? {
              to: emailAddr ?? null,
              sent: emailSent,
              skippedReason: emailSkippedReason,
              errorDetail: emailErrorDetail ?? null,
            }
          : {
              to: null,
              sent: false,
              skippedReason: null,
              errorDetail: null,
            },
      whatsapp: {
        url: whatsappUrl,
      },
    },
  };
}
