import type { DayPanelData } from "@/components/healthy-life/DayPanel";
import type { MedicationPlan } from "@/components/healthy-life/MedicationModals";
import {
  HL_CACHE_STALE_MS,
  cacheKey,
  clearAppCaches,
  isCacheStale,
  readCache,
  writeCache,
  type CacheEntry,
} from "@/lib/healthy-life/app-cache";

export { HL_CACHE_STALE_MS as DAY_CACHE_STALE_MS };

export type DayCachePayload = {
  data: DayPanelData;
  plans: MedicationPlan[];
};

export type DayCacheEntry = {
  savedAt: number;
  data: DayPanelData;
  plans: MedicationPlan[];
};

function dayKey(date: string): string {
  return cacheKey("day", date);
}

export function readDayCache(date: string): DayCacheEntry | null {
  const entry = readCache<DayCachePayload>(dayKey(date));
  if (!entry) return null;
  return { savedAt: entry.savedAt, data: entry.data.data, plans: entry.data.plans };
}

export function writeDayCache(date: string, data: DayPanelData, plans: MedicationPlan[]): void {
  writeCache(dayKey(date), { data, plans } satisfies DayCachePayload);
}

export function isDayCacheStale(entry: DayCacheEntry, maxAgeMs = HL_CACHE_STALE_MS): boolean {
  return isCacheStale({ savedAt: entry.savedAt, data: null } as CacheEntry<null>, maxAgeMs);
}

/** @deprecated Prefer clearAppCaches */
export function clearDayCaches(): void {
  clearAppCaches();
}
