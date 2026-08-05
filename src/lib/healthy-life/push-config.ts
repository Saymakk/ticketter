/** Web Push / reminder env for Healthy Life. */

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getHealthyLifeVapidPublicKey(): string {
  const key =
    readEnv("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY") ||
    readEnv("HEALTHY_LIFE_VAPID_PUBLIC_KEY");
  if (!key) throw new Error("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY не задан");
  return key;
}

export function getHealthyLifeVapidPrivateKey(): string {
  const key = readEnv("HEALTHY_LIFE_VAPID_PRIVATE_KEY");
  if (!key) throw new Error("HEALTHY_LIFE_VAPID_PRIVATE_KEY не задан");
  return key;
}

export function getHealthyLifeVapidSubject(): string {
  return readEnv("HEALTHY_LIFE_VAPID_SUBJECT") || "mailto:admin@myworkspace.su";
}

export function getHealthyLifeCronSecret(): string | undefined {
  return readEnv("HEALTHY_LIFE_CRON_SECRET") || readEnv("CRON_SECRET");
}

export function isHealthyLifePushConfigured(): boolean {
  return Boolean(
    (readEnv("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY") ||
      readEnv("HEALTHY_LIFE_VAPID_PUBLIC_KEY")) &&
      readEnv("HEALTHY_LIFE_VAPID_PRIVATE_KEY"),
  );
}

/** Which env vars are missing — for admin/debug responses. */
export function getHealthyLifePushMissingEnv(): string[] {
  const missing: string[] = [];
  if (
    !readEnv("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY") &&
    !readEnv("HEALTHY_LIFE_VAPID_PUBLIC_KEY")
  ) {
    missing.push("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY");
  }
  if (!readEnv("HEALTHY_LIFE_VAPID_PRIVATE_KEY")) {
    missing.push("HEALTHY_LIFE_VAPID_PRIVATE_KEY");
  }
  return missing;
}
