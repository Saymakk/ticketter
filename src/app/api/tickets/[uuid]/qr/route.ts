import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getStaffReadableTicket } from "@/lib/auth/ticket-staff-read";
import { contentDispositionWithUtf8Name, qrImageFileName } from "@/lib/qr-filename";

type Params = { params: Promise<{ uuid: string }> };

export async function GET(request: Request, { params }: Params) {
    const { uuid } = await params;
    const check = await getStaffReadableTicket(uuid);

    if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const pngBuffer = await QRCode.toBuffer(check.ticket.uuid, {
        type: "png",
        width: 512,
        margin: 1,
    });

    const body = new Uint8Array(pngBuffer);
    const url = new URL(request.url);
    const inline = url.searchParams.get("inline") === "1";
    const fileName = qrImageFileName(check.ticket.buyer_name, check.ticket.uuid);
    const disposition = contentDispositionWithUtf8Name(inline ? "inline" : "attachment", fileName);

    return new NextResponse(body, {
        status: 200,
        headers: {
            "Content-Type": "image/png",
            "Content-Disposition": disposition,
            "Cache-Control": "no-store",
        },
    });
}