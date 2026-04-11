type SendOpts = {
  to: string;
  /** Например Ticketter <noreply@yourdomain.com> — домен должен быть подтверждён в Resend */
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
 * Отправка PNG QR через [Resend](https://resend.com). Нужен env RESEND_API_KEY.
 */
export async function sendTicketQrEmailResend(opts: SendOpts): Promise<SendTicketQrEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "not_configured" };
  }

  const body = {
    from: opts.from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    attachments: [
      {
        filename: opts.attachmentFileName,
        content: opts.pngBuffer.toString("base64"),
      },
    ],
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) detail = String(j.message);
    } catch {
      /* ignore */
    }
    return { ok: false, reason: "api_error", detail };
  }

  return { ok: true };
}
