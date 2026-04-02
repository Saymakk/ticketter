/** Только цифры, без замены кода страны (8→7 и т.п.) — как ввёл пользователь. */
export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10) {
    throw new Error("Неверный формат телефона");
  }
  return digits;
}

export function phoneToEmail(phoneInput: string) {
  const p = normalizePhone(phoneInput);
  return `phone_${p}@ticketter.local`;
}

export function last6FromPhone(phoneInput: string) {
  const p = normalizePhone(phoneInput);
  return p.slice(-6);
}
