"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  AppCard,
  AppShell,
  PageHeaderWithBack,
  ListLoading,
} from "@/components/ui/app-shell";

type DetailResponse = {
  auth: {
    id: string;
    email: string | null;
    phone: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
    confirmedAt: string | null;
    userMetadata: Record<string, unknown>;
  };
  profile: {
    id: string;
    name: string;
    dailyCalorieGoal: number;
    targetWeightKg: number | null;
    heightCm: number | null;
    createdAt: string;
    updatedAt: string;
    _count: {
      meals: number;
      weights: number;
      workouts: number;
      medicationPlans: number;
      medicationIntakes: number;
      advice: number;
      aiRecords: number;
    };
    meals: Array<Record<string, unknown>>;
    weights: Array<Record<string, unknown>>;
    workouts: Array<Record<string, unknown>>;
    medicationPlans: Array<Record<string, unknown>>;
    medicationIntakes: Array<Record<string, unknown>>;
    advice: Array<Record<string, unknown>>;
    aiRecords: Array<Record<string, unknown>>;
  } | null;
};

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(locale === "en" ? "en-US" : locale === "kk" ? "kk-KZ" : "ru-RU");
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-slate-100 pt-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-800/90">
        {title} ({count})
      </h2>
      {children}
    </section>
  );
}

function JsonTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">—</p>;
  }

  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-slate-100">
      <table className="min-w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            {Object.keys(rows[0]).map((key) => (
              <th key={key} className="whitespace-nowrap px-2 py-2 font-semibold text-slate-600">
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100 align-top">
              {Object.values(row).map((value, cellIndex) => (
                <td key={cellIndex} className="max-w-xs break-words px-2 py-2 text-slate-700">
                  {value == null
                    ? "—"
                    : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HealthyLifeUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { t, locale } = useLocaleContext();
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError("");
    void trackedFetch(`/api/super-admin/healthy-life/users/${userId}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? t("super.healthyLife.loadError"));
          setDetail(null);
          return;
        }
        setDetail(json as DetailResponse);
      })
      .catch(() => {
        setError(t("super.healthyLife.networkError"));
        setDetail(null);
      })
      .finally(() => setLoading(false));
  }, [userId, t]);

  const login = detail?.auth.email ?? detail?.auth.phone ?? "—";

  return (
    <AppShell maxWidth="max-w-6xl">
      <PageHeaderWithBack
        backHref="/super-admin/healthy-life/users"
        backLabel={t("super.healthyLife.backToList")}
        title={t("super.healthyLife.detailTitle")}
      />

      {loading ? (
        <AppCard>
          <ListLoading label={t("common.loading")} className="py-8" />
        </AppCard>
      ) : error ? (
        <AppCard>
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        </AppCard>
      ) : detail ? (
        <>
          <AppCard title={t("super.healthyLife.sectionAuth")}>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">{t("super.healthyLife.fieldLogin")}</dt>
                <dd className="mt-1 font-medium text-slate-900">{login}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">{t("super.healthyLife.fieldUserId")}</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-800">{detail.auth.id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">{t("super.healthyLife.fieldRegistered")}</dt>
                <dd className="mt-1 text-slate-800">{formatDate(detail.auth.createdAt, locale)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">{t("super.healthyLife.fieldLastSignIn")}</dt>
                <dd className="mt-1 text-slate-800">{formatDate(detail.auth.lastSignInAt, locale)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">{t("super.healthyLife.fieldConfirmed")}</dt>
                <dd className="mt-1 text-slate-800">{formatDate(detail.auth.confirmedAt, locale)}</dd>
              </div>
            </dl>
            {Object.keys(detail.auth.userMetadata).length > 0 ? (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {t("super.healthyLife.fieldMetadata")}
                </p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  {JSON.stringify(detail.auth.userMetadata, null, 2)}
                </pre>
              </div>
            ) : null}
          </AppCard>

          <AppCard className="mt-4" title={t("super.healthyLife.sectionProfile")}>
            {!detail.profile ? (
              <p className="text-sm text-slate-600">{t("super.healthyLife.noProfile")}</p>
            ) : (
              <>
                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{t("super.healthyLife.fieldName")}</dt>
                    <dd className="mt-1 font-medium text-slate-900">{detail.profile.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {t("super.healthyLife.fieldCalorieGoal")}
                    </dt>
                    <dd className="mt-1 text-slate-800">{detail.profile.dailyCalorieGoal}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {t("super.healthyLife.fieldTargetWeight")}
                    </dt>
                    <dd className="mt-1 text-slate-800">{detail.profile.targetWeightKg ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {t("super.healthyLife.fieldHeight")}
                    </dt>
                    <dd className="mt-1 text-slate-800">{detail.profile.heightCm ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {t("super.healthyLife.fieldProfileCreated")}
                    </dt>
                    <dd className="mt-1 text-slate-800">{formatDate(detail.profile.createdAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {t("super.healthyLife.fieldProfileUpdated")}
                    </dt>
                    <dd className="mt-1 text-slate-800">{formatDate(detail.profile.updatedAt, locale)}</dd>
                  </div>
                </dl>

                <Section title={t("super.healthyLife.sectionMeals")} count={detail.profile._count.meals}>
                  <JsonTable rows={detail.profile.meals} />
                </Section>
                <Section title={t("super.healthyLife.sectionWeights")} count={detail.profile._count.weights}>
                  <JsonTable rows={detail.profile.weights} />
                </Section>
                <Section title={t("super.healthyLife.sectionWorkouts")} count={detail.profile._count.workouts}>
                  <JsonTable rows={detail.profile.workouts} />
                </Section>
                <Section
                  title={t("super.healthyLife.sectionMedicationPlans")}
                  count={detail.profile._count.medicationPlans}
                >
                  <JsonTable rows={detail.profile.medicationPlans} />
                </Section>
                <Section
                  title={t("super.healthyLife.sectionMedicationIntakes")}
                  count={detail.profile._count.medicationIntakes}
                >
                  <JsonTable rows={detail.profile.medicationIntakes} />
                </Section>
                <Section title={t("super.healthyLife.sectionAdvice")} count={detail.profile._count.advice}>
                  <JsonTable rows={detail.profile.advice} />
                </Section>
                <Section title={t("super.healthyLife.sectionAiRecords")} count={detail.profile._count.aiRecords}>
                  <JsonTable rows={detail.profile.aiRecords} />
                </Section>
              </>
            )}
          </AppCard>
        </>
      ) : (
        <AppCard>
          <p className="text-sm text-slate-600">{t("super.healthyLife.userNotFound")}</p>
          <Link
            href="/super-admin/healthy-life/users"
            className="mt-3 inline-block text-sm text-teal-700"
          >
            {t("super.healthyLife.backToList")}
          </Link>
        </AppCard>
      )}
    </AppShell>
  );
}
