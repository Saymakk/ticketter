"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  HL_LOCALE_META,
  HL_LOCALE_STORAGE_KEY,
  HL_LOCALES,
  isHlLocale,
  resolveDeviceLocale,
  type HlLocale,
} from "@/lib/healthy-life/i18n/locales";
import { messagesByLocale } from "@/lib/healthy-life/i18n/messages";
import type { HlMessages } from "@/lib/healthy-life/i18n/messages/en";

type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type HlMessageKey = DotPaths<HlMessages>;

type I18nValue = {
  locale: HlLocale;
  setLocale: (locale: HlLocale) => void;
  t: (key: HlMessageKey, vars?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
  aiLanguage: string;
  locales: typeof HL_LOCALES;
  meta: typeof HL_LOCALE_META;
};

const I18nContext = createContext<I18nValue | null>(null);

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function readStoredLocale(): HlLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HL_LOCALE_STORAGE_KEY);
    if (raw && isHlLocale(raw)) return raw;
  } catch {
    // ignore
  }
  return null;
}

export function HealthyLifeI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<HlLocale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredLocale();
    const device = resolveDeviceLocale(window.navigator.language);
    setLocaleState(stored ?? device);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = HL_LOCALE_META[locale].dir;
    try {
      window.localStorage.setItem(HL_LOCALE_STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }, [locale, ready]);

  const setLocale = useCallback((next: HlLocale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: HlMessageKey, vars?: Record<string, string | number>) => {
      const fromLocale = getByPath(messagesByLocale[locale], key);
      const fromEn = getByPath(messagesByLocale.en, key);
      let text = fromLocale ?? fromEn ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t,
      dir: HL_LOCALE_META[locale].dir,
      aiLanguage: HL_LOCALE_META[locale].aiLanguage,
      locales: HL_LOCALES,
      meta: HL_LOCALE_META,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useHlI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useHlI18n must be used within HealthyLifeI18nProvider");
  }
  return ctx;
}

export function useT() {
  return useHlI18n().t;
}
