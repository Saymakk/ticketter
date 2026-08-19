import { parsePlanTimes, isPlanScheduledOnDate, normalizeTime } from "@/lib/healthy-life/medications";
import { completedPeriodRange } from "@/lib/healthy-life/dates";
import { generateAdvice, describeAiFailure } from "@/lib/healthy-life/ai";
import { saveAiRecord, linkAiRecordToAdvice } from "@/lib/healthy-life/ai-records";
import { HL_LOCALE_META, isHlLocale } from "@/lib/healthy-life/i18n/locales";
import { prisma } from "@/lib/healthy-life/prisma";
import { claimReminderSlot, sendPushToProfile, sendTelegramToProfile } from "@/lib/healthy-life/push";

export type ZonedNow = {
  dateKey: string; // YYYY-MM-DD
  timeKey: string; // HH:mm
};

/** Local calendar date + wall-clock time in the given IANA timezone. */
export function getZonedNow(timeZone: string, date = new Date()): ZonedNow {
  const safeTz = timeZone && timeZone.trim() ? timeZone.trim() : "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";

    const year = get("year");
    const month = get("month");
    const day = get("day");
    let hour = get("hour");
    const minute = get("minute");
    if (hour === "24") hour = "00";

    return {
      dateKey: `${year}-${month}-${day}`,
      timeKey: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
    };
  } catch {
    const iso = date.toISOString();
    return {
      dateKey: iso.slice(0, 10),
      timeKey: iso.slice(11, 16),
    };
  }
}

function parseMealReminderTimes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed
          .map((t) => normalizeTime(String(t)))
          .filter(Boolean),
      ),
    ].sort();
  } catch {
    return [];
  }
}

function pushCopy(locale: string) {
  const ru = locale === "ru" || locale === "kk" || locale === "ky" || locale === "uz";
  if (ru) {
    return {
      medTitle: "Лекарство",
      medBody: (name: string, dosage: string, time: string) =>
        `${name}${dosage} — ${time}`,
      weightTitle: "Вес",
      weightBody: "Пора записать сегодняшний вес",
      mealTitle: "Еда",
      mealBody: (name: string, time: string) => `${name} — ${time}`,
      mealBodyEmpty: "Не забудьте записать приёмы пищи сегодня",
      mealBodyNext: "Пора записать следующий приём пищи",
      adviceTitle: "Совет",
    };
  }
  return {
    medTitle: "Medication",
    medBody: (name: string, dosage: string, time: string) =>
      `${name}${dosage} — ${time}`,
    weightTitle: "Weight",
    weightBody: "Time to log today's weight",
    mealTitle: "Food",
    mealBody: (name: string, time: string) => `${name} — ${time}`,
    mealBodyEmpty: "Don't forget to log your meals today",
    mealBodyNext: "Time for your next meal log",
    adviceTitle: "Advice",
  };
}

export type ReminderRunResult = {
  profilesChecked: number;
  medication: number;
  weight: number;
  meal: number;
  advice: number;
  errors: number;
};

/**
 * Cron tick: find due medication / weight / meal reminders in each profile's local timezone
 * and send Web Push notifications.
 */
