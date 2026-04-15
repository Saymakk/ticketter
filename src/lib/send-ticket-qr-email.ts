import nodemailer from "nodemailer";

type SendOpts = {
  to: string;
  /** Например Ticketter <noreply@yourdomain.com> */
  from: string;
  subject: string;
  html: string;
  pngBuffer: Buffer;
  attachmentFileName: string;
};

export type SendTicketQrEmailResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "api_error"; detail?: string };

/**
 * Отправка PNG QR через SMTP (Sequenzy).
 * Нужны env: SEQUENZY_SMTP_HOST, SEQUENZY_SMTP_PORT, SEQUENZY_SMTP_USER, SEQUENZY_SMTP_PASS.
 */
export async function sendTicketQrEmail(opts: SendOpts): Promise<SendTicketQrEmailResult> {
  const host = process.env.SEQUENZY_SMTP_HOST?.trim();
  const portRaw = process.env.SEQUENZY_SMTP_PORT?.trim();
  const user = process.env.SEQUENZY_SMTP_USER?.trim();
  const pass = process.env.SEQUENZY_SMTP_PASS?.trim();

  if (!host || !portRaw || !user || !pass) {
    return { ok: false, reason: "not_configured" };
  }

  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    return { ok: false, reason: "not_configured", detail: "Некорректный SEQUENZY_SMTP_PORT" };
  }

  const secureRaw = process.env.SEQUENZY_SMTP_SECURE?.trim();
  const secure =
    secureRaw != null
      ? /^(1|true|yes)$/i.test(secureRaw)
      : port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: [
        {
          filename: opts.attachmentFileName,
          content: opts.pngBuffer,
          contentType: "image/png",
        },
      ],
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "api_error", detail };
  }

  return { ok: true };
}
