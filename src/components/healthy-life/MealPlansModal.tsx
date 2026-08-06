"use client";

import { useCallback, useEffect, useState } from "react";
import { todayKey, MEAL_TYPES } from "@/lib/healthy-life/dates";
import {
  describeRecurrence,
  parsePlanTimes,
  type IsoWeekday,
  type MedicationRecurrence,
  ISO_WEEKDAYS,
} from "@/lib/healthy-life/medications";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useHlI18n, useT, type HlMessageKey } from "@/lib/healthy-life/i18n";
import { Button, Field, Modal, inputClass } from "@/components/healthy-life/ui";
import { useHlToast } from "@/components/healthy-life/HlToast";
import { ensurePushPrompt } from "@/components/healthy-life/PushNotificationsCard";

export type MealPlan = {
  id: string;
  name: string;
  mealType: string;
  timesJson: string;
  recurrence?: string | null;
  weekdaysJson?: string | null;
  intervalDays?: number | null;
  anchorDate?: string | null;
  active: boolean;
  note: string | null;
};

const WEEKDAY_KEYS: Record<IsoWeekday, HlMessageKey> = {
  1: "med.weekday1",
  2: "med.weekday2",
  3: "med.weekday3",
  4: "med.weekday4",
  5: "med.weekday5",
  6: "med.weekday6",
  7: "med.weekday7",
};

function mealTypeLabelKey(id: string): HlMessageKey {
  if (id === "snack") return "mealTypes.snackLabel";
  if (id === "breakfast" || id === "lunch" || id === "dinner") return `mealTypes.${id}`;
  return "meal.title";
}

function formatPlanRecurrence(
  plan: MealPlan,
  t: (key: HlMessageKey, vars?: Record<string, string | number>) => string,
): string {
  const rec = describeRecurrence(plan);
  if (rec.type === "weekly") {
    const days =
      rec.weekdays.length > 0
        ? rec.weekdays.map((d) => t(WEEKDAY_KEYS[d])).join(", ")
        : "—";
    return t("med.recWeekly", { days });
  }
  if (rec.type === "interval") {
    const base = t("med.recInterval", { n: rec.intervalDays });
    return rec.anchorDate ? `${base} · ${t("med.recFrom", { date: rec.anchorDate })}` : base;
  }
  return t("med.recDaily");
}

