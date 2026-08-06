"use client";

import { useEffect, useState } from "react";
import { MEAL_TYPES } from "@/lib/healthy-life/dates";
import { formatKcal } from "@/lib/healthy-life/format";
import { isWithinEditWindow } from "@/lib/healthy-life/edit-window";
import { sanitizeDecimalInput, parseOptionalNumber, formatNumberValue } from "@/lib/healthy-life/number-input";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useT } from "@/lib/healthy-life/i18n";
import type { HlMessageKey } from "@/lib/healthy-life/i18n";
import { Button, Field, Modal, inputClass } from "@/components/healthy-life/ui";
import { OpenablePhoto } from "@/components/healthy-life/PhotoLightbox";
import { useHlToast } from "@/components/healthy-life/HlToast";

export type MealDetail = {
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
  portionGrams?: number | null;
  createdAt: string;
};

function mealTypeLabelKey(id: string, forButton = false): HlMessageKey {
  if (id === "snack") return forButton ? "mealTypes.snack" : "mealTypes.snackLabel";
  if (id === "breakfast" || id === "lunch" || id === "dinner") return `mealTypes.${id}`;
  return "meal.title";
}

export function MealDetailModal({
  meal,
  readOnly,
  onClose,
  onSaved,
  onDeleted,
}: {
  meal: MealDetail | null;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: (meal?: MealDetail) => void;
  onDeleted: (id?: string) => void;
}) {
  const { fetch: hlFetch } = useHlRouting();
  const t = useT();
  const toast = useHlToast();
  const editable = Boolean(meal && !readOnly && isWithinEditWindow(meal.createdAt));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [portionGrams, setPortionGrams] = useState("");
  const [mealType, setMealType] = useState("snack");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meal) return;
    setName(meal.name);
    setDescription(meal.description || "");
    setCalories(formatNumberValue(meal.calories));
    setProtein(formatNumberValue(meal.protein));
    setCarbs(formatNumberValue(meal.carbs));
    setFat(formatNumberValue(meal.fat));
    setPortionGrams(formatNumberValue(meal.portionGrams));
    setMealType(meal.mealType);
    setError(null);
  }, [meal?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when opening another meal

  if (!meal) return null;

  async function save() {
    if (!editable) return;
    setSaving(true);
    setError(null);
    try {
      const res = await hlFetch("/api/meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: meal!.id,
          name: name.trim(),
          description: description.trim() || null,
          calories: parseOptionalNumber(calories) ?? 0,
          protein: parseOptionalNumber(protein),
          carbs: parseOptionalNumber(carbs),
          fat: parseOptionalNumber(fat),
          portionGrams: parseOptionalNumber(portionGrams),
          mealType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("meal.saveFailed"));
      const updated = data as MealDetail;
      onSaved({
        ...meal!,
        ...updated,
        createdAt:
          typeof updated.createdAt === "string"
            ? updated.createdAt
            : meal!.createdAt,
      });
      toast.success(t("toast.mealSaved"));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editable) return;
    if (!confirm(t("meal.deleteConfirm"))) return;
    setSaving(true);
    try {
      const res = await hlFetch(`/api/meals?id=${meal!.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("meal.deleteFailed"));
      onDeleted(meal!.id);
      toast.success(t("toast.mealDeleted"));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={Boolean(meal)} onClose={onClose} title={editable ? t("meal.title") : meal.name}>
      {meal.photoPath ? (
        <div className="mb-4">
          <OpenablePhoto
            src={meal.photoPath}
            alt={meal.name}
            className="max-h-72 w-full object-cover"
          />
        </div>
      ) : (
        <div className="mb-4 flex h-40 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {t("day.noPhoto")}
        </div>
      )}

      {!editable ? (
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted)]">{t(mealTypeLabelKey(meal.mealType))}</p>
          <p className="font-display text-3xl">{formatKcal(meal.calories)}</p>
          {meal.description ? <p className="text-sm text-[var(--muted)]">{meal.description}</p> : null}
          <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
            {meal.protein != null ? <span>{t("day.protein")} {formatNumberValue(meal.protein)}g</span> : null}
            {meal.carbs != null ? <span>{t("day.carbs")} {formatNumberValue(meal.carbs)}g</span> : null}
            {meal.fat != null ? <span>{t("day.fat")} {formatNumberValue(meal.fat)}g</span> : null}
            {meal.portionGrams != null ? (
              <span>
                {t("meal.portion")} {formatNumberValue(meal.portionGrams)}g
              </span>
            ) : null}
          </div>
          {readOnly ? null : (
            <p className="text-xs text-[var(--muted)]">{t("meal.editWindow")}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Field label={t("meal.type")}>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map((mt) => (
                <button
                  key={mt.id}
                  type="button"
                  onClick={() => setMealType(mt.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    mealType === mt.id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  }`}
                >
                  {t(mealTypeLabelKey(mt.id, true))}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("meal.name")}>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("meal.description")}>
            <textarea
              className={`${inputClass} min-h-20 resize-none`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("meal.calories")}>
              <input
                className={inputClass}
                inputMode="decimal"
                value={calories}
                onChange={(e) => setCalories(sanitizeDecimalInput(e.target.value))}
              />
            </Field>
            <Field label={t("meal.portion")}>
              <input
                className={inputClass}
                inputMode="decimal"
                value={portionGrams}
                onChange={(e) => setPortionGrams(sanitizeDecimalInput(e.target.value))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("meal.proteins")}>
              <input
                className={inputClass}
                inputMode="decimal"
                value={protein}
                onChange={(e) => setProtein(sanitizeDecimalInput(e.target.value))}
              />
            </Field>
            <Field label={t("meal.carbs")}>
              <input
                className={inputClass}
                inputMode="decimal"
                value={carbs}
                onChange={(e) => setCarbs(sanitizeDecimalInput(e.target.value))}
              />
            </Field>
            <Field label={t("meal.fats")}>
              <input
                className={inputClass}
                inputMode="decimal"
                value={fat}
                onChange={(e) => setFat(sanitizeDecimalInput(e.target.value))}
              />
            </Field>
          </div>
          {error ? <p className="text-sm text-[#8a3b2f]">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" className="flex-1" disabled={saving} onClick={() => save()}>
              {saving ? t("saving") : t("save")}
            </Button>
            <Button type="button" variant="danger" disabled={saving} onClick={() => remove()}>
              {t("delete")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
