import { en, type HlMessages } from "@/lib/healthy-life/i18n/messages/en";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]>;
};

function deepMerge<T extends Record<string, unknown>>(base: T, over?: DeepPartial<T>): T {
  if (!over) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(over) as Array<keyof T>) {
    const v = over[key];
    if (v == null) continue;
    const b = base[key];
    if (typeof v === "object" && typeof b === "object") {
      out[key as string] = deepMerge(b as Record<string, unknown>, v as DeepPartial<Record<string, unknown>>);
    } else {
      out[key as string] = v;
    }
  }
  return out as T;
}

export function defineMessages(over: DeepPartial<HlMessages> | HlMessages): HlMessages {
  return deepMerge(en as unknown as HlMessages, over);
}
