import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { describeAiFailure, generateAdvice } from "@/lib/healthy-life/ai";
import { saveAiRecord, linkAiRecordToAdvice } from "@/lib/healthy-life/ai-records";
import { monthKey, monthRange, todayKey, weekKey, weekRange } from "@/lib/healthy-life/dates";
import { jsonError } from "@/lib/healthy-life/api-error";
import { HL_LOCALE_META, isHlLocale } from "@/lib/healthy-life/i18n/locales";

function isStaleFallbackAdvice(summary: string | null, content: string) {
  const text = `${summary ?? ""}\n${content}`;
  return /OPENAI_API_KEY|Добавьте OPENAI|HEALTHY_LIFE_OPENAI/i.test(text);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "day") as "day" | "week" | "month";
    const refresh = searchParams.get("refresh") === "1";
    const localeRaw = searchParams.get("locale") || "en";
    const locale = isHlLocale(localeRaw) ? localeRaw : "en";
    const aiLanguage = HL_LOCALE_META[locale].aiLanguage;
    const profile = await getOrCreateProfile();

    const now = new Date();
    let periodKeyBase = todayKey(now);
    let start = periodKeyBase;
    let end = periodKeyBase;
    let periodLabel = periodKeyBase;

    if (period === "week") {
      periodKeyBase = weekKey(now);
      const range = weekRange(now);
      start = range.start;
      end = range.end;
      periodLabel = range.label;
    } else if (period === "month") {
      periodKeyBase = monthKey(now);
      const range = monthRange(now);
      start = range.start;
      end = range.end;
      periodLabel = range.label;
    }

    // Cache advice per locale so language switches do not reuse wrong text.
    const periodKey = `${periodKeyBase}__${locale}`;

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
        return NextResponse.json({ advice: cached, cached: true, periodLabel, locale });
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
        ? "no workouts"
        : [...workoutByType.entries()]
            .map(([type, s]) => `${type}: ${s.count}x, volume ${s.quantity}`)
            .join("; ");

    const inputSummary = JSON.stringify({
      period,
      periodKeyBase,
      periodLabel,
      calorieGoal: profile.dailyCalorieGoal,
      totalCalories,
      mealCount: meals.length,
      avgCaloriesPerDay: totalCalories / dayCount,
      weightStart: weights[0]?.weightKg ?? null,
      weightEnd: weights[weights.length - 1]?.weightKg ?? null,
      targetWeight: profile.targetWeightKg,
      recentMeals: meals.slice(0, 12).map((m) => `${m.name} (${Math.round(m.calories)} kcal)`),
      workoutSummary,
    });

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
        recentMeals: meals.map((m) => `${m.name} (${Math.round(m.calories)} kcal)`),
        workoutSummary,
        language: aiLanguage,
      });
    } catch (err) {
      console.error(err);
      usedFallback = true;
      fallbackReason = describeAiFailure(err);
      const hasData = totalCalories > 0 || workouts.length > 0 || weights.length > 0;
      advicePayload = {
        title: period === "day" ? "Today" : period === "week" ? "This week" : "This month",
        summary: `AI temporarily unavailable: ${fallbackReason}. Summary of your data below.`,
        content: hasData
          ? `Period: ${Math.round(totalCalories)} kcal, ${meals.length} meals, ${workouts.length} workouts (${workoutSummary}). Average: ${Math.round(totalCalories / dayCount)} kcal/day vs goal ${profile.dailyCalorieGoal}.`
          : "Not enough data yet. Log meals, weight, and workouts — advice will appear automatically.",
      };
    }

    // Immutable per-user history of this AI response (including regenerations).
    const aiRecord = await saveAiRecord({
      profileId: profile.id,
      kind: "advice",
      locale,
      inputSummary,
      output: advicePayload,
      usedFallback,
      fallbackReason,
    });

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
        locale,
        usedFallback,
        aiRecordId: aiRecord.id,
      },
      update: {
        title: advicePayload.title,
        content: advicePayload.content,
        summary: advicePayload.summary,
        locale,
        usedFallback,
        aiRecordId: aiRecord.id,
      },
    });

    await linkAiRecordToAdvice(aiRecord.id, advice.id);

    return NextResponse.json({
      advice,
      cached: false,
      usedFallback,
      fallbackReason,
      periodLabel,
      locale,
      aiRecordId: aiRecord.id,
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
