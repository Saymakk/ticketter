/** Web Push / reminder env for Healthy Life (server-only). */

/**
 * Read runtime env without static `process.env.NEXT_PUBLIC_*` access.
 * Next.js may replace those with empty strings at build time if build-args were missing.
 */
function runtimeEnv(key: string): string | undefined {
  // eslint-disable-next-line dot-notation -- defeat Next/webpack env inlining
  const bag = process["env"] as Record<string, string | undefined>;
  const raw = bag[key];
  if (raw == null) return undefined;
  const trimmed = String(raw).trim().replace(/^['"]|['']$/g, "");
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Public VAPID key for Web Push.
 * Prefer non-NEXT_PUBLIC name so Docker runtime env always wins.
 */
export function getHealthyLifeVapidPublicKey(): string {
  const key =
    runtimeEnv("HEALTHY_LIFE_VAPID_PUBLIC_KEY") ||
    runtimeEnv("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY");
  if (!key) {
    throw new Error(
      "HEALTHY_LIFE_VAPID_PUBLIC_KEY не задан (добавьте в .env контейнера и перезапустите)",
    );
  }
  return key;
}

export function getHealthyLifeVapidPrivateKey(): string {
  const key = runtimeEnv("HEALTHY_LIFE_VAPID_PRIVATE_KEY");
  if (!key) throw new Error("HEALTHY_LIFE_VAPID_PRIVATE_KEY не задан");
  return key;
}

export function getHealthyLifeVapidSubject(): string {
  return runtimeEnv("HEALTHY_LIFE_VAPID_SUBJECT") || "mailto:admin@myworkspace.su";
}

export function getHealthyLifeCronSecret(): string | undefined {
  return runtimeEnv("HEALTHY_LIFE_CRON_SECRET") || runtimeEnv("CRON_SECRET");
}

export function isHealthyLifePushConfigured(): boolean {
  const pub =
    runtimeEnv("HEALTHY_LIFE_VAPID_PUBLIC_KEY") ||
    runtimeEnv("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY");
  const priv = runtimeEnv("HEALTHY_LIFE_VAPID_PRIVATE_KEY");
  return Boolean(pub && pub.length > 20 && priv && priv.length > 20);
}

export function getHealthyLifePushEnvDebug(): {
  hasPublicAlias: boolean;
  hasPublicNext: boolean;
  hasPrivate: boolean;
  publicLen: number;
  privateLen: number;
} {
  const pub =
    runtimeEnv("HEALTHY_LIFE_VAPID_PUBLIC_KEY") ||
    runtimeEnv("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY") ||
    "";
  const priv = runtimeEnv("HEALTHY_LIFE_VAPID_PRIVATE_KEY") || "";
  return {
    hasPublicAlias: Boolean(runtimeEnv("HEALTHY_LIFE_VAPID_PUBLIC_KEY")),
    hasPublicNext: Boolean(runtimeEnv("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY")),
    hasPrivate: Boolean(runtimeEnv("HEALTHY_LIFE_VAPID_PRIVATE_KEY")),
    publicLen: pub.length,
    privateLen: priv.length,
  };
}

export function getHealthyLifePushMissingEnv(): string[] {
  const missing: string[] = [];
  if (
    !runtimeEnv("HEALTHY_LIFE_VAPID_PUBLIC_KEY") &&
    !runtimeEnv("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY")
  ) {
    missing.push("HEALTHY_LIFE_VAPID_PUBLIC_KEY");
  }
  if (!runtimeEnv("HEALTHY_LIFE_VAPID_PRIVATE_KEY")) {
    missing.push("HEALTHY_LIFE_VAPID_PRIVATE_KEY");
  }
  return missing;
}
