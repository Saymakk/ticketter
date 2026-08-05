"use client";

import { formatKcal, progressPercent } from "@/lib/healthy-life/format";
import { formatWorkoutQuantity, workoutTypeLabel } from "@/lib/healthy-life/workouts";
import { isWithinEditWindow } from "@/lib/healthy-life/edit-window";
import type { ScheduleCompliance } from "@/lib/healthy-life/medications";
import { useT } from "@/lib/healthy-life/i18n";
import type { HlMessageKey } from "@/lib/healthy-life/i18n";
import { Card } from "@/components/healthy-life/ui";
import type { MealDetail } from "@/components/healthy-life/MealDetailModal";
import {
  ComplianceList,
  type MedicationIntake,
} from "@/components/healthy-life/MedicationModals";

export type DayWorkout = {
  id: string;
  type: string;
  quantity: number;
  unit: string;
  name: string | null;
};

export type DayPanelData = {
  date: string;
  totalCalories: number;
  remainingCalories: number;
  meals: MealDetail[];
  workouts: DayWorkout[];
  intakes: MedicationIntake[];
  compliance: ScheduleCompliance[];
  weight: { weightKg: number } | null;
  profile: { dailyCalorieGoal: number; name: string };
};

function mealTypeKey(id: string): HlMessageKey {
  if (id === "snack") return "mealTypes.snackLabel";
  if (id === "breakfast" || id === "lunch" || id === "dinner") return `mealTypes.${id}`;
  return "meal.title";
}

export function DayPanel({
  data,
  readOnly,
  onMealClick,
  onIntakeClick,
  onTakeScheduled,
}: {
  data: DayPanelData;
  readOnly?: boolean;
  onMealClick: (meal: MealDetail) => void;
  onIntakeClick: (intake: MedicationIntake) => void;
  onTakeScheduled?: (row: ScheduleCompliance) => void;
}) {
  const t = useT();
  const pct = progressPercent(data.totalCalories, data.profile.dailyCalorieGoal);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden bg-gradient-to-br from-[#e7f3ea] via-[var(--surface)] to-[#f3efe4]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">{t("day.eaten")}</p>
            <p className="font-display text-4xl text-[var(--ink)]">
              {Math.round(data.totalCalories)}
              <span className="ml-1 text-lg text-[var(--muted)]">{t("day.kcal")}</span>
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t("day.goal")} {data.profile.dailyCalorieGoal} · {t("day.remaining")}{" "}
              {Math.round(Math.max(0, data.remainingCalories))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--muted)]">{t("day.weight")}</p>
            <p className="font-display text-2xl">
              {data.weight ? `${data.weight.weightKg.toFixed(1)} ${t("day.kg")}` : "—"}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--accent-soft)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </Card>

      {data.workouts.length > 0 ? (
        <div className="space-y-2">
          <h2 className="font-display text-xl">{t("day.workoutsTitle")}</h2>
          {data.workouts.map((w) => (
            <Card key={w.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {workoutTypeLabel(w.type)}
                  {w.name ? ` · ${w.name}` : ""}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {formatWorkoutQuantity(w.quantity, w.unit)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="font-display text-xl">{t("day.mealsTitle")}</h2>
        {data.meals.length === 0 ? (
          <Card>
            <p className="text-[var(--muted)]">
              {readOnly ? t("day.mealsEmptyReadonly") : t("day.mealsEmpty")}
            </p>
          </Card>
        ) : (
          data.meals.map((meal) => {
            const canEdit = !readOnly && isWithinEditWindow(meal.createdAt);
            return (
              <button
                key={meal.id}
                type="button"
                onClick={() => onMealClick(meal)}
                className="w-full text-left"
              >
                <Card className="flex gap-3 transition hover:border-[var(--accent)]/40">
                  {meal.photoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={meal.photoPath}
                      alt={meal.name}
                      className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      {t("common.food")}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-[var(--muted)]">{t(mealTypeKey(meal.mealType))}</p>
                        <h3 className="truncate font-semibold">{meal.name}</h3>
                      </div>
                      <p className="shrink-0 font-semibold">{formatKcal(meal.calories)}</p>
                    </div>
                    {meal.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{meal.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                      {meal.userCorrected ? (
                        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5">{t("day.corrected")}</span>
                      ) : null}
                      {canEdit ? (
                        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent-ink)]">
                          {t("day.canEdit")}
                        </span>
                      ) : null}
                      {meal.protein != null ? <span>{t("day.protein")} {Math.round(meal.protein)}g</span> : null}
                      {meal.carbs != null ? <span>{t("day.carbs")} {Math.round(meal.carbs)}g</span> : null}
                      {meal.fat != null ? <span>{t("day.fat")} {Math.round(meal.fat)}g</span> : null}
                    </div>
                  </div>
                </Card>
              </button>
            );
          })
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl text-[var(--med-accent-ink)]">{t("day.medsTitle")}</h2>
        <Card className="space-y-3 border-[var(--med-line)] bg-gradient-to-br from-[#e8f1f9] via-[var(--med-surface)] to-[#eef3f8]">
          <ComplianceList
            compliance={data.compliance}
            readOnly={readOnly}
            onTake={onTakeScheduled}
          />

          {data.intakes.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {readOnly ? t("day.medsEmptyReadonly") : t("day.medsEmpty")}
            </p>
          ) : (
            <div className="space-y-2">
              {data.intakes.map((intake) => (
                <button
                  key={intake.id}
                  type="button"
                  onClick={() => onIntakeClick(intake)}
                  className="flex w-full gap-3 rounded-2xl border border-[var(--med-line)] bg-white/80 p-3 text-left transition hover:border-[var(--med-accent)]/50"
                >
                  {intake.photoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={intake.photoPath}
                      alt={intake.name}
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--med-soft)] text-xs text-[var(--med-accent)]">
                      Rx
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-[var(--med-accent-ink)]">{intake.name}</p>
                      <span className="shrink-0 text-xs text-[var(--med-accent)]">{intake.takenTime}</span>
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      {[intake.dosage, intake.reason].filter(Boolean).join(" · ") || t("med.noDetails")}
                    </p>
                    {intake.scheduledTime ? (
                      <p className="mt-1 text-xs text-[var(--med-accent)]">
                        {t("med.scheduled")} {intake.scheduledTime}
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
