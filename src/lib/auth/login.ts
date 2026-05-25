import { phoneToEmail, phoneAuthEmailCandidates } from "./phone";

export function looksLikeEmail(input: string): boolean {
  const s = input.trim();
  return s.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Один ввод «логин»: телефон → email для Supabase Auth, иначе настоящий email.
 */
export function resolveAuthEmail(raw: string): { email: string; mode: "phone" | "email" } {
  const trimmed = raw.trim();
  if (looksLikeEmail(trimmed)) {
    return { email: normalizeEmail(trimmed), mode: "email" };
  }
  return { email: phoneToEmail(trimmed), mode: "phone" };
}

/** Все возможные auth-email для входа (актуальный + legacy для телефона). */
export function resolveAuthEmailCandidates(raw: string): { emails: string[]; mode: "phone" | "email" } {
  const trimmed = raw.trim();
  if (looksLikeEmail(trimmed)) {
    return { emails: [normalizeEmail(trimmed)], mode: "email" };
  }
  return { emails: phoneAuthEmailCandidates(trimmed), mode: "phone" };
}
