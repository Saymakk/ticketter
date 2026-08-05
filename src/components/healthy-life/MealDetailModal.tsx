"use client";

import { useEffect, useState } from "react";
import { MEAL_TYPES } from "@/lib/healthy-life/dates";
import { formatKcal } from "@/lib/healthy-life/format";
import { isWithinEditWindow } from "@/lib/healthy-life/edit-window";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useT } from "@/lib/healthy-life/i18n";
import type { HlMessageKey } from "@/lib/healthy-life/i18n";
import { Button, Field, Modal, inputClass } from "@/components/healthy-life/ui";
import { OpenablePhoto } from "@/components/healthy-life/PhotoLightbox";

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
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { fetch: hlFetch } = useHlRouting();
  const t = useT();
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
    setCalories(String(Math.round(meal.calories)));
    setProtein(meal.protein != null ? String(Math.round(meal.protein)) : "");
    setCarbs(meal.carbs != null ? String(Math.round(meal.carbs)) : "");
    setFat(meal.fat != null ? String(Math.round(meal.fat)) : "");
    setPortionGrams(meal.portionGrams != null ? String(Math.round(meal.portionGrams)) : "");
    setMealType(meal.mealType);
    setError(null);
  }, [meal]);

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
          calories: Number(calories),
          protein: protein === "" ? null : Number(protein),
          carbs: carbs === "" ? null : Number(carbs),
          fat: fat === "" ? null : Number(fat),
          portionGrams: portionGrams === "" ? null : Number(portionGrams),
          mealType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("meal.saveFailed"));
      onSaved();
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
      onDeleted();
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
            {meal.protein != null ? <span>{t("day.protein")} {Math.round(meal.protein)}g</span> : null}
            {meal.carbs != null ? <span>{t("day.carbs")} {Math.round(meal.carbs)}g</span> : null}
            {meal.fat != null ? <span>{t("day.fat")} {Math.round(meal.fat)}g</span> : null}
            {meal.portionGrams != null ? (
              <span>
                {t("meal.portion")} {Math.round(meal.portionGrams)}g
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
              <input className={inputClass} inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} />
            </Field>
            <Field label={t("meal.portion")}>
              <input className={inputClass} inputMode="decimal" value={portionGrams} onChange={(e) => setPortionGrams(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("meal.proteins")}>
              <input className={inputClass} inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </Field>
            <Field label={t("meal.carbs")}>
              <input className={inputClass} inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </Field>
            <Field label={t("meal.fats")}>
              <input className={inputClass} inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
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
