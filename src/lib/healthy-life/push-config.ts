/** Web Push / reminder env for Healthy Life. */

export function getHealthyLifeVapidPublicKey(): string {
  const key =
    process.env.NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY ||
    process.env.HEALTHY_LIFE_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY не задан");
  return key;
}

export function getHealthyLifeVapidPrivateKey(): string {
  const key = process.env.HEALTHY_LIFE_VAPID_PRIVATE_KEY;
  if (!key) throw new Error("HEALTHY_LIFE_VAPID_PRIVATE_KEY не задан");
  return key;
}

export function getHealthyLifeVapidSubject(): string {
  return process.env.HEALTHY_LIFE_VAPID_SUBJECT || "mailto:admin@myworkspace.su";
}

export function getHealthyLifeCronSecret(): string | undefined {
  return process.env.HEALTHY_LIFE_CRON_SECRET || process.env.CRON_SECRET;
}

export function isHealthyLifePushConfigured(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_HEALTHY_LIFE_VAPID_PUBLIC_KEY ||
      process.env.HEALTHY_LIFE_VAPID_PUBLIC_KEY) &&
      process.env.HEALTHY_LIFE_VAPID_PRIVATE_KEY,
  );
}
