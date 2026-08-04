"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDayLabel, mealTypeLabel, todayKey } from "@/lib/healthy-life/dates";
import { formatKcal, progressPercent } from "@/lib/healthy-life/format";
import { formatWorkoutQuantity, workoutTypeLabel } from "@/lib/healthy-life/workouts";
import { Button, Card, PageHeader, Shell } from "@/components/healthy-life/ui";

type Meal = {
  id: string;
  name: string;
  description: string | null;
  calories: number;
  mealType: string;
  photoPath: string | null;
  userCorrected: boolean;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

type Workout = {
  id: string;
  type: string;
  quantity: number;
  unit: string;
  name: string | null;
};

type DayData = {
  date: string;
  totalCalories: number;
  remainingCalories: number;
  meals: Meal[];
  profile: { dailyCalorieGoal: number; name: string };
  weight: { weightKg: number } | null;
};

export function DayView() {
  const [date, setDate] = useState(todayKey());
  const [data, setData] = useState<DayData | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const [mealRes, workoutRes] = await Promise.all([
        fetch(`/api/meals?date=${d}`),
        fetch(`/api/workouts?date=${d}`),
      ]);
      const mealJson = await mealRes.json().catch(() => ({}));
      if (!mealRes.ok) {
        throw new Error(mealJson.error || "Не удалось загрузить день");
      }
      setData(mealJson);
      if (workoutRes.ok) {
        const w = await workoutRes.json();
        setWorkouts(w.workouts || []);
      } else {
        setWorkouts([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  async function removeMeal(id: string) {
    if (!confirm("Удалить запись?")) return;
    await fetch(`/api/meals?id=${id}`, { method: "DELETE" });
    load(date);
  }

  const pct = data ? progressPercent(data.totalCalories, data.profile.dailyCalorieGoal) : 0;

  return (
    <Shell>
      <PageHeader
        title="Сегодня"
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

      {loading && <p className="text-[var(--muted)]">Загрузка…</p>}
      {error && <p className="text-[#8a3b2f]">{error}</p>}

      {data && !loading && (
        <div className="space-y-4 animate-rise">
          <Card className="overflow-hidden bg-gradient-to-br from-[#e7f3ea] via-[var(--surface)] to-[#f3efe4]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--muted)]">Съедено</p>
                <p className="font-display text-4xl text-[var(--ink)]">
                  {Math.round(data.totalCalories)}
                  <span className="ml-1 text-lg text-[var(--muted)]">ккал</span>
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Цель {data.profile.dailyCalorieGoal} · осталось{" "}
                  {Math.round(Math.max(0, data.remainingCalories))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--muted)]">Вес</p>
                <p className="font-display text-2xl">
                  {data.weight ? `${data.weight.weightKg.toFixed(1)} кг` : "—"}
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

          <div className="flex gap-2">
            <Link href="/add" className="flex-1">
              <Button className="w-full" type="button">
                Добавить еду
              </Button>
            </Link>
            <Link href="/progress">
              <Button variant="secondary" type="button">
                Тренировка
              </Button>
            </Link>
          </div>

          {workouts.length > 0 ? (
            <div className="space-y-2">
              <h2 className="font-display text-xl">Тренировки</h2>
              {workouts.map((w) => (
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
            <h2 className="font-display text-xl">Приёмы пищи</h2>
            {data.meals.length === 0 ? (
              <Card>
                <p className="text-[var(--muted)]">
                  Пока пусто. Сделайте фото блюда — ИИ распознает еду и оценит калории, а вы сможете
                  поправить результат.
                </p>
              </Card>
            ) : (
              data.meals.map((meal) => (
                <Card key={meal.id} className="flex gap-3">
                  {meal.photoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={meal.photoPath}
                      alt={meal.name}
                      className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      еда
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-[var(--muted)]">{mealTypeLabel(meal.mealType)}</p>
                        <h3 className="truncate font-semibold">{meal.name}</h3>
                      </div>
                      <p className="shrink-0 font-semibold">{formatKcal(meal.calories)}</p>
                    </div>
                    {meal.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{meal.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                      {meal.userCorrected ? <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5">скорректировано</span> : null}
                      {meal.protein != null ? <span>Б {Math.round(meal.protein)}г</span> : null}
                      {meal.carbs != null ? <span>У {Math.round(meal.carbs)}г</span> : null}
                      {meal.fat != null ? <span>Ж {Math.round(meal.fat)}г</span> : null}
                      <button
                        type="button"
                        onClick={() => removeMeal(meal.id)}
                        className="ml-auto text-[#8a3b2f]"
                      >
                        удалить
                      </button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
