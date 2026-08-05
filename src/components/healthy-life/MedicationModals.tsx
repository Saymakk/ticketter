"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { todayKey } from "@/lib/healthy-life/dates";
import { isWithinEditWindow } from "@/lib/healthy-life/edit-window";
import {
  describeRecurrence,
  isPlanScheduledOnDate,
  nowTimeKey,
  parsePlanTimes,
  type IsoWeekday,
  type MedicationRecurrence,
  type ScheduleCompliance,
  ISO_WEEKDAYS,
} from "@/lib/healthy-life/medications";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useT, type HlMessageKey } from "@/lib/healthy-life/i18n";
import { Button, Field, Modal, medInputClass } from "@/components/healthy-life/ui";
import { OpenablePhoto } from "@/components/healthy-life/PhotoLightbox";

export type MedicationIntake = {
  id: string;
  name: string;
  dosage: string | null;
  reason: string | null;
  photoPath: string | null;
  scheduledTime: string | null;
  takenTime: string;
  planId: string | null;
  createdAt: string;
  date: string;
};

export type MedicationPlan = {
  id: string;
  name: string;
  dosage: string | null;
  reason: string | null;
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

function formatPlanRecurrence(
  plan: MedicationPlan,
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

function complianceStatusKey(status: ScheduleCompliance["status"]): HlMessageKey {
  switch (status) {
    case "taken_on_time":
      return "med.statusOnTime";
    case "taken_late":
      return "med.statusLate";
    case "missed":
      return "med.statusMissed";
    case "pending":
      return "med.statusPending";
  }
}

export function MedicationDetailModal({
  intake,
  readOnly,
  onClose,
  onChanged,
}: {
  intake: MedicationIntake | null;
  readOnly?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { fetch: hlFetch } = useHlRouting();
  const t = useT();
  const editable = Boolean(intake && !readOnly && isWithinEditWindow(intake.createdAt));
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [reason, setReason] = useState("");
  const [takenTime, setTakenTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!intake) return;
    setName(intake.name);
    setDosage(intake.dosage || "");
    setReason(intake.reason || "");
    setTakenTime(intake.takenTime);
    setError(null);
  }, [intake]);

  if (!intake) return null;

  async function save() {
    if (!editable) return;
    setSaving(true);
    setError(null);
    try {
      const res = await hlFetch("/api/medications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: intake!.id,
          name: name.trim(),
          dosage: dosage.trim() || null,
          reason: reason.trim() || null,
          takenTime,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("error"));
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editable) return;
    if (!confirm(t("med.deleteIntakeConfirm"))) return;
    const res = await hlFetch(`/api/medications?id=${intake!.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || t("error"));
      return;
    }
    onChanged();
    onClose();
  }

  return (
    <Modal open={Boolean(intake)} onClose={onClose} title={intake.name} tone="med">
      {intake.photoPath ? (
        <div className="mb-4">
          <OpenablePhoto
            src={intake.photoPath}
            alt={intake.name}
            className="max-h-72 w-full object-cover"
          />
        </div>
      ) : null}

      {!editable ? (
        <div className="space-y-2 text-sm">
          {intake.dosage ? (
            <p className="text-[var(--med-accent-ink)]">
              {t("med.dosage")}: {intake.dosage}
            </p>
          ) : null}
          {intake.reason ? (
            <p className="text-[var(--muted)]">
              {t("med.reason")}: {intake.reason}
            </p>
          ) : null}
          <p className="text-[var(--muted)]">
            {t("med.taken")} {intake.takenTime}
          </p>
          {intake.scheduledTime ? (
            <p className="text-[var(--muted)]">
              {t("med.scheduled")}: {intake.scheduledTime}
            </p>
          ) : null}
          {readOnly ? null : (
            <p className="pt-2 text-xs text-[var(--muted)]">{t("med.editWindow")}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Field label={t("med.name")}>
            <input className={medInputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("med.dosage")}>
            <input
              className={medInputClass}
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder={t("med.dosagePlaceholder")}
            />
          </Field>
          <Field label={t("med.reason")}>
            <input className={medInputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label={t("med.takenTime")}>
            <input className={medInputClass} type="time" value={takenTime} onChange={(e) => setTakenTime(e.target.value)} />
          </Field>
          {error ? <p className="text-sm text-[#8a3b2f]">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="med" className="flex-1" disabled={saving} onClick={() => save()}>
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

export function AddMedicationModal({
  open,
  date,
  plans,
  prefill,
  onClose,
  onSaved,
}: {
  open: boolean;
  date: string;
  plans: MedicationPlan[];
  prefill?: { planId?: string; scheduledTime?: string; name?: string; dosage?: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { fetch: hlFetch } = useHlRouting();
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [reason, setReason] = useState("");
  const [takenTime, setTakenTime] = useState(nowTimeKey());
  const [planId, setPlanId] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(prefill?.name || "");
    setDosage(prefill?.dosage || "");
    setReason("");
    setTakenTime(nowTimeKey());
    setPlanId(prefill?.planId || "");
    setScheduledTime(prefill?.scheduledTime || "");
    setPhotoPath(null);
    setPreview(null);
    setError(null);
  }, [open, prefill]);

  const plansForDay = plans.filter((p) => isPlanScheduledOnDate(p, date));
  const selectedPlan = plansForDay.find((p) => p.id === planId) ?? plans.find((p) => p.id === planId);
  const planSlots = selectedPlan ? parsePlanTimes(selectedPlan.timesJson) : [];

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await hlFetch("/api/medications/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("error"));
      setPhotoPath(data.photoPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setError(t("med.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await hlFetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name: name.trim(),
          dosage: dosage.trim() || null,
          reason: reason.trim() || null,
          photoPath,
          planId: planId || null,
          scheduledTime: scheduledTime || null,
          takenTime,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("error"));
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("med.addTitle")} tone="med">
      <div className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />

        {(preview || photoPath) && (
          <OpenablePhoto
            src={preview || photoPath || ""}
            alt=""
            className="h-36 w-full object-cover"
          />
        )}

        <Button type="button" variant="med-secondary" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? t("med.uploading") : photoPath ? t("med.replacePhoto") : t("med.addPhoto")}
        </Button>

        {plansForDay.length > 0 ? (
          <Field label={t("med.fromSchedule")}>
            <select
              className={medInputClass}
              value={planId}
              onChange={(e) => {
                const id = e.target.value;
                setPlanId(id);
                const plan = plansForDay.find((p) => p.id === id);
                if (plan) {
                  setName(plan.name);
                  setDosage(plan.dosage || "");
                  const slots = parsePlanTimes(plan.timesJson);
                  setScheduledTime(slots[0] || "");
                } else {
                  setScheduledTime("");
                }
              }}
            >
              <option value="">{t("med.noSchedule")}</option>
              {plansForDay.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.dosage ? ` · ${p.dosage}` : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {planSlots.length > 0 ? (
          <Field label={t("med.scheduleSlot")}>
            <div className="flex flex-wrap gap-2">
              {planSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setScheduledTime(slot)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    scheduledTime === slot
                      ? "bg-[var(--med-accent)] text-white"
                      : "bg-[var(--med-soft)] text-[var(--med-accent-ink)]"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </Field>
        ) : null}

        <Field label={t("med.name")}>
          <input className={medInputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("med.dosage")}>
          <input
            className={medInputClass}
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder={t("med.dosagePlaceholder")}
          />
        </Field>
        <Field label={t("med.reason")}>
          <input
            className={medInputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("med.reasonPlaceholder")}
          />
        </Field>
        <Field label={t("med.takenTime")}>
          <input className={medInputClass} type="time" value={takenTime} onChange={(e) => setTakenTime(e.target.value)} />
        </Field>

        {error ? <p className="text-sm text-[#8a3b2f]">{error}</p> : null}

        <Button type="button" variant="med" className="w-full" disabled={saving || uploading} onClick={() => save()}>
          {saving ? t("saving") : t("med.markTaken")}
        </Button>
      </div>
    </Modal>
  );
}

export function MedicationPlansModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { fetch: hlFetch } = useHlRouting();
  const t = useT();
  const [plans, setPlans] = useState<MedicationPlan[]>([]);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [reason, setReason] = useState("");
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
      const res = await hlFetch("/api/medication-plans");
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
    setDosage("");
    setReason("");
    setTimes(["08:00"]);
    setRecurrence("daily");
    setWeekdays([]);
    setIntervalDays(2);
    setAnchorDate(todayKey());
  }

  function toggleWeekday(day: IsoWeekday) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function createPlan() {
    if (!name.trim() || times.length === 0) {
      setError(t("med.needTime"));
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
      const res = await hlFetch("/api/medication-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          dosage: dosage.trim() || null,
          reason: reason.trim() || null,
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
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan: MedicationPlan) {
    await hlFetch("/api/medication-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: plan.id, active: !plan.active }),
    });
    await load();
    onChanged();
  }

  async function removePlan(id: string) {
    if (!confirm(t("med.deletePlanConfirm"))) return;
    await hlFetch(`/api/medication-plans?id=${id}`, { method: "DELETE" });
    await load();
    onChanged();
  }

  return (
    <Modal open={open} onClose={onClose} title={t("med.plansTitle")} tone="med">
      <p className="mb-4 text-sm text-[var(--muted)]">{t("med.plansHint")}</p>

      <div className="mb-5 space-y-3 rounded-2xl border border-[var(--med-line)] bg-white/60 p-3">
        <Field label={t("med.name")}>
          <input className={medInputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("med.dosage")}>
          <input className={medInputClass} value={dosage} onChange={(e) => setDosage(e.target.value)} />
        </Field>
        <Field label={t("med.reason")}>
          <input className={medInputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label={t("med.frequency")}>
          <select
            className={medInputClass}
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
                        ? "bg-[var(--med-accent)] text-white"
                        : "bg-[var(--med-soft)] text-[var(--med-accent-ink)]"
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
                className={medInputClass}
                type="number"
                min={1}
                max={365}
                value={intervalDays}
                onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
            <Field label={t("med.anchorDate")}>
              <input
                className={medInputClass}
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
                className="rounded-xl bg-[var(--med-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--med-accent-ink)]"
              >
                {time} ×
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className={medInputClass}
              type="time"
              value={timeDraft}
              onChange={(e) => setTimeDraft(e.target.value)}
            />
            <Button
              type="button"
              variant="med-secondary"
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
        <Button type="button" variant="med" className="w-full" disabled={saving} onClick={() => createPlan()}>
          {t("med.addToSchedule")}
        </Button>
      </div>

      {loading ? <p className="text-sm text-[var(--muted)]">{t("loading")}</p> : null}

      <div className="space-y-2">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-3 ${plan.active ? "border-[var(--med-line)] bg-white/70" : "border-dashed border-[var(--med-line)] opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--med-accent-ink)]">{plan.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {formatPlanRecurrence(plan, t)}
                  {" · "}
                  {parsePlanTimes(plan.timesJson).join(" · ")}
                  {plan.dosage ? ` · ${plan.dosage}` : ""}
                </p>
                {plan.reason ? <p className="mt-1 text-xs text-[var(--muted)]">{plan.reason}</p> : null}
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" className="text-xs text-[var(--med-accent)]" onClick={() => toggleActive(plan)}>
                  {plan.active ? t("med.disable") : t("med.enable")}
                </button>
                <button type="button" className="text-xs text-[#8a3b2f]" onClick={() => removePlan(plan.id)}>
                  {t("delete").toLowerCase()}
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && plans.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("med.emptyPlans")}</p>
        ) : null}
      </div>
    </Modal>
  );
}

export function ComplianceList({
  compliance,
  onTake,
  readOnly,
}: {
  compliance: ScheduleCompliance[];
  onTake?: (row: ScheduleCompliance) => void;
  readOnly?: boolean;
}) {
  const t = useT();
  if (compliance.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-[var(--med-accent)] uppercase">{t("med.compliance")}</p>
      {compliance.map((row) => (
        <div
          key={`${row.planId}-${row.scheduledTime}`}
          className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm"
        >
          <div>
            <p className="font-medium text-[var(--med-accent-ink)]">
              {row.scheduledTime} · {row.name}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {t(complianceStatusKey(row.status))}
              {row.takenTime ? ` · ${row.takenTime}` : ""}
            </p>
          </div>
          {!readOnly && (row.status === "missed" || row.status === "pending") && onTake ? (
            <button
              type="button"
              onClick={() => onTake(row)}
              className="rounded-xl bg-[var(--med-accent)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              {t("med.took")}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
