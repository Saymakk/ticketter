/** Допустимые типы файла чека в `<input type="file">`. */
export const RECEIPT_FILE_ACCEPT = "image/*,application/pdf";

export function isPdfReceiptUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".pdf");
}

export function pdfReceiptFileName(url: string): string {
  const segment = url.split("?")[0].split("/").pop() ?? "";
  return segment.toLowerCase().endsWith(".pdf") ? segment : "chek.pdf";
}

/** Скачивает PDF-чек (fetch + blob, с запасным вариантом через прямую ссылку). */
export async function downloadPdfReceipt(url: string, fileName?: string): Promise<void> {
  const name = fileName ?? pdfReceiptFileName(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
