"use client";

import { useCallback, useEffect, useState } from "react";
import { todayKey } from "@/lib/healthy-life/dates";
import { formatKg } from "@/lib/healthy-life/format";
import { Button, Card, Field, PageHeader, Shell, inputClass } from "@/components/healthy-life/ui";

type WeightEntry = {
  id: string;
  date: string;
  weightKg: number;
  note: string | null;
};

export function WeightView() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayKey());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/weight");
      const data = await res.json();
      setEntries(data.entries || []);
      setTargetWeightKg(data.profile?.targetWeightKg ?? null);
      setWeightKg((current) => current || (data.entries?.[0] ? String(data.entries[0].weightKg) : ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/weight", {
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
      await load();
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
          <div className="mt-2 flex gap-4 text-sm text-[var(--muted)]">
            <span>Цель: {targetWeightKg != null ? formatKg(targetWeightKg) : "не задана"}</span>
            {delta != null ? (
              <span>
                За период: {delta > 0 ? "+" : ""}
                {delta.toFixed(1)} кг
              </span>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-3">
          <Field label="Дата">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
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
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="утро, натощак" />
          </Field>
          {error ? <p className="text-sm text-[#8a3b2f]">{error}</p> : null}
          <Button type="button" className="w-full" disabled={saving} onClick={save}>
            {saving ? "Сохраняем…" : "Сохранить вес"}
          </Button>
        </Card>

        <div className="space-y-2">
          <h2 className="font-display text-xl">История</h2>
          {loading ? <p className="text-[var(--muted)]">Загрузка…</p> : null}
          {!loading && entries.length === 0 ? (
            <Card>
              <p className="text-[var(--muted)]">Записей пока нет.</p>
            </Card>
          ) : null}
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
      </div>
    </Shell>
  );
}
