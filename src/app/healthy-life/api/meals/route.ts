import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { todayKey } from "@/lib/healthy-life/dates";
import { jsonError } from "@/lib/healthy-life/api-error";
import { isWithinEditWindow } from "@/lib/healthy-life/edit-window";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || todayKey();
    const profile = await getOrCreateProfile();

    const meals = await prisma.meal.findMany({
      where: { profileId: profile.id, date },
      orderBy: { createdAt: "asc" },
    });

    const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
    const weight = await prisma.weightEntry.findUnique({
      where: { profileId_date: { profileId: profile.id, date } },
    });

    return NextResponse.json({
      date,
      profile,
      meals,
      totalCalories,
      remainingCalories: profile.dailyCalorieGoal - totalCalories,
      weight,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profile = await getOrCreateProfile();

    const aiRecordId =
      typeof body.aiRecordId === "string" && body.aiRecordId.trim()
        ? body.aiRecordId.trim()
        : null;

    // Only link an AiRecord that belongs to this user.
    let verifiedAiRecordId: string | null = null;
    if (aiRecordId) {
      const record = await prisma.aiRecord.findFirst({
        where: { id: aiRecordId, profileId: profile.id, kind: "food_analysis" },
        select: { id: true },
      });
      verifiedAiRecordId = record?.id ?? null;
    }

    const meal = await prisma.meal.create({
      data: {
        profileId: profile.id,
        date: body.date || todayKey(),
        mealType: body.mealType || "snack",
        name: body.name,
        description: body.description ?? null,
        calories: Number(body.calories) || 0,
        protein: body.protein != null ? Number(body.protein) : null,
        carbs: body.carbs != null ? Number(body.carbs) : null,
        fat: body.fat != null ? Number(body.fat) : null,
        portionGrams: body.portionGrams != null ? Number(body.portionGrams) : null,
        photoPath: body.photoPath ?? null,
        aiDetectedName: body.aiDetectedName ?? null,
        aiCalories: body.aiCalories != null ? Number(body.aiCalories) : null,
        aiConfidence: body.aiConfidence != null ? Number(body.aiConfidence) : null,
        aiRawResponse: body.aiRawResponse ?? null,
        aiRecordId: verifiedAiRecordId,
        aiUsedFallback: Boolean(body.aiUsedFallback),
        userCorrected: Boolean(body.userCorrected),
      },
    });

    if (verifiedAiRecordId) {
      await prisma.aiRecord.update({
        where: { id: verifiedAiRecordId },
        data: { mealId: meal.id },
      });
    }

    return NextResponse.json(meal, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    const profile = await getOrCreateProfile();
    const existing = await prisma.meal.findFirst({
      where: { id: body.id, profileId: profile.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }
    if (!isWithinEditWindow(existing.createdAt)) {
      return NextResponse.json(
        { error: "Редактировать можно только в течение часа после внесения" },
        { status: 403 },
      );
    }

    const meal = await prisma.meal.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        description: body.description,
        calories: body.calories != null ? Number(body.calories) : undefined,
        protein: body.protein !== undefined ? (body.protein === "" || body.protein == null ? null : Number(body.protein)) : undefined,
        carbs: body.carbs !== undefined ? (body.carbs === "" || body.carbs == null ? null : Number(body.carbs)) : undefined,
        fat: body.fat !== undefined ? (body.fat === "" || body.fat == null ? null : Number(body.fat)) : undefined,
        portionGrams:
          body.portionGrams !== undefined
            ? body.portionGrams === "" || body.portionGrams == null
              ? null
              : Number(body.portionGrams)
            : undefined,
        mealType: body.mealType,
        userCorrected: true,
      },
    });

    return NextResponse.json(meal);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    const profile = await getOrCreateProfile();
    const existing = await prisma.meal.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }
    if (!isWithinEditWindow(existing.createdAt)) {
      return NextResponse.json(
        { error: "Удалить можно только в течение часа после внесения" },
        { status: 403 },
      );
    }
    await prisma.meal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
