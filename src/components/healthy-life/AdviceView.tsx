"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cacheKey,
  isCacheStale,
  readCache,
  writeCache,
} from "@/lib/healthy-life/app-cache";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useHlI18n, useT } from "@/lib/healthy-life/i18n";
import type { HlMessageKey } from "@/lib/healthy-life/i18n";
import { Button, Card, LoadingText, PageHeader, Shell } from "@/components/healthy-life/ui";

type Period = "day" | "week" | "month";

type AdvicePayload = {
  advice: {
    title: string;
    summary: string | null;
    content: string;
    periodKey: string;
  } | null;
  empty?: boolean;
  periodLabel: string;
  currentPeriodLabel?: string;
  periodStatus?: string;
  cached?: boolean;
  stats?: {
    totalCalories: number;
    mealCount: number;
    avgCaloriesPerDay: number;
    weightStart: number | null;
    weightEnd: number | null;
  };
};

const tabs: { id: Period; labelKey: HlMessageKey }[] = [
  { id: "day", labelKey: "advice.day" },
  { id: "week", labelKey: "advice.week" },
  { id: "month", labelKey: "advice.month" },
];

function adviceCacheKey(period: Period, locale: string) {
  return cacheKey("advice", period, locale);
}

function waitingKey(period: Period): HlMessageKey {
  if (period === "week") return "advice.waitingWeek";
  if (period === "month") return "advice.waitingMonth";
  return "advice.waitingDay";
}

export function AdviceView() {
  const { fetch: hlFetch } = useHlRouting();
  const { locale } = useHlI18n();
  const t = useT();
  const [period, setPeriod] = useState<Period>("day");
  const [data, setData] = useState<AdvicePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrevious, setShowPrevious] = useState(true);
  const fetchGen = useRef(0);

  const load = useCallback(async (p: Period, refresh = false) => {
    const key = adviceCacheKey(p, locale);
    const cached = !refresh ? readCache<AdvicePayload>(key) : null;
    if (cached) {
      setData(cached.data);
      setLoading(false);
      setError(null);
      if (!isCacheStale(cached) && !refresh) {
        setRefreshing(false);
        return;
      }
    }

    setRefreshing(true);
    setError(null);
    const gen = ++fetchGen.current;

    try {
      const res = await hlFetch(
        `/api/advice?period=${p}&locale=${locale}${refresh ? "&refresh=1" : ""}`,
      );
      if (gen !== fetchGen.current) return;
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t("error"));
      setData(json);
      writeCache(key, json as AdvicePayload);
    } catch (e) {
      if (gen !== fetchGen.current) return;
      if (!cached) {
        setData(null);
        setError(e instanceof Error ? e.message : t("error"));
      }
    } finally {
      if (gen === fetchGen.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [hlFetch, locale, t]);

  useEffect(() => {
    load(period);
  }, [period, load]);

  const hasAdvice = Boolean(data?.advice);
  const showRetry = Boolean(!loading && !refreshing && !data && error);

  return (
    <Shell>
      <PageHeader title={t("advice.title")} subtitle={t("advice.subtitle")} />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setPeriod(tab.id);
              setShowPrevious(true);
              const cached = readCache<AdvicePayload>(adviceCacheKey(tab.id, locale));
              if (cached) setData(cached.data);
            }}
            className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
              period === tab.id
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {loading && !data ? <LoadingText label={t("loading")} /> : null}
      {error && !data ? <p className="mb-3 text-center text-sm text-[#8a3b2f]">{error}</p> : null}
      {refreshing && data ? (
        <p className="mb-2 text-center text-xs text-[var(--muted)]">{t("day.updating")}</p>
      ) : null}

      {data ? (
        <div
          className={`space-y-4 transition-opacity ${refreshing ? "opacity-70" : "opacity-100"}`}
        >
          <Card className="space-y-2 bg-gradient-to-br from-[#eaf3e8] to-[var(--surface)]">
            <p className="text-xs tracking-wide text-[var(--muted)] uppercase">
              {data.currentPeriodLabel || t(tabs.find((x) => x.id === period)!.labelKey)}
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--ink)]">{t(waitingKey(period))}</p>
          </Card>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => setShowPrevious((v) => !v)}
          >
            {showPrevious ? t("advice.hidePrevious") : t("advice.showPrevious")}
          </Button>

          {showPrevious ? (
            hasAdvice ? (
              <div className="space-y-4">
                {data.stats ? (
                  <Card className="grid grid-cols-2 gap-3">
                    <Stat
                      label={t("advice.day")}
                      value={`${data.stats.avgCaloriesPerDay} ${t("day.kcal")}`}
                    />
                    <Stat label={t("day.mealsTitle")} value={String(data.stats.mealCount)} />
                    <Stat
                      label={t("day.kcal")}
                      value={String(Math.round(data.stats.totalCalories))}
                    />
                    <Stat
                      label={t("day.weight")}
                      value={
                        data.stats.weightEnd != null
                          ? `${data.stats.weightEnd.toFixed(1)} ${t("day.kg")}`
                          : "—"
                      }
                    />
                  </Card>
                ) : null}

                <Card className="space-y-3">
                  <p className="text-xs tracking-wide text-[var(--muted)] uppercase">
                    {t("advice.previousTitle")} · {data.periodLabel}
                  </p>
                  <h2 className="font-display text-2xl">{data.advice!.title}</h2>
                  {data.advice!.summary ? (
                    <p className="text-[var(--accent-ink)]">{data.advice!.summary}</p>
                  ) : null}
                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]/90">
                    {data.advice!.content}
                  </div>
                </Card>
              </div>
            ) : (
              <Card>
                <p className="text-sm text-[var(--muted)]">{t("advice.noPrevious")}</p>
              </Card>
            )
          ) : null}
        </div>
      ) : null}

      {showRetry ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => load(period, true)}
        >
          {t("advice.refresh")}
        </Button>
      ) : null}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-display text-xl">{value}</p>
    </div>
  );
}
