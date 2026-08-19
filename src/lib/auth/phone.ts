/**
 * International phone for Auth: digits in E.164 (no plus), 8–15 characters.
 * Local RU/KZ `8XXXXXXXXXX` is mapped to `7…` so old accounts still match.
 */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  throw new Error("Неверный формат телефона");
}

export function phoneToEmail(phoneInput: string): string {
  const p = normalizePhone(phoneInput);
  return `phone_${p}@ticketter.local`;
}

/** Варианты auth-email для входа (актуальный + legacy после старой нормализации). */
export function phoneAuthEmailCandidates(phoneInput: string): string[] {
  const digits = phoneInput.replace(/\D/g, "");
  const candidates = new Set<string>();

  try {
    candidates.add(phoneToEmail(phoneInput));
  } catch {
    // ignore
  }

  if (digits.length >= 8 && digits.length <= 15) {
    candidates.add(`phone_${digits}@ticketter.local`);
  }

  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    candidates.add(`phone_${last10}@ticketter.local`);
    candidates.add(`phone_7${last10}@ticketter.local`);
  }

  if (digits.length === 11 && digits.startsWith("8")) {
    candidates.add(`phone_7${digits.slice(1)}@ticketter.local`);
    candidates.add(`phone_${digits}@ticketter.local`);
  }

  if (digits.length === 11 && digits.startsWith("7")) {
    candidates.add(`phone_${digits}@ticketter.local`);
    candidates.add(`phone_${digits.slice(1)}@ticketter.local`);
  }

  return [...candidates];
}

export function last6FromPhone(phoneInput: string) {
  const p = normalizePhone(phoneInput);
  return p.slice(-6);
}

export function tryNormalizePhone(input: string): string | null {
  try {
    return normalizePhone(input);
  } catch {
    return null;
  }
}

/** Reverse of phoneToEmail — `phone_77001234567@ticketter.local` → `77001234567`. */
export function phoneFromAuthEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const m = email.trim().toLowerCase().match(/^phone_(\d{8,15})@ticketter\.local$/);
  return m?.[1] ?? null;
}
