"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDayLabel, todayKey } from "@/lib/healthy-life/dates";
import { invalidateRelatedCaches } from "@/lib/healthy-life/app-cache";
import {
  isDayCacheStale,
  readDayCache,
  writeDayCache,
} from "@/lib/healthy-life/day-cache";
import type { ScheduleCompliance } from "@/lib/healthy-life/medications";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useT } from "@/lib/healthy-life/i18n";
import { PageHeader, Shell, LoadingText } from "@/components/healthy-life/ui";
import { DayPanel, type DayPanelData } from "@/components/healthy-life/DayPanel";
import { DayHistory } from "@/components/healthy-life/DayHistory";
import { MealDetailModal, type MealDetail } from "@/components/healthy-life/MealDetailModal";
import { AddMealModal } from "@/components/healthy-life/AddMealModal";
import {
  AddMedicationModal,
  MedicationDetailModal,
  MedicationPlansModal,
  type MedicationIntake,
  type MedicationPlan,
} from "@/components/healthy-life/MedicationModals";
import {
  FoodActionIcon,
  IconActionButton,
  IconActionLink,
  MedActionIcon,
  ScheduleActionIcon,
  WorkoutActionIcon,
} from "@/components/healthy-life/DayActionIcons";

export function DayView() {
  const { path, fetch: hlFetch } = useHlRouting();
  const t = useT();
  const [date, setDate] = useState(todayKey());
  const [data, setData] = useState<DayPanelData | null>(null);
  const [plans, setPlans] = useState<MedicationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const fetchGen = useRef(0);

  const [selectedMeal, setSelectedMeal] = useState<MealDetail | null>(null);
  const [selectedIntake, setSelectedIntake] = useState<MedicationIntake | null>(null);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [addMedOpen, setAddMedOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [medPrefill, setMedPrefill] = useState<{
    planId?: string;
    scheduledTime?: string;
    name?: string;
    dosage?: string | null;
    photoPath?: string | null;
  } | null>(null);

  const applyPayload = useCallback(
    (d: string, mealJson: Record<string, unknown>, workouts: DayPanelData["workouts"], medJson: Record<string, unknown>) => {
      const nextPlans = (medJson.plans as MedicationPlan[]) || [];
      const nextData: DayPanelData = {
        date: (mealJson.date as string) || d,
        totalCalories: Number(mealJson.totalCalories) || 0,
        remainingCalories: Number(mealJson.remainingCalories) || 0,
        meals: (mealJson.meals as MealDetail[]) || [],
        workouts,
        intakes: (medJson.intakes as MedicationIntake[]) || [],
        compliance: (medJson.compliance as ScheduleCompliance[]) || [],
        weight: (mealJson.weight as DayPanelData["weight"]) ?? null,
        profile: (mealJson.profile as DayPanelData["profile"]) || {
          dailyCalorieGoal: 2000,
          name: "",
        },
      };
      setPlans(nextPlans);
      setData(nextData);
      writeDayCache(d, nextData, nextPlans);
    },
    [],
  );

  const load = useCallback(
    async (d: string, opts?: { force?: boolean; silent?: boolean }) => {
      const cached = readDayCache(d);
      if (cached) {
        setData(cached.data);
        setPlans(cached.plans);
        setLoading(false);
        setError(null);
        if (!opts?.force && !isDayCacheStale(cached)) {
          return;
        }
      }

      if (!cached) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const gen = ++fetchGen.current;
      try {
        const [mealRes, workoutRes, medRes] = await Promise.all([
          hlFetch(`/api/meals?date=${d}`),
          hlFetch(`/api/workouts?date=${d}`),
          hlFetch(`/api/medications?date=${d}`),
        ]);
        if (gen !== fetchGen.current) return;

        const mealJson = await mealRes.json().catch(() => ({}));
        if (!mealRes.ok) throw new Error(mealJson.error || t("error"));

        const workouts = workoutRes.ok ? ((await workoutRes.json()).workouts || []) : [];
        if (medRes.ok) {
          const medJson = await medRes.json();
          applyPayload(d, mealJson, workouts, medJson);
        } else if (!cached) {
          applyPayload(d, mealJson, workouts, { intakes: [], plans: [], compliance: [] });
        } else {
          // Keep cached meds if medications API failed — avoid empty flicker.
          setData({
            ...cached.data,
            date: (mealJson.date as string) || d,
            totalCalories: Number(mealJson.totalCalories) || 0,
            remainingCalories: Number(mealJson.remainingCalories) || 0,
            meals: (mealJson.meals as MealDetail[]) || [],
            workouts,
            weight: (mealJson.weight as DayPanelData["weight"]) ?? null,
            profile: (mealJson.profile as DayPanelData["profile"]) || cached.data.profile,
          });
          setPlans(cached.plans);
        }
      } catch (e) {
        if (gen !== fetchGen.current) return;
        if (!cached) {
          setError(e instanceof Error ? e.message : t("error"));
        }
      } finally {
        if (gen === fetchGen.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [applyPayload, hlFetch, t],
  );

  useEffect(() => {
    if (!showHistory) load(date);
  }, [date, load, showHistory]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible" || showHistory) return;
      const cached = readDayCache(date);
      if (!cached || isDayCacheStale(cached)) {
        load(date, { silent: true });
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [date, load, showHistory]);

  function openTake(row: ScheduleCompliance) {
    setMedPrefill({
      planId: row.planId,
      scheduledTime: row.scheduledTime,
      name: row.name,
      dosage: row.dosage,
      photoPath: row.photoPath,
    });
    setAddMedOpen(true);
  }

  function refreshAfterMutation() {
    invalidateRelatedCaches({ day: date });
    load(date, { force: true });
  }

  if (showHistory) {
    return (
      <Shell>
        <DayHistory
          onClose={() => {
            setShowHistory(false);
            load(date, { silent: true });
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        title={t("day.title")}
        subtitle={formatDayLabel(date)}
        action={
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm"
          />
        }
      />

      <div className="-mt-3 mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="text-sm font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
        >
          {t("day.historyLink")}
        </button>
        {refreshing ? (
          <span className="text-[11px] font-medium text-[var(--muted)]">{t("day.updating")}</span>
        ) : null}
      </div>

      {loading && !data && <LoadingText label={t("loading")} />}
      {error && <p className="text-[#8a3b2f]">{error}</p>}

      {data && (
        <div className="space-y-4 animate-rise">
          <div className="flex items-center justify-between gap-2 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] px-2 py-2">
            <IconActionButton
              label={t("day.addFood")}
              tone="primary"
              icon={<FoodActionIcon />}
              onClick={() => setAddMealOpen(true)}
            />
            <IconActionLink
              label={t("day.workout")}
              tone="secondary"
              href={path("/progress")}
              icon={<WorkoutActionIcon />}
            />
            <IconActionButton
              label={t("day.medication")}
              tone="med"
              icon={<MedActionIcon />}
              onClick={() => {
                setMedPrefill(null);
                setAddMedOpen(true);
              }}
            />
            <IconActionButton
              label={t("day.schedule")}
              tone="med-secondary"
              icon={<ScheduleActionIcon />}
              onClick={() => setPlansOpen(true)}
            />
          </div>

          <DayPanel
            data={data}
            onMealClick={setSelectedMeal}
            onIntakeClick={setSelectedIntake}
            onTakeScheduled={openTake}
          />
        </div>
      )}

      <AddMealModal
        open={addMealOpen}
        date={date}
        onClose={() => setAddMealOpen(false)}
        onSaved={refreshAfterMutation}
      />
      <MealDetailModal
        meal={selectedMeal}
        onClose={() => setSelectedMeal(null)}
        onSaved={refreshAfterMutation}
        onDeleted={refreshAfterMutation}
      />
      <MedicationDetailModal
        intake={selectedIntake}
        onClose={() => setSelectedIntake(null)}
        onChanged={refreshAfterMutation}
      />
      <AddMedicationModal
        open={addMedOpen}
        date={date}
        plans={plans}
        prefill={medPrefill}
        onClose={() => setAddMedOpen(false)}
        onSaved={refreshAfterMutation}
      />
      <MedicationPlansModal
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
        onChanged={refreshAfterMutation}
      />
    </Shell>
  );
}
