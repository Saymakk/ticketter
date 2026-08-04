/** Hostnames that serve the Workspace portal instead of Ticketter home */

const WORKSPACE_HOSTS = new Set([
  "myworkspace.su",
  "www.myworkspace.su",
]);

/** Optional override for local / staging (comma-separated hosts) */
function envWorkspaceHosts(): string[] {
  const raw = process.env.WORKSPACE_HOSTS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeHost(hostHeader: string | null | undefined): string {
  if (!hostHeader) return "";
  return hostHeader.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function isWorkspaceHost(hostHeader: string | null | undefined): boolean {
  const host = normalizeHost(hostHeader);
  if (!host) return false;
  if (WORKSPACE_HOSTS.has(host)) return true;
  return envWorkspaceHosts().includes(host);
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
