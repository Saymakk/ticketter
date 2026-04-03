export const LOCALES = ["ru", "kk", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(s: string | null | undefined): s is Locale {
  return s === "ru" || s === "kk" || s === "en";
}

export const LOCALE_STORAGE_KEY = "ticketter_locale";
