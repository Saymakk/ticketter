"use client";

import { useEffect, useRef, useState } from "react";
import { Field, inputClass, Button } from "@/components/healthy-life/ui";
import { sanitizeDecimalInput, formatNumberValue } from "@/lib/healthy-life/number-input";
import {
  applyLabelScanToDraftStrings,
  nutrientSetFromStrings,
  scaleFromPer100,
  type NutrientSet,
} from "@/lib/healthy-life/nutrition-scale";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useHlI18n, useT } from "@/lib/healthy-life/i18n";
import { useHlToast } from "@/components/healthy-life/HlToast";
import { OpenablePhoto } from "@/components/healthy-life/PhotoLightbox";

export type MealNutritionDraft = {
  portionGrams: string;
  caloriesPer100: string;
  proteinPer100: string;
  carbsPer100: string;
  fatPer100: string;
};

export const EMPTY_MEAL_NUTRITION: MealNutritionDraft = {
  portionGrams: "",
  caloriesPer100: "",
  proteinPer100: "",
  carbsPer100: "",
  fatPer100: "",
};

export function computeActualFromDraft(draft: MealNutritionDraft): NutrientSet {
  const portion = draft.portionGrams.trim()
    ? Number(String(draft.portionGrams).replace(",", "."))
    : null;
  const portionOk = portion != null && Number.isFinite(portion) && portion > 0 ? portion : null;
  return scaleFromPer100(
    nutrientSetFromStrings({
      calories: draft.caloriesPer100,
      protein: draft.proteinPer100,
      carbs: draft.carbsPer100,
      fat: draft.fatPer100,
    }),
    portionOk,
  );
}

