"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MEAL_TYPES, todayKey } from "@/lib/healthy-life/dates";
import { Button, Card, Field, PageHeader, Shell, inputClass } from "@/components/healthy-life/ui";

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

export function AddMealView() {
  const router = useRouter();
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
    setAiBaseline(null);
    setName("");
    setDescription("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setPortionGrams("");
  }

  function resetRecognition() {
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    setAnalyzing(false);
    revokePreview();
    setPreview(null);
    clearAnalysisFields();
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

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
      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");

      const a = data.analysis as Analysis;
      setPhotoPath(data.photoPath);
      setUsedFallback(Boolean(data.usedFallback));
      setFallbackReason(data.fallbackReason ?? null);
      setAiRawResponse(data.aiRawResponse);
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
      setError(e instanceof Error ? e.message : "Ошибка");
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
      setError("Укажите название и калории");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayKey(),
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
          userCorrected: isCorrected(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Не удалось сохранить");
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Приёмы пищи"
        subtitle="Можно добавить несколько записей за день — в том числе много перекусов."
        action={
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={analyzing}
            aria-label="Сфотографировать еду"
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-[0_10px_24px_-14px_var(--accent)] transition active:scale-95 disabled:opacity-60"
          >
            {analyzing ? (
              <span className="h-4 w-4 animate-pulse rounded-full bg-white/80" />
            ) : (
              <CameraGlyph />
            )}
          </button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      <div className="space-y-4">
        {(preview || analyzing) && (
          <Card className="relative overflow-hidden p-0">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Превью блюда" className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-28 items-center justify-center bg-[var(--accent-soft)] text-sm text-[var(--muted)]">
                Анализируем фото…
              </div>
            )}
            {analyzing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 px-4 text-center">
                <p className="text-sm font-semibold text-white">Распознаём еду…</p>
                <button
                  type="button"
                  onClick={resetRecognition}
                  className="rounded-xl bg-white/95 px-4 py-2 text-sm font-semibold text-[var(--ink)] shadow-sm active:scale-[0.98]"
                >
                  Сбросить
                </button>
              </div>
            ) : null}
          </Card>
        )}

        {usedFallback ? (
          <p className="text-sm text-[#8a3b2f]">
            AI недоступен{fallbackReason ? `: ${fallbackReason}` : ""}. Показана примерная оценка —
            отредактируйте поля вручную.
          </p>
        ) : null}

        <Card className="space-y-3">
          <Field label="Тип приёма пищи">
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMealType(t.id)}
                  className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${
                    mealType === t.id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="pt-1 text-xs text-[var(--muted)]">
              Перекусов за день можно добавить сколько угодно — каждый раз жмите «Добавить перекус».
            </p>
          </Field>

          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Название">
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например, овсянка с ягодами"
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--accent)]"
              aria-label="Фото"
              title="Фото"
            >
              <CameraGlyph dark />
            </button>
          </div>

          <Field label="Описание">
            <textarea
              className={`${inputClass} min-h-20 resize-none`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Что именно на тарелке"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Калории">
              <input
                className={inputClass}
                inputMode="decimal"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="450"
              />
            </Field>
            <Field label="Порция, г">
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
            <Field label="Белки">
              <input className={inputClass} inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </Field>
            <Field label="Углеводы">
              <input className={inputClass} inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </Field>
            <Field label="Жиры">
              <input className={inputClass} inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
            </Field>
          </div>

          {aiBaseline?.confidence != null ? (
            <p className="text-xs text-[var(--muted)]">
              Уверенность ИИ: {Math.round(aiBaseline.confidence * 100)}%. Можно скорректировать любые поля.
            </p>
          ) : null}

          {error ? <p className="text-sm text-[#8a3b2f]">{error}</p> : null}

          {analyzing ? (
            <Button type="button" variant="danger" className="w-full" onClick={resetRecognition}>
              Сбросить распознавание
            </Button>
          ) : null}

          <Button type="button" className="w-full" disabled={analyzing || saving} onClick={() => save()}>
            {saving ? "Сохраняем…" : "Сохранить приём пищи"}
          </Button>
        </Card>
      </div>
    </Shell>
  );
}

function CameraGlyph({ dark }: { dark?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-1.6A1.5 1.5 0 0 1 10.9 4h2.2a1.5 1.5 0 0 1 1.2.4L15.5 6h2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9Z"
        stroke={dark ? "currentColor" : "white"}
        strokeWidth="1.8"
      />
      <circle cx="12" cy="13" r="3.2" stroke={dark ? "currentColor" : "white"} strokeWidth="1.8" />
    </svg>
  );
}
