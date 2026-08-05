/** Client-side stale-while-revalidate cache for Healthy Life (localStorage). */

export const HL_CACHE_STALE_MS = 45_000;

const PREFIX = "hl:cache:v1:";

export type CacheEntry<T> = {
  savedAt: number;
  data: T;
};

export function cacheKey(...parts: Array<string | number>): string {
  return parts.map(String).join(":");
}

function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

export function readCache<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || parsed.data === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { savedAt: Date.now(), data };
    window.localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Quota / private mode — ignore
  }
}

export function isCacheStale<T>(entry: CacheEntry<T>, maxAgeMs = HL_CACHE_STALE_MS): boolean {
  return Date.now() - entry.savedAt > maxAgeMs;
}

export function removeCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}

/** Remove keys whose logical key starts with prefix (e.g. "progress:" or "day:"). */
export function invalidateCachePrefix(prefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const full = `${PREFIX}${prefix}`;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(full)) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

/** Drop all Healthy Life client caches (e.g. on sign-out). */
export function clearAppCaches(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX) || k?.startsWith("hl:day-cache:v1:")) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

/** After meals / workouts / meds / weight / profile changes. */
export function invalidateRelatedCaches(opts?: {
  day?: string;
  progress?: boolean;
  workouts?: boolean;
  weight?: boolean;
  advice?: boolean;
  profile?: boolean;
  dayHistory?: boolean;
}): void {
  if (opts?.day) removeCache(cacheKey("day", opts.day));
  if (opts?.progress !== false) invalidateCachePrefix("progress:");
  if (opts?.workouts !== false) invalidateCachePrefix("workouts:");
  if (opts?.weight !== false) invalidateCachePrefix("weight:");
  if (opts?.advice !== false) invalidateCachePrefix("advice:");
  if (opts?.dayHistory !== false) removeCache(cacheKey("day-history", "first"));
  if (opts?.profile) removeCache("profile");
}
