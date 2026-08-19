import webpush from "web-push";
import { prisma } from "@/lib/healthy-life/prisma";
import {
  getHealthyLifeVapidPrivateKey,
  getHealthyLifeVapidPublicKey,
  getHealthyLifeVapidSubject,
  isHealthyLifePushConfigured,
} from "@/lib/healthy-life/push-config";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  kind?: "medication" | "weight" | "meal";
};

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return;
  if (!isHealthyLifePushConfigured()) {
    throw new Error("Web Push (VAPID) не настроен");
  }
  webpush.setVapidDetails(
    getHealthyLifeVapidSubject(),
    getHealthyLifeVapidPublicKey(),
    getHealthyLifeVapidPrivateKey(),
  );
  vapidReady = true;
}

export async function sendPushToProfile(profileId: string, payload: PushPayload) {
  if (!isHealthyLifePushConfigured()) return { sent: 0, removed: 0 };
  ensureVapid();
  const subs = await prisma.pushSubscription.findMany({ where: { profileId } });
  if (subs.length === 0) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 },
        );
        sent += 1;
      } catch (error) {
        const status =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode: number }).statusCode)
            : 0;
        // Gone / expired subscription
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
          removed += 1;
        }
      }
    }),
  );

  return { sent, removed };
}

/**
 * Send a Telegram message to a profile if they have a linked telegramChatId.
 * Fails silently — Telegram notifications are best-effort.
 */
export async function sendTelegramToProfile(
  profileId: string,
  payload: PushPayload,
) {
  const token = process.env.HEALTHY_LIFE_TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { telegramChatId: true, botLoggedOut: true },
  });
  if (!profile?.telegramChatId || profile.botLoggedOut) return;

  const text = `${payload.title}\n${payload.body}`;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: profile.telegramChatId,
        text,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      console.error("Telegram reminder failed:", resp.status, err.slice(0, 300));
    }
  } catch (e) {
    console.error("Telegram reminder error:", e);
  }
}

export async function claimReminderSlot(params: {
  profileId: string;
  kind: string;
  dedupeKey: string;
}): Promise<boolean> {
  try {
    await prisma.pushReminderSent.create({
      data: {
        profileId: params.profileId,
        kind: params.kind,
        dedupeKey: params.dedupeKey,
      },
    });
    return true;
  } catch {
    // Unique constraint — already sent
    return false;
  }
}
