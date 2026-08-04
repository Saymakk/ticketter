"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/healthy-life/supabase/client";
import { Button, Card, Field, PageHeader, Shell, inputClass } from "@/components/healthy-life/ui";

type Profile = {
  id: string;
  name: string;
  dailyCalorieGoal: number;
  targetWeightKg: number | null;
  heightCm: number | null;
};

export function ProfileView() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState("2000");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (r) => {
        if (!r.ok) throw new Error("Не удалось загрузить профиль");
        return r.json();
      })
      .then((p: Profile) => {
        setProfile(p);
        setName(p.name);
        setDailyCalorieGoal(String(p.dailyCalorieGoal));
        setTargetWeightKg(p.targetWeightKg != null ? String(p.targetWeightKg) : "");
        setHeightCm(p.heightCm != null ? String(p.heightCm) : "");
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : "Ошибка"));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dailyCalorieGoal: Number(dailyCalorieGoal),
          targetWeightKg: targetWeightKg === "" ? null : Number(targetWeightKg),
          heightCm: heightCm === "" ? null : Number(heightCm),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setProfile(data);
      setMessage("Сохранено");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Shell>
      <PageHeader title="Профиль" subtitle="Цели по калориям и весу для дневника и советов." />

      <Card className="space-y-3">
        <Field label="Имя">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Цель калорий в день">
          <input
            className={inputClass}
            inputMode="numeric"
            value={dailyCalorieGoal}
            onChange={(e) => setDailyCalorieGoal(e.target.value)}
          />
        </Field>
        <Field label="Целевой вес, кг">
          <input
            className={inputClass}
            inputMode="decimal"
            value={targetWeightKg}
            onChange={(e) => setTargetWeightKg(e.target.value)}
          />
        </Field>
        <Field label="Рост, см">
          <input
            className={inputClass}
            inputMode="decimal"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </Field>
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
        <Button type="button" className="w-full" disabled={saving || !profile} onClick={save}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={logout}>
          Выйти
        </Button>
      </Card>

      <Card className="mt-4 space-y-2 text-sm text-[var(--muted)]">
        <p className="font-semibold text-[var(--ink)]">Как это работает</p>
        <p>1. Фото сохраняется в Supabase Storage и анализируется OpenAI Vision.</p>
        <p>2. Можно добавить несколько приёмов пищи и перекусов за день.</p>
        <p>3. Советы учитывают питание, вес и тренировки.</p>
      </Card>
    </Shell>
  );
}
