import { formatNumberValue, parseOptionalNumber } from "@/lib/healthy-life/number-input";

export type NutrientSet = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

/** Scale per-100g nutrients to an actual portion weight. */
export function scaleFromPer100(per100: NutrientSet, portionGrams: number | null): NutrientSet {
  if (portionGrams == null || !(portionGrams > 0)) {
    return { calories: null, protein: null, carbs: null, fat: null };
  }
  const factor = portionGrams / 100;
  const scale = (v: number | null) =>
    v == null || !Number.isFinite(v) ? null : roundNutrient(v * factor);

  return {
    calories: scale(per100.calories),
    protein: scale(per100.protein),
    carbs: scale(per100.carbs),
    fat: scale(per100.fat),
  };
}

/** Convert portion totals back to per-100g values. */
export function toPer100(actual: NutrientSet, portionGrams: number | null): NutrientSet {
  if (portionGrams == null || !(portionGrams > 0)) {
    return { ...actual };
  }
  const factor = 100 / portionGrams;
  const scale = (v: number | null) =>
    v == null || !Number.isFinite(v) ? null : roundNutrient(v * factor);

  return {
    calories: scale(actual.calories),
    protein: scale(actual.protein),
    carbs: scale(actual.carbs),
    fat: scale(actual.fat),
  };
}

export function roundNutrient(n: number): number {
  return parseFloat(n.toFixed(3));
}

export function nutrientSetFromStrings(fields: {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}): NutrientSet {
  return {
    calories: parseOptionalNumber(fields.calories),
    protein: parseOptionalNumber(fields.protein),
    carbs: parseOptionalNumber(fields.carbs),
    fat: parseOptionalNumber(fields.fat),
  };
}

export function nutrientSetToStrings(set: NutrientSet): {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
} {
  return {
    calories: formatNumberValue(set.calories),
    protein: formatNumberValue(set.protein),
    carbs: formatNumberValue(set.carbs),
    fat: formatNumberValue(set.fat),
  };
}

/**
 * Values to persist: scaled totals when weight is set, otherwise treat per-100 inputs as the logged totals.
 */
export function resolveMealNutritionForSave(params: {
  per100: NutrientSet;
  portionGrams: number | null;
}): { nutrients: NutrientSet; portionGrams: number | null } {
  const portion = params.portionGrams != null && params.portionGrams > 0 ? params.portionGrams : null;
  if (portion) {
    return {
      nutrients: scaleFromPer100(params.per100, portion),
      portionGrams: portion,
    };
  }
  return {
    nutrients: {
      calories: params.per100.calories,
      protein: params.per100.protein,
      carbs: params.per100.carbs,
      fat: params.per100.fat,
    },
    portionGrams: null,
  };
}

/** Seed per-100g fields from stored meal totals (optionally reverse-scaled by portion). */
export function seedPer100FromStored(
  actual: NutrientSet,
  portionGrams: number | null | undefined,
  opts?: { defaultPortionIfMissing?: number },
) {
  const portion =
    portionGrams != null && portionGrams > 0
      ? portionGrams
      : opts?.defaultPortionIfMissing != null && opts.defaultPortionIfMissing > 0
        ? opts.defaultPortionIfMissing
        : null;
  return {
    per100: toPer100(actual, portion),
    portionGrams: portion,
  };
}

/** Apply label scan results onto a nutrition draft. */
export function applyLabelScanToDraftStrings(
  draft: {
    portionGrams: string;
    caloriesPer100: string;
    proteinPer100: string;
    carbsPer100: string;
    fatPer100: string;
  },
  per100: NutrientSet,
  weightGrams?: number | null,
): {
  portionGrams: string;
  caloriesPer100: string;
  proteinPer100: string;
  carbsPer100: string;
  fatPer100: string;
} {
  const strings = nutrientSetToStrings(per100);
  const weight =
    weightGrams != null && Number.isFinite(weightGrams) && weightGrams > 0
      ? formatNumberValue(weightGrams)
      : "";
  return {
    portionGrams: weight || draft.portionGrams,
    caloriesPer100: strings.calories || draft.caloriesPer100,
    proteinPer100: strings.protein || draft.proteinPer100,
    carbsPer100: strings.carbs || draft.carbsPer100,
    fatPer100: strings.fat || draft.fatPer100,
  };
}

/** @deprecated use applyLabelScanToDraftStrings */
export function applyPer100ToDraftStrings(
  draft: {
    portionGrams: string;
    caloriesPer100: string;
    proteinPer100: string;
    carbsPer100: string;
    fatPer100: string;
  },
  per100: NutrientSet,
) {
  return applyLabelScanToDraftStrings(draft, per100, null);
}
