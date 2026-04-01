export function normalizePhone(input: string) {
    const digits = input.replace(/\D/g, "");
    if (digits.length === 10) return `7${digits}`;
    if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
    if (digits.length === 11 && digits.startsWith("7")) return digits;
    throw new Error("Неверный формат телефона");
  }
  
  export function phoneToEmail(phoneInput: string) {
    const p = normalizePhone(phoneInput);
    return `phone_${p}@inspire.local`;
  }
  
  export function last6FromPhone(phoneInput: string) {
    const p = normalizePhone(phoneInput);
    return p.slice(-6);
  }