import { NextResponse } from "next/server";
import { z } from "zod";
import { executeTicketSendQr, type SendQrChannel } from "@/lib/tickets/send-qr-execute";

type Params = { params: Promise<{ uuid: string }> };

const bodySchema = z.object({
  channel: z.enum(["email", "whatsapp"] satisfies [SendQrChannel, SendQrChannel]),
});

/**
 * POST JSON { "channel": "email" | "whatsapp" }
 * Email — QR во вложении. WhatsApp — при настроенном Cloud API изображение уходит получателю;
 * иначе открывается wa.me с текстом и (при TICKET_QR_LINK_SECRET + публичном URL) ссылкой на PNG QR.
 */
export async function POST(request: Request, { params }: Params) {
  const { uuid } = await params;

  let channel: SendQrChannel;
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Укажите channel: «email» или «whatsapp»" },
        { status: 400 }
      );
    }
    channel = parsed.data.channel;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const result = await executeTicketSendQr(uuid, channel);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
