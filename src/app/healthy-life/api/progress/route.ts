import { NextResponse } from "next/server";
import { eachDayOfInterval, parseISO, subDays } from "date-fns";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { todayKey } from "@/lib/healthy-life/dates";
import { workoutTypeLabel } from "@/lib/healthy-life/workouts";
import { jsonError } from "@/lib/healthy-life/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(7, Number(searchParams.get("days") || 14)));
    const profile = await getOrCreateProfile();

    const end = todayKey();
    const start = todayKey(subDays(parseISO(end), days - 1));

    const [meals, weights, workouts] = await Promise.all([
      prisma.meal.findMany({
        where: { profileId: profile.id, date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
      prisma.weightEntry.findMany({
        where: { profileId: profile.id, date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
      prisma.workout.findMany({
        where: { profileId: profile.id, date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
    ]);

    const dayKeys = eachDayOfInterval({
      start: parseISO(start),
      end: parseISO(end),
    }).map((d) => todayKey(d));

    const caloriesByDay = new Map<string, number>();
    for (const meal of meals) {
      caloriesByDay.set(meal.date, (caloriesByDay.get(meal.date) || 0) + meal.calories);
    }

    const weightByDay = new Map(weights.map((w) => [w.date, w.weightKg]));

    const workoutsByDay = new Map<
      string,
      { count: number; quantity: number; byType: Record<string, { count: number; quantity: number }> }
    >();

    for (const w of workouts) {
      const bucket = workoutsByDay.get(w.date) || { count: 0, quantity: 0, byType: {} };
      bucket.count += 1;
      bucket.quantity += w.quantity;
      if (!bucket.byType[w.type]) bucket.byType[w.type] = { count: 0, quantity: 0 };
      bucket.byType[w.type].count += 1;
      bucket.byType[w.type].quantity += w.quantity;
      workoutsByDay.set(w.date, bucket);
    }

    const series = dayKeys.map((date) => {
      const dayWorkouts = workoutsByDay.get(date);
      return {
        date,
        calories: Math.round(caloriesByDay.get(date) || 0),
        weightKg: weightByDay.get(date) ?? null,
        workoutCount: dayWorkouts?.count || 0,
        workoutQuantity: dayWorkouts?.quantity || 0,
        workoutsByType: dayWorkouts?.byType || {},
      };
    });

    const typeTotalsMap = new Map<string, { count: number; quantity: number; unitSamples: string[] }>();
    for (const w of workouts) {
      const cur = typeTotalsMap.get(w.type) || { count: 0, quantity: 0, unitSamples: [] };
      cur.count += 1;
      cur.quantity += w.quantity;
      cur.unitSamples.push(w.unit);
      typeTotalsMap.set(w.type, cur);
    }

    const byType = [...typeTotalsMap.entries()]
      .map(([type, stats]) => {
        const unitCounts = stats.unitSamples.reduce<Record<string, number>>((acc, u) => {
          acc[u] = (acc[u] || 0) + 1;
          return acc;
        }, {});
        const dominantUnit =
          Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "minutes";
        return {
          type,
          label: workoutTypeLabel(type),
          count: stats.count,
          quantity: Number(stats.quantity.toFixed(1)),
          unit: dominantUnit,
        };
      })
      .sort((a, b) => b.count - a.count || b.quantity - a.quantity);

    return NextResponse.json({
      from: start,
      to: end,
      days,
      calorieGoal: profile.dailyCalorieGoal,
      series,
      byType,
      totals: {
        meals: meals.length,
        calories: Math.round(meals.reduce((s, m) => s + m.calories, 0)),
        workouts: workouts.length,
        workoutTypes: byType.length,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
