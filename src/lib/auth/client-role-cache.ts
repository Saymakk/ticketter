"use client";

type CachedRole = {
  role: string | null;
  updatedAt: number;
};

const ROLE_CACHE_TTL_MS = 10 * 60 * 1000;
const ROLE_CACHE_KEY = "ticketter.role.cache.v1";

let memoryRoleCache: CachedRole | null = null;

function isFresh(cache: CachedRole | null): cache is CachedRole {
  if (!cache) return false;
  return Date.now() - cache.updatedAt <= ROLE_CACHE_TTL_MS;
}

export function readCachedClientRole(): string | null | undefined {
  if (isFresh(memoryRoleCache)) return memoryRoleCache.role;

  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedRole;
    if (!isFresh(parsed)) return undefined;
    memoryRoleCache = parsed;
    return parsed.role;
  } catch {
    return undefined;
  }
}

export function writeCachedClientRole(role: string | null): void {
  const next: CachedRole = { role, updatedAt: Date.now() };
  memoryRoleCache = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

export function clearCachedClientRole(): void {
  memoryRoleCache = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ROLE_CACHE_KEY);
  } catch {
    // ignore storage failures
  }
}

