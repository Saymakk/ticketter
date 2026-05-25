/** Нормализует телефон к формату 7XXXXXXXXXX (KZ/RU) для единого логина в Auth. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // 8XXXXXXXXXX → 7XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }

  // 10 цифр без кода страны → добавляем 7
  if (digits.length === 10) {
    digits = `7${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("7")) {
    return digits;
  }

  if (digits.length < 10) {
    throw new Error("Неверный формат телефона");
  }

  throw new Error("Неверный формат телефона");
}

export function phoneToEmail(phoneInput: string): string {
  const p = normalizePhone(phoneInput);
  return `phone_${p}@ticketter.local`;
}

/** Варианты auth-email для входа (новый формат + legacy после старой нормализации). */
export function phoneAuthEmailCandidates(phoneInput: string): string[] {
  const digits = phoneInput.replace(/\D/g, "");
  const candidates = new Set<string>();

  try {
    candidates.add(phoneToEmail(phoneInput));
  } catch {
    // ignore
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
