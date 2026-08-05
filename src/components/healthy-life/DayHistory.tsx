"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDayLabel } from "@/lib/healthy-life/dates";
import { cacheKey, isCacheStale, readCache, writeCache } from "@/lib/healthy-life/app-cache";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useT } from "@/lib/healthy-life/i18n";
import { DayPanel, type DayPanelData } from "@/components/healthy-life/DayPanel";
import { MealDetailModal, type MealDetail } from "@/components/healthy-life/MealDetailModal";
import {
  MedicationDetailModal,
  type MedicationIntake,
} from "@/components/healthy-life/MedicationModals";
import { Button } from "@/components/healthy-life/ui";

type HistoryPage = {
  days: DayPanelData[];
  nextBefore: string | null;
};

const FIRST_PAGE_KEY = cacheKey("day-history", "first");

export function DayHistory({ onClose }: { onClose: () => void }) {
  const { fetch: hlFetch } = useHlRouting();
  const t = useT();
  const [days, setDays] = useState<DayPanelData[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealDetail | null>(null);
  const [selectedIntake, setSelectedIntake] = useState<MedicationIntake | null>(null);
  const dayEls = useRef<Map<number, HTMLElement | null>>(new Map());
  const loadingRef = useRef(false);
  const bootstrapped = useRef(false);

  const loadMore = useCallback(async (before?: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const q = before ? `?before=${before}&days=7` : "?days=7";
      const res = await hlFetch(`/api/day-history${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("error"));
      const batch = (data.days || []) as DayPanelData[];
      const next = (data.nextBefore || null) as string | null;
      setDays((prev) => {
        const seen = new Set(prev.map((d) => d.date));
        return [...prev, ...batch.filter((d) => !seen.has(d.date))];
      });
      setNextBefore(next);
      if (!before) {
        writeCache(FIRST_PAGE_KEY, { days: batch, nextBefore: next } satisfies HistoryPage);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hlFetch, t]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const cached = readCache<HistoryPage>(FIRST_PAGE_KEY);
    if (cached) {
      setDays(cached.data.days);
      setNextBefore(cached.data.nextBefore);
      if (!isCacheStale(cached)) return;
    }
    loadMore();
  }, [loadMore]);

  // Load next batch when the 5th day of the latest group scrolls into view (indices 4, 11, 18…).
  useEffect(() => {
    if (!nextBefore || loading || days.length < 5) return;
    const batchStart = Math.floor((days.length - 1) / 7) * 7;
    const triggerIndex = batchStart + 4;
    const el = dayEls.current.get(triggerIndex);
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMore(nextBefore);
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [days.length, nextBefore, loading, loadMore]);

  return (
    <div className="space-y-4 animate-rise">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{t("day.historyTitle")}</h2>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("backToToday")}
        </Button>
      </div>
      <p className="text-sm text-[var(--muted)]">{t("day.historyHint")}</p>

      {error ? <p className="text-sm text-[#8a3b2f]">{error}</p> : null}

      {days.map((day, index) => (
        <section
          key={day.date}
          ref={(el) => {
            dayEls.current.set(index, el);
          }}
          className="space-y-3 border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0"
        >
          <h3 className="font-display text-xl capitalize">{formatDayLabel(day.date)}</h3>
          <DayPanel
            data={day}
            readOnly
            onMealClick={setSelectedMeal}
            onIntakeClick={setSelectedIntake}
          />
        </section>
      ))}

      {loading ? <p className="py-4 text-center text-sm text-[var(--muted)]">{t("day.loadingMore")}</p> : null}
      {!loading && nextBefore && days.length > 0 ? (
        <Button type="button" variant="secondary" className="w-full" onClick={() => loadMore(nextBefore)}>
          {t("day.loadMore")}
        </Button>
      ) : null}
      {!loading && days.length === 0 ? (
        <p className="text-[var(--muted)]">{t("day.historyEmpty")}</p>
      ) : null}

      <MealDetailModal
        meal={selectedMeal}
        readOnly
        onClose={() => setSelectedMeal(null)}
        onSaved={() => {}}
        onDeleted={() => {}}
      />
      <MedicationDetailModal
        intake={selectedIntake}
        readOnly
        onClose={() => setSelectedIntake(null)}
        onChanged={() => {}}
      />
    </div>
  );
}
