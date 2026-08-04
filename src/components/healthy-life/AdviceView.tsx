"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, PageHeader, Shell } from "@/components/healthy-life/ui";

type Period = "day" | "week" | "month";

type AdvicePayload = {
  advice: {
    title: string;
    summary: string | null;
    content: string;
    periodKey: string;
  };
  periodLabel: string;
  cached?: boolean;
  stats?: {
    totalCalories: number;
    mealCount: number;
    avgCaloriesPerDay: number;
    weightStart: number | null;
    weightEnd: number | null;
  };
};

const tabs: { id: Period; label: string }[] = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
];

export function AdviceView() {
  const [period, setPeriod] = useState<Period>("day");
  const [data, setData] = useState<AdvicePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: Period, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/advice?period=${p}${refresh ? "&refresh=1" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  return (
    <Shell>
      <PageHeader
        title="Советы"
        subtitle="ИИ учитывает калории, блюда и динамику веса за выбранный период."
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPeriod(tab.id)}
            className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
              period === tab.id
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-[var(--muted)]">Готовим совет…</p> : null}
      {error ? <p className="text-[#8a3b2f]">{error}</p> : null}

      {data && !loading ? (
        <div className="space-y-4 animate-rise">
          {data.stats ? (
            <Card className="grid grid-cols-2 gap-3 bg-gradient-to-br from-[#eaf3e8] to-[var(--surface)]">
              <Stat label="Среднее/день" value={`${data.stats.avgCaloriesPerDay} ккал`} />
              <Stat label="Приёмов" value={String(data.stats.mealCount)} />
              <Stat label="Сумма ккал" value={String(Math.round(data.stats.totalCalories))} />
              <Stat
                label="Вес"
                value={
                  data.stats.weightEnd != null
                    ? `${data.stats.weightEnd.toFixed(1)} кг`
                    : "—"
                }
              />
            </Card>
          ) : null}

          <Card className="space-y-3">
            <p className="text-xs tracking-wide text-[var(--muted)] uppercase">{data.periodLabel}</p>
            <h2 className="font-display text-2xl">{data.advice.title}</h2>
            {data.advice.summary ? (
              <p className="text-[var(--accent-ink)]">{data.advice.summary}</p>
            ) : null}
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]/90">
              {data.advice.content}
            </div>
          </Card>

          <Button type="button" variant="secondary" className="w-full" onClick={() => load(period, true)}>
            Обновить совет
          </Button>
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
