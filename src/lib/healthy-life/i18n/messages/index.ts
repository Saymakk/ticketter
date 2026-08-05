import type { HlLocale } from "../locales";
import type { HlMessages } from "./en";
import { en } from "./en";
import { ru } from "./ru";
import { ar } from "./ar";
import { zh } from "./zh";
import { fr } from "./fr";
import { es } from "./es";
import { kk } from "./kk";
import { ky } from "./ky";
import { uz } from "./uz";
import { ko } from "./ko";
import { ja } from "./ja";

export const messagesByLocale: Record<HlLocale, HlMessages> = {
  en,
  ru,
  ar,
  zh,
  fr,
  es,
  kk,
  ky,
  uz,
  ko,
  ja,
};
