import { parsePlanTimes, isPlanScheduledOnDate, normalizeTime } from "@/lib/healthy-life/medications";
import { prisma } from "@/lib/healthy-life/prisma";
import { claimReminderSlot, sendPushToProfile } from "@/lib/healthy-life/push";

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
  };
}

export type ReminderRunResult = {
  profilesChecked: number;
  medication: number;
  weight: number;
  meal: number;
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
    errors: 0,
  };

  const profiles = await prisma.profile.findMany({
    where: {
      pushEnabled: true,
      pushSubscriptions: { some: {} },
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
        await sendPushToProfile(profile.id, {
          title: copy.medTitle,
          body: copy.medBody(plan.name, dosage, zoned.timeKey),
          url: "/",
          tag: `med-${plan.id}-${zoned.timeKey}`,
          kind: "medication",
        });
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

        await sendPushToProfile(profile.id, {
          title: copy.mealTitle,
          body: copy.mealBody(plan.name, zoned.timeKey),
          url: "/",
          tag: `mealplan-${plan.id}-${zoned.timeKey}`,
          kind: "meal",
        });
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
            await sendPushToProfile(profile.id, {
              title: copy.weightTitle,
              body: copy.weightBody,
              url: "/weight",
              tag: `weight-${zoned.dateKey}`,
              kind: "weight",
            });
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
          await sendPushToProfile(profile.id, {
            title: copy.mealTitle,
            body: mealCount === 0 ? copy.mealBodyEmpty : copy.mealBodyNext,
            url: "/",
            tag: `meal-${zoned.dateKey}-${zoned.timeKey}`,
            kind: "meal",
          });
          result.meal += 1;
        }
      }
    } catch {
      result.errors += 1;
    }
  }

  return result;
}
