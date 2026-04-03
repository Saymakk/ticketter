import type { Locale } from "./types";
import en from "@/messages/en.json";
import kk from "@/messages/kk.json";
import ru from "@/messages/ru.json";

const bundles: Record<Locale, Record<string, unknown>> = { ru, kk, en };

export function getBundle(locale: Locale) {
  return bundles[locale] ?? bundles.ru;
}

function applyVars(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/** Путь вида "login.title" или "admin.manage.sectionNew" */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const parts = key.split(".");
  let cur: unknown = getBundle(locale);
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      cur = undefined;
      break;
    }
  }
  if (typeof cur === "string") return applyVars(cur, vars);
  if (locale !== "ru") return translate("ru", key, vars);
  return key;
}
