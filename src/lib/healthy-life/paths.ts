/**
 * Healthy Life URL helpers.
 *
 * Production host (healthy-life.myworkspace.su): browser paths are unprefixed (`/api/...`, `/add`);
 * `src/proxy.ts` rewrites them to `/healthy-life/...`.
 *
 * Local / path-based access (`localhost:3000/healthy-life/...`): calls must keep the prefix
 * because there is no hostname rewrite.
 */

import { isHealthyLifeHost } from "@/lib/healthy-life/hosts";

const PREFIX = "/healthy-life";

function browserHost(): string {
  if (typeof window === "undefined") return "";
  return window.location.host;
}

/** True when HL is served as its own host (rewrite hides the `/healthy-life` prefix). */
export function isHealthyLifeStandaloneHost(): boolean {
  return isHealthyLifeHost(browserHost());
}

/**
 * Path prefix for in-app navigation and API calls.
 * Empty on the dedicated HL host; `/healthy-life` otherwise (local path-based access).
 */
export function getHealthyLifePathPrefix(): string {
  if (typeof window === "undefined") {
    // SSR of HL pages always lives under the segment.
    return PREFIX;
  }
  if (isHealthyLifeStandaloneHost()) return "";
  if (window.location.pathname === PREFIX || window.location.pathname.startsWith(`${PREFIX}/`)) {
    return PREFIX;
  }
  // Fallback for odd entry points into HL components.
  return PREFIX;
}

/** App path → browser path (`/add` → `/add` or `/healthy-life/add`). */
export function hlPath(path: string): string {
  const prefix = getHealthyLifePathPrefix();
  if (!path || path === "/") return prefix || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === PREFIX || normalized.startsWith(`${PREFIX}/`)) return normalized;
  return `${prefix}${normalized}`;
}

/** API path → browser path (`/api/meals` → …). */
export function hlApi(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return hlPath(normalized);
}

/** fetch() wrapper that prefixes Healthy Life API routes when needed. */
export function hlFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith("/api") || input.startsWith("api/") ? hlApi(input.startsWith("/") ? input : `/${input}`) : input;
  return fetch(url, init);
}
