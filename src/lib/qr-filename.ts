const INVALID_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Убирает недопустимые для имён файлов символы, пробелы → подчёркивания */
export function sanitizeForFileSegment(raw: string | null | undefined, maxLen = 120): string {
  if (!raw?.trim()) return "";
  return raw
    .trim()
    .replace(INVALID_FILE_CHARS, "_")
    .replace(/\s+/g, "_")
    .slice(0, maxLen)
    .replace(/^_+|_+$/g, "");
}

/** Имя PNG без расширения: ФИО_uuid или только uuid, если ФИО пусто */
export function qrImageBaseName(buyerName: string | null | undefined, uuid: string): string {
  const seg = sanitizeForFileSegment(buyerName);
  return seg ? `${seg}_${uuid}` : uuid;
}

export function qrImageFileName(buyerName: string | null | undefined, uuid: string): string {
  return `${qrImageBaseName(buyerName, uuid)}.png`;
}

export function ticketImageFileName(buyerName: string | null | undefined, uuid: string): string {
  return `${qrImageBaseName(buyerName, uuid)}.svg`;
}

/**
 * Content-Disposition с поддержкой кириллицы (filename* UTF-8 по RFC 5987).
 * В filename= — только ASCII fallback для старых клиентов.
 */
export function contentDispositionWithUtf8Name(
  disposition: "inline" | "attachment",
  fileName: string
): string {
  const asciiFallback =
    fileName.replace(/[^\x20-\x7e]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "qr.png";
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
