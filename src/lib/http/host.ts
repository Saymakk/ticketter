/** Shared hostname helpers for proxy-level routing across portal sub-apps. */

export function normalizeHost(hostHeader: string | null | undefined): string {
  if (!hostHeader) return "";
  return hostHeader.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function getRequestHost(request: {
  headers: { get(name: string): string | null };
}): string {
  return (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    ""
  );
}
