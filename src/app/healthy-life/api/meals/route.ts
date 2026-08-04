import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { todayKey } from "@/lib/healthy-life/dates";
import { jsonError } from "@/lib/healthy-life/api-error";

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
        userCorrected: Boolean(body.userCorrected),
      },
    });

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
    await getOrCreateProfile();

    const meal = await prisma.meal.update({
      where: { id: body.id },
      data: {
        name: body.name,
        description: body.description,
        calories: body.calories != null ? Number(body.calories) : undefined,
        protein: body.protein != null ? Number(body.protein) : undefined,
        carbs: body.carbs != null ? Number(body.carbs) : undefined,
        fat: body.fat != null ? Number(body.fat) : undefined,
        portionGrams: body.portionGrams != null ? Number(body.portionGrams) : undefined,
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
    await getOrCreateProfile();
    await prisma.meal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
