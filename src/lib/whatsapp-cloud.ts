/**
 * WhatsApp Cloud API (Meta): отправка изображения по ссылке (HTTPS, доступно серверам Meta).
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 */

export function isWhatsAppCloudConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim()
  );
}

export async function sendWhatsAppCloudImage(params: {
  toDigits: string;
  imageUrl: string;
  caption: string;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  const token = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim();
  const version = process.env.WHATSAPP_CLOUD_API_VERSION?.trim() || "v21.0";
  if (!token || !phoneId) {
    return { ok: false, detail: "WhatsApp Cloud API не настроен" };
  }

  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
  const caption =
    params.caption.length > 1020 ? `${params.caption.slice(0, 1017)}…` : params.caption;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.toDigits,
      type: "image",
      image: {
        link: params.imageUrl,
        caption,
      },
    }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail =
      typeof json.error === "object" && json.error !== null && "message" in json.error
        ? String((json.error as { message?: unknown }).message)
        : JSON.stringify(json);
    return { ok: false, detail: detail || `HTTP ${res.status}` };
  }
  return { ok: true };
}
