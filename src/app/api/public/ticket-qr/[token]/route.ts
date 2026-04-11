import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { verifyTicketQrLinkToken } from "@/lib/tickets/ticket-qr-link-token";

type Params = { params: Promise<{ token: string }> };

/**
 * Публичная PNG по подписанному токену (для WhatsApp Cloud и ссылки в wa.me).
 * Срок токена задаётся при выпуске: до конца дня после даты мероприятия (UTC), см. qrPublicLinkExpiryUnixUtc.
 * Не использует сессию; доступ только по валидному токену.
 */
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const verified = verifyTicketQrLinkToken(token);
  if (!verified) {
    return NextResponse.json({ error: "Недействительная или просроченная ссылка" }, { status: 404 });
  }

  const pngBuffer = await QRCode.toBuffer(verified.uuid, {
    type: "png",
    width: 512,
    margin: 1,
  });

  return new NextResponse(new Uint8Array(pngBuffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
