import QRCode from "qrcode";
import { getStaffReadableTicket } from "@/lib/auth/ticket-staff-read";
import { qrImageFileName } from "@/lib/qr-filename";
import { publicSiteUrl } from "@/lib/site-public-url";
import {
  extractEmailFromCustomData,
  normalizePhoneForWhatsAppLink,
} from "@/lib/ticket-contact";
import { sendTicketQrEmailResend } from "@/lib/send-ticket-qr-email";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mintTicketQrLinkToken } from "@/lib/tickets/ticket-qr-link-token";
import { isWhatsAppCloudConfigured, sendWhatsAppCloudImage } from "@/lib/whatsapp-cloud";

export type SendQrChannel = "email" | "whatsapp";

export type SendQrExecuteResult = {
  email: {
    to: string | null;
    sent: boolean;
    skippedReason: "no_email" | "not_configured" | "api_error" | null;
    errorDetail: string | null;
  };
  whatsapp: {
    url: string | null;
    /** Отправлено изображение через WhatsApp Cloud API */
    sentViaApi: boolean;
    /** Ошибка API при попытке отправить изображение (есть fallback на wa.me) */
    apiError: string | null;
  };
};

function mailFrom(): string {
  return (
    process.env.MAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "Ticketter <onboarding@resend.dev>"
  );
}

function buildWhatsAppMessage(eventTitle: string | null): string {
  const title = eventTitle?.trim();
  if (title) {
    return `Билет: ${title}. Покажите QR по ссылке на входе.`;
  }
  return `Покажите QR по ссылке на входе.`;
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
    .select("title,event_date")
    .eq("id", ticket.event_id)
    .maybeSingle();

  const eventTitle = ev?.title ? String(ev.title) : null;
  const eventDate =
    ev != null && typeof (ev as { event_date?: unknown }).event_date === "string"
      ? (ev as { event_date: string }).event_date
      : null;
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

  let whatsappUrl: string | null = null;
  let whatsappSentViaApi = false;
  let whatsappApiError: string | null = null;

  if (channel === "whatsapp" && waDigits) {
    const caption = buildWhatsAppMessage(eventTitle);
    const base = publicSiteUrl();
    const token = mintTicketQrLinkToken(ticket.uuid, eventDate);
    const publicTicketPageUrl = base && token ? `${base}/ticket-qr/${token}` : null;
    const publicQrImageUrl =
      base && token ? `${base}/api/public/ticket-qr/${token}` : null;

    if (publicQrImageUrl && isWhatsAppCloudConfigured()) {
      const waCaption = publicTicketPageUrl ? `${caption}\n${publicTicketPageUrl}` : caption;
      const waRes = await sendWhatsAppCloudImage({
        toDigits: waDigits,
        imageUrl: publicQrImageUrl,
        caption: waCaption,
      });
      if (waRes.ok) {
        whatsappSentViaApi = true;
      } else {
        whatsappApiError = waRes.detail;
      }
    }

    if (!whatsappSentViaApi) {
      const textBody = publicTicketPageUrl
        ? `${caption}\n\n${publicTicketPageUrl}`
        : caption;
      whatsappUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(textBody)}`;
    }
  }

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
        sentViaApi: whatsappSentViaApi,
        apiError: whatsappApiError,
      },
    },
  };
}
