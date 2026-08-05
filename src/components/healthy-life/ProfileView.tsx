"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/healthy-life/supabase/client";
import { useHlToast } from "@/components/healthy-life/HlToast";
import {
  clearAppCaches,
  invalidateRelatedCaches,
  isCacheStale,
  readCache,
  writeCache,
} from "@/lib/healthy-life/app-cache";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useHlI18n, useT } from "@/lib/healthy-life/i18n";
import type { HlLocale } from "@/lib/healthy-life/i18n";
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
  const { path, fetch: hlFetch } = useHlRouting();
  const { locale, setLocale, locales, meta } = useHlI18n();
  const t = useT();
  const toast = useHlToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState("2000");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  function apply(p: Profile) {
    setProfile(p);
    setName(p.name);
    setDailyCalorieGoal(String(p.dailyCalorieGoal));
    setTargetWeightKg(p.targetWeightKg != null ? String(p.targetWeightKg) : "");
    setHeightCm(p.heightCm != null ? String(p.heightCm) : "");
  }

  useEffect(() => {
    const cached = readCache<Profile>("profile");
    if (cached) apply(cached.data);
    if (cached && !isCacheStale(cached)) return;

    hlFetch("/api/profile")
      .then(async (r) => {
        if (!r.ok) throw new Error(t("error"));
        return r.json();
      })
      .then((p: Profile) => {
        apply(p);
        writeCache("profile", p);
      })
      .catch((e) => {
        if (!cached) setMessage(e instanceof Error ? e.message : t("error"));
      });
  }, [hlFetch, t]);

  useEffect(() => {
    if (!langOpen) return;
    function onDoc(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLangOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  function cancelEdit() {
    if (profile) apply(profile);
    setEditing(false);
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await hlFetch("/api/profile", {
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
      if (!res.ok) throw new Error(data.error || t("error"));
      apply(data as Profile);
      writeCache("profile", data as Profile);
      invalidateRelatedCaches({ progress: true, advice: true, weight: true, profile: false });
      toast.success(t("toast.profileSaved"));
      setMessage(null);
      setEditing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("error");
      setMessage(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    clearAppCaches();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace(path("/login"));
    router.refresh();
  }

  const displayName = name.trim() || "—";
  const displayGoal = dailyCalorieGoal || "—";
  const displayWeight = targetWeightKg.trim() ? targetWeightKg : "—";
  const displayHeight = heightCm.trim() ? heightCm : "—";

  return (
    <Shell>
      <PageHeader
        title={t("profile.title")}
        subtitle={t("profile.languageHint")}
        action={
          <div ref={langRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] shadow-sm touch-manipulation"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label={t("profile.language")}
              title={t("profile.language")}
            >
              <LangGlyph />
              <span className="max-w-[7.5rem] truncate">{meta[locale].nativeName}</span>
              <span className="text-[10px] text-[var(--muted)]" aria-hidden>
                {langOpen ? "▴" : "▾"}
              </span>
            </button>
            {langOpen ? (
              <ul
                role="listbox"
                aria-label={t("profile.language")}
                className="absolute top-[calc(100%+0.35rem)] right-0 z-30 max-h-72 min-w-[11rem] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[0_16px_40px_-20px_rgba(28,55,42,0.55)]"
              >
                {locales.map((loc) => {
                  const active = loc === locale;
                  return (
                    <li key={loc} role="option" aria-selected={active}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm touch-manipulation ${
                          active
                            ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]"
                            : "text-[var(--ink)] hover:bg-[var(--bg-elevated)]"
                        }`}
                        onClick={() => {
                          setLocale(loc as HlLocale);
                          setLangOpen(false);
                          toast.success(t("toast.languageChanged"));
                        }}
                      >
                        <span>{meta[loc].nativeName}</span>
                        {active ? <span aria-hidden>✓</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        }
      />

      <Card className="relative space-y-3">
        <button
          type="button"
          onClick={() => (editing ? cancelEdit() : setEditing(true))}
          disabled={!profile}
          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 touch-manipulation"
          aria-label={editing ? t("profile.cancelEdit") : t("profile.edit")}
          title={editing ? t("profile.cancelEdit") : t("profile.edit")}
        >
          {editing ? <CloseGlyph /> : <EditGlyph />}
        </button>

        {editing ? (
          <>
            <Field label={t("profile.name")}>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={t("profile.calorieGoal")}>
              <input
                className={inputClass}
                inputMode="numeric"
                value={dailyCalorieGoal}
                onChange={(e) => setDailyCalorieGoal(e.target.value)}
              />
            </Field>
            <Field label={t("profile.targetWeight")}>
              <input
                className={inputClass}
                inputMode="decimal"
                value={targetWeightKg}
                onChange={(e) => setTargetWeightKg(e.target.value)}
              />
            </Field>
            <Field label={t("profile.height")}>
              <input
                className={inputClass}
                inputMode="decimal"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </Field>
            {message ? <p className="text-sm text-[#8a3b2f]">{message}</p> : null}
            <Button type="button" className="w-full" disabled={saving || !profile} onClick={save}>
              {saving ? t("saving") : t("profile.saveProfile")}
            </Button>
            <Button type="button" variant="secondary" className="w-full" disabled={saving} onClick={cancelEdit}>
              {t("profile.cancelEdit")}
            </Button>
          </>
        ) : (
          <div className="space-y-4 pr-10">
            <ReadonlyRow label={t("profile.name")} value={displayName} />
            <ReadonlyRow label={t("profile.calorieGoal")} value={displayGoal} />
            <ReadonlyRow label={t("profile.targetWeight")} value={displayWeight} />
            <ReadonlyRow label={t("profile.height")} value={displayHeight} />
          </div>
        )}

        <Button type="button" variant="ghost" className="w-full" onClick={logout}>
          {t("profile.signOut")}
        </Button>
      </Card>
    </Shell>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-sm text-[var(--muted)]">{label}</p>
      <p className="text-base font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function EditGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.5L19 9.5a2.1 2.1 0 0 0-3-3L5.5 17V20Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LangGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[var(--accent)]">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5S14.4 18 12 20.5C9.6 18 8.4 15.1 8.4 12S9.6 6.1 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
