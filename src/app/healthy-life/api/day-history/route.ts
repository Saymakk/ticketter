import { NextResponse } from "next/server";
import { parseISO, subDays } from "date-fns";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { todayKey } from "@/lib/healthy-life/dates";
import { jsonError } from "@/lib/healthy-life/api-error";
import {
  buildDayCompliance,
  nowTimeKey,
} from "@/lib/healthy-life/medications";

/** Load N past days ending before `before` (exclusive). Default: 7 days before today. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(14, Math.max(1, Number(searchParams.get("days") || 7)));
    const beforeRaw = searchParams.get("before") || todayKey();
    const beforeDate = parseISO(beforeRaw);
    if (Number.isNaN(beforeDate.getTime())) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }

    const profile = await getOrCreateProfile();
    const end = todayKey(subDays(beforeDate, 1));
    const start = todayKey(subDays(parseISO(end), days - 1));

    const dayKeys: string[] = [];
    for (let i = 0; i < days; i++) {
      dayKeys.push(todayKey(subDays(parseISO(end), i)));
    }

    const [meals, workouts, intakes, plans, weights] = await Promise.all([
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
        where: { profileId: profile.id, active: true },
      }),
      prisma.weightEntry.findMany({
        where: { profileId: profile.id, date: { gte: start, lte: end } },
      }),
    ]);

    const today = todayKey();
    const nowTime = nowTimeKey();

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
