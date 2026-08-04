import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { jsonError } from "@/lib/healthy-life/api-error";

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

    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        name: body.name ?? undefined,
        dailyCalorieGoal:
          body.dailyCalorieGoal != null ? Number(body.dailyCalorieGoal) : undefined,
        targetWeightKg:
          body.targetWeightKg === "" || body.targetWeightKg == null
            ? null
            : Number(body.targetWeightKg),
        heightCm:
          body.heightCm === "" || body.heightCm == null ? null : Number(body.heightCm),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
