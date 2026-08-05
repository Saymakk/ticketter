"use client";

import { useCallback, useEffect, useState } from "react";
import { todayKey } from "@/lib/healthy-life/dates";
import { formatKg } from "@/lib/healthy-life/format";
import {
  cacheKey,
  invalidateRelatedCaches,
  isCacheStale,
  readCache,
  writeCache,
} from "@/lib/healthy-life/app-cache";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useT } from "@/lib/healthy-life/i18n";
import { Button, Card, Field, PageHeader, Shell, inputClass, LoadingText } from "@/components/healthy-life/ui";
import { useHlToast } from "@/components/healthy-life/HlToast";

type WeightEntry = {
  id: string;
  date: string;
  weightKg: number;
  note: string | null;
};

type WeightPayload = {
  entries: WeightEntry[];
  profile: { targetWeightKg: number | null } | null;
};

const WEIGHT_KEY = cacheKey("weight", "list");

export function WeightView() {
  const { fetch: hlFetch } = useHlRouting();
  const t = useT();
  const toast = useHlToast();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayKey());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPayload = useCallback((data: WeightPayload) => {
    setEntries(data.entries || []);
    setTargetWeightKg(data.profile?.targetWeightKg ?? null);
    setWeightKg((current) => current || (data.entries?.[0] ? String(data.entries[0].weightKg) : ""));
  }, []);

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      const cached = readCache<WeightPayload>(WEIGHT_KEY);
      if (cached) {
        applyPayload(cached.data);
        setLoading(false);
        if (!opts?.force && !isCacheStale(cached)) return;
      } else {
        setLoading(true);
      }

      try {
        const res = await hlFetch("/api/weight");
        const data = await res.json();
        const payload: WeightPayload = {
          entries: data.entries || [],
          profile: data.profile ?? null,
        };
        applyPayload(payload);
        writeCache(WEIGHT_KEY, payload);
      } finally {
        setLoading(false);
      }
    },
    [applyPayload, hlFetch],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await hlFetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          weightKg: Number(weightKg),
          note: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setNote("");
      invalidateRelatedCaches({ day: date });
      await load({ force: true });
      toast.success(t("toast.weightSaved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const latest = entries[0];
  const oldest = entries[entries.length - 1];
  const delta =
    latest && oldest && entries.length > 1 ? latest.weightKg - oldest.weightKg : null;

  return (
    <Shell>
      <PageHeader title="Вес" subtitle="Отмечайте вес каждый день — так советы станут точнее." />

      <div className="space-y-4">
        <Card className="bg-gradient-to-br from-[#eef4ea] to-[var(--surface)]">
          <p className="text-sm text-[var(--muted)]">Текущий</p>
          <p className="font-display text-4xl">
            {latest ? formatKg(latest.weightKg) : "—"}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Цель: {targetWeightKg != null ? formatKg(targetWeightKg) : "не задана"}
            {delta != null ? ` · Δ ${delta > 0 ? "+" : ""}${delta.toFixed(1)} кг` : ""}
          </p>
        </Card>

        {error ? <p className="text-sm text-[#8a3b2f]">{error}</p> : null}

        <Card className="space-y-3">
          <Field label="Дата">
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Вес, кг">
            <input
              className={inputClass}
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="72.5"
            />
          </Field>
          <Field label="Заметка">
            <input
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Button type="button" className="w-full" disabled={saving} onClick={save}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
        </Card>

        {loading && entries.length === 0 ? (
          <LoadingText label={t("loading")} />
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <Card key={entry.id} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{entry.date}</p>
                  {entry.note ? <p className="text-sm text-[var(--muted)]">{entry.note}</p> : null}
                </div>
                <p className="font-display text-xl">{formatKg(entry.weightKg)}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