export function MealPlansModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { fetch: hlFetch } = useHlRouting();
  const { locale } = useHlI18n();
  const t = useT();
  const toast = useHlToast();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState("breakfast");
  const [timeDraft, setTimeDraft] = useState("08:00");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [recurrence, setRecurrence] = useState<MedicationRecurrence>("daily");
  const [weekdays, setWeekdays] = useState<IsoWeekday[]>([]);
  const [intervalDays, setIntervalDays] = useState(2);
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hlFetch("/api/meal-plans");
      const data = await res.json();
      if (res.ok) setPlans(data.plans || []);
    } finally {
      setLoading(false);
    }
  }, [hlFetch]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function resetForm() {
    setName("");
    setMealType("breakfast");
    setTimes(["08:00"]);
    setTimeDraft("08:00");
    setRecurrence("daily");
    setWeekdays([]);
    setIntervalDays(2);
    setAnchorDate(todayKey());
    setError(null);
  }

  function toggleWeekday(day: IsoWeekday) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function createPlan() {
    if (!name.trim() || times.length === 0) {
      setError(t("mealSchedule.needTime"));
      return;
    }
    if (recurrence === "weekly" && weekdays.length === 0) {
      setError(t("med.needWeekdays"));
      return;
    }
    if (recurrence === "interval" && intervalDays < 1) {
      setError(t("med.needInterval"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await hlFetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mealType,
          times,
          recurrence,
          weekdays: recurrence === "weekly" ? weekdays : [],
          intervalDays: recurrence === "interval" ? intervalDays : 1,
          anchorDate: recurrence === "interval" ? anchorDate : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("error"));
      resetForm();
      await load();
      onChanged();
      toast.success(t("toast.mealPlanSaved"));
      void ensurePushPrompt({ hlFetch, t, toast, locale });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan: MealPlan) {
    await hlFetch("/api/meal-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: plan.id, active: !plan.active }),
    });
    await load();
    onChanged();
    toast.success(t("toast.mealPlanSaved"));
  }

  async function removePlan(id: string) {
    if (!confirm(t("mealSchedule.deleteConfirm"))) return;
    await hlFetch(`/api/meal-plans?id=${id}`, { method: "DELETE" });
    await load();
    onChanged();
    toast.success(t("toast.deleted"));
  }

  return (
    <Modal open={open} onClose={onClose} title={t("mealSchedule.title")}>
      <p className="mb-4 text-sm text-[var(--muted)]">{t("mealSchedule.hint")}</p>

      <div className="mb-5 space-y-3 rounded-2xl border border-[var(--line)] bg-white/60 p-3">
        <Field label={t("meal.name")}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("mealSchedule.namePlaceholder")}
          />
        </Field>

        <Field label={t("meal.type")}>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt.id}
                type="button"
                onClick={() => {
                  setMealType(mt.id);
                  if (!name.trim()) {
                    setName(t(mealTypeLabelKey(mt.id)));
                  }
                }}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  mealType === mt.id
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                }`}
              >
                {t(mealTypeLabelKey(mt.id))}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t("med.frequency")}>
          <select
            className={inputClass}
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as MedicationRecurrence)}
          >
            <option value="daily">{t("med.freqDaily")}</option>
            <option value="weekly">{t("med.freqWeekly")}</option>
            <option value="interval">{t("med.freqInterval")}</option>
          </select>
        </Field>

        {recurrence === "weekly" ? (
          <Field label={t("med.weekdays")}>
            <div className="flex flex-wrap gap-2">
              {ISO_WEEKDAYS.map((day) => {
                const on = weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                      on
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                    }`}
                  >
                    {t(WEEKDAY_KEYS[day])}
                  </button>
                );
              })}
            </div>
          </Field>
        ) : null}

        {recurrence === "interval" ? (
          <>
            <Field label={t("med.intervalDays")}>
              <input
                className={inputClass}
                type="number"
                min={1}
                max={365}
                value={intervalDays}
                onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
            <Field label={t("med.anchorDate")}>
              <input
                className={inputClass}
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value || todayKey())}
              />
            </Field>
          </>
        ) : null}

        <Field label={t("med.times")}>
          <div className="flex flex-wrap gap-2">
            {times.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setTimes((prev) => prev.filter((x) => x !== time))}
                className="rounded-xl bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-ink)]"
              >
                {time} ×
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              type="time"
              value={timeDraft}
              onChange={(e) => setTimeDraft(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!timeDraft) return;
                setTimes((prev) => (prev.includes(timeDraft) ? prev : [...prev, timeDraft].sort()));
              }}
            >
              +
            </Button>
          </div>
        </Field>

        {error ? <p className="text-sm text-[#8a3b2f]">{error}</p> : null}
        <Button type="button" className="w-full" disabled={saving} onClick={() => createPlan()}>
          {t("mealSchedule.add")}
        </Button>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-[var(--muted)]">{t("loading")}</p>
      ) : null}

      <div className="space-y-2">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-3 ${
              plan.active ? "border-[var(--line)] bg-white/70" : "border-dashed border-[var(--line)] opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold text-[var(--ink)]">{plan.name}</p>
                <p className="break-words text-xs text-[var(--muted)]">
                  {t(mealTypeLabelKey(plan.mealType))}
                  {" · "}
                  {formatPlanRecurrence(plan, t)}
                  {" · "}
                  {parsePlanTimes(plan.timesJson).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  className="text-xs text-[var(--accent)]"
                  onClick={() => toggleActive(plan)}
                >
                  {plan.active ? t("med.disable") : t("med.enable")}
                </button>
                <button
                  type="button"
                  className="text-xs text-[#8a3b2f]"
                  onClick={() => removePlan(plan.id)}
                >
                  {t("delete").toLowerCase()}
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && plans.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("mealSchedule.empty")}</p>
        ) : null}
      </div>
    </Modal>
  );
}
