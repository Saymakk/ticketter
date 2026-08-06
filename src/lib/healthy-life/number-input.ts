/** Digits-only meal macro / portion fields, with leading-zero cleanup. */
export function sanitizeDigitsInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 1) return digits;
  // "05" / "00" / "0123" → drop leading zeros when no decimal separator
  return digits.replace(/^0+/, "") || "0";
}

/** Allow digits and a single decimal separator (. or ,). Leading integer zero is dropped when typing more digits without a separator. */
export function sanitizeDecimalInput(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, "");
  const sepMatch = s.match(/[.,]/);
  if (!sepMatch || sepMatch.index == null) {
    return sanitizeDigitsInput(s);
  }
  const sepIdx = sepMatch.index;
  const sep = s[sepIdx]!;
  const intPart = s.slice(0, sepIdx).replace(/\D/g, "");
  const fracPart = s.slice(sepIdx + 1).replace(/\D/g, "");
  const normalizedInt = intPart === "" ? "0" : intPart.replace(/^0+(?=\d)/, "");
  return `${normalizedInt}${sep}${fracPart}`;
}

export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
