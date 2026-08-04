import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export function todayKey(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

export function weekKey(date = new Date()) {
  return format(date, "RRRR-'W'II");
}

export function monthKey(date = new Date()) {
  return format(date, "yyyy-MM");
}

export function formatDayLabel(dateKey: string) {
  return format(parseISO(dateKey), "d MMMM yyyy, EEEE", { locale: ru });
}

export function weekRange(date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return {
    start: todayKey(start),
    end: todayKey(end),
    label: `${format(start, "d MMM", { locale: ru })} — ${format(end, "d MMM yyyy", { locale: ru })}`,
  };
}

export function monthRange(date = new Date()) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return {
    start: todayKey(start),
    end: todayKey(end),
    label: format(start, "LLLL yyyy", { locale: ru }),
  };
}

export const MEAL_TYPES = [
  { id: "breakfast", label: "Завтрак" },
  { id: "lunch", label: "Обед" },
  { id: "dinner", label: "Ужин" },
  { id: "snack", label: "Добавить перекус" },
] as const;

export type MealTypeId = (typeof MEAL_TYPES)[number]["id"];

export function mealTypeLabel(id: string) {
  if (id === "snack") return "Перекус";
  return MEAL_TYPES.find((m) => m.id === id)?.label ?? "Приём пищи";
}
