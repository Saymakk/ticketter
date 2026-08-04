"use client";

import { useCallback, useEffect, useState } from "react";
import { todayKey } from "@/lib/healthy-life/dates";
import { formatKg } from "@/lib/healthy-life/format";
import {
  WORKOUT_TYPES,
  WORKOUT_UNITS,
  formatWorkoutQuantity,
  workoutTypeLabel,
} from "@/lib/healthy-life/workouts";
import { OverviewChart, WorkoutTypeChart } from "@/components/healthy-life/ProgressCharts";
import { Button, Card, Field, PageHeader, Shell, inputClass } from "@/components/healthy-life/ui";

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

export function ProgressView() {
  const [tab, setTab] = useState<Tab>("chart");
  const [rangeDays, setRangeDays] = useState(14);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, wRes, wtRes] = await Promise.all([
        fetch(`/api/progress?days=${rangeDays}`),
        fetch("/api/workouts?limit=40"),
        fetch("/api/weight?limit=30"),
      ]);
      if (!pRes.ok || !wRes.ok || !wtRes.ok) throw new Error("Не удалось загрузить прогресс");
      const [pData, wData, wtData] = await Promise.all([pRes.json(), wRes.json(), wtRes.json()]);
      setProgress(pData);
      setWorkouts(wData.workouts || []);
      setWeights(wtData.entries || []);
      setTargetWeightKg(wtData.profile?.targetWeightKg ?? null);
      setWeightKg((cur) => cur || (wtData.entries?.[0] ? String(wtData.entries[0].weightKg) : ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const meta = WORKOUT_TYPES.find((t) => t.id === workoutType);
    if (meta) setWorkoutUnit(meta.defaultUnit);
  }, [workoutType]);

  async function saveWorkout() {
    setSavingWorkout(true);
    setError(null);
    try {
      const res = await fetch("/api/workouts", {
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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingWorkout(false);
    }
  }

  async function removeWorkout(id: string) {
    if (!confirm("Удалить тренировку?")) return;
    await fetch(`/api/workouts?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function saveWeight() {
    setSavingWeight(true);
    setError(null);
    try {
      const res = await fetch("/api/weight", {
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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingWeight(false);
    }
  }

  const latestWeight = weights[0];

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
      {loading ? <p className="text-[var(--muted)]">Загрузка…</p> : null}

      {!loading && tab === "chart" && progress ? (
        <div className="space-y-4 animate-rise">
          <div className="flex gap-2">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRangeDays(d)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  rangeDays === d
                    ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {d} дн.
              </button>
            ))}
          </div>

          <Card className="space-y-3 bg-gradient-to-br from-[#eaf3e8] to-[var(--surface)]">
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

      {!loading && tab === "workout" ? (
        <div className="space-y-4 animate-rise">
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

      {!loading && tab === "weight" ? (
        <div className="space-y-4 animate-rise">
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
