import type { MealDetail } from "@/components/healthy-life/MealDetailModal";

export type MealSortMode = "time_asc" | "time_desc" | "kcal_desc" | "kcal_asc";

const MEAL_SORT_STORAGE_KEY = "hl:meal-sort";

const MEAL_TYPE_ORDER: Record<string, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

function mealTimeKey(meal: MealDetail): number {
  const typeOrder = MEAL_TYPE_ORDER[meal.mealType] ?? 9;
  const created = new Date(meal.createdAt).getTime();
  const createdSafe = Number.isFinite(created) ? created : 0;
  // Type order dominates (morning→evening); within type use creation time.
  return typeOrder * 1e15 + createdSafe;
}

export function sortMeals(meals: MealDetail[], mode: MealSortMode): MealDetail[] {
  const copy = [...meals];
  copy.sort((a, b) => {
    switch (mode) {
      case "time_asc":
        return mealTimeKey(a) - mealTimeKey(b);
      case "time_desc":
        return mealTimeKey(b) - mealTimeKey(a);
      case "kcal_desc":
        return (b.calories || 0) - (a.calories || 0) || mealTimeKey(a) - mealTimeKey(b);
      case "kcal_asc":
        return (a.calories || 0) - (b.calories || 0) || mealTimeKey(a) - mealTimeKey(b);
      default:
        return 0;
    }
  });
  return copy;
}

export function readMealSortMode(): MealSortMode {
  if (typeof window === "undefined") return "time_asc";
  try {
    const raw = window.localStorage.getItem(MEAL_SORT_STORAGE_KEY);
    if (
      raw === "time_asc" ||
      raw === "time_desc" ||
      raw === "kcal_desc" ||
      raw === "kcal_asc"
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "time_asc";
}

export function writeMealSortMode(mode: MealSortMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEAL_SORT_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export type IntakeBalance = "over" | "under" | "ok";

/** Status vs daily goal. Near-zero delta (±1 kcal) counts as on track. */
export function intakeBalance(totalCalories: number, goal: number): {
  status: IntakeBalance;
  delta: number;
} {
  if (!(goal > 0)) {
    return { status: "ok", delta: 0 };
  }
  const delta = Math.round(totalCalories - goal);
  if (delta > 1) return { status: "over", delta };
  if (delta < -1) return { status: "under", delta: Math.abs(delta) };
  return { status: "ok", delta: 0 };
}
