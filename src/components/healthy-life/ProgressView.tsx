"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { todayKey } from "@/lib/healthy-life/dates";
import { formatKg } from "@/lib/healthy-life/format";
import {
  cacheKey,
  invalidateRelatedCaches,
  isCacheStale,
  readCache,
  writeCache,
} from "@/lib/healthy-life/app-cache";
import {
  WORKOUT_TYPES,
  WORKOUT_UNITS,
  formatWorkoutQuantity,
  workoutTypeLabel,
} from "@/lib/healthy-life/workouts";
import { OverviewChart, WorkoutTypeChart } from "@/components/healthy-life/ProgressCharts";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useT } from "@/lib/healthy-life/i18n";
import { Button, Card, Field, PageHeader, Shell, inputClass, LoadingText } from "@/components/healthy-life/ui";
import { useHlToast } from "@/components/healthy-life/HlToast";

type Tab = "chart" | "workout" | "weight";

type ProgressData = {
  days: number;
  calorieGoal: number;
  series: Array<{
    date: string;
    calories: number;
    weightKg: number | null;
    workoutCount: number;
    workoutQuantity: number;
    workoutsByType: Record<string, { count: number; quantity: number }>;
  }>;
  byType: Array<{
    type: string;
    label: string;
    count: number;
    quantity: number;
    unit: string;
  }>;
  totals: {
    meals: number;
    calories: number;
    workouts: number;
    workoutTypes: number;
  };
};

type Workout = {
  id: string;
  date: string;
  type: string;
  quantity: number;
  unit: string;
  name: string | null;
  note: string | null;
  caloriesBurned: number | null;
};

type WeightEntry = {
  id: string;
  date: string;
  weightKg: number;
  note: string | null;
};

type WeightPayload = {
  entries: WeightEntry[];
  profile: { targetWeightKg: number | null } | null;
};

const WORKOUTS_KEY = cacheKey("workouts", "limit", 40);
const WEIGHT_KEY = cacheKey("weight", "limit", 30);

function progressKey(days: number) {
  return cacheKey("progress", days);
}

