import { createHmac, timingSafeEqual } from "crypto";
import { qrPublicLinkExpiryUnixUtc } from "@/lib/event-date";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function secret(): string | null {
  return process.env.TICKET_QR_LINK_SECRET?.trim() || null;
}

/**
 * Подписанный токен для GET /api/public/ticket-qr/[token] (PNG).
 * Срок — до конца дня после даты мероприятия (см. qrPublicLinkExpiryUnixUtc).
 * Без TICKET_QR_LINK_SECRET вернёт null.
 */
export function mintTicketQrLinkToken(
  ticketUuid: string,
  eventDate: string | null | undefined
): string | null {
  const s = secret();
  if (!s || !UUID_RE.test(ticketUuid)) return null;
  const exp = qrPublicLinkExpiryUnixUtc(eventDate);
  const body = `${ticketUuid}|${exp}`;
  const sig = createHmac("sha256", s).update(body).digest("hex");
  return Buffer.from(`${body}|${sig}`, "utf8").toString("base64url");
}

export function verifyTicketQrLinkToken(token: string): { uuid: string } | null {
  const s = secret();
  if (!s) return null;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parts = raw.split("|");
    if (parts.length !== 3) return null;
    const [uuid, expStr, sig] = parts;
    if (!uuid || !UUID_RE.test(uuid)) return null;
    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
    const body = `${uuid}|${expStr}`;
    const expected = createHmac("sha256", s).update(body).digest("hex");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { uuid };
  } catch {
    return null;
  }
}
