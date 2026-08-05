import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { jsonError } from "@/lib/healthy-life/api-error";
import {
  getHealthyLifeVapidPublicKey,
  getHealthyLifePushMissingEnv,
  isHealthyLifePushConfigured,
} from "@/lib/healthy-life/push-config";

export async function GET() {
  try {
    if (!isHealthyLifePushConfigured()) {
      return NextResponse.json({
        configured: false,
        publicKey: null,
        missing: getHealthyLifePushMissingEnv(),
      });
    }
    return NextResponse.json({
      configured: true,
      publicKey: getHealthyLifeVapidPublicKey(),
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** Current device subscription status for this profile. */
export async function POST(request: Request) {
  try {
    const profile = await getOrCreateProfile();
    const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
    const count = await prisma.pushSubscription.count({ where: { profileId: profile.id } });
    let thisDevice = false;
    if (body.endpoint) {
      const found = await prisma.pushSubscription.findFirst({
        where: { profileId: profile.id, endpoint: body.endpoint },
        select: { id: true },
      });
      thisDevice = Boolean(found);
    }
    return NextResponse.json({
      pushEnabled: profile.pushEnabled,
      timezone: profile.timezone,
      weightReminderTime: profile.weightReminderTime,
      mealReminderTimesJson: profile.mealReminderTimesJson,
      subscriptionCount: count,
      thisDevice,
    });
  } catch (error) {
    return jsonError(error);
  }
}
