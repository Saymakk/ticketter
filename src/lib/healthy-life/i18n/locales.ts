export const HL_LOCALES = [
  "en",
  "ru",
  "ar",
  "zh",
  "fr",
  "es",
  "kk",
  "ky",
  "uz",
  "ko",
  "ja",
] as const;

export type HlLocale = (typeof HL_LOCALES)[number];

export const HL_LOCALE_STORAGE_KEY = "hl-locale";

export const HL_LOCALE_META: Record<
  HlLocale,
  { nativeName: string; englishName: string; dir: "ltr" | "rtl"; aiLanguage: string }
> = {
  en: { nativeName: "English", englishName: "English", dir: "ltr", aiLanguage: "English" },
  ru: { nativeName: "Русский", englishName: "Russian", dir: "ltr", aiLanguage: "Russian" },
  ar: { nativeName: "العربية", englishName: "Arabic", dir: "rtl", aiLanguage: "Arabic" },
  zh: { nativeName: "中文", englishName: "Chinese", dir: "ltr", aiLanguage: "Simplified Chinese" },
  fr: { nativeName: "Français", englishName: "French", dir: "ltr", aiLanguage: "French" },
  es: { nativeName: "Español", englishName: "Spanish", dir: "ltr", aiLanguage: "Spanish" },
  kk: { nativeName: "Қазақша", englishName: "Kazakh", dir: "ltr", aiLanguage: "Kazakh" },
  ky: { nativeName: "Кыргызча", englishName: "Kyrgyz", dir: "ltr", aiLanguage: "Kyrgyz" },
  uz: { nativeName: "Oʻzbekcha", englishName: "Uzbek", dir: "ltr", aiLanguage: "Uzbek" },
  ko: { nativeName: "한국어", englishName: "Korean", dir: "ltr", aiLanguage: "Korean" },
  ja: { nativeName: "日本語", englishName: "Japanese", dir: "ltr", aiLanguage: "Japanese" },
};

/** Map BCP-47 / device tags → supported locale. Default: English. */
export function resolveDeviceLocale(tag?: string | null): HlLocale {
  if (!tag) return "en";
  const lower = tag.trim().toLowerCase().replace("_", "-");
  const primary = lower.split("-")[0] || lower;

  const direct = HL_LOCALES.find((l) => l === primary);
  if (direct) return direct;

  // Chinese variants
  if (primary === "zh" || lower.startsWith("zh")) return "zh";

  return "en";
}

export function isHlLocale(value: string): value is HlLocale {
  return (HL_LOCALES as readonly string[]).includes(value);
}
