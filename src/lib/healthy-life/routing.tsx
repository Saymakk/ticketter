"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

type RoutingValue = {
  /** "" on healthy-life.myworkspace.su; "/healthy-life" for path-based local access */
  prefix: string;
  path: (appPath: string) => string;
  api: (apiPath: string) => string;
  fetch: (apiPath: string, init?: RequestInit) => Promise<Response>;
};

const RoutingContext = createContext<RoutingValue | null>(null);

function joinPrefix(prefix: string, path: string): string {
  if (!path || path === "/") return prefix || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!prefix) return normalized;
  if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return normalized;
  return `${prefix}${normalized}`;
}

export function HealthyLifeRoutingProvider({
  prefix,
  children,
}: {
  prefix: string;
  children: ReactNode;
}) {
  const value = useMemo<RoutingValue>(() => {
    const path = (appPath: string) => joinPrefix(prefix, appPath);
    const api = (apiPath: string) => joinPrefix(prefix, apiPath.startsWith("/") ? apiPath : `/${apiPath}`);
    return {
      prefix,
      path,
      api,
      fetch: (apiPath, init) => fetch(api(apiPath), init),
    };
  }, [prefix]);

  return <RoutingContext.Provider value={value}>{children}</RoutingContext.Provider>;
}

export function useHlRouting(): RoutingValue {
  const ctx = useContext(RoutingContext);
  if (!ctx) {
    // Safe fallback for tests / accidental use outside provider: path-based prefix.
    const prefix = "/healthy-life";
    const path = (appPath: string) => joinPrefix(prefix, appPath);
    const api = (apiPath: string) => joinPrefix(prefix, apiPath.startsWith("/") ? apiPath : `/${apiPath}`);
    return {
      prefix,
      path,
      api,
      fetch: (apiPath, init) => fetch(api(apiPath), init),
    };
  }
  return ctx;
}

export function useHlPath() {
  return useHlRouting().path;
}

export function useHlFetch() {
  return useHlRouting().fetch;
}

/** Optional: stable callback form for effects. */
export function useHlFetchFn() {
  const { fetch: hlFetch } = useHlRouting();
  return useCallback((apiPath: string, init?: RequestInit) => hlFetch(apiPath, init), [hlFetch]);
}
