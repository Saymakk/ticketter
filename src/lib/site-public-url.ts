/**
 * Базовый HTTPS URL сайта для публичных ссылок (QR, WhatsApp Cloud API).
 */
export function publicSiteUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return null;
}
