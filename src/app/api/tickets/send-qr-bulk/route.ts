import { NextResponse } from "next/server";
import { z } from "zod";
import { executeTicketSendQr, type SendQrChannel } from "@/lib/tickets/send-qr-execute";

const bodySchema = z.object({
  uuids: z.array(z.string().uuid()).min(1),
  channel: z.enum(["email", "whatsapp"] satisfies [SendQrChannel, SendQrChannel]),
});

/**
 * POST: массовая отправка QR выбранным билетам (доступ как у одиночного send-qr).
 */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Нужны uuids (uuid[]) и channel: email | whatsapp" },
      { status: 400 }
    );
  }

  const { uuids, channel } = parsed.data;

  const results: {
    uuid: string;
    ok: boolean;
    error?: string;
    email?: { to: string | null; sent: boolean };
    whatsappUrl?: string | null;
    whatsappSentViaApi?: boolean;
  }[] = [];

  for (const uuid of uuids) {
    const r = await executeTicketSendQr(uuid, channel);
    if (!r.ok) {
      results.push({ uuid, ok: false, error: r.error });
      continue;
    }

    if (channel === "email") {
      const em = r.data.email;
      if (em.sent) {
        results.push({
          uuid,
          ok: true,
          email: { to: em.to, sent: true },
        });
      } else if (em.skippedReason === "not_configured") {
        results.push({
          uuid,
          ok: false,
          error: "Почта не настроена (RESEND_API_KEY / MAIL_FROM)",
        });
      } else if (em.skippedReason === "api_error") {
        results.push({
          uuid,
          ok: false,
          error: em.errorDetail ?? "Ошибка отправки почты",
        });
      } else {
        results.push({ uuid, ok: false, error: "Письмо не отправлено" });
      }
    } else {
      const w = r.data.whatsapp;
      if (w.sentViaApi) {
        results.push({ uuid, ok: true, whatsappSentViaApi: true, whatsappUrl: null });
      } else if (w.url) {
        results.push({ uuid, ok: true, whatsappUrl: w.url });
      } else {
        results.push({
          uuid,
          ok: false,
          error: "Нет телефона для WhatsApp",
        });
      }
    }
  }

  const okCount = results.filter((x) => x.ok).length;

  return NextResponse.json({
    channel,
    processed: uuids.length,
    successCount: okCount,
    failedCount: results.length - okCount,
    results,
  });
}