export async function runHealthyLifeReminders(now = new Date()): Promise<ReminderRunResult> {
  const result: ReminderRunResult = {
    profilesChecked: 0,
    medication: 0,
    weight: 0,
    meal: 0,
    advice: 0,
    errors: 0,
  };

  const profiles = await prisma.profile.findMany({
    where: {
      pushEnabled: true,
      OR: [
        { pushSubscriptions: { some: {} } },
        { telegramChatId: { not: null } },
      ],
    },
    include: {
      medicationPlans: { where: { active: true } },
      mealPlans: { where: { active: true } },
      pushSubscriptions: { select: { id: true } },
    },
  });

  for (const profile of profiles) {
    result.profilesChecked += 1;
    const zoned = getZonedNow(profile.timezone || "UTC", now);
    const copy = pushCopy(profile.preferredLocale || "en");

    try {
      for (const plan of profile.medicationPlans) {
        if (!isPlanScheduledOnDate(plan, zoned.dateKey)) continue;
        const times = parsePlanTimes(plan.timesJson);
        if (!times.includes(zoned.timeKey)) continue;

        const alreadyTaken = await prisma.medicationIntake.findFirst({
          where: {
            profileId: profile.id,
            planId: plan.id,
            date: zoned.dateKey,
            scheduledTime: zoned.timeKey,
          },
          select: { id: true },
        });
        if (alreadyTaken) continue;

        const dedupeKey = `${plan.id}|${zoned.dateKey}|${zoned.timeKey}`;
        const claimed = await claimReminderSlot({
          profileId: profile.id,
          kind: "medication",
          dedupeKey,
        });
        if (!claimed) continue;

        const dosage = plan.dosage ? ` (${plan.dosage})` : "";
        const medPayload = {
          title: copy.medTitle,
          body: copy.medBody(plan.name, dosage, zoned.timeKey),
          url: "/",
          tag: `med-${plan.id}-${zoned.timeKey}`,
          kind: "medication" as const,
        };
        await Promise.all([
          sendPushToProfile(profile.id, medPayload),
          sendTelegramToProfile(profile.id, medPayload),
        ]);
        result.medication += 1;
      }

      for (const plan of profile.mealPlans) {
        if (!isPlanScheduledOnDate(plan, zoned.dateKey)) continue;
        const times = parsePlanTimes(plan.timesJson);
        if (!times.includes(zoned.timeKey)) continue;

        // Skip if this meal type was already logged today.
        const alreadyLogged = await prisma.meal.findFirst({
          where: {
            profileId: profile.id,
            date: zoned.dateKey,
            mealType: plan.mealType,
          },
          select: { id: true },
        });
        if (alreadyLogged) continue;

        const dedupeKey = `mealplan|${plan.id}|${zoned.dateKey}|${zoned.timeKey}`;
        const claimed = await claimReminderSlot({
          profileId: profile.id,
          kind: "meal",
          dedupeKey,
        });
        if (!claimed) continue;

        const mealPlanPayload = {
          title: copy.mealTitle,
          body: copy.mealBody(plan.name, zoned.timeKey),
          url: "/",
          tag: `mealplan-${plan.id}-${zoned.timeKey}`,
          kind: "meal" as const,
        };
        await Promise.all([
          sendPushToProfile(profile.id, mealPlanPayload),
          sendTelegramToProfile(profile.id, mealPlanPayload),
        ]);
        result.meal += 1;
      }

      const weightTime = profile.weightReminderTime
        ? normalizeTime(profile.weightReminderTime)
        : "";
      if (weightTime && weightTime === zoned.timeKey) {
        const hasWeight = await prisma.weightEntry.findUnique({
          where: {
            profileId_date: { profileId: profile.id, date: zoned.dateKey },
          },
          select: { id: true },
        });
        if (!hasWeight) {
          const dedupeKey = `weight|${zoned.dateKey}|${weightTime}`;
          const claimed = await claimReminderSlot({
            profileId: profile.id,
            kind: "weight",
            dedupeKey,
          });
          if (claimed) {
            const weightPayload = {
              title: copy.weightTitle,
              body: copy.weightBody,
              url: "/weight",
              tag: `weight-${zoned.dateKey}`,
              kind: "weight" as const,
            };
            await Promise.all([
              sendPushToProfile(profile.id, weightPayload),
              sendTelegramToProfile(profile.id, weightPayload),
            ]);
            result.weight += 1;
          }
        }
      }

      // Legacy free-form meal times on profile (kept for older prefs).
      const mealTimes = parseMealReminderTimes(profile.mealReminderTimesJson);
      if (mealTimes.includes(zoned.timeKey)) {
        const mealCount = await prisma.meal.count({
          where: { profileId: profile.id, date: zoned.dateKey },
        });
        const dedupeKey = `meal|${zoned.dateKey}|${zoned.timeKey}`;
        const claimed = await claimReminderSlot({
          profileId: profile.id,
          kind: "meal",
          dedupeKey,
        });
        if (claimed) {
          const legacyMealPayload = {
            title: copy.mealTitle,
            body: mealCount === 0 ? copy.mealBodyEmpty : copy.mealBodyNext,
            url: "/",
            tag: `meal-${zoned.dateKey}-${zoned.timeKey}`,
            kind: "meal" as const,
          };
          await Promise.all([
            sendPushToProfile(profile.id, legacyMealPayload),
            sendTelegramToProfile(profile.id, legacyMealPayload),
          ]);
          result.meal += 1;
        }
      }
      // ── Auto-advice at midnight (00:00) ─────────────────────────────────
      if (zoned.timeKey === "00:00") {
        const locale = isHlLocale(profile.preferredLocale) ? profile.preferredLocale : "en";
        const aiLanguage = HL_LOCALE_META[locale].aiLanguage;
        const periods: Array<"day" | "week" | "month"> = ["day"];
        // Week: Monday 00:00 means the previous week just ended
        const dow = new Date(now).getDay(); // 0=Sun
        const isoWeekday = dow === 0 ? 7 : dow;
        if (isoWeekday === 1) periods.push("week");
        // Month: 1st of month 00:00 means previous month ended
        const dayOfMonth = parseInt(zoned.dateKey.slice(8, 10), 10);
        if (dayOfMonth === 1) periods.push("month");

        for (const period of periods) {
          const dedupeKey = `advice|${period}|${zoned.dateKey}`;
          const claimed = await claimReminderSlot({
            profileId: profile.id,
            kind: "advice",
            dedupeKey,
          });
          if (!claimed) continue;

          try {
            const completed = completedPeriodRange(period, now);
            const { start, end, periodKeyBase, label: periodLabel } = completed;
            const periodKey = `${periodKeyBase}__${locale}`;

            const meals = await prisma.meal.findMany({
              where: { profileId: profile.id, date: { gte: start, lte: end } },
              orderBy: { date: "asc" },
            });
            const weights = await prisma.weightEntry.findMany({
              where: { profileId: profile.id, date: { gte: start, lte: end } },
              orderBy: { date: "asc" },
            });
            const workouts = await prisma.workout.findMany({
              where: { profileId: profile.id, date: { gte: start, lte: end } },
              orderBy: { date: "asc" },
            });

            const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
            const dayCount = Math.max(new Set(meals.map((m) => m.date)).size, 1);
            const hasData = totalCalories > 0 || workouts.length > 0 || weights.length > 0;
            if (!hasData) continue;

            const workoutByType = new Map<string, { count: number; quantity: number }>();
            for (const w of workouts) {
              const cur = workoutByType.get(w.type) || { count: 0, quantity: 0 };
              cur.count += 1;
              cur.quantity += w.quantity;
              workoutByType.set(w.type, cur);
            }
            const workoutSummary = workouts.length === 0
              ? "no workouts"
              : [...workoutByType.entries()].map(([t, s]) => `${t}: ${s.count}x, vol ${s.quantity}`).join("; ");

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
            } catch (aiErr) {
              usedFallback = true;
              fallbackReason = describeAiFailure(aiErr);
              advicePayload = {
                title: period === "day" ? "Yesterday" : period === "week" ? "Last week" : "Last month",
                summary: `AI unavailable: ${fallbackReason}`,
                content: `${Math.round(totalCalories)} kcal, ${meals.length} meals, ${workouts.length} workouts. Avg ${Math.round(totalCalories / dayCount)} kcal/day vs goal ${profile.dailyCalorieGoal}.`,
              };
            }

            const aiRecord = await saveAiRecord({
              profileId: profile.id,
              kind: "advice",
              locale,
              inputSummary: JSON.stringify({ period, periodKeyBase }),
              output: advicePayload,
              usedFallback,
              fallbackReason,
            });

            const advice = await prisma.advice.upsert({
              where: { profileId_period_periodKey: { profileId: profile.id, period, periodKey } },
              create: {
                profileId: profile.id, period, periodKey,
                title: advicePayload.title, content: advicePayload.content,
                summary: advicePayload.summary, locale, usedFallback, aiRecordId: aiRecord.id,
              },
              update: {
                title: advicePayload.title, content: advicePayload.content,
                summary: advicePayload.summary, locale, usedFallback, aiRecordId: aiRecord.id,
              },
            });
            await linkAiRecordToAdvice(aiRecord.id, advice.id);

            const advPayload = {
              title: copy.adviceTitle ?? advicePayload.title,
              body: advicePayload.summary || advicePayload.content.slice(0, 200),
              url: "/advice",
              tag: `advice-${period}-${zoned.dateKey}`,
              kind: "meal" as const,
            };
            await Promise.all([
              sendPushToProfile(profile.id, advPayload),
              sendTelegramToProfile(profile.id, advPayload),
            ]);
            result.advice += 1;
          } catch {
            result.errors += 1;
          }
        }
      }
    } catch {
      result.errors += 1;
    }
  }

  return result;
}
