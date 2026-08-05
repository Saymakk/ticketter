import { differenceInCalendarDays, getISODay, parseISO } from "date-fns";

/** Medication helpers — tracking only, never for AI advice. */

export type MedicationPlanTimes = string[]; // "HH:mm"

/** daily = every day; weekly = selected weekdays; interval = every N days from anchor */
export type MedicationRecurrence = "daily" | "weekly" | "interval";

/** ISO weekday: 1=Monday … 7=Sunday */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ISO_WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export function parsePlanTimes(timesJson: string | null | undefined): MedicationPlanTimes {
  if (!timesJson) return [];
  try {
    const parsed = JSON.parse(timesJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => String(t).trim())
      .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
      .map(normalizeTime);
  } catch {
    return [];
  }
}

export function serializePlanTimes(times: string[]): string {
  const cleaned = [...new Set(times.map(normalizeTime).filter(Boolean))].sort();
  return JSON.stringify(cleaned);
}

export function normalizeTime(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function parseWeekdays(weekdaysJson: string | null | undefined): IsoWeekday[] {
  if (!weekdaysJson) return [];
  try {
    const parsed = JSON.parse(weekdaysJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed
          .map((n) => Number(n))
          .filter((n): n is IsoWeekday => Number.isInteger(n) && n >= 1 && n <= 7),
      ),
    ].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function serializeWeekdays(days: Array<number | string>): string {
  const cleaned = [
    ...new Set(
      days
        .map((n) => Number(n))
        .filter((n): n is IsoWeekday => Number.isInteger(n) && n >= 1 && n <= 7),
    ),
  ].sort((a, b) => a - b);
  return JSON.stringify(cleaned);
}

export function normalizeRecurrence(raw: unknown): MedicationRecurrence {
  const v = String(raw || "daily");
  if (v === "weekly" || v === "interval") return v;
  return "daily";
}

export type PlanScheduleFields = {
  recurrence?: string | null;
  weekdaysJson?: string | null;
  intervalDays?: number | null;
  anchorDate?: string | null;
  timesJson: string;
  active: boolean;
};

/**
 * Whether a plan has dose slots on the given calendar day (YYYY-MM-DD).
 * Existing plans without recurrence fields behave as daily.
 */
export function isPlanScheduledOnDate(plan: PlanScheduleFields, dateKey: string): boolean {
  if (!plan.active) return false;

  const recurrence = normalizeRecurrence(plan.recurrence);
  const day = parseISO(dateKey);
  if (Number.isNaN(day.getTime())) return false;

  if (plan.anchorDate) {
    const anchor = parseISO(plan.anchorDate);
    if (!Number.isNaN(anchor.getTime()) && dateKey < plan.anchorDate) {
      return false;
    }
  }

  if (recurrence === "daily") return true;

  if (recurrence === "weekly") {
    const days = parseWeekdays(plan.weekdaysJson);
    if (days.length === 0) return false;
    return days.includes(getISODay(day) as IsoWeekday);
  }

  // interval
  const n = Math.max(1, Math.floor(Number(plan.intervalDays) || 1));
  const anchorKey = plan.anchorDate || dateKey;
  const anchor = parseISO(anchorKey);
  if (Number.isNaN(anchor.getTime())) return false;
  const diff = differenceInCalendarDays(day, anchor);
  if (diff < 0) return false;
  return diff % n === 0;
}

export function nowTimeKey(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Minutes between two HH:mm values (same day). */
export function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

/** A scheduled dose is "on time" if taken within ±tolerance minutes of the slot. */
export const ON_TIME_TOLERANCE_MIN = 60;

export function isOnTime(scheduledTime: string | null | undefined, takenTime: string): boolean | null {
  if (!scheduledTime) return null;
  const delta = Math.abs(minutesBetween(scheduledTime, takenTime));
  return delta <= ON_TIME_TOLERANCE_MIN;
}

export type ScheduleCompliance = {
  planId: string;
  name: string;
  dosage: string | null;
  scheduledTime: string;
  status: "taken_on_time" | "taken_late" | "missed" | "pending";
  intakeId: string | null;
  takenTime: string | null;
};

/**
 * For one day: each plan slot → taken on time / late / missed / still pending (today future).
 * Plans that are not scheduled on this date are skipped.
 */
export function buildDayCompliance(params: {
  plans: Array<
    {
      id: string;
      name: string;
      dosage: string | null;
      timesJson: string;
      active: boolean;
    } & PlanScheduleFields
  >;
  intakes: Array<{
    id: string;
    planId: string | null;
    scheduledTime: string | null;
    takenTime: string;
  }>;
  date: string;
  today: string;
  nowTime: string;
}): ScheduleCompliance[] {
  const activePlans = params.plans.filter((p) => isPlanScheduledOnDate(p, params.date));
  const usedIntakeIds = new Set<string>();
  const rows: ScheduleCompliance[] = [];

  for (const plan of activePlans) {
    for (const slot of parsePlanTimes(plan.timesJson)) {
      const match = params.intakes.find(
        (i) =>
          i.planId === plan.id &&
          i.scheduledTime === slot &&
          !usedIntakeIds.has(i.id),
      );
      if (match) {
        usedIntakeIds.add(match.id);
        const onTime = isOnTime(slot, match.takenTime);
        rows.push({
          planId: plan.id,
          name: plan.name,
          dosage: plan.dosage,
          scheduledTime: slot,
          status: onTime === false ? "taken_late" : "taken_on_time",
          intakeId: match.id,
          takenTime: match.takenTime,
        });
        continue;
      }

      const isToday = params.date === params.today;
      const stillAhead = isToday && minutesBetween(params.nowTime, slot) > 0;
      rows.push({
        planId: plan.id,
        name: plan.name,
        dosage: plan.dosage,
        scheduledTime: slot,
        status: stillAhead ? "pending" : "missed",
        intakeId: null,
        takenTime: null,
      });
    }
  }

  return rows.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}

export function complianceLabel(status: ScheduleCompliance["status"]): string {
  switch (status) {
    case "taken_on_time":
      return "on time";
    case "taken_late":
      return "late";
    case "missed":
      return "missed";
    case "pending":
      return "upcoming";
  }
}

/** Short human summary of recurrence (English keys resolved by UI via i18n when needed). */
export function describeRecurrence(plan: PlanScheduleFields): {
  type: MedicationRecurrence;
  weekdays: IsoWeekday[];
  intervalDays: number;
  anchorDate: string | null;
} {
  return {
    type: normalizeRecurrence(plan.recurrence),
    weekdays: parseWeekdays(plan.weekdaysJson),
    intervalDays: Math.max(1, Math.floor(Number(plan.intervalDays) || 1)),
    anchorDate: plan.anchorDate || null,
  };
}
