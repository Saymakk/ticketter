"use client";

import { LOCALES, type Locale } from "@/lib/i18n/types";
import { useLocaleContext } from "@/components/locale-provider";

export default function LanguageSwitcher({
  className = "",
}: {
  className?: string;
}) {
  const { locale, setLocale, t } = useLocaleContext();

  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <span className="text-slate-600">{t("common.language")}</span>
      <select
        value={locale}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "ru" || v === "kk" || v === "en") setLocale(v as Locale);
        }}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        aria-label={t("common.language")}
      >
        {LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {t(`lang.${loc}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
