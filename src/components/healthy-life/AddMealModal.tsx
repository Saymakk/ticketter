"use client";

import { useEffect, useRef, useState } from "react";
import { MEAL_TYPES } from "@/lib/healthy-life/dates";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useHlI18n, useT } from "@/lib/healthy-life/i18n";
import type { HlMessageKey } from "@/lib/healthy-life/i18n";
import { Button, Field, Modal, inputClass } from "@/components/healthy-life/ui";
import { OpenablePhoto } from "@/components/healthy-life/PhotoLightbox";
import { useHlToast } from "@/components/healthy-life/HlToast";

type Analysis = {
  name: string;
  description?: string | null;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  portionGrams?: number | null;
  confidence?: number | null;
};

function mealTypeLabelKey(id: string): HlMessageKey {
  if (id === "snack") return "mealTypes.snack";
  if (id === "breakfast" || id === "lunch" || id === "dinner") return `mealTypes.${id}`;
  return "meal.title";
}

export function AddMealModal({
  open,
  date,
  onClose,
  onSaved,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { fetch: hlFetch } = useHlRouting();
  const { locale } = useHlI18n();
  const t = useT();
  const toast = useHlToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [aiRawResponse, setAiRawResponse] = useState<string | null>(null);
  const [aiRecordId, setAiRecordId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mealType, setMealType] = useState("breakfast");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [portionGrams, setPortionGrams] = useState("");
  const [aiBaseline, setAiBaseline] = useState<Analysis | null>(null);

  function revokePreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }

  function clearAnalysisFields() {
    setPhotoPath(null);
    setUsedFallback(false);
    setFallbackReason(null);
    setAiRawResponse(null);
    setAiRecordId(null);
    setAiBaseline(null);
    setName("");
    setDescription("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setPortionGrams("");
  }

  function resetAll() {
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    setAnalyzing(false);
    revokePreview();
    setPreview(null);
    clearAnalysisFields();
    setMealType("breakfast");
    setError(null);
    setSaving(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  useEffect(() => {
    if (open) {
      resetAll();
    } else {
      analyzeAbortRef.current?.abort();
      revokePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opening
  }, [open]);

  async function onFile(file: File | null) {
    if (!file) return;

    analyzeAbortRef.current?.abort();
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    setError(null);
    clearAnalysisFields();
    revokePreview();
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreview(url);
    setAnalyzing(true);

    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("locale", locale);
      const res = await hlFetch("/api/meals/analyze", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("error"));

      const a = data.analysis as Analysis;
      setPhotoPath(data.photoPath);
      setUsedFallback(Boolean(data.usedFallback));
      setFallbackReason(data.fallbackReason ?? null);
      setAiRawResponse(data.aiRawResponse);
      setAiRecordId(typeof data.aiRecordId === "string" ? data.aiRecordId : null);
      setAiBaseline(a);
      setName(a.name || "");
      setDescription(a.description || "");
      setCalories(String(Math.round(a.calories || 0)));
      setProtein(a.protein != null ? String(Math.round(a.protein)) : "");
      setCarbs(a.carbs != null ? String(Math.round(a.carbs)) : "");
      setFat(a.fat != null ? String(Math.round(a.fat)) : "");
      setPortionGrams(a.portionGrams != null ? String(Math.round(a.portionGrams)) : "");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      if (analyzeAbortRef.current === controller) {
        analyzeAbortRef.current = null;
        setAnalyzing(false);
      }
    }
  }

  function isCorrected() {
    if (!aiBaseline) return Boolean(name || calories);
    return (
      name !== (aiBaseline.name || "") ||
      Number(calories) !== Math.round(aiBaseline.calories || 0) ||
      (protein || "") !== (aiBaseline.protein != null ? String(Math.round(aiBaseline.protein)) : "") ||
      (carbs || "") !== (aiBaseline.carbs != null ? String(Math.round(aiBaseline.carbs)) : "") ||
      (fat || "") !== (aiBaseline.fat != null ? String(Math.round(aiBaseline.fat)) : "")
    );
  }

  async function save() {
    if (!name.trim() || !calories) {
      setError(t("addMeal.needNameCalories"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await hlFetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          mealType,
          name: name.trim(),
          description: description.trim() || null,
          calories: Number(calories),
          protein: protein === "" ? null : Number(protein),
          carbs: carbs === "" ? null : Number(carbs),
          fat: fat === "" ? null : Number(fat),
          portionGrams: portionGrams === "" ? null : Number(portionGrams),
          photoPath,
          aiDetectedName: aiBaseline?.name ?? null,
          aiCalories: aiBaseline?.calories ?? null,
          aiConfidence: aiBaseline?.confidence ?? null,
          aiRawResponse,
          aiRecordId,
          aiUsedFallback: usedFallback,
          userCorrected: isCorrected(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("error"));
      }
      onSaved();
      toast.success(t("toast.mealSaved"));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("addMeal.title")}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">{t("addMeal.subtitle")}</p>

        {(preview || analyzing) && (
          <div className="relative overflow-hidden rounded-2xl border border-[var(--line)]">
            {preview ? (
              <OpenablePhoto src={preview} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-24 items-center justify-center bg-[var(--accent-soft)] text-sm text-[var(--muted)]">
                {t("addMeal.analyzingShort")}
              </div>
            )}
            {analyzing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 px-4 text-center">
                <p className="text-sm font-semibold text-white">{t("addMeal.analyzing")}</p>
                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded-xl bg-white/95 px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
                >
                  {t("addMeal.reset")}
                </button>
              </div>
            ) : null}
          </div>
        )}

        {usedFallback ? (
          <p className="text-sm text-[#8a3b2f]">
            {t("addMeal.fallback", { reason: fallbackReason ? `: ${fallbackReason}` : "" })}
          </p>
        ) : null}

        <Field label={t("meal.type")}>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt.id}
                type="button"
                onClick={() => setMealType(mt.id)}
                className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${
                  mealType === mt.id
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                }`}
              >
                {t(mealTypeLabelKey(mt.id))}
              </button>
            ))}
          </div>
          <p className="pt-1 text-xs text-[var(--muted)]">{t("addMeal.snackHint")}</p>
        </Field>

        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label={t("meal.name")}>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("addMeal.namePlaceholder")}
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={analyzing}
            className="mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-[0_10px_24px_-14px_var(--accent)] transition active:scale-95 disabled:opacity-60"
            aria-label={t("addMeal.photoLabel")}
            title={t("addMeal.photoLabel")}
          >
            {analyzing ? (
              <span className="h-4 w-4 animate-pulse rounded-full bg-white/80" />
            ) : (
              <CameraGlyph />
            )}
          </button>
        </div>

        <Field label={t("meal.description")}>
          <textarea
            className={`${inputClass} min-h-16 resize-none`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("addMeal.descriptionPlaceholder")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("meal.calories")}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="450"
            />
          </Field>
          <Field label={t("meal.portion")}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={portionGrams}
              onChange={(e) => setPortionGrams(e.target.value)}
              placeholder="300"
            />
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

        {aiBaseline?.confidence != null ? (
          <p className="text-xs text-[var(--muted)]">
            {t("addMeal.confidence", { pct: Math.round(aiBaseline.confidence * 100) })}
          </p>
        ) : null}

        {error ? <p className="text-sm text-[#8a3b2f]">{error}</p> : null}

        {analyzing ? (
          <Button type="button" variant="danger" className="w-full" onClick={resetAll}>
            {t("addMeal.resetRecognition")}
          </Button>
        ) : null}

        <Button type="button" className="w-full" disabled={analyzing || saving} onClick={() => save()}>
          {saving ? t("saving") : t("addMeal.saveMeal")}
        </Button>
      </div>
    </Modal>
  );
}

function CameraGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-1.6A1.5 1.5 0 0 1 10.9 4h2.2a1.5 1.5 0 0 1 1.2.4L15.5 6h2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9Z"
        stroke="white"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="13" r="3.2" stroke="white" strokeWidth="1.8" />
    </svg>
  );
}
