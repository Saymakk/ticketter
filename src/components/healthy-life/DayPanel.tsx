"use client";

import { useEffect, useMemo, useState } from "react";
import { formatKcal, progressPercent } from "@/lib/healthy-life/format";
import { formatNumberValue } from "@/lib/healthy-life/number-input";
import { formatWorkoutQuantity, workoutTypeLabel } from "@/lib/healthy-life/workouts";
import { isWithinEditWindow } from "@/lib/healthy-life/edit-window";
import type { ScheduleCompliance } from "@/lib/healthy-life/medications";
import {
  intakeBalance,
  readMealSortMode,
  sortMeals,
  writeMealSortMode,
  type MealSortMode,
} from "@/lib/healthy-life/meal-sort";
import { useT } from "@/lib/healthy-life/i18n";
import type { HlMessageKey } from "@/lib/healthy-life/i18n";
import { Card, Modal } from "@/components/healthy-life/ui";
import type { MealDetail } from "@/components/healthy-life/MealDetailModal";
import {
  ComplianceList,
  type MedicationIntake,
} from "@/components/healthy-life/MedicationModals";
import { SortActionIcon } from "@/components/healthy-life/DayActionIcons";

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

type DayTab = "meals" | "meds";

const SORT_OPTIONS: Array<{ id: MealSortMode; label: HlMessageKey }> = [
  { id: "time_asc", label: "day.sortTimeAsc" },
  { id: "time_desc", label: "day.sortTimeDesc" },
  { id: "kcal_desc", label: "day.sortKcalDesc" },
  { id: "kcal_asc", label: "day.sortKcalAsc" },
];

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
  const [tab, setTab] = useState<DayTab>("meals");
  const [sortMode, setSortMode] = useState<MealSortMode>("time_asc");
  const [sortReady, setSortReady] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    setSortMode(readMealSortMode());
    setSortReady(true);
  }, []);

  function changeSort(mode: MealSortMode) {
    setSortMode(mode);
    writeMealSortMode(mode);
    setSortOpen(false);
  }

  const sortedMeals = useMemo(
    () => sortMeals(data.meals, sortMode),
    [data.meals, sortMode],
  );

  const goal = data.profile.dailyCalorieGoal;
  const pct = progressPercent(data.totalCalories, goal);
  const balance = intakeBalance(data.totalCalories, goal);
  const remaining = Math.round(goal - data.totalCalories);

  const balanceLabel =
    balance.status === "over"
      ? t("day.overBy", { n: balance.delta })
      : balance.status === "under"
        ? t("day.underBy", { n: balance.delta })
        : t("day.onTrack");

  const balanceClass =
    balance.status === "over"
      ? "text-[#8a3b2f]"
      : balance.status === "under"
        ? "text-[#6b5a2e]"
        : "text-[var(--accent-ink)]";

  const barClass =
    balance.status === "over"
      ? "bg-[#c45c4a]"
      : balance.status === "under"
        ? "bg-[#c4a35a]"
        : "bg-[var(--accent)]";

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden bg-gradient-to-br from-[#e7f3ea] via-[var(--surface)] to-[#f3efe4]">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-[var(--muted)]">{t("day.eaten")}</p>
            <p className="font-display text-4xl text-[var(--ink)]">
              {Math.round(data.totalCalories)}
              <span className="ml-1 text-lg text-[var(--muted)]">{t("day.kcal")}</span>
            </p>
            <p className={`mt-1 text-sm font-semibold ${balanceClass}`}>{balanceLabel}</p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {t("day.goal")} {goal}
              {remaining >= 0
                ? ` · ${t("day.remaining")} ${remaining}`
                : ` · +${Math.abs(remaining)}`}
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
            className={`h-full rounded-full transition-all duration-700 ${barClass}`}
            style={{ width: `${Math.min(100, pct)}%` }}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("day.sortBy")}
            title={t("day.sortBy")}
            onClick={() => setSortOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] transition active:scale-95"
          >
            <SortActionIcon />
          </button>
          <div
            className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1"
            role="tablist"
            aria-label={`${t("day.mealsTitle")} / ${t("day.medsTitle")}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "meals"}
              onClick={() => setTab("meals")}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                tab === "meals"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {t("day.mealsTitle")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "meds"}
              onClick={() => setTab("meds")}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                tab === "meds"
                  ? "bg-[var(--med-accent)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--med-accent-ink)]"
              }`}
            >
              {t("day.medsTitle")}
            </button>
          </div>
        </div>

        <Modal open={sortOpen} onClose={() => setSortOpen(false)} title={t("day.sortBy")}>
          <div className="space-y-2">
            {SORT_OPTIONS.map((opt) => {
              const active = sortReady && sortMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => changeSort(opt.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
                  }`}
                >
                  <span>{t(opt.label)}</span>
                  {active ? <span aria-hidden>✓</span> : null}
                </button>
              );
            })}
          </div>
        </Modal>

        {tab === "meals" ? (
          <div className="space-y-3" role="tabpanel">
            {data.meals.length === 0 ? (
              <Card>
                <p className="text-[var(--muted)]">
                  {readOnly ? t("day.mealsEmptyReadonly") : t("day.mealsEmpty")}
                </p>
              </Card>
            ) : (
              sortedMeals.map((meal) => {
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
                          <div className="min-w-0">
                            <p className="text-xs text-[var(--muted)]">{t(mealTypeKey(meal.mealType))}</p>
                            <h3 className="break-words font-semibold">{meal.name}</h3>
                          </div>
                          <p className="shrink-0 font-semibold">{formatKcal(meal.calories)}</p>
                        </div>
                        {meal.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{meal.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                          {meal.userCorrected ? (
                            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5">
                              {t("day.corrected")}
                            </span>
                          ) : null}
                          {canEdit ? (
                            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent-ink)]">
                              {t("day.canEdit")}
                            </span>
                          ) : null}
                          {meal.protein != null ? (
                            <span>
                              {t("day.protein")} {formatNumberValue(meal.protein)}g
                            </span>
                          ) : null}
                          {meal.carbs != null ? (
                            <span>
                              {t("day.carbs")} {formatNumberValue(meal.carbs)}g
                            </span>
                          ) : null}
                          {meal.fat != null ? (
                            <span>
                              {t("day.fat")} {formatNumberValue(meal.fat)}g
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <Card
            className="space-y-3 border-[var(--med-line)] bg-gradient-to-br from-[#e8f1f9] via-[var(--med-surface)] to-[#eef3f8]"
            role="tabpanel"
          >
            <ComplianceList
              compliance={data.compliance}
              readOnly={readOnly}
              onTake={onTakeScheduled}
            />

            {data.intakes.length === 0 && data.compliance.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                {readOnly ? t("day.medsEmptyReadonly") : t("day.medsEmpty")}
              </p>
            ) : data.intakes.length === 0 ? null : (
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
                        <p className="min-w-0 break-words font-semibold text-[var(--med-accent-ink)]">
                          {intake.name}
                        </p>
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
        )}
      </div>
    </div>
  );
}
