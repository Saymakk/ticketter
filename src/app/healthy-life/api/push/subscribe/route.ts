import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { jsonError } from "@/lib/healthy-life/api-error";
import { isHealthyLifePushConfigured } from "@/lib/healthy-life/push-config";

type SubBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  timezone?: string;
  locale?: string;
  userAgent?: string;
};

export async function POST(request: Request) {
  try {
    if (!isHealthyLifePushConfigured()) {
      return NextResponse.json({ error: "Push not configured" }, { status: 503 });
    }

    const profile = await getOrCreateProfile();
    const body = (await request.json()) as SubBody;
    const endpoint = body.endpoint?.trim();
    const p256dh = body.keys?.p256dh?.trim();
    const auth = body.keys?.auth?.trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim().slice(0, 64)
        : undefined;
    const preferredLocale =
      typeof body.locale === "string" && body.locale.trim()
        ? body.locale.trim().slice(0, 16)
        : undefined;

    await prisma.$transaction([
      prisma.pushSubscription.upsert({
        where: { endpoint },
        create: {
          profileId: profile.id,
          endpoint,
          p256dh,
          auth,
          userAgent: body.userAgent?.slice(0, 512) ?? null,
        },
        update: {
          profileId: profile.id,
          p256dh,
          auth,
          userAgent: body.userAgent?.slice(0, 512) ?? null,
        },
      }),
      prisma.profile.update({
        where: { id: profile.id },
        data: {
          pushEnabled: true,
          ...(timezone ? { timezone } : {}),
          ...(preferredLocale ? { preferredLocale } : {}),
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const profile = await getOrCreateProfile();
    const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
    if (body.endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { profileId: profile.id, endpoint: body.endpoint },
      });
    } else {
      await prisma.pushSubscription.deleteMany({ where: { profileId: profile.id } });
    }

    const remaining = await prisma.pushSubscription.count({ where: { profileId: profile.id } });
    if (remaining === 0) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { pushEnabled: false },
      });
    }

    return NextResponse.json({ ok: true, remaining });
  } catch (error) {
    return jsonError(error);
  }
}
