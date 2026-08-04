"use client";

import { workoutTypeColor } from "@/lib/healthy-life/workouts";

type DayPoint = {
  date: string;
  calories: number;
  weightKg: number | null;
  workoutCount: number;
  workoutsByType: Record<string, { count: number; quantity: number }>;
};

type TypeTotal = {
  type: string;
  label: string;
  count: number;
  quantity: number;
  unit: string;
};

export function OverviewChart({
  series,
  calorieGoal,
}: {
  series: DayPoint[];
  calorieGoal: number;
}) {
  const width = 360;
  const height = 180;
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxCal = Math.max(calorieGoal, ...series.map((d) => d.calories), 1);
  const maxWorkouts = Math.max(...series.map((d) => d.workoutCount), 1);
  const barW = Math.max(4, innerW / series.length - 2);

  const points = series
    .map((d, i) => {
      const x = pad.left + (i + 0.5) * (innerW / series.length);
      const y = pad.top + innerH - (d.workoutCount / maxWorkouts) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="График калорий и тренировок">
      <line
        x1={pad.left}
        x2={width - pad.right}
        y1={pad.top + innerH - (calorieGoal / maxCal) * innerH}
        y2={pad.top + innerH - (calorieGoal / maxCal) * innerH}
        stroke="var(--line)"
        strokeDasharray="4 4"
      />
      {series.map((d, i) => {
        const x = pad.left + i * (innerW / series.length) + 1;
        const h = (d.calories / maxCal) * innerH;
        const y = pad.top + innerH - h;
        return (
          <rect
            key={d.date}
            x={x}
            y={y}
            width={barW}
            height={Math.max(h, d.calories > 0 ? 2 : 0)}
            rx={3}
            fill="var(--accent)"
            opacity={0.55}
          />
        );
      })}
      <polyline
        fill="none"
        stroke="#b06a3c"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      {series.map((d, i) => {
        if (d.workoutCount <= 0) return null;
        const x = pad.left + (i + 0.5) * (innerW / series.length);
        const y = pad.top + innerH - (d.workoutCount / maxWorkouts) * innerH;
        return <circle key={`w-${d.date}`} cx={x} cy={y} r="3.5" fill="#b06a3c" />;
      })}
      <text x={pad.left} y={height - 8} fontSize="10" fill="var(--muted)">
        {series[0]?.date.slice(5)}
      </text>
      <text x={width - pad.right} y={height - 8} fontSize="10" fill="var(--muted)" textAnchor="end">
        {series[series.length - 1]?.date.slice(5)}
      </text>
      <text x={4} y={pad.top + 4} fontSize="10" fill="var(--muted)">
        ккал
      </text>
    </svg>
  );
}

export function WorkoutTypeChart({ byType }: { byType: TypeTotal[] }) {
  if (byType.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Пока нет тренировок за период.</p>;
  }

  const maxCount = Math.max(...byType.map((t) => t.count), 1);

  return (
    <div className="space-y-3">
      {byType.map((item) => (
        <div key={item.type}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">{item.label}</span>
            <span className="text-[var(--muted)]">
              {item.count}× · {item.quantity} {unitShort(item.unit)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--accent-soft)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(8, (item.count / maxCount) * 100)}%`,
                background: workoutTypeColor(item.type),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function unitShort(unit: string) {
  if (unit === "minutes") return "мин";
  if (unit === "km") return "км";
  if (unit === "sets") return "подх.";
  if (unit === "reps") return "повт.";
  return unit;
}