export function ProgressView() {
  const { fetch: hlFetch } = useHlRouting();
  const t = useT();
  const toast = useHlToast();
  const [tab, setTab] = useState<Tab>("chart");
  const [rangeDays, setRangeDays] = useState(14);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsRefreshing, setMetricsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressGen = useRef(0);

  const [workoutDate, setWorkoutDate] = useState(todayKey());
  const [workoutType, setWorkoutType] = useState<string>("running");
  const [workoutUnit, setWorkoutUnit] = useState("minutes");
  const [workoutQty, setWorkoutQty] = useState("30");
  const [workoutName, setWorkoutName] = useState("");
  const [workoutNote, setWorkoutNote] = useState("");
  const [workoutBurn, setWorkoutBurn] = useState("");
  const [savingWorkout, setSavingWorkout] = useState(false);

  const [weightDate, setWeightDate] = useState(todayKey());
  const [weightKg, setWeightKg] = useState("");
  const [weightNote, setWeightNote] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  const applyWeightPayload = useCallback((wtData: WeightPayload) => {
    setWeights(wtData.entries || []);
    setTargetWeightKg(wtData.profile?.targetWeightKg ?? null);
    setWeightKg((cur) => cur || (wtData.entries?.[0] ? String(wtData.entries[0].weightKg) : ""));
  }, []);

  const loadLists = useCallback(
    async (opts?: { force?: boolean }) => {
      const wCached = readCache<Workout[]>(WORKOUTS_KEY);
      const wtCached = readCache<WeightPayload>(WEIGHT_KEY);

      if (wCached) setWorkouts(wCached.data);
      if (wtCached) applyWeightPayload(wtCached.data);

      const listsFresh =
        wCached &&
        wtCached &&
        !opts?.force &&
        !isCacheStale(wCached) &&
        !isCacheStale(wtCached);

      if (listsFresh) {
        setLoading(false);
        return;
      }

      try {
        const [wRes, wtRes] = await Promise.all([
          hlFetch("/api/workouts?limit=40"),
          hlFetch("/api/weight?limit=30"),
        ]);
        if (!wRes.ok || !wtRes.ok) throw new Error("Не удалось загрузить прогресс");
        const [wData, wtData] = await Promise.all([wRes.json(), wtRes.json()]);
        const workoutsList = (wData.workouts || []) as Workout[];
        const weightPayload: WeightPayload = {
          entries: wtData.entries || [],
          profile: wtData.profile ?? null,
        };
        setWorkouts(workoutsList);
        applyWeightPayload(weightPayload);
        writeCache(WORKOUTS_KEY, workoutsList);
        writeCache(WEIGHT_KEY, weightPayload);
      } catch (e) {
        if (!wCached && !wtCached) {
          setError(e instanceof Error ? e.message : "Ошибка");
        }
      } finally {
        setLoading(false);
      }
    },
    [applyWeightPayload, hlFetch],
  );

  const loadProgress = useCallback(
    async (days: number, opts?: { force?: boolean }) => {
      const key = progressKey(days);
      const cached = readCache<ProgressData>(key);
      if (cached) {
        setProgress(cached.data);
        if (!opts?.force && !isCacheStale(cached)) {
          setMetricsRefreshing(false);
          return;
        }
      }

      // Keep existing chart visible; only blank on first visit with no cache.
      setMetricsRefreshing(true);
      setError(null);
      const gen = ++progressGen.current;

      try {
        const pRes = await hlFetch(`/api/progress?days=${days}`);
        if (gen !== progressGen.current) return;
        if (!pRes.ok) throw new Error("Не удалось загрузить прогресс");
        const pData = (await pRes.json()) as ProgressData;
        if (gen !== progressGen.current) return;
        setProgress(pData);
        writeCache(key, pData);
      } catch (e) {
        if (gen !== progressGen.current) return;
        if (!cached) {
          setError(e instanceof Error ? e.message : "Ошибка");
        }
      } finally {
        if (gen === progressGen.current) {
          setMetricsRefreshing(false);
        }
      }
    },
    [hlFetch],
  );

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    loadProgress(rangeDays);
  }, [rangeDays, loadProgress]);

  useEffect(() => {
    const meta = WORKOUT_TYPES.find((t) => t.id === workoutType);
    if (meta) setWorkoutUnit(meta.defaultUnit);
  }, [workoutType]);

  async function refreshAll() {
    invalidateRelatedCaches({ progress: true, workouts: true, weight: true, advice: true });
    await Promise.all([loadLists({ force: true }), loadProgress(rangeDays, { force: true })]);
  }

  async function saveWorkout() {
    setSavingWorkout(true);
    setError(null);
    try {
      const res = await hlFetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: workoutDate,
          type: workoutType,
          unit: workoutUnit,
          quantity: Number(workoutQty),
          name: workoutName || null,
          note: workoutNote || null,
          caloriesBurned: workoutBurn === "" ? null : Number(workoutBurn),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setWorkoutNote("");
      setWorkoutName("");
      setWorkoutBurn("");
      setTab("chart");
      invalidateRelatedCaches({ day: workoutDate });
      await refreshAll();
      toast.success(t("toast.workoutSaved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingWorkout(false);
    }
  }

  async function removeWorkout(id: string) {
    if (!confirm("Удалить тренировку?")) return;
    await hlFetch(`/api/workouts?id=${id}`, { method: "DELETE" });
    invalidateRelatedCaches();
    await refreshAll();
    toast.success(t("toast.deleted"));
  }

  async function saveWeight() {
    setSavingWeight(true);
    setError(null);
    try {
      const res = await hlFetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: weightDate,
          weightKg: Number(weightKg),
          note: weightNote || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setWeightNote("");
      setTab("chart");
      invalidateRelatedCaches({ day: weightDate });
      await refreshAll();
      toast.success(t("toast.weightSaved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingWeight(false);
    }
  }

  const latestWeight = weights[0];
  const showInitialLoading = loading && !progress && workouts.length === 0 && weights.length === 0;

  return (
    <Shell>
      <PageHeader
        title="График"
        subtitle="Калории, вес и тренировки по типам в одном обзоре."
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {(
          [
            { id: "chart", label: "Обзор" },
            { id: "workout", label: "Тренировка" },
            { id: "weight", label: "Вес" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-2xl px-2 py-3 text-sm font-semibold transition ${
              tab === item.id
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-3 text-sm text-[#8a3b2f]">{error}</p> : null}
      {showInitialLoading ? <LoadingText label={t("loading")} /> : null}

      {tab === "chart" && progress ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setRangeDays(d);
                  const cached = readCache<ProgressData>(progressKey(d));
                  if (cached) setProgress(cached.data);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  rangeDays === d
                    ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {d} дн.
              </button>
            ))}
            {metricsRefreshing ? (
              <span className="ml-auto text-xs text-[var(--muted)]">Обновляем…</span>
            ) : null}
          </div>

          <Card
            className={`space-y-3 bg-gradient-to-br from-[#eaf3e8] to-[var(--surface)] transition-opacity ${
              metricsRefreshing ? "opacity-70" : "opacity-100"
            }`}
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Ккал" value={String(progress.totals.calories)} />
              <Stat label="Тренировок" value={String(progress.totals.workouts)} />
              <Stat label="Типов" value={String(progress.totals.workoutTypes)} />
            </div>
            <OverviewChart series={progress.series} calorieGoal={progress.calorieGoal} />
            <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent)] opacity-55" /> калории
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#b06a3c]" /> кол-во тренировок
              </span>
              <span>пунктир — цель ккал</span>
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display text-xl">Типы тренировок</h2>
            <p className="text-sm text-[var(--muted)]">
              Сколько раз и суммарный объём по каждому типу за выбранный период.
            </p>
            <WorkoutTypeChart byType={progress.byType} />
          </Card>

          <Card>
            <p className="text-sm text-[var(--muted)]">Текущий вес</p>
            <p className="font-display text-3xl">
              {latestWeight ? formatKg(latestWeight.weightKg) : "—"}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Цель: {targetWeightKg != null ? formatKg(targetWeightKg) : "не задана"}
            </p>
          </Card>
        </div>
      ) : null}

      {tab === "chart" && !progress && !showInitialLoading ? (
        <LoadingText label={t("loading")} />
      ) : null}

      {tab === "workout" && !showInitialLoading ? (
        <div className="space-y-4">
          <Card className="space-y-3">
            <Field label="Дата">
              <input
                type="date"
                className={inputClass}
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
              />
            </Field>

            <Field label="Тип">
              <div className="grid grid-cols-3 gap-2">
                {WORKOUT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setWorkoutType(t.id)}
                    className={`rounded-xl px-2 py-2 text-xs font-semibold ${
                      workoutType === t.id
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Количество">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={workoutQty}
                  onChange={(e) => setWorkoutQty(e.target.value)}
                />
              </Field>
              <Field label="Единица">
                <select
                  className={inputClass}
                  value={workoutUnit}
                  onChange={(e) => setWorkoutUnit(e.target.value)}
                >
                  {WORKOUT_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Название (необязательно)">
              <input
                className={inputClass}
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="Интервалы / ноги / бассейн"
              />
            </Field>

            <Field label="Сожжено ккал (необязательно)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={workoutBurn}
                onChange={(e) => setWorkoutBurn(e.target.value)}
              />
            </Field>

            <Field label="Заметка">
              <input
                className={inputClass}
                value={workoutNote}
                onChange={(e) => setWorkoutNote(e.target.value)}
              />
            </Field>

            <Button type="button" className="w-full" disabled={savingWorkout} onClick={saveWorkout}>
              {savingWorkout ? "Сохраняем…" : "Добавить тренировку"}
            </Button>
          </Card>

          <div className="space-y-2">
            <h2 className="font-display text-xl">Недавние</h2>
            {workouts.length === 0 ? (
              <Card>
                <p className="text-[var(--muted)]">Тренировок пока нет.</p>
              </Card>
            ) : (
              workouts.map((w) => (
                <Card key={w.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[var(--muted)]">{w.date}</p>
                    <p className="font-semibold">
                      {workoutTypeLabel(w.type)}
                      {w.name ? ` · ${w.name}` : ""}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {formatWorkoutQuantity(w.quantity, w.unit)}
                      {w.caloriesBurned != null ? ` · −${Math.round(w.caloriesBurned)} ккал` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-[#8a3b2f]"
                    onClick={() => removeWorkout(w.id)}
                  >
                    удалить
                  </button>
                </Card>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === "weight" && !showInitialLoading ? (
        <div className="space-y-4">
          <Card className="space-y-3">
            <Field label="Дата">
              <input
                type="date"
                className={inputClass}
                value={weightDate}
                onChange={(e) => setWeightDate(e.target.value)}
              />
            </Field>
            <Field label="Вес, кг">
              <input
                className={inputClass}
                inputMode="decimal"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="72.5"
              />
            </Field>
            <Field label="Заметка">
              <input
                className={inputClass}
                value={weightNote}
                onChange={(e) => setWeightNote(e.target.value)}
              />
            </Field>
            <Button type="button" className="w-full" disabled={savingWeight} onClick={saveWeight}>
              {savingWeight ? "Сохраняем…" : "Сохранить вес"}
            </Button>
          </Card>

          <div className="space-y-2">
            <h2 className="font-display text-xl">История веса</h2>
            {weights.map((entry) => (
              <Card key={entry.id} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{entry.date}</p>
                  {entry.note ? <p className="text-sm text-[var(--muted)]">{entry.note}</p> : null}
                </div>
                <p className="font-display text-xl">{formatKg(entry.weightKg)}</p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-display text-xl">{value}</p>
    </div>
  );
}
