export const WORKOUT_TYPES = [
  { id: "running", label: "Бег", defaultUnit: "minutes", color: "#2f6b4f" },
  { id: "walking", label: "Ходьба", defaultUnit: "minutes", color: "#5a8f6e" },
  { id: "cycling", label: "Вело", defaultUnit: "km", color: "#3d7ea6" },
  { id: "strength", label: "Силовая", defaultUnit: "sets", color: "#b06a3c" },
  { id: "yoga", label: "Йога", defaultUnit: "minutes", color: "#7a6aa8" },
  { id: "swimming", label: "Плавание", defaultUnit: "minutes", color: "#2f8f9d" },
  { id: "hiit", label: "HIIT", defaultUnit: "minutes", color: "#c45c4a" },
  { id: "sports", label: "Спорт", defaultUnit: "minutes", color: "#6b8e23" },
  { id: "other", label: "Другое", defaultUnit: "minutes", color: "#6d7b70" },
] as const;

export type WorkoutTypeId = (typeof WORKOUT_TYPES)[number]["id"];

export const WORKOUT_UNITS = [
  { id: "minutes", label: "мин", short: "мин" },
  { id: "km", label: "км", short: "км" },
  { id: "sets", label: "подходы", short: "подх." },
  { id: "reps", label: "повторы", short: "повт." },
] as const;

export type WorkoutUnitId = (typeof WORKOUT_UNITS)[number]["id"];

export function workoutTypeLabel(id: string) {
  return WORKOUT_TYPES.find((t) => t.id === id)?.label ?? id;
}

export function workoutTypeColor(id: string) {
  return WORKOUT_TYPES.find((t) => t.id === id)?.color ?? "#6d7b70";
}

export function workoutUnitLabel(id: string) {
  return WORKOUT_UNITS.find((u) => u.id === id)?.short ?? id;
}

export function formatWorkoutQuantity(quantity: number, unit: string) {
  const q = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
  return `${q} ${workoutUnitLabel(unit)}`;
}