export function MealNutritionFields({
  value,
  onChange,
  disabled,
}: {
  value: MealNutritionDraft;
  onChange: (next: MealNutritionDraft) => void;
  disabled?: boolean;
}) {
  const { fetch: hlFetch } = useHlRouting();
  const { locale } = useHlI18n();
  const t = useT();
  const toast = useHlToast();
  const labelInputRef = useRef<HTMLInputElement>(null);
  const labelPreviewRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const [labelPreview, setLabelPreview] = useState<string | null>(null);
  const [labelScanning, setLabelScanning] = useState(false);
  const [labelHint, setLabelHint] = useState<string | null>(null);

  const actual = computeActualFromDraft(value);
  const weightNum = Number(String(value.portionGrams).replace(",", "."));
  const weightOk = Number.isFinite(weightNum) && weightNum > 0;

  function patch(partial: Partial<MealNutritionDraft>) {
    onChange({ ...value, ...partial });
  }

  function revokeLabelPreview() {
    if (labelPreviewRef.current) {
      URL.revokeObjectURL(labelPreviewRef.current);
      labelPreviewRef.current = null;
    }
  }

  async function onLabelFile(file: File | null) {
    if (!file || disabled) return;
    setLabelScanning(true);
    setLabelHint(null);
    revokeLabelPreview();
    const url = URL.createObjectURL(file);
    labelPreviewRef.current = url;
    setLabelPreview(url);

    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("locale", locale);
      const res = await hlFetch("/api/meals/analyze-label", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("error"));

      if (data.usedFallback) {
        setLabelHint(
          t("addMeal.labelFallback", {
            reason: data.fallbackReason ? `: ${data.fallbackReason}` : "",
          }),
        );
      }

      const hasNutrition = Boolean(data.hasNutrition);
      const weightGrams =
        data.weightGrams != null && Number(data.weightGrams) > 0
          ? Number(data.weightGrams)
          : null;
      const hasWeight = weightGrams != null;

      if (!hasNutrition && !hasWeight) {
        setLabelHint(t("addMeal.labelEmpty"));
        toast.error(t("addMeal.labelEmpty"));
        return;
      }

      const next = applyLabelScanToDraftStrings(
        valueRef.current,
        {
          calories: data.per100?.calories ?? null,
          protein: data.per100?.protein ?? null,
          carbs: data.per100?.carbs ?? null,
          fat: data.per100?.fat ?? null,
        },
        weightGrams,
      );
      onChange(next);

      const product =
        typeof data.analysis?.productName === "string" && data.analysis.productName.trim()
          ? data.analysis.productName.trim()
          : null;
      const pct =
        data.analysis?.confidence != null
          ? Math.round(Number(data.analysis.confidence) * 100)
          : null;
      setLabelHint(
        t("addMeal.labelFilled", {
          product: product ? ` (${product})` : "",
          pct: pct != null ? String(pct) : "—",
          weight: hasWeight ? formatNumberValue(weightGrams) : "—",
        }),
      );
      toast.success(t("addMeal.labelApplied"));
    } catch (e) {
      setLabelHint(e instanceof Error ? e.message : t("error"));
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setLabelScanning(false);
      if (labelInputRef.current) labelInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={labelInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onLabelFile(e.target.files?.[0] ?? null)}
      />

      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-3 space-y-2">
        <p className="text-sm text-[var(--muted)]">{t("addMeal.labelHint")}</p>
        {labelPreview ? (
          <OpenablePhoto src={labelPreview} alt="" className="h-28 w-full object-cover" />
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={disabled || labelScanning}
          onClick={() => labelInputRef.current?.click()}
        >
          {labelScanning ? t("addMeal.labelScanning") : t("addMeal.labelPhoto")}
        </Button>
        {labelHint ? <p className="text-xs text-[var(--accent-ink)]">{labelHint}</p> : null}
      </div>

      <Field label={t("meal.portionActual")}>
        <input
          className={inputClass}
          inputMode="decimal"
          disabled={disabled || labelScanning}
          value={value.portionGrams}
          onChange={(e) => patch({ portionGrams: sanitizeDecimalInput(e.target.value) })}
          placeholder="200"
        />
      </Field>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {t("meal.per100Title")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("meal.caloriesPer100")}>
            <input
              className={inputClass}
              inputMode="decimal"
              disabled={disabled || labelScanning}
              value={value.caloriesPer100}
              onChange={(e) => patch({ caloriesPer100: sanitizeDecimalInput(e.target.value) })}
              placeholder="250"
            />
          </Field>
          <Field label={t("meal.proteinsPer100")}>
            <input
              className={inputClass}
              inputMode="decimal"
              disabled={disabled || labelScanning}
              value={value.proteinPer100}
              onChange={(e) => patch({ proteinPer100: sanitizeDecimalInput(e.target.value) })}
            />
          </Field>
          <Field label={t("meal.carbsPer100")}>
            <input
              className={inputClass}
              inputMode="decimal"
              disabled={disabled || labelScanning}
              value={value.carbsPer100}
              onChange={(e) => patch({ carbsPer100: sanitizeDecimalInput(e.target.value) })}
            />
          </Field>
          <Field label={t("meal.fatsPer100")}>
            <input
              className={inputClass}
              inputMode="decimal"
              disabled={disabled || labelScanning}
              value={value.fatPer100}
              onChange={(e) => patch({ fatPer100: sanitizeDecimalInput(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)]/40 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {t("meal.actualTitle")}
        </p>
        {weightOk ? (
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <ActualStat label={t("meal.calories")} value={formatNumberValue(actual.calories)} suffix="" />
            <ActualStat label={t("meal.proteins")} value={formatNumberValue(actual.protein)} suffix="g" />
            <ActualStat label={t("meal.carbs")} value={formatNumberValue(actual.carbs)} suffix="g" />
            <ActualStat label={t("meal.fats")} value={formatNumberValue(actual.fat)} suffix="g" />
          </div>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">{t("meal.actualNeedWeight")}</p>
        )}
      </div>
    </div>
  );
}

function ActualStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className="font-semibold text-[var(--ink)]">
        {value || "—"}
        {value && suffix ? suffix : ""}
      </p>
    </div>
  );
}
