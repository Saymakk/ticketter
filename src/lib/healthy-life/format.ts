export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatKcal(value: number) {
  return `${Math.round(value)} ккал`;
}

export function formatKg(value: number) {
  return `${value.toFixed(1)} кг`;
}

export function progressPercent(current: number, goal: number) {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}
