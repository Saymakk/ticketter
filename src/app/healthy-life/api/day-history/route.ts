import { NextResponse } from "next/server";
import { parseISO, subDays } from "date-fns";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { todayKey } from "@/lib/healthy-life/dates";
import { jsonError } from "@/lib/healthy-life/api-error";
import {
  buildDayCompliance,
  resolveMedicationPhoto,
} from "@/lib/healthy-life/medications";
import { getZonedNow } from "@/lib/healthy-life/reminders";

/** Load N past days ending before `before` (exclusive). Default: 7 days before today. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(14, Math.max(1, Number(searchParams.get("days") || 7)));
    const profile = await getOrCreateProfile();
    const zoned = getZonedNow(profile.timezone || "UTC");
    const beforeRaw = searchParams.get("before") || zoned.dateKey;
    const beforeDate = parseISO(beforeRaw);
    if (Number.isNaN(beforeDate.getTime())) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }

    const end = todayKey(subDays(beforeDate, 1));
    const start = todayKey(subDays(parseISO(end), days - 1));

    const dayKeys: string[] = [];
    for (let i = 0; i < days; i++) {
      dayKeys.push(todayKey(subDays(parseISO(end), i)));
    }

    const [meals, workouts, intakesRaw, allPlans, weights] = await Promise.all([
      prisma.meal.findMany({
        where: { profileId: profile.id, date: { gte: start, lte: end } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.workout.findMany({
        where: { profileId: profile.id, date: { gte: start, lte: end } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.medicationIntake.findMany({
        where: { profileId: profile.id, date: { gte: start, lte: end } },
        orderBy: [{ takenTime: "asc" }, { createdAt: "asc" }],
      }),
      prisma.medicationPlan.findMany({
        where: { profileId: profile.id },
      }),
      prisma.weightEntry.findMany({
        where: { profileId: profile.id, date: { gte: start, lte: end } },
      }),
    ]);

    const plans = allPlans.filter((p) => p.active);
    const intakes = intakesRaw.map((i) => ({
      ...i,
      photoPath: resolveMedicationPhoto(i, allPlans),
    }));

    const today = zoned.dateKey;
    const nowTime = zoned.timeKey;

    const daysPayload = dayKeys.map((date) => {
      const dayMeals = meals.filter((m) => m.date === date);
      const dayWorkouts = workouts.filter((w) => w.date === date);
      const dayIntakes = intakes.filter((i) => i.date === date);
      const weight = weights.find((w) => w.date === date) ?? null;
      const totalCalories = dayMeals.reduce((s, m) => s + m.calories, 0);
      return {
        date,
        totalCalories,
        remainingCalories: profile.dailyCalorieGoal - totalCalories,
        meals: dayMeals,
        workouts: dayWorkouts,
        intakes: dayIntakes,
        compliance: buildDayCompliance({
          plans,
          intakes: dayIntakes,
          date,
          today,
          nowTime,
        }),
        weight,
        profile: {
          dailyCalorieGoal: profile.dailyCalorieGoal,
          name: profile.name,
        },
      };
    });

    return NextResponse.json({
      start,
      end,
      before: beforeRaw,
      days: daysPayload,
      nextBefore: start,
      hasMore: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
