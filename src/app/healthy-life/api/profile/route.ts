import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { jsonError } from "@/lib/healthy-life/api-error";
import { normalizeTime } from "@/lib/healthy-life/medications";

function parseMealTimes(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return "[]";
  if (Array.isArray(raw)) {
    const cleaned = [
      ...new Set(
        raw
          .map((t) => normalizeTime(String(t)))
          .filter(Boolean),
      ),
    ].sort();
    return JSON.stringify(cleaned);
  }
  if (typeof raw === "string") {
    try {
      return parseMealTimes(JSON.parse(raw));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function GET() {
  try {
    const profile = await getOrCreateProfile();
    return NextResponse.json(profile);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const profile = await getOrCreateProfile();

    const mealReminderTimesJson = parseMealTimes(body.mealReminderTimes ?? body.mealReminderTimesJson);
    const weightReminderTime =
      body.weightReminderTime === undefined
        ? undefined
        : body.weightReminderTime === "" || body.weightReminderTime == null
          ? null
          : normalizeTime(String(body.weightReminderTime)) || null;

    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim().slice(0, 64)
        : undefined;

    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.dailyCalorieGoal != null
          ? { dailyCalorieGoal: Number(body.dailyCalorieGoal) }
          : {}),
        ...(body.targetWeightKg !== undefined
          ? {
              targetWeightKg:
                body.targetWeightKg === "" || body.targetWeightKg == null
                  ? null
                  : Number(body.targetWeightKg),
            }
          : {}),
        ...(body.heightCm !== undefined
          ? {
              heightCm:
                body.heightCm === "" || body.heightCm == null
                  ? null
                  : Number(body.heightCm),
            }
          : {}),
        ...(timezone ? { timezone } : {}),
        ...(typeof body.preferredLocale === "string" && body.preferredLocale.trim()
          ? { preferredLocale: body.preferredLocale.trim().slice(0, 16) }
          : {}),
        ...(body.pushEnabled != null ? { pushEnabled: Boolean(body.pushEnabled) } : {}),
        ...(weightReminderTime !== undefined ? { weightReminderTime } : {}),
        ...(mealReminderTimesJson !== undefined ? { mealReminderTimesJson } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
