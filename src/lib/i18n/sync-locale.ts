import { trackedFetch } from "@/lib/http/tracked-fetch";
import { isLocale, LOCALE_STORAGE_KEY, type Locale } from "./types";

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "ru";
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw && isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "ru";
}

export async function fetchProfileLocale(): Promise<Locale | null> {
  const res = await trackedFetch("/api/me/locale", { credentials: "include" });
  if (!res.ok) return null;
  const j: unknown = await res.json();
  if (!j || typeof j !== "object" || !("locale" in j)) return null;
  const loc = (j as { locale: unknown }).locale;
  return typeof loc === "string" && isLocale(loc) ? loc : null;
}

export async function patchProfileLocale(locale: Locale): Promise<boolean> {
  const res = await trackedFetch("/api/me/locale", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
    credentials: "include",
  });
  return res.ok;
}
