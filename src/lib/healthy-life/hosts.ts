/** Hostname that serves the Healthy Life app instead of Ticketter/Workspace */
import { normalizeHost } from "@/lib/http/host";

const HEALTHY_LIFE_HOSTS = new Set(["healthy-life.myworkspace.su"]);

/** Optional override for local / staging (comma-separated hosts) */
function envHealthyLifeHosts(): string[] {
  const raw = process.env.HEALTHY_LIFE_HOSTS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function isHealthyLifeHost(hostHeader: string | null | undefined): boolean {
  const host = normalizeHost(hostHeader);
  if (!host) return false;
  if (HEALTHY_LIFE_HOSTS.has(host)) return true;
  return envHealthyLifeHosts().includes(host);
}
