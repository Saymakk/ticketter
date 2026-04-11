const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email только из явного поля (ключ содержит email / e-mail / mail), значение непустое и похоже на email.
 * Случайные поля без «email» в названии не учитываются.
 */
export function extractEmailFromCustomData(custom: unknown): string | null {
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) return null;
  const rec = custom as Record<string, unknown>;

  for (const [k, v] of Object.entries(rec)) {
    if (/email|e-mail|^mail$/i.test(k) && typeof v === "string") {
      const t = v.trim();
      if (t && EMAIL_LIKE.test(t)) return t;
    }
  }

  return null;
}

/**
 * Цифры для https://wa.me/&lt;digits&gt; (без +).
 * Упрощённо: 8… → 7… для РФ/КЗ; 10 цифр без кода → добавляется 7.
 */
export function normalizePhoneForWhatsAppLink(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length === 0) return null;
  if (d.length === 11 && d.startsWith("8")) d = `7${d.slice(1)}`;
  if (d.length === 10 && !d.startsWith("7")) d = `7${d}`;
  if (d.length < 10 || d.length > 15) return null;
  return d;
}
