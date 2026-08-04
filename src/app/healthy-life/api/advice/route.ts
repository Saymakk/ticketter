import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { describeAiFailure, generateAdvice } from "@/lib/healthy-life/ai";
import { monthKey, monthRange, todayKey, weekKey, weekRange } from "@/lib/healthy-life/dates";
import { jsonError } from "@/lib/healthy-life/api-error";

function isStaleFallbackAdvice(summary: string | null, content: string) {
  const text = `${summary ?? ""}\n${content}`;
  return /OPENAI_API_KEY|Добавьте OPENAI/i.test(text);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "day") as "day" | "week" | "month";
    const refresh = searchParams.get("refresh") === "1";
    const profile = await getOrCreateProfile();

    const now = new Date();
    let periodKey = todayKey(now);
    let start = periodKey;
    let end = periodKey;
    let periodLabel = periodKey;

    if (period === "week") {
      periodKey = weekKey(now);
      const range = weekRange(now);
      start = range.start;
      end = range.end;
      periodLabel = range.label;
    } else if (period === "month") {
      periodKey = monthKey(now);
      const range = monthRange(now);
      start = range.start;
      end = range.end;
      periodLabel = range.label;
    }

    if (!refresh) {
      const cached = await prisma.advice.findUnique({
        where: {
          profileId_period_periodKey: {
            profileId: profile.id,
            period,
            periodKey,
          },
        },
      });
      if (cached && !isStaleFallbackAdvice(cached.summary, cached.content)) {
        return NextResponse.json({ advice: cached, cached: true, periodLabel });
      }
    }

    const meals = await prisma.meal.findMany({
      where: {
        profileId: profile.id,
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });

    const weights = await prisma.weightEntry.findMany({
      where: {
        profileId: profile.id,
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });

    const workouts = await prisma.workout.findMany({
      where: {
        profileId: profile.id,
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });

    const days = new Set(meals.map((m) => m.date));
    const dayCount = Math.max(days.size, 1);
    const totalCalories = meals.reduce((s, m) => s + m.calories, 0);

    const workoutByType = new Map<string, { count: number; quantity: number }>();
    for (const w of workouts) {
      const cur = workoutByType.get(w.type) || { count: 0, quantity: 0 };
      cur.count += 1;
      cur.quantity += w.quantity;
      workoutByType.set(w.type, cur);
    }
    const workoutSummary =
      workouts.length === 0
        ? "тренировок не было"
        : [...workoutByType.entries()]
            .map(([type, s]) => `${type}: ${s.count} раз, объём ${s.quantity}`)
            .join("; ");

    let advicePayload;
    let usedFallback = false;
    let fallbackReason: string | null = null;
    try {
      advicePayload = await generateAdvice({
        period,
        periodLabel,
        calorieGoal: profile.dailyCalorieGoal,
        totalCalories,
        mealCount: meals.length,
        avgCaloriesPerDay: totalCalories / dayCount,
        weightStart: weights[0]?.weightKg ?? null,
        weightEnd: weights[weights.length - 1]?.weightKg ?? null,
        targetWeight: profile.targetWeightKg,
        recentMeals: meals.map((m) => `${m.name} (${Math.round(m.calories)} ккал)`),
        workoutSummary,
      });
    } catch (err) {
      console.error(err);
      usedFallback = true;
      fallbackReason = describeAiFailure(err);
      const hasData = totalCalories > 0 || workouts.length > 0 || weights.length > 0;
      advicePayload = {
        title: period === "day" ? "Совет на сегодня" : period === "week" ? "Итоги недели" : "Итоги месяца",
        summary: `ИИ временно недоступен: ${fallbackReason}. Ниже — краткая сводка по вашим данным.`,
        content: hasData
          ? `За период: ${Math.round(totalCalories)} ккал, ${meals.length} приёмов пищи, ${workouts.length} тренировок (${workoutSummary}). Среднее: ${Math.round(totalCalories / dayCount)} ккал/день при цели ${profile.dailyCalorieGoal}.`
          : "Пока мало данных. Начните с фото еды, веса и тренировок — советы появятся автоматически.",
      };
    }

    const advice = await prisma.advice.upsert({
      where: {
        profileId_period_periodKey: {
          profileId: profile.id,
          period,
          periodKey,
        },
      },
      create: {
        profileId: profile.id,
        period,
        periodKey,
        title: advicePayload.title,
        content: advicePayload.content,
        summary: advicePayload.summary,
      },
      update: {
        title: advicePayload.title,
        content: advicePayload.content,
        summary: advicePayload.summary,
      },
    });

    return NextResponse.json({
      advice,
      cached: false,
      usedFallback,
      fallbackReason,
      periodLabel,
      stats: {
        totalCalories,
        mealCount: meals.length,
        avgCaloriesPerDay: Math.round(totalCalories / dayCount),
        weightStart: weights[0]?.weightKg ?? null,
        weightEnd: weights[weights.length - 1]?.weightKg ?? null,
        workoutCount: workouts.length,
        workoutSummary,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
